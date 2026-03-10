/**
 * Send generic email (not tied to a claim) and save to NAS under Poslati_mailovi/[subject].
 * POST /api/mail/send - body: FormData with to, cc?, subject, body, and optional files.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getEmailConfig } from "@/lib/config/envLoader";
import { sendEmail } from "@/lib/email/smtpClient";
import { saveSentMailToNas } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CLAIMS_CREATE);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let to: string;
  let cc: string | undefined;
  let subject: string;
  let body: string;
  const attachments: Array<{ filename: string; buffer: Buffer; contentType?: string }> = [];

  try {
    const formData = await request.formData();
    to = (formData.get("to") as string)?.trim() ?? "";
    cc = (formData.get("cc") as string)?.trim() || undefined;
    subject = (formData.get("subject") as string)?.trim() ?? "";
    body = (formData.get("body") as string)?.trim() ?? "";

    if (!to || !subject) {
      return NextResponse.json(
        { error: "To and Subject are required" },
        { status: 400 }
      );
    }

    const files = formData.getAll("files") as File[];
    if (files?.length) {
      for (const file of files) {
        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer());
          attachments.push({
            filename: file.name || "attachment",
            buffer,
            contentType: file.type || undefined,
          });
        }
      }
    }
  } catch (err) {
    console.error("[mail/send] Form parse error:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const config = getEmailConfig();
  const html = body ? body.replace(/\n/g, "<br>") : undefined;

  try {
    const sendResult = await sendEmail({
      to,
      cc: cc ? cc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : undefined,
      subject,
      text: body || undefined,
      html: html ? `<p>${html}</p>` : undefined,
      attachments: attachments.length
        ? attachments.map((a) => ({ filename: a.filename, content: a.buffer, contentType: a.contentType }))
        : undefined,
    });

    const folderPath = await saveSentMailToNas({
      from: config.smtpUserEmail,
      to,
      cc,
      subject,
      text: body || undefined,
      html: html ? `<p>${html}</p>` : undefined,
      messageId: sendResult.messageId,
      sentAt: new Date(),
      attachments: attachments.length ? attachments : undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      folderPath: folderPath ?? undefined,
    });
  } catch (err) {
    console.error("[mail/send] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
