/**
 * API routes for individual claims
 * GET /api/claims/[id] - Get claim details
 * PATCH /api/claims/[id] - Update claim
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseClaimCode } from "@/lib/domain/claimCode";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[GET /api/claims/${id}] Fetching claim with ID: ${id} (type: ${typeof id})`);

    // First, check if claim exists at all
    const claimExists = await prisma.claim.findUnique({
      where: { id },
      select: { id: true },
    });
    console.log(`[GET /api/claims/${id}] Claim exists check:`, claimExists ? `YES (found ID: ${claimExists.id})` : "NO");

    // Also try to list all claims to see what IDs exist
    const allClaims = await prisma.claim.findMany({
      select: { id: true, status: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    console.log(`[GET /api/claims/${id}] Recent claims in DB:`, allClaims.map((c: { id: string; status: string }) => ({ id: c.id, status: c.status })));

    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        customer: true,
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
                date: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
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
            indexNo: "asc",
          },
        },
        reportSections: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (!claim) {
      console.log(`[GET /api/claims/${id}] Claim not found in database`);
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Explicitly fetch claimAcceptanceStatus from DB to ensure we get the latest value
    // (Prisma might cache the value after raw SQL updates)
    const statusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
      `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
      id
    );
    if (statusResult && statusResult.length > 0) {
      (claim as any).claimAcceptanceStatus = statusResult[0].claimAcceptanceStatus;
      console.log(`[GET /api/claims/${id}] Fetched claimAcceptanceStatus from DB:`, statusResult[0].claimAcceptanceStatus);
    }

    console.log(`[GET /api/claims/${id}] Successfully fetched claim. claimAcceptanceStatus:`, claim.claimAcceptanceStatus);
    return NextResponse.json({ claim });
  } catch (error) {
    console.error("Error fetching claim:", error);
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
    const body = await request.json();

    console.log(`[PATCH /api/claims/${id}] Updating claim with data:`, JSON.stringify(body, null, 2));

    // If claimCodeRaw is being updated, parse it
    // If claimPrefix is being updated separately, allow it
    const updateData: any = { ...body };
    if (body.claimCodeRaw !== undefined) {
      const parsed = parseClaimCode(body.claimCodeRaw);
      updateData.claimCodeRaw = parsed.raw;
      updateData.claimPrefix = parsed.prefix;
      updateData.claimNumber = parsed.number;
      updateData.claimYear = parsed.year;
    } else if (body.claimPrefix !== undefined) {
      // Allow direct prefix update
      updateData.claimPrefix = body.claimPrefix;
    }

    // Handle assignedToName - create or find user by name
    if (body.assignedToName !== undefined) {
      if (body.assignedToName.trim()) {
        // Find or create user by name
        let user = await prisma.user.findFirst({
          where: { fullName: body.assignedToName.trim() },
        });
        
        if (!user) {
          // Create new user with just the name
          user = await prisma.user.create({
            data: {
              fullName: body.assignedToName.trim(),
              email: `${body.assignedToName.trim().toLowerCase().replace(/\s+/g, '.')}@mrgroup.rs`,
              role: "WORKER",
            },
          });
        }
        
        updateData.assignedToId = user.id;
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

    // Update other fields using Prisma if needed
    let claim;
    if (Object.keys(updateData).length > 0) {
      try {
        claim = await prisma.claim.update({
          where: { id },
          data: updateData as any,
          include: {
            customer: true,
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
                    date: "asc",
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
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
                indexNo: "asc",
              },
            },
            reportSections: {
              orderBy: {
                orderIndex: "asc",
              },
            },
          },
        });
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
        // Fetch claim after raw SQL update
        claim = await prisma.claim.findUnique({
          where: { id },
          include: {
            customer: true,
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
                    date: "asc",
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
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
                indexNo: "asc",
              },
            },
            reportSections: {
              orderBy: {
                orderIndex: "asc",
              },
            },
          },
        });
        // Manually set claimAcceptanceStatus from raw query
        if (claim && acceptanceStatus !== undefined) {
          (claim as any).claimAcceptanceStatus = acceptanceStatus;
        }
      }
    } else {
      // Only claimAcceptanceStatus was updated, fetch the claim and explicitly set the status
      claim = await prisma.claim.findUnique({
        where: { id },
        include: {
          customer: true,
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
                  date: "asc",
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
              indexNo: "asc",
            },
          },
          reportSections: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      });
      
      // Explicitly set claimAcceptanceStatus from the value we just saved
      if (claim && acceptanceStatus !== undefined) {
        (claim as any).claimAcceptanceStatus = acceptanceStatus;
        console.log(`[PATCH /api/claims/${id}] Manually set claimAcceptanceStatus to:`, acceptanceStatus);
      }
    }
    
    console.log(`[PATCH /api/claims/${id}] Final claim.claimAcceptanceStatus:`, claim?.claimAcceptanceStatus);

    console.log(`[PATCH /api/claims/${id}] Successfully updated claim. claimAcceptanceStatus:`, claim?.claimAcceptanceStatus);
    return NextResponse.json({ claim });
  } catch (error) {
    console.error(`[PATCH /api/claims/${id}] Error updating claim:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[PATCH /api/claims/${id}] Error details:`, { errorMessage, errorStack });
    return NextResponse.json(
      { error: `Failed to update claim: ${errorMessage}` },
      { status: 500 }
    );
  }
}

