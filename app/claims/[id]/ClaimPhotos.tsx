"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Languages, Upload, X, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileViewerModal } from "@/components/file-viewer-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [translating, setTranslating] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

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
        if (onRefresh) {
          onRefresh();
        } else {
          router.refresh();
        }
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Upload all files in parallel for better performance
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`/api/claims/${claim.id}/upload-attachment`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            successCount++;
            return { success: true, fileName: file.name };
          } else {
            const errorText = await res.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || "Unknown error" };
            }
            errorCount++;
            return { success: false, fileName: file.name, error: errorData.error || "Unknown error" };
          }
        } catch (fileError) {
          errorCount++;
          return { 
            success: false, 
            fileName: file.name, 
            error: fileError instanceof Error ? fileError.message : "Unknown error" 
          };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Show errors if any
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors.map(e => `${e.fileName}: ${e.error}`).join('\n');
        alert(`Neuspešno učitavanje:\n${errorMessages}`);
      }
      
      // Refresh if at least one file was uploaded successfully
      if (successCount > 0) {
        alert(`Uspešno učitano ${successCount} fajlova!`);
        
        // Small delay to ensure backend has processed the upload
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh the claim data
        if (onRefresh) {
          try {
            await onRefresh();
          } catch (refreshError) {
            console.error("Error refreshing claim data:", refreshError);
            window.location.reload();
          }
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Error in upload handler:", error);
      alert("Neuspešno učitavanje fajla: " + (error instanceof Error ? error.message : "Unknown error"));
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
        if (onRefresh) {
          await onRefresh();
        } else {
          window.location.reload();
        }
      } else {
        const errorData = await res.json();
        alert(`Neuspešno brisanje: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert("Neuspešno brisanje fajla: " + (error instanceof Error ? error.message : "Unknown error"));
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
          <h3 className="text-lg font-semibold mb-4">Upload internih slika i dokumenata</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="photo-upload">Fajlovi</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="photo-upload"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  className="w-full"
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Učitava se..." : "Izaberi fajlove"}
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((uploaded) => (
                      <div
                        key={uploaded.id}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <span className="text-sm">{uploaded.file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(uploaded.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
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
          <p className="text-muted-foreground">Nema internih fajlova za ovu reklamaciju.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Images Section */}
          {images.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Slike ({images.length})
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
                      {file.fileName || `Slika ${index + 1}`}
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
                              Brisanje...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
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
                Dokumenti ({documents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((file: any) => (
                  <Card key={file.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.fileName || "Document"}</p>
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
                          Otvori
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
          fileName: file.fileName || `File ${file.id}`,
          mimeType: file.mimeType,
        }))}
        initialIndex={viewerIndex}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Brisanje fajla"
        description="Da li ste sigurni da želite da obrišete ovaj fajl? Ova akcija je nepovratna."
        confirmText="Obriši"
        cancelText="Otkaži"
        variant="destructive"
      />
    </>
  );
}

