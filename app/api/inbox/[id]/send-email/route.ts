/**
 * API route to send email reply from inbox thread
 * POST /api/inbox/[id]/send-email
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmailAndSave } from "@/lib/email/smtpClient";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    // Get thread to check if it has a claim
    const thread = await prisma.emailThread.findUnique({
      where: { id: threadId },
      include: { claim: true },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    // Send email and save to database
    const result = await sendEmailAndSave({
      emailThreadId: threadId,
      claimId: thread.claimId || undefined,
      to,
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      cc: undefined,
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

