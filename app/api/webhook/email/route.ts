/**
 * Webhook endpoint for receiving emails from SendGrid Inbound Parse or Cloudmailin
 * POST /api/webhook/email
 * 
 * Supports both:
 * - SendGrid Inbound Parse (multipart/form-data)
 * - Cloudmailin (JSON)
 * 
 * Updated: 2026-01-15
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  saveAttachmentForUnassignedThread,
  saveAttachmentForClaim,
} from "@/lib/files/fileStorage";

// Webhook secret for verification (optional, but recommended)
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET;

interface CloudmailinAttachment {
  file_name: string;
  content_type: string;
  content: string; // Base64 encoded
  size?: number;
}

interface CloudmailinPayload {
  headers: {
    from: string;
    to: string;
    cc?: string;
    subject: string;
    message_id?: string;
    in_reply_to?: string;
    date?: string;
  };
  envelope: {
    from: string;
    to: string;
    recipients: string[];
  };
  plain?: string;
  html?: string;
  attachments?: CloudmailinAttachment[];
}

export async function POST(request: NextRequest) {
  console.log("[Email Webhook] Received webhook request");
  
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = request.headers.get("x-webhook-secret") || 
                            authHeader?.replace("Bearer ", "");
      
      if (providedSecret !== WEBHOOK_SECRET) {
        console.log("[Email Webhook] Invalid secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let from = "";
    let to = "";
    let cc = "";
    let subject = "(No Subject)";
    let messageId: string | null = null;
    let inReplyTo: string | null = null;
    let date = new Date();
    let bodyText = "";
    let bodyHtml = "";
    let attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];

    // Detect format and parse accordingly
    if (contentType.includes("multipart/form-data")) {
      // SendGrid Inbound Parse format
      const formData = await request.formData();
      
      from = (formData.get("from") as string) || "";
      to = (formData.get("to") as string) || "";
      subject = (formData.get("subject") as string) || "(No Subject)";
      bodyText = (formData.get("text") as string) || "";
      bodyHtml = (formData.get("html") as string) || "";
      
      // Parse headers if provided
      const headersStr = formData.get("headers") as string;
      if (headersStr) {
        try {
          const headers = JSON.parse(headersStr);
          messageId = headers["Message-ID"] || headers["Message-Id"] || null;
          inReplyTo = headers["In-Reply-To"] || null;
          cc = headers["Cc"] || headers["CC"] || "";
          if (headers["Date"]) {
            date = new Date(headers["Date"]);
          }
        } catch (e) {
          console.log("[Email Webhook] Error parsing headers:", e);
        }
      }

      // Process attachments from SendGrid
      const attachmentInfo = formData.get("attachment-info");
      if (attachmentInfo) {
        try {
          const attachmentList = JSON.parse(attachmentInfo as string);
          for (const [index, info] of Object.entries(attachmentList)) {
            const file = formData.get(`attachment${index}`);
            if (file && file instanceof File) {
              const buffer = Buffer.from(await file.arrayBuffer());
              attachments.push({
                filename: (info as any).filename || file.name || `attachment-${index}`,
                mimeType: (info as any).type || file.type || "application/octet-stream",
                buffer,
              });
            }
          }
        } catch (e) {
          console.log("[Email Webhook] Error parsing attachment-info:", e);
        }
      }

      console.log("[Email Webhook] SendGrid payload received:", {
        from,
        to,
        subject,
        hasPlain: !!bodyText,
        hasHtml: !!bodyHtml,
        attachmentCount: attachments.length,
      });
    } else {
      // Cloudmailin JSON format
      const payload: CloudmailinPayload = await request.json();
      
      from = payload.headers?.from || payload.envelope?.from || "";
      to = payload.headers?.to || payload.envelope?.to || "";
      cc = payload.headers?.cc || "";
      subject = payload.headers?.subject || "(No Subject)";
      messageId = payload.headers?.message_id || null;
      inReplyTo = payload.headers?.in_reply_to || null;
      date = payload.headers?.date ? new Date(payload.headers.date) : new Date();
      bodyText = payload.plain || "";
      bodyHtml = payload.html || "";

      // Process Cloudmailin attachments (base64)
      if (payload.attachments) {
        for (const att of payload.attachments) {
          attachments.push({
            filename: att.file_name,
            mimeType: att.content_type,
            buffer: Buffer.from(att.content, "base64"),
          });
        }
      }

      console.log("[Email Webhook] Cloudmailin payload received:", {
        from,
        to,
        subject,
        hasPlain: !!bodyText,
        hasHtml: !!bodyHtml,
        attachmentCount: attachments.length,
      });
    }

    // Check for duplicate message
    if (messageId) {
      const existingMessage = await prisma.emailMessage.findFirst({
        where: { messageId },
      });
      if (existingMessage) {
        console.log("[Email Webhook] Duplicate message, skipping:", messageId);
        return NextResponse.json({ 
          success: true, 
          message: "Duplicate message, skipped",
          duplicate: true 
        });
      }
    }

    // Find or create email thread
    let thread = await prisma.emailThread.findFirst({
      where: {
        OR: [
          { subjectOriginal: subject },
          messageId ? {
            messages: {
              some: {
                OR: [
                  { messageId: messageId },
                  inReplyTo ? { messageId: inReplyTo } : {},
                ],
              },
            },
          } : {},
        ],
      },
    });

    const isNewThread = !thread;

    if (!thread) {
      thread = await prisma.emailThread.create({
        data: {
          subjectOriginal: subject,
          originalSender: from,
        },
      });
      console.log("[Email Webhook] Created new thread:", thread.id);
    }

    // Create email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        emailThreadId: thread.id,
        direction: "INBOUND",
        from,
        to,
        cc: cc || null,
        subject,
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
        messageId,
        inReplyTo,
        date,
      },
    });
    console.log("[Email Webhook] Created message:", emailMessage.id);

    // Process attachments
    let attachmentCount = 0;
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          let filePath: string;
          if (thread.claimId) {
            const claim = await prisma.claim.findUnique({
              where: { id: thread.claimId },
            });
            if (claim) {
              filePath = await saveAttachmentForClaim({
                claim,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
                subfolder: "03_attachments",
              });
            } else {
              filePath = await saveAttachmentForUnassignedThread({
                threadId: thread.id,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
              });
            }
          } else {
            filePath = await saveAttachmentForUnassignedThread({
              threadId: thread.id,
              fileBuffer: attachment.buffer,
              originalFileName: attachment.filename,
              mimeType: attachment.mimeType,
            });
          }

          await prisma.attachment.create({
            data: {
              emailMessageId: emailMessage.id,
              fileName: attachment.filename,
              mimeType: attachment.mimeType,
              filePath,
              isRelevant: true,
              source: "CLIENT",
            },
          });
          
          attachmentCount++;
          console.log("[Email Webhook] Saved attachment:", attachment.filename);
        } catch (error) {
          console.error("[Email Webhook] Error saving attachment:", attachment.filename, error);
        }
      }
    }

    // Detect forwarded email
    const subjectLower = subject.toLowerCase();
    const isForwarded = subjectLower.startsWith("fwd:") || 
                       subjectLower.startsWith("fw:") ||
                       bodyText.toLowerCase().includes("original message");

    if (isForwarded) {
      const originalSenderMatch = bodyText.match(/from:\s*([^\r\n]+)/i);
      if (originalSenderMatch) {
        await prisma.emailThread.update({
          where: { id: thread.id },
          data: {
            originalSender: originalSenderMatch[1].trim(),
            forwardedBy: from,
          },
        });
      }
    }

    console.log("[Email Webhook] Processing complete:", {
      threadId: thread.id,
      messageId: emailMessage.id,
      isNewThread,
      attachmentCount,
    });

    return NextResponse.json({
      success: true,
      threadId: thread.id,
      messageId: emailMessage.id,
      isNewThread,
      attachmentCount,
    });

  } catch (error) {
    console.error("[Email Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    endpoint: "email-webhook",
    message: "Send POST requests with email data to this endpoint"
  });
}
