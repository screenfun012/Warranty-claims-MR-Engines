"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Paperclip } from "lucide-react";

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
        <Card key={thread.id} className="p-4">
          <h3 className="font-semibold mb-2">{thread.subjectOriginal}</h3>
          <div className="space-y-3">
            {thread.messages.map((message: any) => (
              <div key={message.id} className="border-l-2 pl-4">
                <div className="flex justify-between mb-1">
                  <div>
                    <strong>{message.from}</strong>
                    <Badge variant={message.direction === "INBOUND" ? "default" : "secondary"} className="ml-2">
                      {message.direction}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(message.date).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.bodyText || ""}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {message.attachments.length} attachment(s)
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
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Send Reply</h3>
        <div className="space-y-4">
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
            <Label>Attachments</Label>
            <div className="mt-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
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

          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="accepted"
                checked={claimAcceptanceStatus === "ACCEPTED"}
                onChange={() => handleAcceptanceStatusChange("ACCEPTED")}
                className="h-4 w-4"
              />
              <Label htmlFor="accepted" className="cursor-pointer font-normal">
                Prihvaćeno
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rejected"
                checked={claimAcceptanceStatus === "REJECTED"}
                onChange={() => handleAcceptanceStatusChange("REJECTED")}
                className="h-4 w-4"
              />
              <Label htmlFor="rejected" className="cursor-pointer font-normal">
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
    </div>
  );
}

