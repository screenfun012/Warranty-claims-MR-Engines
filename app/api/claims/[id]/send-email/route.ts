/**
 * API route for sending emails from a claim
 * POST /api/claims/[id]/send-email
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";
import { readAttachmentFile } from "@/lib/files/fileStorage";
import { getClaimStatusEmailTemplate, getClaimProcessingEmailTemplate } from "@/lib/email/emailTemplates";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Use existing thread or create new one
    let threadId = body.emailThreadId;
    if (!threadId && claim.emailThreads.length > 0) {
      threadId = claim.emailThreads[0].id;
    } else if (!threadId) {
      // Create new thread
      const newThread = await prisma.emailThread.create({
        data: {
          claimId: id,
          subjectOriginal: body.subject,
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

    // Generate email template based on type
    let emailSubject = body.subject;
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

    // After successful email send, update processingEmailSentAt if it was a processing email
    if (body._isProcessingEmail || body.type === "processing") {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE Claim SET processingEmailSentAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?`,
          id
        );
        console.log(`[send-email] Updated processingEmailSentAt for claim ${id}`);
      } catch (updateError) {
        console.error("Error updating processingEmailSentAt:", updateError);
      }
    }

    // After successful email send, update claim status to CLOSED if acceptance status is provided
    if (body.claimAcceptanceStatus && (body.claimAcceptanceStatus === "ACCEPTED" || body.claimAcceptanceStatus === "REJECTED")) {
      try {
        console.log(`[send-email] Attempting to update claim ${id} with status=CLOSED and claimAcceptanceStatus=${body.claimAcceptanceStatus}`);
        
        // Use raw SQL for SQLite compatibility
        await prisma.$executeRawUnsafe(
          `UPDATE Claim SET status = ?, claimAcceptanceStatus = ?, updatedAt = datetime('now') WHERE id = ?`,
          "CLOSED",
          body.claimAcceptanceStatus,
          id
        );
        
        console.log(`[send-email] SQL update executed for claim ${id}`);
        
        // Verify the update
        const updatedClaim = await prisma.claim.findUnique({
          where: { id },
          select: { status: true, claimAcceptanceStatus: true },
        });
        console.log(`[send-email] Verification - claim status: ${updatedClaim?.status}, acceptanceStatus: ${updatedClaim?.claimAcceptanceStatus}`);
        
        if (updatedClaim?.status !== "CLOSED" || updatedClaim?.claimAcceptanceStatus !== body.claimAcceptanceStatus) {
          console.error(`[send-email] Update verification failed! Expected CLOSED/${body.claimAcceptanceStatus}, got ${updatedClaim?.status}/${updatedClaim?.claimAcceptanceStatus}`);
        }
      } catch (updateError) {
        console.error("Error updating claim status:", updateError);
        // Don't fail the email send if status update fails, but log it
      }
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

