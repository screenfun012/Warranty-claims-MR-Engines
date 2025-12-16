/**
 * API routes for claims
 * GET /api/claims - List claims with filters
 * POST /api/claims - Create new claim (optional, can be done via UI form)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";
import { getClaimProcessingEmailTemplate } from "@/lib/email/emailTemplates";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const claimCode = searchParams.get("claimCode");
    const customerName = searchParams.get("customerId"); // Keep param name for backward compatibility

    const where: any = {};
    if (status) where.status = status;
    if (claimCode) {
      // SQLite doesn't support case-insensitive mode, so we'll use contains
      where.claimCodeRaw = {
        contains: claimCode,
      };
    }

    // If customer name is provided, first find customers matching the name
    let customerIds: string[] = [];
    if (customerName) {
      try {
        const customers = await prisma.customer.findMany({
          where: {
            name: {
              contains: customerName,
            },
          },
          select: {
            id: true,
          },
        });
        customerIds = customers.map(c => c.id);
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

    const claims = await prisma.claim.findMany({
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

    // Log to verify claimAcceptanceStatus is being returned
    if (claims.length > 0) {
      console.log(`[GET /api/claims] Returning ${claims.length} claims. Sample claimAcceptanceStatus:`, claims[0].claimAcceptanceStatus);
      
      // If claimAcceptanceStatus is not being returned, explicitly fetch it using raw query
      for (const claim of claims) {
        if (claim.claimAcceptanceStatus === undefined) {
          const statusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null }>>(
            `SELECT claimAcceptanceStatus FROM Claim WHERE id = ?`,
            claim.id
          );
          if (statusResult && statusResult.length > 0) {
            (claim as any).claimAcceptanceStatus = statusResult[0].claimAcceptanceStatus;
            console.log(`[GET /api/claims] Fetched claimAcceptanceStatus from DB for claim ${claim.id}:`, statusResult[0].claimAcceptanceStatus);
          }
        }
      }
    }

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("Error fetching claims:", error);
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[create-claim] Creating new claim with data:", { 
      emailThreadId: body.emailThreadId,
      status: body.status,
      customerId: body.customerId,
    });
    
    // If creating from email thread, link the thread to the claim
    let emailThreadId = body.emailThreadId;
    
    const claim = await prisma.claim.create({
      data: {
        status: body.status || "NEW",
        customerId: body.customerId,
        workOrderId: body.workOrderId,
        engineType: body.engineType,
        mrEngineCode: body.mrEngineCode,
        assignedToId: body.assignedToId,
        summarySr: body.summarySr,
      },
      include: {
        customer: true,
        workOrder: true,
        assignedTo: true,
      },
    });
    
    console.log(`[create-claim] Created claim with ID: ${claim.id} (type: ${typeof claim.id})`);
    
    // Immediately verify the claim exists in the database
    const verifyClaim = await prisma.claim.findUnique({
      where: { id: claim.id },
      select: { id: true, status: true },
    });
    console.log(`[create-claim] Verification query result:`, verifyClaim ? `Found claim ${verifyClaim.id}` : "Claim NOT found in database!");

    // Link email thread to claim if provided and process attachments
    let photosCreated = 0;
    let documentsCreated = 0;

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
          const emailBody = firstMessage.bodyText || firstMessage.bodyHtml?.replace(/<[^>]*>/g, "").trim() || "";
          
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
              await prisma.photo.create({
                data: {
                  claimId: claim.id,
                  attachmentId: attachment.id,
                  internalUpload: false,
                },
              });
              photosCreated++;
              console.log(`[create-claim] Created photo for attachment ${attachment.id}`);
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
        }

        console.log(`[create-claim] Summary: ${photosCreated} photos, ${documentsCreated} documents created`);

        // Auto-send email to customer when claim is created from inbox
        try {
          // Use originalSender from thread first (this is the real customer email)
          // Fallback to first message from if originalSender is not available
          let customerEmail = thread.originalSender || (thread.messages[0]?.from);
          
          // Extract email address from "from" field (handle "Name <email@domain.com>" format)
          if (customerEmail) {
            // Try to extract email from format like "Name <email@domain.com>" or just "email@domain.com"
            const emailMatch = customerEmail.match(/<([^>]+)>/) || customerEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              customerEmail = emailMatch[1] || emailMatch[0];
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerEmail)) {
              console.log(`[create-claim] Invalid email format: ${customerEmail}, skipping auto-email`);
              customerEmail = null;
            }
            
            // Skip known invalid/system email addresses
            const invalidEmails = ['cpanel@', 'noreply@', 'no-reply@', 'mailer-daemon@', 'postmaster@', 'bounce@', 'return@'];
            if (customerEmail && invalidEmails.some(invalid => customerEmail.toLowerCase().includes(invalid))) {
              console.log(`[create-claim] Skipping system/invalid email: ${customerEmail}`);
              customerEmail = null;
            }
          }
          
          if (customerEmail) {
            const emailTemplate = getClaimProcessingEmailTemplate();
            
            // Create or get email thread for this claim
            let emailThread = await prisma.emailThread.findFirst({
              where: { claimId: claim.id },
            });
            
            if (!emailThread) {
              emailThread = await prisma.emailThread.create({
                data: {
                  claimId: claim.id,
                  subjectOriginal: emailTemplate.subject,
                  originalSender: customerEmail,
                },
              });
            }

            const emailResult = await sendEmailAndSave({
              emailThreadId: emailThread.id,
              claimId: claim.id,
              to: customerEmail,
              subject: emailTemplate.subject,
              text: emailTemplate.text,
              html: emailTemplate.html,
            });

            console.log(`[create-claim] Auto-sent processing email to ${customerEmail} (messageId: ${emailResult.messageId})`);
          } else {
            console.log(`[create-claim] No valid customer email found, skipping auto-email`);
          }
        } catch (emailError) {
          console.error("[create-claim] Error sending auto-email:", emailError);
          // Don't fail claim creation if email fails
        }
      }
    }

    // Fetch updated claim with all relations (same as GET endpoint)
    console.log(`[create-claim] Fetching updated claim with ID: ${claim.id} (type: ${typeof claim.id})`);
    const updatedClaim = await prisma.claim.findUnique({
      where: { id: claim.id },
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

    if (!updatedClaim) {
      console.error("[create-claim] Failed to fetch created claim after processing attachments");
      return NextResponse.json(
        { error: "Failed to fetch created claim" },
        { status: 500 }
      );
    }

    console.log(`[create-claim] Successfully created claim ${updatedClaim.id} with ${photosCreated} photos and ${documentsCreated} documents`);

    return NextResponse.json({ 
      claim: updatedClaim,
      photosCreated,
      documentsCreated,
      message: photosCreated > 0 || documentsCreated > 0 
        ? `Created ${photosCreated} photo(s) and ${documentsCreated} document(s).`
        : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating claim:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create claim" },
      { status: 500 }
    );
  }
}

