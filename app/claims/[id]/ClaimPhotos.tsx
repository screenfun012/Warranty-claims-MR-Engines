"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState } from "react";
import { FileViewerModal } from "@/components/file-viewer-modal";

interface ClaimPhotosProps {
  claim: any;
  isReadOnly?: boolean;
}

export function ClaimPhotos({ claim, isReadOnly = false }: ClaimPhotosProps) {
  const [translating, setTranslating] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  const photosWithAttachments = claim.photos.filter((photo: any) => photo.attachment);

  const handleImageClick = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {claim.photos.map((photo: any, index: number) => (
          <Card key={photo.id} className="p-4 flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
            {photo.attachment && (
              <div className="mb-3 rounded-lg overflow-hidden bg-muted/30 border border-border">
                <AspectRatio ratio={4 / 3} className="bg-muted/50">
                  <img
                    src={`/api/files/${photo.attachment.id}`}
                    alt={photo.captionSr || "Photo"}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleImageClick(photosWithAttachments.findIndex((p: any) => p.id === photo.id))}
                  />
                </AspectRatio>
              </div>
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

      <FileViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={photosWithAttachments.map((photo: any) => ({
          id: photo.attachment.id,
          url: `/api/files/${photo.attachment.id}`,
          fileName: photo.attachment.fileName || `Photo ${photo.id}`,
          mimeType: photo.attachment.mimeType,
        }))}
        initialIndex={viewerIndex}
      />
    </>
  );
}

