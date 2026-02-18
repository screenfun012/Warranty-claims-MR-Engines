"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { Languages, Upload, X, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

const FileViewerModal = dynamic(
  () => import("@/components/file-viewer-modal").then((m) => ({ default: m.FileViewerModal })),
  { ssr: false, loading: () => <Skeleton className="h-0 w-0 overflow-hidden" /> }
);
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ClaimPhotosProps {
  claim: any;
  isReadOnly?: boolean;
  onRefresh?: () => void;
}

interface UploadedFile {
  file: File;
  id: string;
}

export function ClaimPhotos({ claim, isReadOnly = false, onRefresh }: ClaimPhotosProps) {
  const router = useRouter();
  const t = useTranslations();
  const [translating, setTranslating] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

  const handleTranslate = async (photoId: string, photo: any) => {
    const srcLang = sourceLang[photoId] || "SR";
    const tgtLang = targetLang[photoId] || "EN";
    
    if (srcLang === tgtLang) {
      alert(t("claims.photos.translate.sameLanguage"));
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
        alert(t("claims.photos.translate.success"));
        if (onRefresh) {
          onRefresh();
        } else {
          router.refresh();
        }
      } else {
        alert(t("claims.photos.translate.error") + ": " + (data.error || t("common.error")));
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert(t("claims.photos.translate.error") + ": " + (error instanceof Error ? error.message : t("common.error")));
    } finally {
      setTranslating(null);
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress({});
    let successCount = 0;
    let errorCount = 0;
    const totalFiles = files.length;
    
    try {
      // Upload all files with progress tracking
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const fileId = `${file.name}-${index}`;
        try {
          // Simulate progress for better UX
          setUploadProgress(prev => ({ ...prev, [fileId]: 10 }));
          
          const formData = new FormData();
          formData.append("file", file);

          setUploadProgress(prev => ({ ...prev, [fileId]: 50 }));

          const res = await fetch(`/api/claims/${claim.id}/upload-attachment`, {
            method: "POST",
            body: formData,
          });

          setUploadProgress(prev => ({ ...prev, [fileId]: 90 }));

          if (res.ok) {
            setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
            successCount++;
            return { success: true, fileName: file.name, fileId };
          } else {
            const errorText = await res.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || "Unknown error" };
            }
            errorCount++;
            return { success: false, fileName: file.name, error: errorData.error || "Unknown error", fileId };
          }
        } catch (fileError) {
          errorCount++;
          return { 
            success: false, 
            fileName: file.name, 
            error: fileError instanceof Error ? fileError.message : "Unknown error",
            fileId
          };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Clear progress after a short delay
      setTimeout(() => {
        setUploadProgress({});
      }, 1000);
      
      // Show errors if any
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors.map(e => `${e.fileName}: ${e.error}`).join(', ');
        toast.error(t("claims.photos.upload.error", { count: errors.length }), {
          description: errorMessages,
        });
      }
      
      // Refresh if at least one file was uploaded successfully
      if (successCount > 0) {
        toast.success(t("claims.photos.upload.success", { count: successCount }), {
          description: totalFiles > successCount ? t("claims.photos.upload.partialError", { count: errorCount }) : undefined,
        });
        
        // Small delay to ensure backend has processed the upload
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh the claim data
        if (onRefresh) {
          try {
            await onRefresh();
          } catch (refreshError) {
            console.error("Error refreshing claim data:", refreshError);
          }
        }
      }
    } catch (error) {
      console.error("Error in upload handler:", error);
      toast.error(t("claims.photos.upload.errorGeneral"), {
        description: error instanceof Error ? error.message : t("common.error"),
      });
    } finally {
      setUploading(false);
      // Reset input
      if (e.target) {
        e.target.value = "";
      }
    }
  }, [claim.id, onRefresh]);

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDeleteClick = useCallback((attachmentId: string) => {
    setAttachmentToDelete(attachmentId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!attachmentToDelete) return;

    setDeleting(attachmentToDelete);
    try {
      const res = await fetch(`/api/claims/${claim.id}/delete-attachment?attachmentId=${attachmentToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("claims.photos.deleteSuccess"));
        // Use onRefresh callback if available, otherwise just close dialog
        if (onRefresh) {
          await onRefresh();
        }
        // No need to reload - onRefresh will update the UI
      } else {
        const errorData = await res.json();
        toast.error(t("claims.photos.deleteError"), {
          description: errorData.error || t("common.error"),
        });
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error(t("claims.photos.deleteError"), {
        description: error instanceof Error ? error.message : t("common.error"),
      });
    } finally {
      setDeleting(null);
      setAttachmentToDelete(null);
    }
  }, [attachmentToDelete, claim.id, onRefresh]);

  // Collect ALL internal uploads (photos, PDFs, DOCX) - everything we uploaded
  const internalFiles = useMemo(() => {
    const files: any[] = [];
    
    // Add internal photos (images we uploaded)
    if (claim.photos) {
      claim.photos.forEach((photo: any) => {
        if (photo.internalUpload === true || 
            (photo.attachment?.source === "INTERNAL_TEARDOWN" || photo.attachment?.source === "OTHER")) {
          if (photo.attachment) {
            files.push({
              ...photo.attachment,
              type: 'image',
              photoId: photo.id,
            });
          }
        }
      });
    }
    
    // Add internal documents (PDF/DOCX we uploaded)
    if (claim.clientDocuments) {
      claim.clientDocuments.forEach((doc: any) => {
        if (doc.attachment && 
            (doc.attachment.source === "INTERNAL_TEARDOWN" || doc.attachment.source === "OTHER")) {
          // Check if already added (shouldn't happen, but just in case)
          const exists = files.some((f: any) => f.id === doc.attachment.id);
          if (!exists) {
            const isPdf = doc.attachment.mimeType?.includes("pdf") || 
                         doc.attachment.fileName?.toLowerCase().endsWith(".pdf");
            const isDocx = doc.attachment.mimeType?.includes("wordprocessingml") ||
                          doc.attachment.fileName?.toLowerCase().endsWith(".docx") ||
                          doc.attachment.fileName?.toLowerCase().endsWith(".doc");
            files.push({
              ...doc.attachment,
              type: isPdf ? 'pdf' : isDocx ? 'docx' : 'document',
              clientDocumentId: doc.id,
            });
          }
        }
      });
    }
    
    // Sort by upload date (newest first)
    return files.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [claim.photos, claim.clientDocuments]);

  // Memoize filtered arrays to avoid recalculating on every render
  const images = useMemo(() => 
    internalFiles.filter((f: any) => f.type === 'image'),
    [internalFiles]
  );
  
  const documents = useMemo(() => 
    internalFiles.filter((f: any) => f.type !== 'image'),
    [internalFiles]
  );

  const handleImageClick = useCallback((imageIndex: number) => {
    const imageFile = images[imageIndex];
    if (!imageFile) return;
    
    const fileIndex = internalFiles.findIndex((f: any) => f.id === imageFile.id);
    setViewerIndex(fileIndex >= 0 ? fileIndex : 0);
    setViewerOpen(true);
  }, [images, internalFiles]);

  const handleDocumentClick = useCallback((file: any) => {
    const fileIndex = internalFiles.findIndex((f: any) => f.id === file.id);
    setViewerIndex(fileIndex >= 0 ? fileIndex : 0);
    setViewerOpen(true);
  }, [internalFiles]);

  return (
    <>
      {/* Upload Section */}
      {!isReadOnly && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t("claims.photos.upload.title")}</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="photo-upload">{t("claims.photos.files")}</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="photo-upload"
                  accept="image/*,.pdf,.doc,.docx,video/*,.mp4,.webm,.mov,.m4v,.ogg"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  className="w-full"
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? t("claims.photos.upload.uploading") : t("claims.photos.upload.selectFiles")}
                </Button>
                {uploading && Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(uploadProgress).map(([fileId, progress]) => {
                      const fileName = fileId.split('-').slice(0, -1).join('-');
                      return (
                        <div key={fileId} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate flex-1">{fileName}</span>
                            <span className="text-muted-foreground ml-2">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Internal Files Display */}
      {internalFiles.length === 0 && uploadedFiles.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">{t("claims.photos.noPhotos")}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Images Section */}
          {images.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {t("claims.photos.images")} ({images.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((file: any, index: number) => (
                  <Card key={file.id} className="p-6 flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="mb-3 rounded-lg overflow-hidden bg-muted/30 border border-border">
                      <AspectRatio ratio={4 / 3} className="bg-muted/50">
                        <img
                          src={`/api/files/${file.id}`}
                          alt={file.fileName || "Image"}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(images.findIndex((f: any) => f.id === file.id))}
                        />
                      </AspectRatio>
                    </div>
                    <p className="text-sm font-medium mb-2 truncate" title={file.fileName}>
                      {file.fileName || t("claims.photos.imageNumber", { number: index + 1 })}
                    </p>
                    {!isReadOnly && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteClick(file.id);
                          }}
                          disabled={deleting === file.id}
                          className="w-full"
                        >
                          {deleting === file.id ? (
                            <>
                              <X className="h-4 w-4 mr-2 animate-spin" />
                              {t("common.loading")}
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete")}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {documents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("claims.photos.documents")} ({documents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((file: any) => (
                  <Card key={file.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.fileName || t("claims.photos.document")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(file.createdAt || Date.now()).toLocaleDateString('sr-RS')}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDocumentClick(file)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {t("common.open")}
                        </Button>
                        {!isReadOnly && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(file.id)}
                            disabled={deleting === file.id}
                          >
                            {deleting === file.id ? (
                              <X className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <FileViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={internalFiles.map((file: any) => ({
          id: file.id,
          url: `/api/files/${file.id}`,
          fileName: file.fileName || t("claims.photos.fileNumber", { id: file.id }),
          mimeType: file.mimeType,
        }))}
        initialIndex={viewerIndex}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("claims.photos.delete.title")}
        description={t("claims.photos.deleteConfirm")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </>
  );
}

