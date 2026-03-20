/**
 * Send generic email (not tied to a claim) and save to NAS under Poslati_mailovi/[subject].
 * POST /api/mail/send - body: FormData with to, cc?, subject, body, and optional files.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getEmailConfig } from "@/lib/config/envLoader";
import { sendEmail } from "@/lib/email/smtpClient";
import { getEmailSignatureHtml, getEmailSignatureText } from "@/lib/email/emailSignature";
import { sanitizeEmailHtml } from "@/lib/email/sanitizeEmailHtml";
import { saveSentMailToNas } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);
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
  let bcc: string | undefined;
  let subject: string;
  let body: string;
  let bodyHtml: string | undefined;
  let importance: "normal" | "high" | "low" = "normal";
  const attachments: Array<{ filename: string; buffer: Buffer; contentType?: string }> = [];

  try {
    const formData = await request.formData();
    to = (formData.get("to") as string)?.trim() ?? "";
    cc = (formData.get("cc") as string)?.trim() || undefined;
    bcc = (formData.get("bcc") as string)?.trim() || undefined;
    subject = (formData.get("subject") as string)?.trim() ?? "";
    body = (formData.get("body") as string)?.trim() ?? "";
    bodyHtml = (formData.get("bodyHtml") as string)?.trim() || undefined;
    const imp = (formData.get("importance") as string)?.toLowerCase();
    if (imp === "high" || imp === "low") importance = imp;

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
  const baseUrl =
    request.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const signatureHtml = getEmailSignatureHtml(baseUrl);
  const signatureText = getEmailSignatureText();
  let mainHtml = bodyHtml ?? (body ? body.replace(/\n/g, "<br>") : "");
  mainHtml = sanitizeEmailHtml(mainHtml);
  const html = (mainHtml ? (mainHtml.startsWith("<") ? mainHtml : `<p>${mainHtml}</p>`) : "<p></p>") + signatureHtml;
  const text = (body || "") + signatureText;

  const importanceHeaders: Record<string, string> = {};
  if (importance === "high") {
    importanceHeaders["X-Priority"] = "1";
    importanceHeaders["Importance"] = "high";
  } else if (importance === "low") {
    importanceHeaders["X-Priority"] = "5";
    importanceHeaders["Importance"] = "low";
  }

  try {
    const sendResult = await sendEmail({
      to,
      cc: cc ? cc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : undefined,
      subject,
      text: text || undefined,
      html,
      headers: Object.keys(importanceHeaders).length ? importanceHeaders : undefined,
      attachments: attachments.length
        ? attachments.map((a) => ({ filename: a.filename, content: a.buffer, contentType: a.contentType }))
        : undefined,
    });

    const folderPath = await saveSentMailToNas({
      from: config.smtpUserEmail,
      to,
      cc,
      bcc,
      subject,
      text: text || undefined,
      html,
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
