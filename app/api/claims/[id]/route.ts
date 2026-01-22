/**
 * API routes for individual claims
 * GET /api/claims/[id] - Get claim details (VIEWER+)
 * PATCH /api/claims/[id] - Update claim (OPERATOR+)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { parseClaimCode } from "@/lib/domain/claimCode";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/realtime/pusher";
import { logActivityFromRequest } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // VIEWER+ can read claims
    await requirePermission(PERMISSIONS.CLAIMS_READ);
    
    const { id } = await params;
    console.log(`[GET /api/claims/${id}] Fetching claim with ID: ${id}`);

    // Base include options (without faultDepartments)
    const baseInclude = {
      customer: true,
      faultDepartment: true,
      workOrder: {
        include: {
          worker: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      emailThreads: {
        include: {
          messages: {
            include: {
              attachments: true,
            },
            orderBy: {
              date: "asc" as const,
            },
          },
        },
        orderBy: {
          createdAt: "desc" as const,
        },
      },
      attachments: true,
      clientDocuments: {
        include: {
          attachment: true,
        },
      },
      photos: {
        include: {
          attachment: true,
        },
        orderBy: {
          indexNo: "asc" as const,
        },
      },
      reportSections: {
        orderBy: {
          orderIndex: "asc" as const,
        },
      },
    };

    // Try to fetch claim - first with faultDepartments, fallback without
    let claim = null;
    
    try {
      claim = await prisma.claim.findUnique({
        where: { id },
        include: {
          ...baseInclude,
          faultDepartments: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (faultDeptError) {
      console.warn(`[GET /api/claims/${id}] faultDepartments include failed, trying without:`, faultDeptError);
      // Fallback without faultDepartments
      claim = await prisma.claim.findUnique({
        where: { id },
        include: baseInclude,
      });
    }

    if (!claim) {
      console.log(`[GET /api/claims/${id}] Claim not found in database`);
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Explicitly fetch claimAcceptanceStatus from DB to ensure we get the latest value
    const statusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
      `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
      id
    );
    if (statusResult && statusResult.length > 0) {
      (claim as any).claimAcceptanceStatus = statusResult[0].claimAcceptanceStatus;
    }

    console.log(`[GET /api/claims/${id}] Successfully fetched claim`);
    return NextResponse.json({ claim });
  } catch (error) {
    console.error("Error fetching claim:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch claim" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const prisma = await getPrisma();
    // OPERATOR+ can update claims
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);
    
    const body = await request.json();

    console.log(`[PATCH /api/claims/${id}] Updating claim with data:`, JSON.stringify(body, null, 2));

    // Dohvati postojeću reklamaciju da proverimo da li je claimCodeRaw prvi put setovan
    const existingClaim = await prisma.claim.findUnique({
      where: { id },
      include: {
        customer: true,
        emailThreads: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!existingClaim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Check if claim is locked (SUPER_ADMIN can always edit, regardless of lock status)
    // Lock is used by SUPER_ADMIN to control whether OTHER users can edit
    const { isSuperAdmin } = await import("@/lib/auth/permissions");
    const userIsSuperAdmin = await isSuperAdmin();
    
    if (!userIsSuperAdmin) {
      // For non-SUPER_ADMIN users, check if claim is locked
      const isClaimLocked = existingClaim.isLocked === true || 
                           (existingClaim.status === "CLOSED" && existingClaim.isLocked !== false);
      
      if (isClaimLocked) {
        return NextResponse.json(
          { error: "Claim is locked and cannot be edited. Please contact a super admin to unlock it." },
          { status: 403 }
        );
      }
    }

    // If claimCodeRaw is being updated, parse it
    // If claimPrefix is being updated separately, allow it
    const updateData: any = { ...body };
    if (body.claimCodeRaw !== undefined) {
      const parsed = parseClaimCode(body.claimCodeRaw);
      updateData.claimCodeRaw = parsed.raw;
      updateData.claimPrefix = parsed.prefix;
      updateData.claimNumber = parsed.number;
      updateData.claimYear = parsed.year;

      // Proveri da li je ovo prvi put da se unosi claim code
      const wasEmpty = !existingClaim.claimCodeRaw || existingClaim.claimCodeRaw.trim() === '';
      const isNowFilled = parsed.raw && parsed.raw.trim() !== '';
      
      if (wasEmpty && isNowFilled) {
        // Automatski promeni status na IN_ANALYSIS ako je trenutno NEW
        if (existingClaim.status === 'NEW') {
          updateData.status = 'IN_ANALYSIS';
          console.log(`[PATCH /api/claims/${id}] Auto-changing status from NEW to IN_ANALYSIS`);
        }
      }
    } else if (body.claimPrefix !== undefined) {
      // Allow direct prefix update
      updateData.claimPrefix = body.claimPrefix;
    }

    // Handle assignedToName - find existing user by name ONLY (do NOT create new users)
    // assignedTo represents the worker who built the engine, not a new application user
    // Users are created ONLY when they log in via Auth0, not from metadata
    if (body.assignedToName !== undefined) {
      if (body.assignedToName.trim()) {
        // Find existing user by name - do NOT create if not found
        const user = await prisma.user.findFirst({
          where: { fullName: body.assignedToName.trim() },
        });
        
        if (user) {
          updateData.assignedToId = user.id;
        } else {
          // User doesn't exist - clear assignedTo (don't create fake users from metadata)
          updateData.assignedToId = null;
          console.warn(`[PATCH /api/claims/${id}] User with name "${body.assignedToName.trim()}" not found. assignedTo cleared. Users are created only via Auth0 login.`);
        }
      } else {
        // Clear assignedTo if name is empty
        updateData.assignedToId = null;
      }
      delete updateData.assignedToName;
    }

    // Remove undefined values, but keep null values (for clearing fields)
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Auto-lock claim when status becomes APPROVED or REJECTED
    if (updateData.status === "APPROVED" || updateData.status === "REJECTED") {
      updateData.isLocked = true;
      console.log(`[PATCH /api/claims/${id}] Auto-locking claim due to status change to ${updateData.status}`);
    }

    // Ensure claimAcceptanceStatus is properly handled (can be null to clear it)
    if (body.claimAcceptanceStatus === null || body.claimAcceptanceStatus === "") {
      updateData.claimAcceptanceStatus = null;
    }

    console.log(`[PATCH /api/claims/${id}] Final updateData:`, JSON.stringify(updateData, null, 2));

    // Handle claimAcceptanceStatus update - use raw SQL to ensure it's saved
    const acceptanceStatus = updateData.claimAcceptanceStatus;
    if (acceptanceStatus !== undefined) {
      console.log(`[PATCH /api/claims/${id}] Updating claimAcceptanceStatus using raw SQL:`, acceptanceStatus);
      delete updateData.claimAcceptanceStatus;
      
      // Use raw SQL to update claimAcceptanceStatus
      if (acceptanceStatus === null) {
        await prisma.$executeRawUnsafe(
          `UPDATE Claim SET claimAcceptanceStatus = NULL, updatedAt = datetime('now') WHERE id = ?`,
          id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE Claim SET claimAcceptanceStatus = ?, updatedAt = datetime('now') WHERE id = ?`,
          acceptanceStatus,
          id
        );
      }
      
      // Verify it was saved
      const verifyResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
        `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
        id
      );
      console.log(`[PATCH /api/claims/${id}] Verified claimAcceptanceStatus saved:`, verifyResult[0]?.claimAcceptanceStatus);
    }

    // Handle multiple fault departments update
    if (body.faultDepartmentIds !== undefined) {
      const departmentIds = Array.isArray(body.faultDepartmentIds) ? body.faultDepartmentIds : [];
      // Connect/disconnect departments (wrapped in try-catch in case junction table doesn't exist)
      try {
        await prisma.claim.update({
          where: { id },
          data: {
            faultDepartments: {
              set: departmentIds.map((deptId: string) => ({ id: deptId })),
            },
          },
        });
      } catch (faultDeptError) {
        console.warn(`[PATCH /api/claims/${id}] Failed to update faultDepartments:`, faultDeptError);
        // Continue without failing - the junction table might not exist yet
      }
      delete updateData.faultDepartmentIds;
    }

    // Base include options for responses
    const baseResponseInclude = {
      customer: true,
      faultDepartment: true,
      workOrder: {
        include: {
          worker: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      emailThreads: {
        include: {
          messages: {
            include: {
              attachments: true,
            },
            orderBy: {
              date: "asc" as const,
            },
          },
        },
        orderBy: {
          createdAt: "desc" as const,
        },
      },
      attachments: true,
      clientDocuments: {
        include: {
          attachment: true,
        },
      },
      photos: {
        include: {
          attachment: true,
        },
        orderBy: {
          indexNo: "asc" as const,
        },
      },
      reportSections: {
        orderBy: {
          orderIndex: "asc" as const,
        },
      },
    };

    // Update other fields using Prisma if needed
    let claim;
    if (Object.keys(updateData).length > 0) {
      try {
        // Try to include faultDepartments, fallback without if table doesn't exist
        try {
          claim = await prisma.claim.update({
            where: { id },
            data: updateData as any,
            include: {
              ...baseResponseInclude,
              faultDepartments: {
                select: { id: true, name: true },
              },
            },
          });
        } catch (includeError) {
          console.warn(`[PATCH /api/claims/${id}] faultDepartments include failed, trying without`);
          claim = await prisma.claim.update({
            where: { id },
            data: updateData as any,
            include: baseResponseInclude,
          });
        }
      } catch (error) {
        // If Prisma update fails (e.g., type issues), use raw SQL as fallback
        console.log(`[PATCH /api/claims/${id}] Prisma update failed, using raw SQL fallback:`, error);
        if (acceptanceStatus !== undefined) {
          if (acceptanceStatus === null) {
            await prisma.$executeRawUnsafe(
              `UPDATE Claim SET claimAcceptanceStatus = NULL, updatedAt = datetime('now') WHERE id = ?`,
              id
            );
          } else {
            await prisma.$executeRawUnsafe(
              `UPDATE Claim SET claimAcceptanceStatus = ?, updatedAt = datetime('now') WHERE id = ?`,
              acceptanceStatus,
              id
            );
          }
        }
        // Fetch claim after raw SQL update - try with faultDepartments
        try {
          claim = await prisma.claim.findUnique({
            where: { id },
            include: {
              ...baseResponseInclude,
              faultDepartments: { select: { id: true, name: true } },
            },
          });
        } catch {
          claim = await prisma.claim.findUnique({
            where: { id },
            include: baseResponseInclude,
          });
        }
        // Manually set claimAcceptanceStatus from raw query
        if (claim && acceptanceStatus !== undefined) {
          (claim as any).claimAcceptanceStatus = acceptanceStatus;
        }
      }
    } else {
      // Only claimAcceptanceStatus was updated, fetch the claim - try with faultDepartments
      try {
        claim = await prisma.claim.findUnique({
          where: { id },
          include: {
            ...baseResponseInclude,
            faultDepartments: { select: { id: true, name: true } },
          },
        });
      } catch {
        claim = await prisma.claim.findUnique({
          where: { id },
          include: baseResponseInclude,
        });
      }
      
      // Explicitly set claimAcceptanceStatus from the value we just saved
      if (claim && acceptanceStatus !== undefined) {
        (claim as any).claimAcceptanceStatus = acceptanceStatus;
        console.log(`[PATCH /api/claims/${id}] Manually set claimAcceptanceStatus to:`, acceptanceStatus);
      }
    }
    
    // Always explicitly fetch claimAcceptanceStatus to ensure it's included in response
    if (claim) {
      const statusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
        `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
        id
      );
      if (statusResult && statusResult.length > 0) {
        (claim as any).claimAcceptanceStatus = statusResult[0].claimAcceptanceStatus;
      }
    }

    console.log(`[PATCH /api/claims/${id}] Final claim.claimAcceptanceStatus:`, claim?.claimAcceptanceStatus);
    console.log(`[PATCH /api/claims/${id}] Successfully updated claim. claimAcceptanceStatus:`, claim?.claimAcceptanceStatus);
    
    // Trigger real-time event (non-blocking)
    triggerEvent(CHANNELS.CLAIMS, EVENTS.CLAIM_UPDATED, {
      claimId: claim?.id,
      claimCode: claim?.claimCodeRaw,
      status: claim?.status,
    }).catch(console.error);
    
    // Log activity (non-blocking)
    logActivityFromRequest(request, {
      action: "UPDATE",
      entityType: "CLAIM",
      entityId: claim?.id || id,
      entityName: claim?.claimCodeRaw || "Reklamacija",
      details: {
        updatedFields: Object.keys(body),
        newStatus: claim?.status,
      },
    }).catch(console.error);
    
    return NextResponse.json({ claim });
  } catch (error) {
    console.error(`[PATCH /api/claims/${id}] Error updating claim:`, error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[PATCH /api/claims/${id}] Error details:`, { errorMessage, errorStack });
    return NextResponse.json(
      { error: `Failed to update claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}

