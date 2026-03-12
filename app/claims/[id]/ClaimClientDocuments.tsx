"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Languages, FileText, Image as ImageIcon, Paperclip, Trash2, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const FileViewerModal = dynamic(
  () => import("@/components/file-viewer-modal").then((m) => ({ default: m.FileViewerModal })),
  { ssr: false, loading: () => <Skeleton className="h-0 w-0 overflow-hidden" /> }
);
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TRANSLATION_LANGUAGES } from "@/lib/translation/languages";

/** Attachment as returned from email thread messages */
interface EmailMessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  filePath: string;
  textOriginal?: string | null;
  textSr?: string | null;
  textEn?: string | null;
  translationsJson?: string | null;
  isProbablyLogo?: boolean;
  isRelevant?: boolean;
  source?: string;
}

/** Attachment enriched with message context (used in this tab) */
interface ClientAttachment extends EmailMessageAttachment {
  messageDate: string;
  messageFrom?: string;
  messageSubject?: string;
}

interface EmailMessage {
  date: string;
  from: string;
  subject?: string;
  direction: string;
  attachments?: EmailMessageAttachment[];
}

interface EmailThread {
  messages?: EmailMessage[];
}

interface ClientDocument {
  id: string;
  attachmentId?: string | null;
  textOriginal: string;
  textSr?: string | null;
  textEn?: string | null;
  translationsJson?: string | null;
}

interface ClaimForDocuments {
  id: string;
  emailThreads?: EmailThread[];
  clientDocuments?: ClientDocument[];
}

