/**
 * API route for translating attachment text
 * POST /api/attachments/[id]/translate
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/translation/translator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { targetLang, sourceLang } = body;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const textToTranslate = attachment.textOriginal;
    if (!textToTranslate) {
      return NextResponse.json(
        { error: "No text to translate. Please extract text from PDF first." },
        { status: 400 }
      );
    }

    const translator = getTranslator();
    const translated = await translator.translate({
      text: textToTranslate,
      sourceLang: sourceLang || "auto",
      targetLang,
    });

    const updateData: any = {};
    if (targetLang === "SR") updateData.textSr = translated;
    if (targetLang === "EN") updateData.textEn = translated;

    const updated = await prisma.attachment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ translated, attachment: updated });
  } catch (error) {
    console.error("Error translating attachment text:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}

