"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Languages, ArrowLeftRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ClaimOverviewProps {
  claim: any;
  onUpdate: (updates: any) => void;
  isReadOnly?: boolean;
}

interface LanguageConfig {
  code: string;
  name: string;
  field: string;
  isBeta?: boolean;
}

const LANGUAGES: LanguageConfig[] = [
  { code: "SR", name: "Serbian", field: "summarySr" },
  { code: "EN", name: "English", field: "summaryEn" },
  { code: "DE", name: "German", field: "summaryDe", isBeta: true },
  { code: "FR", name: "French", field: "summaryFr", isBeta: true },
  { code: "NL", name: "Dutch", field: "summaryNl", isBeta: true },
];

import { getCleanEmailBody } from "@/lib/email/emailBodyCleaner";

// Helper function to get email body text from first inbound message
const getEmailBodyText = (claim: any): string => {
  // Find first inbound message from email threads
  const firstThread = claim.emailThreads?.[0];
  if (firstThread?.messages) {
    const firstInboundMessage = firstThread.messages.find((msg: any) => msg.direction === "INBOUND");
    if (firstInboundMessage) {
      return getCleanEmailBody({
        bodyText: firstInboundMessage.bodyText,
        bodyHtml: firstInboundMessage.bodyHtml,
      });
    }
  }
  return "";
};

