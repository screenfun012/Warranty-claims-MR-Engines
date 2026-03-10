"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Paperclip, FileText, Image as ImageIcon, Mail, Check, Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const FileViewerModal = dynamic(
  () => import("@/components/file-viewer-modal").then((m) => ({ default: m.FileViewerModal })),
  { ssr: false, loading: () => <Skeleton className="h-0 w-0 overflow-hidden" /> }
);
import { cn } from "@/lib/utils";
import { getCleanEmailBody } from "@/lib/email/emailBodyCleaner";
import { extractCleanBody } from "@/lib/email/emailThreadingUtils";

interface ClaimEmailsProps {
  claim: any;
  onUpdate?: (updates: any) => void;
  isReadOnly?: boolean;
}

// Helper function to extract email address from "Name <email@domain.com>" format
const extractEmailAddress = (emailString: string | null | undefined): string => {
  if (!emailString) return "";
  
  // Try to extract email from format like "Name <email@domain.com>" or just "email@domain.com"
  const emailMatch = emailString.match(/<([^>]+)>/) || emailString.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    return emailMatch[1] || emailMatch[0];
  }
  
  return emailString.trim();
};

// Helper function to get the original sender email from claim's email threads
const getOriginalSenderEmail = (claim: any): string => {
  // Find the first email thread (usually the main one)
  const firstThread = claim.emailThreads?.[0];
  
  if (firstThread) {
    // Use originalSender from thread (this is the real customer email, even if forwarded)
    if (firstThread.originalSender) {
      return extractEmailAddress(firstThread.originalSender);
    }
    
    // Fallback: find first inbound message and use its "from" field
    const firstInboundMessage = firstThread.messages?.find((msg: any) => msg.direction === "INBOUND");
    if (firstInboundMessage?.from) {
      return extractEmailAddress(firstInboundMessage.from);
    }
  }
  
  // Final fallback: use customer email from claim
  return extractEmailAddress(claim.customer?.email);
};

