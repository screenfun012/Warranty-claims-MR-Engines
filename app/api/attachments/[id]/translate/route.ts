/**
 * API route for translating attachment text
 * POST /api/attachments/[id]/translate
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/translation/translator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { id } = await params;
    const body = await request.json();
    const { targetLang, sourceLang } = body;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const attAny = attachment as typeof attachment & { translationsJson?: string | null };
    const translations: Record<string, string> = attAny.translationsJson
      ? (typeof attAny.translationsJson === "string" ? JSON.parse(attAny.translationsJson) : attAny.translationsJson) || {}
      : {};

    let textToTranslate = attachment.textOriginal ?? "";
    if (sourceLang && sourceLang !== "auto") {
      if (sourceLang === "SR" && attachment.textSr) textToTranslate = attachment.textSr;
      else if (sourceLang === "EN" && attachment.textEn) textToTranslate = attachment.textEn;
      else if (translations[sourceLang]) textToTranslate = translations[sourceLang];
    }

    if (!textToTranslate) {
      return NextResponse.json(
        { error: "No text to translate. Please extract text from PDF first." },
        { status: 400 }
      );
    }

    const translator = getTranslator(targetLang);
    const translated = await translator.translate({
      text: textToTranslate,
      sourceLang: sourceLang || "auto",
      targetLang,
    });

    const updateData: Record<string, unknown> = {};
    if (targetLang === "SR") updateData.textSr = translated;
    else if (targetLang === "EN") updateData.textEn = translated;
    else {
      translations[targetLang] = translated;
      updateData.translationsJson = JSON.stringify(translations);
    }

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

