/**
 * API route for sending emails from a claim
 * POST /api/claims/[id]/send-email
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";
import { readAttachmentFile, saveAttachmentForClaim } from "@/lib/files/fileStorage";
import { getClaimStatusEmailTemplate, getClaimProcessingEmailTemplate } from "@/lib/email/emailTemplates";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    // OPERATOR+ can send emails
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);
    
    const { id } = await params;
    const body = await request.json();

    // Get claim to find associated email thread
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        customer: true,
        emailThreads: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              where: { direction: 'INBOUND' },
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Generate email subject early (needed for thread creation)
    // We'll refine it later based on email type
    let emailSubject = body.subject;
    
    // If no subject provided, use default based on claim code
    if (!emailSubject || !emailSubject.trim()) {
      if (claim.claimCodeRaw) {
        emailSubject = `Re: Claim ${claim.claimCodeRaw}`;
      } else {
        emailSubject = "Claim Response";
      }
    }

    // Use existing thread or create new one
    let threadId = body.emailThreadId;
    if (!threadId && claim.emailThreads.length > 0) {
      threadId = claim.emailThreads[0].id;
    } else if (!threadId) {
      // Create new thread - subjectOriginal is required, so use emailSubject
      const newThread = await prisma.emailThread.create({
        data: {
          claimId: id,
          subjectOriginal: emailSubject,
        },
      });
      threadId = newThread.id;
    }

    // Get attachments if provided
    let attachments: Array<{
      filename: string;
      path?: string;
      content?: Buffer;
      contentType?: string;
    }> = [];

    if (body.attachmentIds && Array.isArray(body.attachmentIds) && body.attachmentIds.length > 0) {
      const attachmentRecords = await prisma.attachment.findMany({
        where: {
          id: { in: body.attachmentIds },
          claimId: id,
        },
      });

      attachments = await Promise.all(
        attachmentRecords.map(async (att) => {
          try {
            // Read file content as buffer (works for both filesystem and Blob)
            const fileContent = await readAttachmentFile(att.filePath);
            
            return {
              filename: att.fileName,
              content: fileContent,
              contentType: att.mimeType,
            };
          } catch (error) {
            console.error(`Attachment file not found: ${att.filePath}`, error);
            throw new Error(`Attachment file not found: ${att.fileName}`);
          }
        })
      );
    }

    // Determine recipient - use provided "to" or auto-detect from last inbound message
    let recipientEmail = body.to;
    if (!recipientEmail && body.type === "processing") {
      // Auto-detect recipient from last inbound message
      const lastInboundMessage = claim.emailThreads[0]?.messages?.[0];
      recipientEmail = lastInboundMessage?.from || null;
      
      if (recipientEmail) {
        // Extract email address if in format "Name <email@domain.com>"
        const emailMatch = recipientEmail.match(/<([^>]+)>/) || recipientEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          recipientEmail = emailMatch[1] || emailMatch[0];
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
          recipientEmail = null;
        }
        
        // Skip system emails
        const invalidEmails = ['cpanel@', 'noreply@', 'no-reply@', 'mailer-daemon@', 'postmaster@', 'bounce@', 'return@'];
        if (recipientEmail && invalidEmails.some(invalid => recipientEmail!.toLowerCase().includes(invalid))) {
          recipientEmail = null;
        }
      }
      
      if (!recipientEmail) {
        return NextResponse.json(
          { error: "Ne mogu pronaći email adresu primaoca. Proverite da reklamacija ima povezan email thread sa validnim pošiljaocem." },
          { status: 400 }
        );
      }
    }
    
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Email adresa primaoca je obavezna" },
        { status: 400 }
      );
    }

    // Generate email template based on type (refine emailSubject if needed)
    // emailSubject is already set above, but may need to be updated for templates
    let emailText = body.text || body.body;
    let emailHtml = body.html;

    // Get base URL for logo and links
    const baseUrl = request.nextUrl.origin || 
                   process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   "http://localhost:3000";

    if (body.type === "processing") {
      // Processing email - claim is being worked on
      if (!claim.claimCodeRaw) {
        return NextResponse.json(
          { error: "Claim code mora biti unet pre slanja obaveštenja" },
          { status: 400 }
        );
      }
      
      const template = getClaimProcessingEmailTemplate({
        claimCode: claim.claimCodeRaw,
        customerName: claim.customer?.name || undefined,
        status: "IN_ANALYSIS",
        baseUrl,
      });
      
      emailSubject = template.subject;
      emailText = template.text;
      emailHtml = template.html;
      
      console.log(`[send-email] Sending processing email to ${recipientEmail} for claim ${claim.claimCodeRaw}`);
      
      // Mark that processing email was sent (will be saved after email is sent)
      body._isProcessingEmail = true;
    } else if (body.claimAcceptanceStatus && (body.claimAcceptanceStatus === "ACCEPTED" || body.claimAcceptanceStatus === "REJECTED")) {
      // Use the template for status emails
      const template = getClaimStatusEmailTemplate(
        body.claimAcceptanceStatus,
        {
          claimCode: claim.claimCodeRaw || undefined,
          customerName: claim.customer?.name || undefined,
          customMessage: body.text || body.body,
          baseUrl,
          // TODO: Generate viewLink when public viewing is implemented
          // viewLink: `${baseUrl}/claims/${id}/view?token=...`,
        }
      );
      
      emailSubject = template.subject;
      emailText = template.text;
      emailHtml = template.html;
    } else if (body.body && !body.html) {
      // If custom body is provided but no HTML, create simple HTML
      emailHtml = `<p>${(body.text || body.body).replace(/\n/g, '<br>')}</p>`;
    }

    // Send email
    const result = await sendEmailAndSave({
      emailThreadId: threadId,
      claimId: id,
      to: recipientEmail,
      cc: body.cc,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // After successful email send, save attachments to NAS in 04_sent_to_client folder
    // This creates a folder on NAS with format "Customer Name - Claim Code" and saves attachments there
    if (attachments.length > 0 && claim.claimCodeRaw) {
      try {
        console.log(`[send-email] Saving ${attachments.length} attachments to NAS folder 04_sent_to_client for claim ${id}`);
        
        // Reload claim with customer for folder name
        const claimWithCustomer = await prisma.claim.findUnique({
          where: { id },
          include: { customer: true },
        });

        if (claimWithCustomer) {
          for (const attachment of attachments) {
            if (attachment.content) {
              try {
                await saveAttachmentForClaim({
                  claim: claimWithCustomer,
                  fileBuffer: attachment.content,
                  originalFileName: attachment.filename,
                  mimeType: attachment.contentType || "application/octet-stream",
                  subfolder: "04_sent_to_client",
                });
                console.log(`[send-email] Saved attachment to NAS: ${attachment.filename}`);
              } catch (saveError) {
                console.error(`[send-email] Failed to save attachment ${attachment.filename} to NAS:`, saveError);
                // Don't fail the whole process if one attachment fails
              }
            }
          }
        }
      } catch (error) {
        console.error(`[send-email] Error saving attachments to NAS:`, error);
        // Don't fail the email send if NAS save fails, but log it
      }
    }

    // After successful email send, update processingEmailSentAt if it was a processing email
    if (body._isProcessingEmail || body.type === "processing") {
      try {
        await prisma.claim.update({
          where: { id },
          data: {
            processingEmailSentAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`[send-email] Updated processingEmailSentAt for claim ${id}`);
      } catch (updateError) {
        console.error("Error updating processingEmailSentAt:", updateError);
      }
    }

    // After successful email send, ALWAYS close the claim (status = CLOSED)
    // This ensures that once an email is sent to client, the claim is closed
    try {
      console.log(`[send-email] Closing claim ${id} after sending email to client`);
      
      // Use Prisma update for Turso compatibility (works with both SQLite and Turso)
      // When email is sent, claim is closed
      // Default behavior: CLOSED status = locked (no need to set isLocked explicitly)
      // We set isLocked to null/undefined so default behavior applies
      const updateData: any = {
        status: "CLOSED",
        // Don't set isLocked - CLOSED status = locked by default
        updatedAt: new Date(),
      };
      
      if (body.claimAcceptanceStatus) {
        updateData.claimAcceptanceStatus = body.claimAcceptanceStatus;
      }
      
      await prisma.claim.update({
        where: { id },
        data: updateData,
      });
      
      console.log(`[send-email] Claim ${id} closed successfully with status: CLOSED`);
    } catch (updateError) {
      console.error("Error closing claim:", updateError);
      // Don't fail the email send if status update fails, but log it
      // Return error in response so frontend knows to refetch
      return NextResponse.json({
        success: true,
        emailMessageId: result.emailMessageId,
        messageId: result.messageId,
        processingEmailSent: body._isProcessingEmail || body.type === "processing",
        warning: "Email sent successfully, but failed to update claim status. Please refresh the page.",
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      emailMessageId: result.emailMessageId,
      messageId: result.messageId,
      processingEmailSent: body._isProcessingEmail || body.type === "processing",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}

