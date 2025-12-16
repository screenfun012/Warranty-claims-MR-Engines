/**
 * Translation layer with pluggable providers
 * Supports DeepL, OpenAI, Google, or none
 */

import { env } from "@/lib/config/env";

export interface Translator {
  translate(params: {
    text: string;
    sourceLang?: string; // e.g. "NL", "EN", "DE"
    targetLang: string;  // e.g. "SR", "EN"
  }): Promise<string>;
}

/**
 * Null translator that returns original text
 * Used when TRANSLATION_PROVIDER=none or API key is missing
 */
class NullTranslator implements Translator {
  async translate(params: { text: string; sourceLang?: string; targetLang: string }): Promise<string> {
    console.warn("Translation requested but no provider configured. Returning original text.");
    return params.text;
  }
}

/**
 * DeepL translator implementation
 */
class DeepLTranslator implements Translator {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api-free.deepl.com/v2/translate";
  }

  async translate(params: { text: string; sourceLang?: string; targetLang: string }): Promise<string> {
    try {
      // Map language codes to DeepL format
      // DeepL supported languages: https://www.deepl.com/docs-api/translating-text/
      const targetLangMap: Record<string, string> = {
        SR: "SR", // Serbian
        EN: "EN", // English (DeepL accepts both EN and EN-US, but EN is more universal)
        DE: "DE", // German
        NL: "NL", // Dutch
        FR: "FR", // French
      };

      const sourceLangMap: Record<string, string> = {
        SR: "SR", // Serbian - try explicit source language
        EN: "EN", // English
        DE: "DE", // German
        NL: "NL", // Dutch
        FR: "FR", // French
      };

      const target = targetLangMap[params.targetLang.toUpperCase()] || params.targetLang.toUpperCase();
      
      // Include source_lang if explicitly provided and not "auto"
      // DeepL free API may not support SR as source_lang, so we skip it and let DeepL auto-detect
      // This usually works better for Serbian
      let source: string | undefined = undefined;
      if (params.sourceLang && params.sourceLang.toUpperCase() !== "AUTO" && params.sourceLang.toUpperCase() !== "SR") {
        const mappedSource = sourceLangMap[params.sourceLang.toUpperCase()];
        if (mappedSource) {
          source = mappedSource;
        }
      }
      // For SR, we don't send source_lang - DeepL will auto-detect which usually works better

      const bodyParams: Record<string, string> = {
        text: params.text,
        target_lang: target,
      };
      
      // Only add source_lang if we have a valid mapped source language
      if (source) {
        bodyParams.source_lang = source;
      }

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(bodyParams),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.translations[0]?.text || params.text;
    } catch (error) {
      console.error("DeepL translation error:", error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

/**
 * OpenAI translator implementation
 */
class OpenAITranslator implements Translator {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.openai.com/v1/chat/completions";
    this.model = model || "gpt-3.5-turbo";
  }

  async translate(params: { text: string; sourceLang?: string; targetLang: string }): Promise<string> {
    try {
      // Map language codes to full names for better translation
      const langNameMap: Record<string, string> = {
        SR: "Serbian",
        EN: "English",
        DE: "German",
        NL: "Dutch",
        FR: "French",
      };
      
      const sourceLangName = params.sourceLang 
        ? (langNameMap[params.sourceLang.toUpperCase()] || params.sourceLang)
        : "the source language";
      const targetLangName = langNameMap[params.targetLang.toUpperCase()] || params.targetLang;

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the following text from ${sourceLangName} to ${targetLangName}. Return only the translation, no explanations.`,
            },
            {
              role: "user",
              content: params.text,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || params.text;
    } catch (error) {
      console.error("OpenAI translation error:", error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

/**
 * Google Translate implementation (using unofficial API - for production, use official Google Cloud Translation API)
 * This is a placeholder that would need proper implementation with Google Cloud Translation API
 */
class GoogleTranslator implements Translator {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async translate(params: { text: string; sourceLang?: string; targetLang: string }): Promise<string> {
    // Placeholder - would need to implement with Google Cloud Translation API
    // For now, return original text with a warning
    console.warn("Google Translator not fully implemented. Please use DeepL or OpenAI.");
    return params.text;
  }
}

/**
 * Get the configured translator instance based on environment variables
 */
export function getTranslator(): Translator {
  const provider = env.TRANSLATION_PROVIDER.toLowerCase();
  const apiKey = env.TRANSLATION_API_KEY;

  if (provider === "none" || !apiKey) {
    return new NullTranslator();
  }

  switch (provider) {
    case "deepl":
      return new DeepLTranslator(apiKey, env.TRANSLATION_BASE_URL || undefined);
    case "openai":
      return new OpenAITranslator(
        apiKey,
        env.TRANSLATION_BASE_URL || undefined,
        env.TRANSLATION_MODEL || undefined
      );
    case "google":
      return new GoogleTranslator(apiKey);
    default:
      console.warn(`Unknown translation provider: ${provider}. Using NullTranslator.`);
      return new NullTranslator();
  }
}

