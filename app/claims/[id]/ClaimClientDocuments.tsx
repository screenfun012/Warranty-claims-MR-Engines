"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Languages, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClaimClientDocumentsProps {
  claim: any;
  isReadOnly?: boolean;
}

export function ClaimClientDocuments({ claim, isReadOnly = false }: ClaimClientDocumentsProps) {
  const [extracting, setExtracting] = useState<string | null>(null);
  const [translating, setTranslating] = useState<{ docId: string; lang: string; sourceLang: string } | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});

  const handleExtractPdf = async (attachmentId: string) => {
    setExtracting(attachmentId);
    try {
      const res = await fetch(`/api/claims/${claim.id}/extract-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Text extracted successfully");
        window.location.reload();
      } else {
        alert("Failed to extract text: " + data.error);
      }
    } catch (error) {
      console.error("Error extracting PDF:", error);
      alert("Failed to extract text");
    } finally {
      setExtracting(null);
    }
  };

  const handleTranslate = async (docId: string) => {
    const srcLang = sourceLang[docId] || "auto";
    const tgtLang = targetLang[docId] || "EN";
    
    if (srcLang === tgtLang) {
      alert("Source and target languages must be different");
      return;
    }

    setTranslating({ docId, lang: tgtLang, sourceLang: srcLang });
    try {
      const res = await fetch(`/api/claims/${claim.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clientDocument",
          clientDocumentId: docId,
          targetLang: tgtLang,
          sourceLang: srcLang === "auto" ? undefined : srcLang,
        }),
      });
      const data = await res.json();
      if (data.translated) {
        alert("Translation completed");
        window.location.reload();
      } else {
        alert("Translation failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Translation failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setTranslating(null);
    }
  };

  if (!claim.clientDocuments || claim.clientDocuments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No client documents found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {claim.clientDocuments.map((doc: any) => (
        <Card key={doc.id} className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold">{doc.attachment?.fileName || "Document"}</h3>
              <p className="text-sm text-muted-foreground">
                Original: {doc.originalLanguage || "Unknown"} | Detected: {doc.detectedLanguage || "Unknown"}
              </p>
            </div>
            {doc.attachment?.mimeType.includes("pdf") && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/files/${doc.attachment.id}`, "_blank")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Preview PDF
                </Button>
                {!doc.textOriginal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExtractPdf(doc.attachment.id)}
                    disabled={extracting === doc.attachment.id}
                  >
                    {extracting === doc.attachment.id ? "Extracting..." : "Extract Text"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {doc.textOriginal && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Original Text</Label>
                <Textarea value={doc.textOriginal} rows={6} readOnly className="font-mono text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Serbian Translation</Label>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={sourceLang[doc.id] || "auto"} 
                      onValueChange={(val) => setSourceLang({ ...sourceLang, [doc.id]: val })}
                      disabled={translating?.docId === doc.id}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="SR">SR</SelectItem>
                        <SelectItem value="EN">EN</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm">→</span>
                    <Select 
                      value={targetLang[doc.id] || "SR"} 
                      onValueChange={(val) => setTargetLang({ ...targetLang, [doc.id]: val })}
                      disabled={translating?.docId === doc.id}
                    >
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
                      onClick={() => handleTranslate(doc.id)}
                      disabled={translating?.docId === doc.id || (sourceLang[doc.id] || "auto") === (targetLang[doc.id] || "SR")}
                    >
                      <Languages className="h-4 w-4 mr-2" />
                      {translating?.docId === doc.id && translating?.lang === "SR" ? "Translating..." : "Translate to SR"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={doc.textSr || ""}
                  onChange={() => {}} // In real app, handle update
                  rows={6}
                  readOnly
                  placeholder="Serbian translation will appear here..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>English Translation</Label>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={sourceLang[doc.id] || "auto"} 
                      onValueChange={(val) => setSourceLang({ ...sourceLang, [doc.id]: val })}
                      disabled={translating?.docId === doc.id}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="SR">SR</SelectItem>
                        <SelectItem value="EN">EN</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm">→</span>
                    <Select 
                      value={targetLang[doc.id] || "EN"} 
                      onValueChange={(val) => setTargetLang({ ...targetLang, [doc.id]: val })}
                      disabled={translating?.docId === doc.id}
                    >
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
                      onClick={() => handleTranslate(doc.id)}
                      disabled={translating?.docId === doc.id || (sourceLang[doc.id] || "auto") === (targetLang[doc.id] || "EN")}
                    >
                      <Languages className="h-4 w-4 mr-2" />
                      {translating?.docId === doc.id && translating?.lang === "EN" ? "Translating..." : "Translate to EN"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={doc.textEn || ""}
                  onChange={() => {}} // In real app, handle update
                  rows={6}
                  readOnly
                  placeholder="English translation will appear here..."
                />
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
