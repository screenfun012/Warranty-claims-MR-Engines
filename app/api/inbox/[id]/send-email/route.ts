/**
 * API route to send email reply from inbox thread
 * POST /api/inbox/[id]/send-email
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";
import { sanitizeEmailHtml } from "@/lib/email/sanitizeEmailHtml";
import { getEmailSignatureHtml, getEmailSignatureText } from "@/lib/email/emailSignature";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CLAIMS_UPDATE);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const prisma = await getPrisma();
    const { id: threadId } = await params;
    const body = await request.json();
    const {
      to,
      cc,
      bcc,
      subject,
      body: textBody,
      bodyHtml: rawHtml,
      inReplyTo,
      references,
    } = body as {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      body?: string;
      bodyHtml?: string;
      inReplyTo?: string;
      references?: string;
    };

    if (!to || !subject || (textBody === undefined && !rawHtml)) {
      return NextResponse.json(
        { error: "to, subject, and body (or bodyHtml) are required" },
        { status: 400 }
      );
    }

    const thread = await prisma.emailThread.findUnique({
      where: { id: threadId },
      include: { claim: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const baseUrl =
      request.nextUrl?.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const signatureHtml = getEmailSignatureHtml(baseUrl);
    const signatureText = getEmailSignatureText();

    let html = rawHtml?.trim()
      ? sanitizeEmailHtml(rawHtml)
      : `<p>${String(textBody || "").replace(/\n/g, "<br>")}</p>`;
    if (!html.includes("signature") && signatureHtml) {
      html = html + signatureHtml;
    }
    const text = (textBody || "").replace(/\r\n/g, "\n") + signatureText;

    const headers: Record<string, string> = {};
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (references) headers["References"] = references;

    const result = await sendEmailAndSave({
      emailThreadId: threadId,
      claimId: thread.claimId || undefined,
      to,
      cc: cc?.trim() || undefined,
      bcc: bcc?.trim() || undefined,
      subject,
      text,
      html,
      headers: Object.keys(headers).length ? headers : undefined,
    });

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
