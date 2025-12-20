"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Paperclip, FileText, Image as ImageIcon, Mail } from "lucide-react";
import { FileViewerModal } from "@/components/file-viewer-modal";
import { cn } from "@/lib/utils";

interface ClaimEmailsProps {
  claim: any;
  onUpdate?: (updates: any) => void;
  isReadOnly?: boolean;
}

interface UploadedFile {
  file: File;
  id: string;
}

export function ClaimEmails({ claim, onUpdate, isReadOnly = false }: ClaimEmailsProps) {
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [replyForm, setReplyForm] = useState({
    to: claim.customer?.email || "",
    cc: "",
    subject: `Re: ${claim.emailThreads?.[0]?.subjectOriginal || "Claim"}`,
    text: "",
  });
  const [claimAcceptanceStatus, setClaimAcceptanceStatus] = useState<string>(
    claim.claimAcceptanceStatus === "ACCEPTED" || claim.claimAcceptanceStatus === "REJECTED" 
      ? claim.claimAcceptanceStatus 
      : ""
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Sync local state with claim prop when claim ID changes
  const prevClaimIdRef = useRef<string | null>(null);
  useEffect(() => {
    console.log('[ClaimEmails] useEffect triggered. claim.id:', claim.id, 'claim.claimAcceptanceStatus:', claim.claimAcceptanceStatus);
    if (prevClaimIdRef.current !== claim.id) {
      const newStatus = claim.claimAcceptanceStatus === "ACCEPTED" || claim.claimAcceptanceStatus === "REJECTED" 
        ? claim.claimAcceptanceStatus 
        : "";
      console.log('[ClaimEmails] Claim ID changed, syncing status:', newStatus);
      setClaimAcceptanceStatus(newStatus);
      prevClaimIdRef.current = claim.id;
    } else if (claim.claimAcceptanceStatus && (claim.claimAcceptanceStatus === "ACCEPTED" || claim.claimAcceptanceStatus === "REJECTED")) {
      // Also sync if acceptance status changes (e.g., when claim is reloaded)
      console.log('[ClaimEmails] Acceptance status changed, syncing:', claim.claimAcceptanceStatus);
      setClaimAcceptanceStatus(claim.claimAcceptanceStatus);
    }
  }, [claim.id, claim.claimAcceptanceStatus]);

  // When acceptance status is selected, update claimAcceptanceStatus but keep status as is
  const handleAcceptanceStatusChange = async (value: string) => {
    // If clicking the same checkbox that's already selected, deselect it
    const newValue = claimAcceptanceStatus === value ? null : value;
    
    console.log('[ClaimEmails] Status change:', { value, newValue, current: claimAcceptanceStatus });
    
    // Update local state immediately
    setClaimAcceptanceStatus(newValue || "");
    
    // Update parent immediately so header shows the change right away
    if (onUpdate) {
      console.log('[ClaimEmails] Updating parent with new status:', newValue);
      onUpdate({ ...claim, claimAcceptanceStatus: newValue });
    }
    
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          claimAcceptanceStatus: newValue,
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ClaimEmails] API error:', errorText);
        // Revert on error
        const revertedStatus = claim.claimAcceptanceStatus || "";
        setClaimAcceptanceStatus(revertedStatus);
        if (onUpdate) {
          onUpdate({ ...claim, claimAcceptanceStatus: claim.claimAcceptanceStatus });
        }
        alert(`Failed to update: ${errorText}`);
        return;
      }
      
      const data = await res.json();
      console.log('[ClaimEmails] API response:', data.claim?.claimAcceptanceStatus);
      if (data.claim && onUpdate) {
        // Only update parent if API returned a valid claimAcceptanceStatus
        // If API returns undefined, keep the optimistic update we already did
        if (data.claim.claimAcceptanceStatus !== undefined) {
          console.log('[ClaimEmails] Updating parent with full claim from API. Status:', data.claim.claimAcceptanceStatus);
          onUpdate(data.claim);
          // Dispatch event to refresh claims list
          window.dispatchEvent(new Event('claim-updated'));
        } else {
          console.log('[ClaimEmails] API returned undefined for claimAcceptanceStatus, keeping optimistic update');
          // Don't update parent - keep the optimistic update we already did
          // But still dispatch event to refresh claims list
          window.dispatchEvent(new Event('claim-updated'));
        }
      } else {
        // Even if claim is not returned, dispatch event to refresh claims list
        window.dispatchEvent(new Event('claim-updated'));
      }
    } catch (error) {
      console.error("Error updating acceptance status:", error);
      // Revert on error
      const revertedStatus = claim.claimAcceptanceStatus || "";
      setClaimAcceptanceStatus(revertedStatus);
      if (onUpdate) {
        onUpdate({ ...claim, claimAcceptanceStatus: claim.claimAcceptanceStatus });
      }
      alert("Failed to update acceptance status");
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/claims/${claim.id}/upload-attachment`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setUploadedFiles((prev) => [
            ...prev,
            { file, id: data.attachment?.id || Date.now().toString() },
          ]);
        } else {
          const errorData = await res.json();
          alert(`Failed to upload ${file.name}: ${errorData.error}`);
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      // Only send email if acceptance status is set
      if (!claimAcceptanceStatus || (claimAcceptanceStatus !== "ACCEPTED" && claimAcceptanceStatus !== "REJECTED")) {
        alert("Please select Claim Acceptance Status (Accepted or Rejected) before sending email");
        setSending(false);
        return;
      }

      // Build email body with acceptance message
      let emailBody = replyForm.text;
      if (claimAcceptanceStatus === "ACCEPTED") {
        emailBody = emailBody 
          ? `${emailBody}\n\nYour warranty claim has been processed and We accept your claim.`
          : `Your warranty claim has been processed and We accept your claim.`;
      } else if (claimAcceptanceStatus === "REJECTED") {
        emailBody = emailBody 
          ? `${emailBody}\n\nYour warranty claim has been processed and We reject your claim.`
          : `Your warranty claim has been processed and We reject your claim.`;
      }

      // Get attachment IDs from uploaded files
      const attachmentIds = uploadedFiles.map((f) => f.id).filter((id) => id && !id.includes("temp"));

      // Send email - API will automatically set status to CLOSED
      const res = await fetch(`/api/claims/${claim.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...replyForm,
          text: emailBody,
          attachmentIds,
          claimAcceptanceStatus, // Send acceptance status so API can update claim
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        alert("Email sent successfully and claim status updated to CLOSED");
        setReplyForm({ ...replyForm, text: "" });
        setUploadedFiles([]);
        // Force full page reload to ensure status is updated
        window.location.reload();
      } else {
        alert("Failed to send email: " + data.error);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {claim.emailThreads && claim.emailThreads.length > 0 ? (
        claim.emailThreads.map((thread: any) => (
        <Card key={thread.id} className="p-6">
          <h3 className="font-semibold mb-2 text-sm sm:text-base break-words">{thread.subjectOriginal}</h3>
          <div className="space-y-3">
            {thread.messages.map((message: any) => (
              <div key={message.id} className="border-l-2 pl-2 sm:pl-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0 mb-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <strong className="text-xs sm:text-sm break-all">{message.from}</strong>
                    <Badge variant={message.direction === "INBOUND" ? "default" : "secondary"} className="text-xs shrink-0">
                      {message.direction}
                    </Badge>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
                    {new Date(message.date).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.bodyText || ""}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                      {message.attachments.length} attachment(s):
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
            ))}
          </div>
        </Card>
      ))
      ) : (
        <Card className="p-4">
          <p className="text-muted-foreground">No email threads found for this claim.</p>
        </Card>
      )}

      {!isReadOnly && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Send Reply
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <Label>To</Label>
            <Input
              value={replyForm.to}
              onChange={(e) => setReplyForm({ ...replyForm, to: e.target.value })}
            />
          </div>
          <div>
            <Label>CC</Label>
            <Input
              value={replyForm.cc}
              onChange={(e) => setReplyForm({ ...replyForm, cc: e.target.value })}
            />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={replyForm.subject}
              onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
            />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              value={replyForm.text}
              onChange={(e) => setReplyForm({ ...replyForm, text: e.target.value })}
              rows={8}
            />
          </div>

          <div>
            <Label htmlFor="file-upload">Attachments</Label>
            <div className="mt-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
                aria-label="Upload files"
                title="Upload files"
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                className="w-full"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Files"}
              </Button>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.map((uploaded) => (
                    <div
                      key={uploaded.id}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-sm">{uploaded.file.name}</span>
                      </div>
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleAcceptanceStatusChange("ACCEPTED")}
                className={cn(
                  "relative flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                  claimAcceptanceStatus === "ACCEPTED"
                    ? "border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400"
                    : "border-muted-foreground/40 hover:border-green-500/50 dark:border-muted-foreground/60 dark:hover:border-green-400/50"
                )}
                aria-label="Prihvaćeno"
              >
                {claimAcceptanceStatus === "ACCEPTED" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-white dark:bg-gray-900" />
                )}
              </button>
              <Label htmlFor="accepted" className="cursor-pointer font-medium text-sm text-foreground">
                Prihvaćeno
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleAcceptanceStatusChange("REJECTED")}
                className={cn(
                  "relative flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                  claimAcceptanceStatus === "REJECTED"
                    ? "border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400"
                    : "border-muted-foreground/40 hover:border-red-500/50 dark:border-muted-foreground/60 dark:hover:border-red-400/50"
                )}
                aria-label="Odbijeno"
              >
                {claimAcceptanceStatus === "REJECTED" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-white dark:bg-gray-900" />
                )}
              </button>
              <Label htmlFor="rejected" className="cursor-pointer font-medium text-sm text-foreground">
                Odbijeno
              </Label>
            </div>
          </div>

          <Button onClick={handleSendEmail} disabled={sending || uploading}>
            {sending ? "Sending..." : "Send Email"}
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

