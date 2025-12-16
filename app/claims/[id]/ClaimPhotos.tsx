"use client";

import { Card } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface ClaimPhotosProps {
  claim: any;
  isReadOnly?: boolean;
}

export function ClaimPhotos({ claim, isReadOnly = false }: ClaimPhotosProps) {
  const [translating, setTranslating] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});

  const handleTranslate = async (photoId: string, photo: any) => {
    const srcLang = sourceLang[photoId] || "SR";
    const tgtLang = targetLang[photoId] || "EN";
    
    if (srcLang === tgtLang) {
      alert("Source and target languages must be different");
      return;
    }

    setTranslating(photoId);
    try {
      const res = await fetch(`/api/claims/${claim.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "photoCaption",
          photoId,
          targetLang: tgtLang,
          sourceLang: srcLang,
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

  if (!claim.photos || claim.photos.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No photos found</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {claim.photos.map((photo: any) => (
        <Card key={photo.id} className="p-4">
          {photo.attachment && (
            <AspectRatio ratio={16 / 9} className="mb-2">
              <img
                src={`/api/files/${photo.attachment.id}`}
                alt={photo.captionSr || "Photo"}
                className="w-full h-full object-cover rounded"
              />
            </AspectRatio>
          )}
          {photo.groupLabel && (
            <p className="text-sm font-medium mb-1">{photo.groupLabel}</p>
          )}
          {photo.captionSr && (
            <p className="text-sm text-muted-foreground mb-2">{photo.captionSr}</p>
          )}
          {photo.captionEn && (
            <p className="text-sm text-muted-foreground">{photo.captionEn}</p>
          )}
          {(photo.captionSr || photo.captionEn) && (
            <div className="flex items-center gap-2 mt-2">
              <Select 
                value={sourceLang[photo.id] || "SR"} 
                onValueChange={(val) => setSourceLang({ ...sourceLang, [photo.id]: val })}
                disabled={translating === photo.id}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SR">SR</SelectItem>
                  <SelectItem value="EN">EN</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm">→</span>
              <Select 
                value={targetLang[photo.id] || "EN"} 
                onValueChange={(val) => setTargetLang({ ...targetLang, [photo.id]: val })}
                disabled={translating === photo.id}
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
                onClick={() => handleTranslate(photo.id, photo)}
                disabled={translating === photo.id || (sourceLang[photo.id] || "SR") === (targetLang[photo.id] || "EN")}
              >
                <Languages className="h-4 w-4 mr-2" />
                {translating === photo.id ? "Translating..." : "Translate"}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

