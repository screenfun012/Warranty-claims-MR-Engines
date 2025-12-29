"use client";

import { useState, useEffect } from "react";
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

  // Initialize source text when claim or useEmailBody changes
  useEffect(() => {
    if (useEmailBody) {
      setSourceText(emailBodyText);
    } else {
      const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
      setSourceText(sourceLangConfig ? getSummaryValue(sourceLangConfig.field) : "");
    }
  }, [useEmailBody, emailBodyText, sourceLang, claim]);

  const getSourceValue = () => {
    return sourceText;
  };

  const getTargetValue = () => {
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
      alert("Source and target languages cannot be the same");
      return;
    }

    const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
    if (!sourceLangConfig) {
      alert("Invalid source language");
      return;
    }

    const textToTranslate = sourceText; // Use current sourceText state (which can be edited)
    if (!textToTranslate || !textToTranslate.trim()) {
      if (useEmailBody) {
        alert("No email body text to translate");
      } else {
        alert(`No ${sourceLangConfig.name} summary to translate`);
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
      const data = await res.json();
      if (data.translated) {
        const targetLangConfig = LANGUAGES.find(l => l.code === targetLang);
        if (targetLangConfig) {
          onUpdate({ [targetLangConfig.field]: data.translated });
        }
      } else {
        alert("Translation failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Translation failed: " + (error instanceof Error ? error.message : "Unknown error"));
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
          <h2 className="text-lg font-semibold text-primary">Summary</h2>
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
            {useEmailBody ? "Koristi Email Body" : "Koristi Summary"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Language */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">From</Label>
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
                const newValue = e.target.value;
                setSourceText(newValue);
                // Save to summary field
                handleSourceTextChange(newValue);
              }
            }}
            rows={10}
            placeholder={useEmailBody 
              ? "Email body text (editable - extracted from first inbound email)" 
              : `Enter summary in ${sourceLangConfig?.name || sourceLang}...`}
            disabled={isReadOnly}
            className="min-h-[200px] resize-y"
          />
        </div>

        {/* Target Language */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">To</Label>
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
            onChange={(e) => !isReadOnly && handleTargetTextChange(e.target.value)}
            rows={10}
            placeholder={`Translated summary in ${targetLangConfig?.name || targetLang}...`}
            disabled={isReadOnly}
            className="min-h-[200px] resize-y"
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
          Swap Languages
        </Button>
        <Button
          variant="default"
          size="default"
          onClick={handleTranslate}
          disabled={translating || sourceLang === targetLang || isReadOnly || !getSourceValue()}
          className="gap-2"
        >
          <Languages className="h-4 w-4" />
          {translating ? "Translating..." : "Translate"}
        </Button>
      </div>
    </Card>
  );
}
