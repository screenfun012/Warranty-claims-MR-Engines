"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClaimOverviewProps {
  claim: any;
  onUpdate: (updates: any) => void;
  isReadOnly?: boolean;
}

export function ClaimOverview({ claim, onUpdate, isReadOnly = false }: ClaimOverviewProps) {
  const [translating, setTranslating] = useState(false);
  const [sourceLang, setSourceLang] = useState<string>("SR");
  const [targetLang, setTargetLang] = useState<string>("EN");

  const handleTranslateSummary = async () => {
    const textToTranslate = sourceLang === "SR" ? claim.summarySr : claim.summaryEn;
    if (!textToTranslate) {
      alert(`No ${sourceLang === "SR" ? "Serbian" : "English"} summary to translate`);
      return;
    }

    setTranslating(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summary",
          targetLang,
          sourceLang,
        }),
      });
      const data = await res.json();
      if (data.translated) {
        if (targetLang === "EN") {
          onUpdate({ summaryEn: data.translated });
        } else if (targetLang === "SR") {
          onUpdate({ summarySr: data.translated });
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

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Summary</h2>
      <div className="space-y-4">
        <div>
          <Label>Summary (Serbian)</Label>
          <Textarea
            value={claim.summarySr || ""}
            onChange={(e) => !isReadOnly && onUpdate({ summarySr: e.target.value })}
            rows={5}
            placeholder="Enter summary in Serbian..."
            disabled={isReadOnly}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Summary (English)</Label>
            {(claim.summarySr || claim.summaryEn) && (
              <div className="flex items-center gap-2">
                <Select value={sourceLang} onValueChange={setSourceLang} disabled={translating}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SR">SR</SelectItem>
                    <SelectItem value="EN">EN</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm">→</span>
                <Select value={targetLang} onValueChange={setTargetLang} disabled={translating}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SR">SR</SelectItem>
                    <SelectItem value="EN">EN</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTranslateSummary}
                  disabled={translating || sourceLang === targetLang || isReadOnly}
                >
                  <Languages className="h-4 w-4 mr-2" />
                  {translating ? "Translating..." : "Translate"}
                </Button>
              </div>
            )}
          </div>
          <Textarea
            value={claim.summaryEn || ""}
            onChange={(e) => !isReadOnly && onUpdate({ summaryEn: e.target.value })}
            rows={5}
            placeholder="Enter or translate summary in English..."
            disabled={isReadOnly}
          />
        </div>
      </div>
    </Card>
  );
}