/** Thumbnail that loads /api/files/[id] via fetch (credentials) and shows blob; placeholder on error so images always render. */
function DocumentThumbnail({
  attachmentId,
  alt,
  className,
  openLabel = "Open",
  repairLabel = "Ponovo preuzmi sa maila",
}: {
  attachmentId: string;
  alt: string;
  className?: string;
  openLabel?: string;
  repairLabel?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let revoked = false;
    setFailed(false);
    setErrorCode(null);
    setBlobUrl(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    fetch(`/api/files/${attachmentId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const code = (errBody as { code?: string }).code;
          if (!revoked) setErrorCode(code ?? null);
          const msg = code === "FILE_NOT_ON_NAS"
            ? "Fajl nije na skladištu (NAS)."
            : res.statusText;
          throw new Error(msg);
        }
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!revoked) setFailed(true);
      });
    return () => {
      revoked = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [attachmentId, refreshKey]);

  const handleRepair = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRepairing(true);
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/repair`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setRefreshKey((k) => k + 1);
      } else {
        alert(data.error || "Popravka nije uspela.");
      }
    } catch (err) {
      alert("Greška pri pozivu popravke.");
    } finally {
      setRepairing(false);
    }
  };

  if (failed) {
    const isNasError = errorCode === "FILE_NOT_ON_NAS";
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-muted/50 ${className ?? ""}`}>
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
        {isNasError && (
          <button
            type="button"
            disabled={repairing}
            className="text-xs text-primary hover:underline disabled:opacity-50"
            onClick={handleRepair}
          >
            {repairing ? "..." : repairLabel}
          </button>
        )}
        <a
          href={`/api/files/${attachmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {openLabel}
        </a>
      </div>
    );
  }
  if (!blobUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 animate-pulse ${className ?? ""}`}>
        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className ?? "w-full h-full object-cover"}
    />
  );
}

interface ClaimClientDocumentsProps {
  claim: ClaimForDocuments;
  isReadOnly?: boolean;
  onRefresh?: () => void;
}

export function ClaimClientDocuments({ claim, isReadOnly = false, onRefresh }: ClaimClientDocumentsProps) {
  const t = useTranslations();
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
  const clientAttachments = useMemo((): ClientAttachment[] => {
    const attachments: ClientAttachment[] = [];
    
    // Add attachments from INBOUND email messages (from client)
    if (claim.emailThreads) {
      claim.emailThreads.forEach((thread: EmailThread) => {
        if (thread.messages) {
          thread.messages.forEach((message: EmailMessage) => {
            // Only INBOUND messages (from client)
            if (message.direction === "INBOUND" && message.attachments) {
              message.attachments.forEach((attachment: EmailMessageAttachment) => {
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
        alert(t("claims.documents.extractSuccess"));
        // Refresh claim data if onRefresh callback is available
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        alert(t("claims.documents.extractError") + ": " + data.error);
      }
    } catch (error) {
      console.error("Error extracting PDF:", error);
      alert(t("claims.documents.extractError"));
    } finally {
      setExtracting(null);
    }
  };

  const handleTranslate = async (docId: string) => {
    const srcLang = sourceLang[docId] || "auto";
    const tgtLang = targetLang[docId] || "EN";
    
    if (srcLang === tgtLang) {
      alert(t("claims.documents.translate.sameLanguage"));
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
        alert(t("claims.documents.translate.success"));
        // Refresh claim data if onRefresh callback is available
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        alert(t("claims.documents.translate.error") + ": " + (data.error || t("common.error")));
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert(t("claims.documents.translate.error") + ": " + (error instanceof Error ? error.message : t("common.error")));
    } finally {
      setTranslating(null);
    }
  };

  if (clientAttachments.length === 0) {
    return (
      <Card className="p-6 hover:shadow-md transition-shadow">
        <p className="text-muted-foreground">{t("claims.documents.noDocuments")}</p>
      </Card>
    );
  }

  const getDocTranslations = (doc: { translationsJson?: string | null }): Record<string, string> => {
    if (!doc.translationsJson) return {} as Record<string, string>;
    try {
      return (typeof doc.translationsJson === "string" ? JSON.parse(doc.translationsJson) : doc.translationsJson) || {};
    } catch {
      return {} as Record<string, string>;
    }
  };

  // Group attachments by type
  const images = clientAttachments.filter((att: ClientAttachment) => 
    att.mimeType?.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName || "")
  );
  const pdfs = clientAttachments.filter((att: ClientAttachment) => 
    att.mimeType?.includes("pdf") || /\.pdf$/i.test(att.fileName || "")
  );
  const documents = clientAttachments.filter((att: ClientAttachment) => {
    const isImage = att.mimeType?.startsWith("image/") || 
                   /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName || "");
    const isPdf = att.mimeType?.includes("pdf") || /\.pdf$/i.test(att.fileName || "");
    return !isImage && !isPdf;
  });

  // Find clientDocument for PDFs (for text extraction)
  const getClientDocument = (attachmentId: string): ClientDocument | undefined => {
    return claim.clientDocuments?.find((doc: ClientDocument) => doc.attachmentId === attachmentId);
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
        // Refresh the claim data if onRefresh callback is available
        if (onRefresh) {
          await onRefresh();
        }
        // No need to reload - onRefresh will update the UI
      } else {
        const errorData = await res.json();
        alert(t("claims.documents.deleteError") + ": " + (errorData.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(t("claims.documents.deleteError") + ": " + (error instanceof Error ? error.message : t("common.error")));
    } finally {
      setDeleting(null);
      setAttachmentToDelete(null);
    }
  };

  // Check if attachment is internally uploaded (can be deleted)
  const isInternalUpload = (attachment: ClientAttachment) => {
    return attachment.source === "INTERNAL_TEARDOWN" || attachment.source === "OTHER";
  };

  return (
    <div className="space-y-6">
      {/* Images Section */}
      {images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t("claims.documents.images")} ({images.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((attachment: ClientAttachment, index: number) => (
              <Card key={attachment.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setViewerIndex(clientAttachments.findIndex((a: ClientAttachment) => a.id === attachment.id));
                setViewerOpen(true);
              }}>
                <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden mb-2">
                  <DocumentThumbnail
                    attachmentId={attachment.id}
                    alt={attachment.fileName || t("claims.documents.image")}
                    className="w-full h-full object-cover"
                    openLabel={t("common.open")}
                    repairLabel={t("claims.documents.repairFromEmail")}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate" title={attachment.fileName}>
                  {attachment.fileName || t("claims.photos.imageNumber", { number: index + 1 })}
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
            {t("claims.documents.pdfDocuments")} ({pdfs.length})
          </h3>
          <div className="space-y-4">
            {pdfs.map((attachment: ClientAttachment) => {
              const clientDoc = getClientDocument(attachment.id);
              return (
                <Card key={attachment.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold mb-1 truncate">{attachment.fileName || t("claims.documents.document")}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {new Date(attachment.messageDate).toLocaleDateString('sr-RS')}
                        </Badge>
                        {attachment.messageFrom && (
                          <span className="text-xs text-muted-foreground truncate">
                            {t("claims.emails.from")}: {attachment.messageFrom}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pdfIndex = clientAttachments.findIndex((a: ClientAttachment) => a.id === attachment.id);
                          setViewerIndex(pdfIndex >= 0 ? pdfIndex : 0);
                          setViewerOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {t("common.view")}
                      </Button>
                      {!clientDoc?.textOriginal && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtractPdf(attachment.id)}
                          disabled={extracting === attachment.id}
                        >
                          {extracting === attachment.id ? t("claims.documents.extracting") : t("claims.documents.extractText")}
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
                            {t("common.loading")}
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("claims.documents.deleteDocument")}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {clientDoc?.textOriginal && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>{t("inbox.originalText")}</Label>
                        <Textarea value={clientDoc.textOriginal} rows={6} readOnly className="font-mono text-sm" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>{t("inbox.serbianTranslation")}</Label>
                          <div className="flex items-center gap-2">
                            <Select
                              value={sourceLang[clientDoc.id] || "auto"}
                              onValueChange={(val) => setSourceLang({ ...sourceLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">{t("claims.documents.auto")}</SelectItem>
                                {TRANSLATION_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm">→</span>
                            <Select
                              value={targetLang[clientDoc.id] || "SR"}
                              onValueChange={(val) => setTargetLang({ ...targetLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSLATION_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTranslate(clientDoc.id)}
                              disabled={translating?.docId === clientDoc.id || (sourceLang[clientDoc.id] || "auto") === (targetLang[clientDoc.id] || "SR")}
                            >
                              <Languages className="h-4 w-4 mr-2" />
                              {translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "SR") ? t("inbox.translating") : t("inbox.translateToSR")}
                            </Button>
                          </div>
                        </div>
                        <div className="relative">
                          {translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "SR") && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur-sm">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span className="text-sm font-medium">{t("inbox.translating")}</span>
                              </div>
                            </div>
                          )}
                          <Textarea
                            value={(() => {
                              const tgt = targetLang[clientDoc.id] || "SR";
                              if (translating?.docId === clientDoc.id && translating?.lang === tgt) {
                                const src = sourceLang[clientDoc.id];
                                if (src === "EN") return clientDoc.textEn || "";
                                if (src === "SR") return clientDoc.textSr || "";
                                if (src && src !== "auto") return getDocTranslations(clientDoc)[src] || "";
                                return clientDoc.textOriginal || "";
                              }
                              if (tgt === "SR") return clientDoc.textSr || "";
                              if (tgt === "EN") return clientDoc.textEn || "";
                              return getDocTranslations(clientDoc)[tgt] || "";
                            })()}
                            rows={6}
                            readOnly
                            placeholder={t("inbox.serbianTranslationPlaceholder")}
                            className={translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "SR") ? "opacity-60" : ""}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>{t("inbox.englishTranslation")}</Label>
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
                                <SelectItem value="auto">{t("claims.documents.auto")}</SelectItem>
                                {TRANSLATION_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm">→</span>
                            <Select
                              value={targetLang[clientDoc.id] || "EN"}
                              onValueChange={(val) => setTargetLang({ ...targetLang, [clientDoc.id]: val })}
                              disabled={translating?.docId === clientDoc.id}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSLATION_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTranslate(clientDoc.id)}
                              disabled={translating?.docId === clientDoc.id || (sourceLang[clientDoc.id] || "auto") === (targetLang[clientDoc.id] || "EN")}
                            >
                              <Languages className="h-4 w-4 mr-2" />
                              {translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "EN") ? t("inbox.translating") : t("inbox.translateToEN")}
                            </Button>
                          </div>
                        </div>
                        <div className="relative">
                          {translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "EN") && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur-sm">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span className="text-sm font-medium">{t("inbox.translating")}</span>
                              </div>
                            </div>
                          )}
                          <Textarea
                            value={(() => {
                              const tgt = targetLang[clientDoc.id] || "EN";
                              if (translating?.docId === clientDoc.id && translating?.lang === tgt) {
                                const src = sourceLang[clientDoc.id];
                                if (src === "SR") return clientDoc.textSr || "";
                                if (src === "EN") return clientDoc.textEn || "";
                                if (src && src !== "auto") return getDocTranslations(clientDoc)[src] || "";
                                return clientDoc.textOriginal || "";
                              }
                              if (tgt === "EN") return clientDoc.textEn || "";
                              if (tgt === "SR") return clientDoc.textSr || "";
                              return getDocTranslations(clientDoc)[tgt] || "";
                            })()}
                            rows={6}
                            readOnly
                            placeholder={t("inbox.englishTranslationPlaceholder")}
                            className={translating?.docId === clientDoc.id && translating?.lang === (targetLang[clientDoc.id] || "EN") ? "opacity-60" : ""}
                          />
                        </div>
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
            {t("claims.documents.otherDocuments")} ({documents.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((attachment: ClientAttachment) => (
              <Card key={attachment.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.fileName || t("claims.documents.document")}</p>
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
                      const docIndex = clientAttachments.findIndex((a: ClientAttachment) => a.id === attachment.id);
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
        files={clientAttachments.map((attachment: ClientAttachment) => ({
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
        title={t("claims.documents.deleteFile.title")}
        description={t("claims.documents.deleteFile.confirm")}
        confirmText="Obriši"
        cancelText="Otkaži"
        variant="destructive"
      />
    </div>
  );
}