export function ClaimEmails({ claim, onUpdate, isReadOnly = false }: ClaimEmailsProps) {
  const t = useTranslations();
  const [sending, setSending] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  
  // Get original sender email automatically
  const originalSenderEmail = getOriginalSenderEmail(claim);
  
  const [replyForm, setReplyForm] = useState({
    to: originalSenderEmail,
    cc: "",
    subject: `${t("claims.emails.re")}: ${claim.emailThreads?.[0]?.subjectOriginal || t("claims.title")}`,
    text: "",
  });
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
  };

  // Sync reply "To" when claim changes
  const prevClaimIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevClaimIdRef.current !== claim.id) {
      prevClaimIdRef.current = claim.id;
      const newOriginalSender = getOriginalSenderEmail(claim);
      setReplyForm(prev => ({ ...prev, to: newOriginalSender }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.id, claim.emailThreads, claim.customer]);


  // Get all internal files (from "Naši fajlovi" tab)
  const internalFiles = (() => {
    const files: any[] = [];
    
    // Add internal photos
    if (claim.photos) {
      claim.photos.forEach((photo: any) => {
        if (photo.internalUpload === true || 
            (photo.attachment?.source === "INTERNAL_TEARDOWN" || photo.attachment?.source === "OTHER")) {
          if (photo.attachment) {
            files.push({
              ...photo.attachment,
              type: 'image',
            });
          }
        }
      });
    }
    
    // Add internal documents (PDF/DOCX)
    if (claim.clientDocuments) {
      claim.clientDocuments.forEach((doc: any) => {
        if (doc.attachment && 
            (doc.attachment.source === "INTERNAL_TEARDOWN" || doc.attachment.source === "OTHER")) {
          const exists = files.some((f: any) => f.id === doc.attachment.id);
          if (!exists) {
            files.push({
              ...doc.attachment,
              type: doc.attachment.mimeType?.includes("pdf") ? 'pdf' : 'docx',
            });
          }
        }
      });
    }
    
    return files.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  })();

  const handleToggleAttachment = (attachmentId: string) => {
    setSelectedAttachmentIds((prev) => 
      prev.includes(attachmentId)
        ? prev.filter((id) => id !== attachmentId)
        : [...prev, attachmentId]
    );
  };

  const handleSendEmail = async () => {
    if (!replyForm.to?.trim()) {
      alert(t("claims.emails.recipientRequired"));
      return;
    }
    if (!replyForm.subject?.trim()) {
      alert(t("claims.emails.subjectRequired"));
      return;
    }
    const bodyText = bodyRef.current?.innerText?.trim() ?? "";
    const bodyHtmlContent = bodyRef.current?.innerHTML?.trim() ?? "";
    if (!bodyText && !bodyHtmlContent) {
      alert(t("claims.emails.bodyRequired"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plainEmail: true,
          to: replyForm.to.trim(),
          cc: replyForm.cc?.trim() || undefined,
          subject: replyForm.subject.trim(),
          text: bodyText,
          html: bodyHtmlContent || undefined,
          attachmentIds: selectedAttachmentIds,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.warning) {
          alert(t("claims.emails.sendSuccess") + "\n\n" + t("common.warning") + ": " + data.warning);
        } else {
          alert(t("claims.emails.sendSuccess"));
        }
        if (bodyRef.current) bodyRef.current.innerHTML = "";
        setReplyForm({ ...replyForm, text: "" });
        setSelectedAttachmentIds([]);
        onUpdate?.({});
      } else {
        alert(t("claims.emails.sendError") + ": " + (data.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert(t("claims.emails.sendError"));
    } finally {
      setSending(false);
    }
  };

  // Collect all messages from all threads and sort by date for timeline view
  const allMessages = claim.emailThreads?.flatMap((thread: any) => 
    (thread.messages || []).map((message: any) => ({
      ...message,
      threadSubject: thread.subjectOriginal,
      threadId: thread.id,
    }))
  ) || [];

  // Sort messages by date (oldest first for timeline)
  const sortedMessages = [...allMessages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Timeline Header */}
      <Card className="p-4 bg-muted/50">
        <h3 className="font-semibold text-lg mb-1">{t("claims.emails.timeline")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("claims.emails.timelineDesc")}
        </p>
      </Card>

      {/* Timeline Messages */}
      {sortedMessages.length > 0 ? (
        <div className="space-y-4">
          {sortedMessages.map((message: any, index: number) => {
            const isInbound = message.direction === "INBOUND";
            const isFirstInbound = isInbound && index === 0;
            const date = new Date(message.date);
            const formattedDate = date.toLocaleDateString('sr-RS', { 
              day: 'numeric', 
              month: 'numeric', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <Card 
                key={`${message.threadId}-${message.id}`} 
                className={`p-4 ${isInbound ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${isInbound ? 'bg-blue-500' : 'bg-green-500'}`} />
                    {index < sortedMessages.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-2 min-h-5 ${isInbound ? 'bg-blue-300' : 'bg-green-300'}`} />
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          variant={isInbound ? "default" : "secondary"} 
                          className={`text-xs ${isInbound ? 'bg-blue-500' : 'bg-green-500'}`}
                        >
                          {isInbound ? t("claims.emails.fromClient") : t("claims.emails.toClient")}
                        </Badge>
                        {isFirstInbound && (
                          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            {t("claims.emails.initialMessage")}
                          </Badge>
                        )}
                        {!isInbound && message.threadSubject && (
                          <Badge variant="outline" className="text-xs">
                            {t("common.status")}: {t("claims.status.IN_ANALYSIS")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formattedDate}
                      </span>
                    </div>

                    <div className="mb-2">
                      <strong className="text-sm break-all">{message.from}</strong>
                      {message.to && (
                        <span className="text-xs text-muted-foreground ml-2">
                          → {message.to}
                        </span>
                      )}
                    </div>

                    {message.subject && (
                      <p className="text-sm font-medium mb-2 break-words">
                        {message.subject}
                      </p>
                    )}

                    <div className="text-sm whitespace-pre-wrap break-words bg-background/50 p-3 rounded border">
                      {(() => {
                        const cleanText = extractCleanBody(
                          message.bodyText || '',
                          message.bodyHtml
                        );
                        return cleanText || t("claims.emails.noText");
                      })()}
                    </div>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {message.attachments.length} {t("claims.emails.attachments")}:
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {message.attachments.map((attachment: any, attIndex: number) => {
                            const allAttachments = claim.emailThreads?.flatMap((t: any) => 
                              t.messages?.flatMap((m: any) => m.attachments || []) || []
                            ) || [];
                            const globalIndex = allAttachments.findIndex((a: any) => 
                              a.id === attachment.id
                            );
                            
                            const isImage = attachment.mimeType?.startsWith("image/") || 
                                           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.fileName || "");
                            const isPdf = attachment.mimeType?.includes("pdf") || 
                                         /\.pdf$/i.test(attachment.fileName || "");
                            
                            const fileName = attachment.fileName || `Attachment ${attIndex + 1}`;
                            const truncatedFileName = fileName.length > 30 ? fileName.substring(0, 30) + "..." : fileName;
                            
                            return (
                              <Button
                                key={attachment.id}
                                variant="outline"
                                size="sm"
                                className="text-xs h-auto py-1.5 px-2 sm:px-3"
                                onClick={() => {
                                  setViewerIndex(globalIndex >= 0 ? globalIndex : 0);
                                  setViewerOpen(true);
                                }}
                                title={fileName}
                              >
                                {isImage ? (
                                  <ImageIcon className="h-3 w-3 mr-1 shrink-0" />
                                ) : isPdf ? (
                                  <FileText className="h-3 w-3 mr-1 shrink-0" />
                                ) : (
                                  <Paperclip className="h-3 w-3 mr-1 shrink-0" />
                                )}
                                <span className="truncate max-w-[120px] sm:max-w-none">{truncatedFileName}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-muted-foreground">{t("claims.emails.noEmails")}</p>
        </Card>
      )}

      {!isReadOnly && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          {t("claims.emails.sendReply")}
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <Label>{t("inbox.to")}</Label>
            <Input
              value={replyForm.to}
              onChange={(e) => setReplyForm({ ...replyForm, to: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("inbox.cc")}</Label>
            <Input
              value={replyForm.cc}
              onChange={(e) => setReplyForm({ ...replyForm, cc: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("inbox.subject")}</Label>
            <Input
              value={replyForm.subject}
              onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("claims.emails.message")}</Label>
            <div className="rounded-md border overflow-hidden">
              <div className="flex items-center gap-1 p-1 border-b bg-muted/30">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execFormat("bold")} title="Bold"><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execFormat("italic")} title="Italic"><Italic className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execFormat("underline")} title="Underline"><Underline className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execFormat("insertUnorderedList")} title="Bullet list"><List className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execFormat("insertOrderedList")} title="Numbered list"><ListOrdered className="h-4 w-4" /></Button>
              </div>
              <div
                ref={bodyRef}
                contentEditable
                className="min-h-[160px] p-3 text-base focus:outline-none focus:ring-0 prose prose-sm dark:prose-invert max-w-none"
                data-placeholder={t("claims.emails.message")}
                suppressContentEditableWarning
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }}
              />
            </div>
          </div>

          <div>
            <Label>{t("claims.emails.attachmentsFromFiles")}</Label>
            {internalFiles.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {internalFiles.map((file: any) => {
                  const isSelected = selectedAttachmentIds.includes(file.id);
                  const isImage = file.type === 'image' || file.mimeType?.startsWith('image/');
                  const isPdf = file.type === 'pdf' || file.mimeType?.includes('pdf');
                  
                  return (
                    <div
                      key={file.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                        isSelected 
                          ? "bg-primary/10 border border-primary" 
                          : "bg-muted/50 hover:bg-muted border border-transparent"
                      )}
                      onClick={() => handleToggleAttachment(file.id)}
                    >
                      <div className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2 transition-all shrink-0",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isImage ? (
                          <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                        ) : isPdf ? (
                          <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <Paperclip className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                        <span className="text-sm truncate">{file.fileName || t("claims.photos.fileNumber", { id: file.id })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("claims.emails.noFilesToAttach")}
              </p>
            )}
            {selectedAttachmentIds.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("claims.emails.selected")}: {selectedAttachmentIds.length} {t("claims.photos.files")}
              </p>
            )}
          </div>

          <Button onClick={handleSendEmail} disabled={sending}>
            {sending ? t("claims.emails.sending") : t("claims.emails.sendEmail")}
          </Button>
        </div>
      </Card>
      )}

      <FileViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={(claim.emailThreads || [])
          .flatMap((thread: any) => 
            (thread.messages || []).flatMap((message: any) => 
              (message.attachments || []).map((attachment: any) => ({
                id: attachment.id,
                url: `/api/files/${attachment.id}`,
                fileName: attachment.fileName || `Attachment ${attachment.id}`,
                mimeType: attachment.mimeType,
              }))
            )
          )}
        initialIndex={viewerIndex}
      />
    </div>
  );
}

