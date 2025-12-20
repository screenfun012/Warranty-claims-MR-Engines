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

export function ClaimOverview({ claim, onUpdate, isReadOnly = false }: ClaimOverviewProps) {
  const [translating, setTranslating] = useState(false);
  const [sourceLang, setSourceLang] = useState<string>("SR");
  const [targetLang, setTargetLang] = useState<string>("EN");

  // Initialize languages from existing summaries
  useEffect(() => {
    // If Serbian summary exists, use it as source
    if (claim.summarySr) {
      setSourceLang("SR");
    } else if (claim.summaryEn) {
      setSourceLang("EN");
    } else {
      // Check other languages
      const langWithContent = LANGUAGES.find(lang => claim[lang.field]);
      if (langWithContent) {
        setSourceLang(langWithContent.code);
      }
    }
  }, [claim]);

  const getSummaryValue = (field: string) => {
    return claim[field] || "";
  };

  const getSourceValue = () => {
    const sourceLangConfig = LANGUAGES.find(l => l.code === sourceLang);
    return sourceLangConfig ? getSummaryValue(sourceLangConfig.field) : "";
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

    const textToTranslate = getSourceValue();
    if (!textToTranslate) {
      alert(`No ${sourceLangConfig.name} summary to translate`);
      return;
    }

    setTranslating(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summary",
          targetLang: targetLang.toUpperCase(),
          sourceLang: sourceLang.toUpperCase(),
        }),
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
      <div className="flex items-center gap-2 mb-6">
        <Languages className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-primary">Summary</h2>
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
            onChange={(e) => !isReadOnly && handleSourceTextChange(e.target.value)}
            rows={10}
            placeholder={`Enter summary in ${sourceLangConfig?.name || sourceLang}...`}
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
