"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Languages, FileText, Image as ImageIcon, Paperclip, Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileViewerModal } from "@/components/file-viewer-modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ClaimClientDocumentsProps {
  claim: any;
  isReadOnly?: boolean;
  onRefresh?: () => void;
}

export function ClaimClientDocuments({ claim, isReadOnly = false, onRefresh }: ClaimClientDocumentsProps) {
  const [extracting, setExtracting] = useState<string | null>(null);
  const [translating, setTranslating] = useState<{ docId: string; lang: string; sourceLang: string } | null>(null);
  const [sourceLang, setSourceLang] = useState<Record<string, string>>({});
  const [targetLang, setTargetLang] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

  // Collect all attachments from INBOUND email messages (from client) AND internally uploaded documents
  const clientAttachments = useMemo(() => {
    const attachments: any[] = [];
    
    // Add attachments from INBOUND email messages (from client)
    if (claim.emailThreads) {
      claim.emailThreads.forEach((thread: any) => {
        if (thread.messages) {
          thread.messages.forEach((message: any) => {
            // Only INBOUND messages (from client)
            if (message.direction === "INBOUND" && message.attachments) {
              message.attachments.forEach((attachment: any) => {
                // Skip logos and irrelevant attachments
                if (!attachment.isProbablyLogo && attachment.isRelevant !== false) {
                  attachments.push({
                    ...attachment,
                    messageDate: message.date,
                    messageFrom: message.from,
                    messageSubject: message.subject,
                  });
                }
              });
            }
          });
        }
      });
    }
    
    // Docs tab shows ONLY client-sent attachments (INBOUND emails)
    // Internal uploads are shown in "Naši fajlovi" tab, not here
    
    // Sort by date (oldest first)
    return attachments.sort((a, b) => 
      new Date(a.messageDate).getTime() - new Date(b.messageDate).getTime()
    );
  }, [claim.emailThreads, claim.clientDocuments]);

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

  if (clientAttachments.length === 0) {
    return (
      <Card className="p-6 hover:shadow-md transition-shadow">
        <p className="text-muted-foreground">Nema dokumenata i slika od klijenta.</p>
      </Card>
    );
  }

  // Group attachments by type
  const images = clientAttachments.filter((att: any) => 
    att.mimeType?.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName || "")
  );
  const pdfs = clientAttachments.filter((att: any) => 
    att.mimeType?.includes("pdf") || /\.pdf$/i.test(att.fileName || "")
  );
  const documents = clientAttachments.filter((att: any) => {
    const isImage = att.mimeType?.startsWith("image/") || 
                   /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName || "");
    const isPdf = att.mimeType?.includes("pdf") || /\.pdf$/i.test(att.fileName || "");
    return !isImage && !isPdf;
  });

  // Find clientDocument for PDFs (for text extraction)
  const getClientDocument = (attachmentId: string) => {
    return claim.clientDocuments?.find((doc: any) => doc.attachmentId === attachmentId);
  };

  const handleDeleteClick = (attachmentId: string) => {
    setAttachmentToDelete(attachmentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attachmentToDelete) return;

    setDeleting(attachmentToDelete);
    try {
      const res = await fetch(`/api/claims/${claim.id}/delete-attachment?attachmentId=${attachmentToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Refresh the claim data
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
  };

  // Check if attachment is internally uploaded (can be deleted)
  const isInternalUpload = (attachment: any) => {
    return attachment.source === "INTERNAL_TEARDOWN" || attachment.source === "OTHER";
  };

  return (
    <div className="space-y-6">
      {/* Images Section */}
      {images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Slike ({images.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((attachment: any, index: number) => (
              <Card key={attachment.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setViewerIndex(clientAttachments.findIndex((a: any) => a.id === attachment.id));
                setViewerOpen(true);
              }}>
                <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden mb-2">
                  <img
                    src={`/api/files/${attachment.id}`}
                    alt={attachment.fileName || "Image"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate" title={attachment.fileName}>
                  {attachment.fileName || `Slika ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(attachment.messageDate).toLocaleDateString('sr-RS')}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PDFs Section */}
      {pdfs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Dokumenti ({pdfs.length})
          </h3>
          <div className="space-y-4">
            {pdfs.map((attachment: any) => {
              const clientDoc = getClientDocument(attachment.id);
              return (
                <Card key={attachment.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold mb-1 truncate">{attachment.fileName || "Document"}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {new Date(attachment.messageDate).toLocaleDateString('sr-RS')}
                        </Badge>
                        {attachment.messageFrom && (
                          <span className="text-xs text-muted-foreground truncate">
                            Od: {attachment.messageFrom}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pdfIndex = clientAttachments.findIndex((a: any) => a.id === attachment.id);
                          setViewerIndex(pdfIndex >= 0 ? pdfIndex : 0);
                          setViewerOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Pregledaj
                      </Button>
                      {!clientDoc?.textOriginal && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtractPdf(attachment.id)}
                          disabled={extracting === attachment.id}
                        >
                          {extracting === attachment.id ? "Ekstraktuje..." : "Ekstraktuj tekst"}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {!isReadOnly && isInternalUpload(attachment) && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(attachment.id)}
                        disabled={deleting === attachment.id}
                        className="w-full"
                      >
                        {deleting === attachment.id ? (
                          <>
                            <X className="h-4 w-4 mr-2 animate-spin" />
                            Brisanje...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Obriši dokument
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {clientDoc?.textOriginal && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Originalni tekst</Label>
                        <Textarea value={clientDoc.textOriginal} rows={6} readOnly className="font-mono text-sm" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Srpski prevod</Label>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={sourceLang[clientDoc.id] || "auto"} 
                              onValueChange={(val) => setSourceLang({ ...sourceLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
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
                              value={targetLang[clientDoc.id] || "SR"} 
                              onValueChange={(val) => setTargetLang({ ...targetLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
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
                              onClick={() => handleTranslate(clientDoc.id)}
                              disabled={translating?.docId === clientDoc.id || (sourceLang[clientDoc.id] || "auto") === (targetLang[clientDoc.id] || "SR")}
                            >
                              <Languages className="h-4 w-4 mr-2" />
                              {translating?.docId === clientDoc.id && translating?.lang === "SR" ? "Prevodi..." : "Prevedi na SR"}
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={clientDoc.textSr || ""}
                          rows={6}
                          readOnly
                          placeholder="Srpski prevod će se pojaviti ovde..."
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Engleski prevod</Label>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={sourceLang[clientDoc.id] || "auto"} 
                              onValueChange={(val) => setSourceLang({ ...sourceLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
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
                              value={targetLang[clientDoc.id] || "EN"} 
                              onValueChange={(val) => setTargetLang({ ...targetLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
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
                              onClick={() => handleTranslate(clientDoc.id)}
                              disabled={translating?.docId === clientDoc.id || (sourceLang[clientDoc.id] || "auto") === (targetLang[clientDoc.id] || "EN")}
                            >
                              <Languages className="h-4 w-4 mr-2" />
                              {translating?.docId === clientDoc.id && translating?.lang === "EN" ? "Prevodi..." : "Prevedi na EN"}
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={clientDoc.textEn || ""}
                          rows={6}
                          readOnly
                          placeholder="Engleski prevod će se pojaviti ovde..."
                        />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Documents Section */}
      {documents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Ostali dokumenti ({documents.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((attachment: any) => (
              <Card key={attachment.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.fileName || "Document"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {new Date(attachment.messageDate).toLocaleDateString('sr-RS')}
                      </Badge>
                      {attachment.messageFrom && (
                        <span className="text-xs text-muted-foreground truncate">
                          Od: {attachment.messageFrom}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const docIndex = clientAttachments.findIndex((a: any) => a.id === attachment.id);
                      setViewerIndex(docIndex >= 0 ? docIndex : 0);
                      setViewerOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Otvori
                  </Button>
                </div>
                {!isReadOnly && isInternalUpload(attachment) && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(attachment.id)}
                      disabled={deleting === attachment.id}
                      className="w-full"
                    >
                      {deleting === attachment.id ? (
                        <>
                          <X className="h-4 w-4 mr-2 animate-spin" />
                          Brisanje...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Obriši dokument
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
      
      <FileViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={clientAttachments.map((attachment: any) => ({
          id: attachment.id,
          url: `/api/files/${attachment.id}`,
          fileName: attachment.fileName || `Attachment ${attachment.id}`,
          mimeType: attachment.mimeType,
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
    </div>
  );
}
