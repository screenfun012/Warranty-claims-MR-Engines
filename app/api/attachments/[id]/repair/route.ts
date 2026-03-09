/**
 * Repair attachment: re-fetch from IMAP by Message-ID and save to NAS.
 * Use when file is missing on NAS (e.g. empty folder).
 * POST /api/attachments/[id]/repair
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/get-session";
import { saveAttachmentForClaim, saveAttachmentForUnassignedThread } from "@/lib/files/fileStorage";
import { fetchMessageAttachmentsByMessageId } from "@/lib/email/imapClient";

function normalizeFileName(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: attachmentId } = await params;
    const prisma = await getPrisma();

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { emailMessage: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const emailMessage = attachment.emailMessage;
    if (!emailMessage?.messageId) {
      return NextResponse.json(
        { error: "Attachment has no linked email or Message-ID. Cannot repair." },
        { status: 400 }
      );
    }

    const attachmentsFromImap = await fetchMessageAttachmentsByMessageId(emailMessage.messageId);
    const wantedName = normalizeFileName(attachment.fileName);
    const match = attachmentsFromImap.find(
      (a) => normalizeFileName(a.filename) === wantedName
    );
    if (!match) {
      return NextResponse.json(
        {
          error: "Attachment not found in email (message may have been deleted or filename differs).",
          available: attachmentsFromImap.map((a) => a.filename),
        },
        { status: 404 }
      );
    }

    let newFilePath: string;
    if (attachment.claimId) {
      newFilePath = await saveAttachmentForClaim({
        claimId: attachment.claimId,
        fileBuffer: match.buffer,
        originalFileName: attachment.fileName,
        mimeType: attachment.mimeType,
        subfolder: "03_attachments",
      });
    } else {
      newFilePath = await saveAttachmentForUnassignedThread({
        threadId: emailMessage.emailThreadId,
        fileBuffer: match.buffer,
        originalFileName: attachment.fileName,
        mimeType: attachment.mimeType,
      });
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { filePath: newFilePath },
    });

    return NextResponse.json({ success: true, filePath: newFilePath });
  } catch (err) {
    console.error("[repair attachment]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Repair failed", details: message },
      { status: 500 }
    );
  }
}