export function ClaimOverview({ claim, onUpdate, isReadOnly = false }: ClaimOverviewProps) {
  const t = useTranslations();
  const [translating, setTranslating] = useState(false);
  const [sourceLang, setSourceLang] = useState<string>("SR");
  const [targetLang, setTargetLang] = useState<string>("EN");
  const [useEmailBody, setUseEmailBody] = useState(false);

  // Get email body text
  const emailBodyText = getEmailBodyText(claim);

  // Initialize languages from existing summaries or email body
  useEffect(() => {
    // If email body exists and no summary, use email body
    if (emailBodyText && !claim.summarySr && !claim.summaryEn) {
      setUseEmailBody(true);
      setSourceLang("SR");
    } else if (claim.summarySr) {
      setSourceLang("SR");
      setUseEmailBody(false);
    } else if (claim.summaryEn) {
      setSourceLang("EN");
      setUseEmailBody(false);
    } else {
      // Check other languages
      const langWithContent = LANGUAGES.find(lang => claim[lang.field]);
      if (langWithContent) {
        setSourceLang(langWithContent.code);
        setUseEmailBody(false);
      }
    }
  }, [claim, emailBodyText]);

  const getSummaryValue = (field: string) => {
    return claim[field] || "";
  };

  const [sourceText, setSourceText] = useState("");
  const [targetTexts, setTargetTexts] = useState<Record<string, string>>({});
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [isEditingTarget, setIsEditingTarget] = useState<Record<string, boolean>>({});

  // Initialize source text when claim or useEmailBody changes (only if not currently editing)
  useEffect(() => {
    if (!isEditingSource) {
      if (useEmailBody) {
        setSourceText(emailBodyText);
      } else {
        const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
        setSourceText(sourceLangConfig ? getSummaryValue(sourceLangConfig.field) : "");
      }
    }
  }, [useEmailBody, emailBodyText, sourceLang, claim, isEditingSource]);

  // Initialize target texts when claim changes (only if not currently editing that target)
  useEffect(() => {
    LANGUAGES.forEach(lang => {
      if (!isEditingTarget[lang.code]) {
        const value = getSummaryValue(lang.field);
        setTargetTexts(prev => ({ ...prev, [lang.code]: value }));
      }
    });
  }, [claim, isEditingTarget]);

  const getSourceValue = () => {
    return sourceText;
  };

  const getTargetValue = () => {
    // Use local state if editing, otherwise use claim value
    if (isEditingTarget[targetLang] !== undefined && isEditingTarget[targetLang]) {
      return targetTexts[targetLang] ?? "";
    }
    const targetLangConfig = LANGUAGES.find(l => l.code === targetLang);
    return targetLangConfig ? getSummaryValue(targetLangConfig.field) : "";
  };

  const handleSourceChange = (value: string) => {
    setSourceLang(value);
    // If switching source language, try to keep target different
    if (value === targetLang) {
      // Find a different language for target
      const otherLang = LANGUAGES.find(l => l.code !== value);
      if (otherLang) {
        setTargetLang(otherLang.code);
      }
    }
  };

  const handleTargetChange = (value: string) => {
    setTargetLang(value);
    // If switching target language, try to keep source different
    if (value === sourceLang) {
      // Find a different language for source
      const otherLang = LANGUAGES.find(l => l.code !== value);
      if (otherLang) {
        setSourceLang(otherLang.code);
      }
    }
  };

  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  const handleSourceTextChange = (value: string) => {
    const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
    if (sourceLangConfig) {
      onUpdate({ [sourceLangConfig.field]: value });
    }
  };

  const handleTargetTextChange = (value: string) => {
    const targetLangConfig = LANGUAGES.find(l => l.code === targetLang);
    if (targetLangConfig) {
      onUpdate({ [targetLangConfig.field]: value });
    }
  };

  const handleTranslate = async () => {
    if (sourceLang === targetLang) {
      alert(t("claims.overview.translate.sameLanguage"));
      return;
    }

    const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
    if (!sourceLangConfig) {
      alert(t("claims.overview.translate.invalidSource"));
      return;
    }

    const textToTranslate = sourceText; // Use current sourceText state (which can be edited)
    if (!textToTranslate || !textToTranslate.trim()) {
      if (useEmailBody) {
        alert(t("claims.overview.translate.noEmailBody"));
      } else {
        alert(t("claims.overview.translate.noSummary", { lang: sourceLangConfig.name }));
      }
      return;
    }

    setTranslating(true);
    try {
      // If using email body, send the text directly, otherwise use summary type
      const requestBody = useEmailBody 
        ? {
            type: "text",
            text: textToTranslate,
            targetLang: targetLang.toUpperCase(),
            sourceLang: sourceLang.toUpperCase(),
          }
        : {
            type: "summary",
            targetLang: targetLang.toUpperCase(),
            sourceLang: sourceLang.toUpperCase(),
          };

      const res = await fetch(`/api/claims/${claim.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.error || "Unknown error";
        // Remove duplicate "Translation failed:" prefix if present
        const cleanError = errorMessage.startsWith("Translation failed: ") 
          ? errorMessage.substring("Translation failed: ".length)
          : errorMessage;
        alert(t("claims.overview.translate.error") + ": " + cleanError);
        return;
      }
      
      const data = await res.json();
      if (data.translated) {
        const targetLangConfig = LANGUAGES.find(l => l.code === targetLang);
        if (targetLangConfig) {
          onUpdate({ [targetLangConfig.field]: data.translated });
        }
      } else {
        const errorMessage = data.error || t("common.error");
        const cleanError = errorMessage.startsWith("Translation failed: ") 
          ? errorMessage.substring("Translation failed: ".length)
          : errorMessage;
        alert(t("claims.overview.translate.error") + ": " + cleanError);
      }
    } catch (error) {
      console.error("Translation error:", error);
      const errorMessage = error instanceof Error ? error.message : t("common.error");
      const cleanError = errorMessage.startsWith("Translation failed: ") 
        ? errorMessage.substring("Translation failed: ".length)
        : errorMessage;
      alert(t("claims.overview.translate.error") + ": " + cleanError);
    } finally {
      setTranslating(false);
    }
  };

  const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
  const targetLangConfig = LANGUAGES.find(l => l.code === targetLang);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">{t("claims.tabs.summary")}</h2>
        </div>
        {emailBodyText && (
          <Button
            variant={useEmailBody ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUseEmailBody(!useEmailBody);
              if (!useEmailBody) {
                // When switching to email body, set source to SR
                setSourceLang("SR");
              }
            }}
            disabled={isReadOnly}
          >
            {useEmailBody ? t("claims.overview.useEmailBody") : t("claims.overview.useSummary")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Language */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">{t("claims.overview.from")}</Label>
            <Select value={sourceLang} onValueChange={handleSourceChange} disabled={isReadOnly}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2">
                      <span>{lang.name}</span>
                      {lang.isBeta && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-muted-foreground">
                          Beta
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={getSourceValue()}
            onChange={(e) => {
              if (!isReadOnly) {
                setIsEditingSource(true);
                setSourceText(e.target.value);
              }
            }}
            onBlur={() => {
              if (!isReadOnly) handleSourceTextChange(getSourceValue());
              setIsEditingSource(false);
            }}
            rows={10}
            placeholder={useEmailBody 
              ? t("claims.overview.emailBodyPlaceholder")
              : t("claims.overview.summaryPlaceholder", { lang: sourceLangConfig?.name || sourceLang })}
            disabled={isReadOnly}
            className="min-h-[200px] resize-y whitespace-pre-wrap"
          />
        </div>

        {/* Target Language */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">{t("claims.overview.to")}</Label>
            <Select value={targetLang} onValueChange={handleTargetChange} disabled={isReadOnly}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2">
                      <span>{lang.name}</span>
                      {lang.isBeta && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-muted-foreground">
                          Beta
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={getTargetValue()}
            onChange={(e) => {
              if (!isReadOnly) {
                setIsEditingTarget(prev => ({ ...prev, [targetLang]: true }));
                setTargetTexts(prev => ({ ...prev, [targetLang]: e.target.value }));
              }
            }}
            onBlur={() => {
              if (!isReadOnly) handleTargetTextChange(getTargetValue());
              setIsEditingTarget(prev => ({ ...prev, [targetLang]: false }));
            }}
            rows={10}
            placeholder={t("claims.overview.translatedPlaceholder", { lang: targetLangConfig?.name || targetLang })}
            disabled={isReadOnly}
            className="min-h-[200px] resize-y whitespace-pre-wrap"
          />
        </div>
      </div>

      {/* Translation Controls - Centered between the two columns */}
      <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t">
        <Button
          variant="outline"
          size="default"
          onClick={handleSwapLanguages}
          disabled={isReadOnly}
          className="gap-2"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {t("claims.overview.swapLanguages")}
        </Button>
        <Button
          variant="default"
          size="default"
          onClick={handleTranslate}
          disabled={translating || sourceLang === targetLang || isReadOnly || !getSourceValue()}
          className="gap-2"
        >
          <Languages className="h-4 w-4" />
          {translating ? t("claims.overview.translating") : t("inbox.translate")}
        </Button>
      </div>
    </Card>
  );
}
