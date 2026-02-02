/**
 * API routes for claims
 * GET /api/claims - List claims with filters (VIEWER+)
 * POST /api/claims - Create new claim (OPERATOR+)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { normalizeSerbianLatin } from "@/lib/utils/search";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createClaimFolder } from "@/lib/files/fileStorage";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/realtime/pusher";
import { logActivityFromRequest } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // VIEWER+ can read claims
    await requirePermission(PERMISSIONS.CLAIMS_READ);
    const searchParams = request.nextUrl.searchParams;
    const statusParams = searchParams.getAll("status"); // Get all status values for multi-select
    const claimCode = searchParams.get("claimCode");
    const customerName = searchParams.get("customerId"); // Keep param name for backward compatibility
    const urgentOnly = searchParams.get("urgentOnly") === "true";

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const where: any = {};
    // Handle multi-select status filter
    if (statusParams.length > 0) {
      // Separate status and acceptanceStatus filters
      const statusFilters = statusParams.filter(s => !["ACCEPTED", "REJECTED"].includes(s));
      const acceptanceFilters = statusParams.filter(s => ["ACCEPTED", "REJECTED"].includes(s));
      
      const orConditions: any[] = [];
      
      if (statusFilters.length > 0) {
        if (statusFilters.length === 1) {
          orConditions.push({ status: statusFilters[0] });
        } else {
          orConditions.push({ status: { in: statusFilters } });
        }
      }
      
      if (acceptanceFilters.length > 0) {
        acceptanceFilters.forEach(af => {
          orConditions.push({ claimAcceptanceStatus: af });
        });
      }
      
      if (orConditions.length > 0) {
        where.OR = orConditions;
      }
    }
    if (claimCode) {
      // Normalize Serbian Latin characters for search
      const normalizedClaimCode = normalizeSerbianLatin(claimCode);
      // SQLite doesn't support case-insensitive mode, so we'll use contains
      // We'll filter in memory for Serbian character support
      where.claimCodeRaw = {
        contains: claimCode, // Keep original for initial filter
      };
    }

    // If customer name is provided, first find customers matching the name
    let customerIds: string[] = [];
    if (customerName) {
      try {
        // Normalize search query for Serbian Latin support
        const normalizedCustomerName = normalizeSerbianLatin(customerName);
        
        // Fetch all customers and filter in memory for Serbian character support
        const allCustomers = await prisma.customer.findMany({
          select: {
            id: true,
            name: true,
          },
        });
        
        // Filter customers that match the normalized search
        customerIds = allCustomers
          .filter(c => normalizeSerbianLatin(c.name || "").includes(normalizedCustomerName))
          .map(c => c.id);
      } catch (error) {
        console.warn("Error searching customers:", error);
      }
    }

    // Add customer filter if we have customer IDs
    if (customerIds.length > 0) {
      where.customerId = {
        in: customerIds,
      };
    } else if (customerName) {
      // If customer name provided but no matches found, return empty results
      where.customerId = {
        in: [],
      };
    }

    // Urgent only: NEW or IN_ANALYSIS older than 7 days
    if (urgentOnly) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      (where as any) = {
        AND: [
          { ...where },
          { status: { in: ["NEW", "IN_ANALYSIS"] } },
          { createdAt: { lt: sevenDaysAgo } },
        ],
      };
    }

    // For search queries with Serbian characters, we need to fetch all and filter in memory
    // Then apply pagination manually
    const needsMemoryFilter = !!claimCode;
    
    let claims;
    let total;
    
    if (needsMemoryFilter) {
      // Fetch all matching claims for memory filtering
      let allClaims = await prisma.claim.findMany({
        where,
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Apply Serbian Latin normalization filter for claimCode
      const normalizedClaimCode = normalizeSerbianLatin(claimCode);
      allClaims = allClaims.filter(claim => 
        normalizeSerbianLatin(claim.claimCodeRaw || "").includes(normalizedClaimCode)
      );
      
      total = allClaims.length;
      // Apply pagination manually
      claims = allClaims.slice(offset, offset + limit);
    } else {
      // Use database pagination
      [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          include: {
            customer: true,
            assignedTo: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: offset,
          take: limit,
        }),
        prisma.claim.count({ where }),
      ]);
    }

    // If claimAcceptanceStatus is not being returned, explicitly fetch it using raw query
    for (const claim of claims) {
      if (claim.claimAcceptanceStatus === undefined) {
        const statusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
          `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
          claim.id
        );
        if (statusResult && statusResult.length > 0) {
          (claim as any).claimAcceptanceStatus = statusResult[0].claimAcceptanceStatus;
        }
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ 
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });
  } catch (error) {
    console.error("Error fetching claims:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // OPERATOR+ can create claims
    await requirePermission(PERMISSIONS.CLAIMS_CREATE);

    const body = await request.json();
    console.log("[create-claim] Creating new claim with data:", {
      emailThreadId: body.emailThreadId,
      status: body.status,
      customerId: body.customerId,
    });
    
    // If creating from email thread, link the thread to the claim
    const emailThreadId = body.emailThreadId;
    
    // Validate required fields for new claims (if not from email thread)
    if (!body.emailThreadId) {
      if (!body.claimCodeRaw) {
        return NextResponse.json(
          { error: "MR Number is required" },
          { status: 400 }
        );
      }
      if (!body.engineType) {
        return NextResponse.json(
          { error: "Engine Type is required" },
          { status: 400 }
        );
      }
    }

    // Create customer if customerName or customerCompany is provided
    let customerId = body.customerId;
    if (!customerId && (body.customerCompany || body.customerName)) {
      const customer = await prisma.customer.create({
        data: {
          company: body.customerCompany?.trim() || null,
          name: body.customerName?.trim() || null,
        },
      });
      customerId = customer.id;
    }

    const claim = await prisma.claim.create({
      data: {
        status: body.status || "NEW",
        claimCodeRaw: body.claimCodeRaw,
        customerId: customerId,
        customerNumber: body.customerNumber || null,
        workOrderId: body.workOrderId,
        engineType: body.engineType,
        mrEngineCode: body.mrEngineCode || null,
        assignedToId: body.assignedToId,
        faultDepartmentId: body.faultDepartmentId,
        workerFault: body.workerFault,
        yearEngineDone: body.yearEngineDone ? parseInt(body.yearEngineDone, 10) : null,
        dateEngineDone: body.dateEngineDone ? new Date(body.dateEngineDone) : null,
        claimArrivalDate: new Date(), // Set claim arrival date to now
        reason: body.reason,
        isDomesticMarket: body.isDomesticMarket || false,
        summarySr: body.summarySr,
      },
      include: {
        customer: true,
        faultDepartment: true,
        workOrder: true,
        assignedTo: true,
      },
    });

    // If initialFinding is provided, create a finding/report section
    if (body.initialFinding && body.initialFinding.trim()) {
      await prisma.reportSection.create({
        data: {
          claimId: claim.id,
          sectionType: "FINDINGS",
          textSr: body.initialFinding.trim(),
          orderIndex: 0,
        },
      });
      console.log(`[create-claim] Created initial finding for claim ${claim.id}`);
    }
    
    console.log(`[create-claim] Created claim with ID: ${claim.id} (type: ${typeof claim.id})`);
    
    // Create folder structure on Synology/NAS asynchronously (don't block response)
    // This will be done in the background after we return the claim
    createClaimFolder(claim)
      .then((folderPath) => {
        if (folderPath) {
          console.log(`[create-claim] Created Synology folder: ${folderPath}`);
          // Update claim with server folder path
          return prisma.claim.update({
            where: { id: claim.id },
            data: { serverFolderPath: folderPath },
          });
        }
      })
      .catch((folderError) => {
        console.error(`[create-claim] Error creating Synology folder:`, folderError);
        // Don't fail the claim creation if folder creation fails
      });

    // Link email thread to claim if provided and process attachments
    let photosCreated = 0;
    let documentsCreated = 0;
    const attachmentErrors: Array<{ attachmentId: string; error: string }> = [];

    if (emailThreadId) {
      await prisma.emailThread.update({
        where: { id: emailThreadId },
        data: { claimId: claim.id },
      });

      // Get thread with all messages and attachments
      const thread = await prisma.emailThread.findUnique({
        where: { id: emailThreadId },
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
      });

      if (thread) {
        // Auto-populate summarySr from first email bodyText if not provided
        if (!body.summarySr && thread.messages.length > 0) {
          const firstMessage = thread.messages[0];
          // Use getCleanEmailBody to properly extract and clean email body text
          const { getCleanEmailBody } = await import("@/lib/email/emailBodyCleaner");
          const emailBody = getCleanEmailBody({
            bodyText: firstMessage.bodyText,
            bodyHtml: firstMessage.bodyHtml,
          });
          
          if (emailBody) {
            // Update claim with summary from email
            await prisma.claim.update({
              where: { id: claim.id },
              data: { summarySr: emailBody.substring(0, 5000) }, // Limit to 5000 chars
            });
            console.log(`[create-claim] Auto-populated summarySr from email body (${emailBody.length} chars)`);
          }
        }

        // Process all attachments from the thread
        const allAttachments = thread.messages.flatMap((msg) => msg.attachments || []);

        console.log(`[create-claim] Processing ${allAttachments.length} attachments for new claim ${claim.id}`);

        for (const attachment of allAttachments) {
          try {
            // Skip if already linked to a different claim
            if (attachment.claimId && attachment.claimId !== claim.id) {
              console.log(`[create-claim] Skipping attachment ${attachment.id} - already linked to different claim`);
              continue;
            }

            // Check if photo or document already exists
            const existingPhoto = await prisma.photo.findFirst({
              where: { attachmentId: attachment.id },
            });
            const existingDoc = await prisma.clientDocument.findFirst({
              where: { attachmentId: attachment.id },
            });

            if (existingPhoto || existingDoc) {
              console.log(`[create-claim] Skipping attachment ${attachment.id} - already has photo/document`);
              continue;
            }

            // Link attachment to claim if not already linked
            if (!attachment.claimId) {
              await prisma.attachment.update({
                where: { id: attachment.id },
                data: { claimId: claim.id },
              });
              console.log(`[create-claim] Linked attachment ${attachment.id} to claim ${claim.id}`);
            }

            const isImage = attachment.mimeType.startsWith("image/");
            const isPdf = attachment.mimeType === "application/pdf";
            const isDocx = attachment.mimeType.includes("wordprocessingml") || 
                           attachment.mimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                           attachment.fileName.toLowerCase().endsWith(".docx");

            console.log(`[create-claim] Attachment ${attachment.id}: isImage=${isImage}, isPdf=${isPdf}, isDocx=${isDocx}, isProbablyLogo=${attachment.isProbablyLogo}, isRelevant=${attachment.isRelevant}`);

            // Create Photo for images (skip logos)
            if (isImage) {
              if (attachment.isProbablyLogo) {
                console.log(`[create-claim] Skipping logo image ${attachment.id}`);
              } else {
                // Check if photo already exists for this attachment
                const existingPhoto = await prisma.photo.findUnique({
                  where: { attachmentId: attachment.id },
                });
                
                if (!existingPhoto) {
                  await prisma.photo.create({
                    data: {
                      claimId: claim.id,
                      attachmentId: attachment.id,
                      internalUpload: false,
                    },
                  });
                  photosCreated++;
                  console.log(`[create-claim] Created photo for attachment ${attachment.id}`);
                } else {
                  console.log(`[create-claim] Photo already exists for attachment ${attachment.id}, skipping`);
                }
              }
            }

            // Create ClientDocument for PDFs and DOCX files
            if (isPdf || isDocx) {
              await prisma.clientDocument.create({
                data: {
                  claimId: claim.id,
                  attachmentId: attachment.id,
                  textOriginal: attachment.textOriginal || "",
                  originalLanguage: "SR", // Default, can be detected later
                },
              });
              documentsCreated++;
              console.log(`[create-claim] Created document for attachment ${attachment.id}`);
            }
          } catch (attachmentError) {
            console.error(`[create-claim] Error processing attachment ${attachment.id}:`, attachmentError);
            attachmentErrors.push({
              attachmentId: attachment.id,
              error: attachmentError instanceof Error ? attachmentError.message : String(attachmentError),
            });
            // Continue with next attachment instead of failing entire claim creation
          }
        }

        console.log(`[create-claim] Summary: ${photosCreated} photos, ${documentsCreated} documents created`);
        // NOTE: Email se NE šalje pri kreiranju reklamacije
        // Email se šalje tek kada se unese claim code (u PATCH endpointu)
      }
    }

    // If customerName and customerCompany provided, create/update customer
    if (body.customerName) {
      let customer;
      if (body.customerId) {
        // Update existing customer
        customer = await prisma.customer.update({
          where: { id: body.customerId },
          data: {
            name: body.customerName,
            company: body.customerCompany || undefined,
          },
        });
      } else {
        // Create new customer
        customer = await prisma.customer.create({
          data: {
            name: body.customerName,
            company: body.customerCompany || undefined,
          },
        });
        // Link to claim
        await prisma.claim.update({
          where: { id: claim.id },
          data: { customerId: customer.id },
        });
      }
    }

    // Fetch updated claim with all relations (same as GET endpoint)
    console.log(`[create-claim] Fetching updated claim with ID: ${claim.id} (type: ${typeof claim.id})`);
    const updatedClaim = await prisma.claim.findUnique({
      where: { id: claim.id },
      include: {
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

    if (!updatedClaim) {
      console.error("[create-claim] Failed to fetch created claim after processing attachments");
      return NextResponse.json(
        { error: "Failed to fetch created claim" },
        { status: 500 }
      );
    }

    console.log(`[create-claim] Successfully created claim ${updatedClaim.id} with ${photosCreated} photos and ${documentsCreated} documents`);

    // Trigger real-time event (non-blocking)
    triggerEvent(CHANNELS.CLAIMS, EVENTS.CLAIM_CREATED, {
      claimId: updatedClaim.id,
      claimCode: updatedClaim.claimCodeRaw,
      status: updatedClaim.status,
    }).catch(console.error);

    // Log activity (non-blocking)
    console.log("[CreateClaim] Logging activity for claim:", {
      claimId: updatedClaim.id,
      claimCode: updatedClaim.claimCodeRaw,
    });
    
    logActivityFromRequest(request, {
      action: "CREATE",
      entityType: "CLAIM",
      entityId: updatedClaim.id,
      entityName: updatedClaim.claimCodeRaw || "Nova reklamacija",
      details: {
        status: updatedClaim.status,
        customer: updatedClaim.customer?.company || updatedClaim.customer?.name,
        engineType: updatedClaim.engineType,
        photosCreated,
        documentsCreated,
      },
    }).catch((error) => {
      console.error("[CreateClaim] Failed to log activity:", error);
      if (error instanceof Error) {
        console.error("[CreateClaim] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
    });

    return NextResponse.json({ 
      claim: updatedClaim,
      photosCreated,
      documentsCreated,
      attachmentErrors: attachmentErrors.length > 0 ? attachmentErrors : undefined,
      message: photosCreated > 0 || documentsCreated > 0 
        ? `Created ${photosCreated} photo(s) and ${documentsCreated} document(s).`
        : undefined,
      warning: attachmentErrors.length > 0
        ? `Claim created, but ${attachmentErrors.length} attachment(s) failed to process.`
        : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating claim:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create claim" },
      { status: 500 }
    );
  }
}

