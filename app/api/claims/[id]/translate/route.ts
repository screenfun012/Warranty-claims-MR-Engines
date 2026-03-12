/**
 * API route for translating claim content
 * POST /api/claims/[id]/translate
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

    const { type, targetLang, sourceLang, text } = body;
    const translator = getTranslator(targetLang);

    if (type === "text" && text) {
      // Direct text translation (e.g., from email body)
      const translated = await translator.translate({
        text: text,
        sourceLang: (sourceLang || "SR").toUpperCase(),
        targetLang: targetLang.toUpperCase(),
      });

      const targetLangUpper = targetLang.toUpperCase();
      const summaryFieldMap: Record<string, string> = {
        EN: "summaryEn", SR: "summarySr", DE: "summaryDe", FR: "summaryFr", NL: "summaryNl",
        IT: "summaryIt", PL: "summaryPl", DA: "summaryDa", ES: "summaryEs", SV: "summarySv",
      };
      const updateData: Record<string, string> = {};
      if (summaryFieldMap[targetLangUpper]) updateData[summaryFieldMap[targetLangUpper]] = translated;

      await prisma.claim.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ translated });
    } else if (type === "summary") {
      const claim = await prisma.claim.findUnique({ where: { id } });
      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }

      const sourceLangUpper = (sourceLang || "SR").toUpperCase();
      // Prefer text sent from frontend (what's on screen); fallback to DB so unsaved edits can be translated
      let textToTranslate = typeof text === "string" && text.trim() ? text.trim() : "";
      if (!textToTranslate) {
        const c = claim as typeof claim & { summaryIt?: string | null; summaryPl?: string | null; summaryDa?: string | null; summaryEs?: string | null; summarySv?: string | null };
        const summaryByLang: Record<string, string | null | undefined> = {
          SR: claim.summarySr, EN: claim.summaryEn, DE: (claim as typeof c).summaryDe, FR: (claim as typeof c).summaryFr, NL: (claim as typeof c).summaryNl,
          IT: c.summaryIt, PL: c.summaryPl, DA: c.summaryDa, ES: c.summaryEs, SV: c.summarySv,
        };
        textToTranslate = summaryByLang[sourceLangUpper] || "";
      }

      if (!textToTranslate.trim()) {
        const langNames: Record<string, string> = {
          SR: "Serbian", EN: "English", DE: "German", FR: "French", NL: "Dutch",
          IT: "Italian", PL: "Polish", DA: "Danish", ES: "Spanish", SV: "Swedish",
        };
        return NextResponse.json({ 
          error: `No ${langNames[sourceLangUpper] || sourceLangUpper} summary to translate` 
        }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLangUpper,
        targetLang: targetLang.toUpperCase(),
      });

      const targetLangUpper = targetLang.toUpperCase();
      const summaryFieldMap: Record<string, string> = {
        EN: "summaryEn", SR: "summarySr", DE: "summaryDe", FR: "summaryFr", NL: "summaryNl",
        IT: "summaryIt", PL: "summaryPl", DA: "summaryDa", ES: "summaryEs", SV: "summarySv",
      };
      const updateData: Record<string, string> = {};
      if (summaryFieldMap[targetLangUpper]) updateData[summaryFieldMap[targetLangUpper]] = translated;

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

      const docAny = doc as typeof doc & { translationsJson?: string | null };
      const translations: Record<string, string> = docAny.translationsJson
        ? (typeof docAny.translationsJson === "string" ? JSON.parse(docAny.translationsJson) : docAny.translationsJson) || {}
        : {};

      let textToTranslate = doc.textOriginal;
      if (sourceLang && sourceLang !== "auto") {
        if (sourceLang === "SR" && doc.textSr) textToTranslate = doc.textSr;
        else if (sourceLang === "EN" && doc.textEn) textToTranslate = doc.textEn;
        else if (translations[sourceLang]) textToTranslate = translations[sourceLang];
      }

      if (!textToTranslate) {
        return NextResponse.json({ error: "No text to translate" }, { status: 400 });
      }

      const translated = await translator.translate({
        text: textToTranslate,
        sourceLang: sourceLang && sourceLang !== "auto" ? sourceLang : undefined,
        targetLang,
      });

      const updateData: { textSr?: string; textEn?: string; translationsJson?: string } = {};
      if (targetLang === "SR") updateData.textSr = translated;
      else if (targetLang === "EN") updateData.textEn = translated;
      else {
        translations[targetLang] = translated;
        updateData.translationsJson = JSON.stringify(translations);
      }

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

      const updateData: { textSr?: string; textEn?: string } = {};
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

      const updateData: { captionSr?: string; captionEn?: string } = {};
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

