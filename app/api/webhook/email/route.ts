/**
 * Webhook endpoint for receiving emails from Cloudmailin or similar services
 * POST /api/webhook/email
 * 
 * This endpoint receives email data as JSON and processes it the same way
 * as the IMAP sync, creating threads, messages, and saving attachments.
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

    // Parse the webhook payload
    const payload: CloudmailinPayload = await request.json();
    console.log("[Email Webhook] Payload received:", {
      from: payload.headers?.from || payload.envelope?.from,
      to: payload.headers?.to || payload.envelope?.to,
      subject: payload.headers?.subject,
      hasPlain: !!payload.plain,
      hasHtml: !!payload.html,
      attachmentCount: payload.attachments?.length || 0,
    });

    // Extract email data
    const from = payload.headers?.from || payload.envelope?.from || "";
    const to = payload.headers?.to || payload.envelope?.to || "";
    const cc = payload.headers?.cc || "";
    const subject = payload.headers?.subject || "(No Subject)";
    const messageId = payload.headers?.message_id || null;
    const inReplyTo = payload.headers?.in_reply_to || null;
    const date = payload.headers?.date ? new Date(payload.headers.date) : new Date();
    const bodyText = payload.plain || "";
    const bodyHtml = payload.html || "";

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
    if (payload.attachments && payload.attachments.length > 0) {
      for (const attachment of payload.attachments) {
        try {
          // Decode base64 content
          const buffer = Buffer.from(attachment.content, "base64");
          
          let filePath: string;
          if (thread.claimId) {
            const claim = await prisma.claim.findUnique({
              where: { id: thread.claimId },
            });
            if (claim) {
              filePath = await saveAttachmentForClaim({
                claim,
                fileBuffer: buffer,
                originalFileName: attachment.file_name,
                mimeType: attachment.content_type,
                subfolder: "03_attachments",
              });
            } else {
              filePath = await saveAttachmentForUnassignedThread({
                threadId: thread.id,
                fileBuffer: buffer,
                originalFileName: attachment.file_name,
                mimeType: attachment.content_type,
              });
            }
          } else {
            filePath = await saveAttachmentForUnassignedThread({
              threadId: thread.id,
              fileBuffer: buffer,
              originalFileName: attachment.file_name,
              mimeType: attachment.content_type,
            });
          }

          await prisma.attachment.create({
            data: {
              emailMessageId: emailMessage.id,
              fileName: attachment.file_name,
              mimeType: attachment.content_type,
              filePath,
              isRelevant: true,
              source: "CLIENT",
            },
          });
          
          attachmentCount++;
          console.log("[Email Webhook] Saved attachment:", attachment.file_name);
        } catch (error) {
          console.error("[Email Webhook] Error saving attachment:", attachment.file_name, error);
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
