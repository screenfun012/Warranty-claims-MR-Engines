/**
 * API route for sending emails from a claim
 * POST /api/claims/[id]/send-email
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";
import { getAttachmentFilePath } from "@/lib/files/fileStorage";
import fs from "fs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
          // Get absolute path using fileStorage utility
          const absolutePath = getAttachmentFilePath(att.filePath);
          
          // Check if file exists
          if (!fs.existsSync(absolutePath)) {
            console.error(`Attachment file not found: ${absolutePath} (relative: ${att.filePath})`);
            throw new Error(`Attachment file not found: ${att.fileName}`);
          }
          
          // Read file content as buffer
          const fileContent = fs.readFileSync(absolutePath);
          
          return {
            filename: att.fileName,
            content: fileContent,
            contentType: att.mimeType,
          };
        })
      );
    }

    // Send email
    const result = await sendEmailAndSave({
      emailThreadId: threadId,
      claimId: id,
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      text: body.text || body.body,
      html: body.html || (body.body ? `<p>${body.body.replace(/\n/g, '<br>')}</p>` : undefined),
      attachments: attachments.length > 0 ? attachments : undefined,
    });

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
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}

