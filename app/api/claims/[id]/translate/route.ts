/**
 * API route for translating claim content
 * POST /api/claims/[id]/translate
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

    const { type, targetLang, sourceLang } = body;
    const translator = getTranslator();

    if (type === "summary") {
      const claim = await prisma.claim.findUnique({ where: { id } });
      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }

      // Determine source text based on sourceLang
      let textToTranslate = "";
      if (sourceLang === "SR" || !sourceLang) {
        textToTranslate = claim.summarySr || "";
      } else if (sourceLang === "EN") {
        textToTranslate = claim.summaryEn || "";
      }

      if (!textToTranslate) {
        return NextResponse.json({ error: `No ${sourceLang === "EN" ? "English" : "Serbian"} summary to translate` }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLang || "SR",
        targetLang,
      });

      const updateData: any = {};
      if (targetLang === "EN") updateData.summaryEn = translated;
      if (targetLang === "SR") updateData.summarySr = translated;

      await prisma.claim.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ translated });
    } else if (type === "clientDocument") {
      const { clientDocumentId } = body;
      const doc = await prisma.clientDocument.findUnique({
        where: { id: clientDocumentId },
      });

      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Determine source text based on sourceLang
      let textToTranslate = doc.textOriginal;
      if (sourceLang && sourceLang !== "auto") {
        if (sourceLang === "SR" && doc.textSr) {
          textToTranslate = doc.textSr;
        } else if (sourceLang === "EN" && doc.textEn) {
          textToTranslate = doc.textEn;
        }
      }

      if (!textToTranslate) {
        return NextResponse.json({ error: "No text to translate" }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLang && sourceLang !== "auto" ? sourceLang : undefined,
        targetLang,
      });

      const updateData: any = {};
      if (targetLang === "SR") updateData.textSr = translated;
      if (targetLang === "EN") updateData.textEn = translated;

      await prisma.clientDocument.update({
        where: { id: clientDocumentId },
        data: updateData,
      });

      return NextResponse.json({ translated });
    } else if (type === "reportSection") {
      const { reportSectionId } = body;
      const section = await prisma.reportSection.findUnique({
        where: { id: reportSectionId },
      });

      if (!section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }

      // Determine source text based on sourceLang
      let textToTranslate = "";
      if (sourceLang === "SR" || !sourceLang) {
        textToTranslate = section.textSr || "";
      } else if (sourceLang === "EN") {
        textToTranslate = section.textEn || "";
      }

      if (!textToTranslate) {
        return NextResponse.json({ error: `No ${sourceLang === "EN" ? "English" : "Serbian"} text to translate` }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLang || "SR",
        targetLang,
      });

      const updateData: any = {};
      if (targetLang === "EN") updateData.textEn = translated;
      if (targetLang === "SR") updateData.textSr = translated;

      await prisma.reportSection.update({
        where: { id: reportSectionId },
        data: updateData,
      });

      return NextResponse.json({ translated });
    } else if (type === "photoCaption") {
      const { photoId } = body;
      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
      });

      if (!photo) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }

      // Determine source text based on sourceLang
      let textToTranslate = "";
      if (sourceLang === "SR" || !sourceLang) {
        textToTranslate = photo.captionSr || "";
      } else if (sourceLang === "EN") {
        textToTranslate = photo.captionEn || "";
      }

      if (!textToTranslate) {
        return NextResponse.json({ error: `No ${sourceLang === "EN" ? "English" : "Serbian"} caption to translate` }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLang || "SR",
        targetLang,
      });

      const updateData: any = {};
      if (targetLang === "EN") updateData.captionEn = translated;
      if (targetLang === "SR") updateData.captionSr = translated;

      await prisma.photo.update({
        where: { id: photoId },
        data: updateData,
      });

      return NextResponse.json({ translated });
    }

    return NextResponse.json({ error: "Invalid translation type" }, { status: 400 });
  } catch (error) {
    console.error("Error translating:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}

