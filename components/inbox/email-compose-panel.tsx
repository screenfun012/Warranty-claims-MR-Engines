"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Send,
  Loader2,
  Trash2,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

type EmailComposePanelProps = {
  mode: ComposeMode;
  /** Thread reply/forward — required except for mode "new" */
  threadId?: string;
  fromEmail: string;
  initialTo?: string;
  initialCc?: string;
  initialBcc?: string;
  initialSubject?: string;
  /** HTML body (quoted content may be pre-filled) */
  initialHtml?: string;
  /** For In-Reply-To / References */
  inReplyTo?: string | null;
  references?: string | null;
  onCancel: () => void;
  onSent: () => void;
  className?: string;
};

export function EmailComposePanel({
  mode,
  threadId,
  fromEmail,
  initialTo = "",
  initialCc = "",
  initialBcc = "",
  initialSubject = "",
  initialHtml = "",
  inReplyTo,
  references,
  onCancel,
  onSent,
  className,
}: EmailComposePanelProps) {
  const t = useTranslations("mail");
  const tInbox = useTranslations("inbox");
  const tCommon = useTranslations("common");
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [bcc, setBcc] = useState(initialBcc);
  const [showCc, setShowCc] = useState(!!initialCc?.trim());
  const [showBcc, setShowBcc] = useState(!!initialBcc?.trim());
  const [subject, setSubject] = useState(initialSubject);
  const [importance, setImportance] = useState<"normal" | "high" | "low">("normal");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTo(initialTo);
    setCc(initialCc);
    setBcc(initialBcc);
    setShowCc(!!initialCc?.trim());
    setShowBcc(!!initialBcc?.trim());
    setSubject(initialSubject);
    setError(null);
    if (bodyRef.current) {
      bodyRef.current.innerHTML = initialHtml || "";
    }
  }, [mode, threadId, initialTo, initialCc, initialBcc, initialSubject, initialHtml]);

  const execFormat = useCallback((cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const bodyText = bodyRef.current?.innerText ?? "";
    const bodyHtml = bodyRef.current?.innerHTML ?? "";
    if (!to.trim() || !subject.trim()) {
      setError(tInbox("composeMissingToSubject"));
      return;
    }
    if (!bodyText.trim() && !bodyHtml.replace(/<[^>]+>/g, "").trim()) {
      setError(tInbox("composeMissingBody"));
      return;
    }

    setSending(true);
    try {
      if (mode === "new" || !threadId) {
        const formData = new FormData();
        formData.set("to", to.trim());
        if (cc.trim()) formData.set("cc", cc.trim());
        if (bcc.trim()) formData.set("bcc", bcc.trim());
        formData.set("subject", subject.trim());
        formData.set("body", bodyText);
        formData.set("bodyHtml", bodyHtml);
        formData.set("importance", importance);
        const files = fileInputRef.current?.files;
        if (files) {
          for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
        }
        const res = await fetch("/api/mail/send", { method: "POST", body: formData, credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("sendError"));
      } else {
        const res = await fetch(`/api/inbox/${threadId}/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            to: to.trim(),
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: subject.trim(),
            body: bodyText,
            bodyHtml,
            inReplyTo: inReplyTo || undefined,
            references: references || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("sendError"));
      }
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setSending(false);
    }
  };

  const title =
    mode === "new"
      ? t("sendTab")
      : mode === "reply"
        ? tInbox("reply")
        : mode === "replyAll"
          ? tInbox("replyAll")
          : tInbox("forward");

  return (
    <form onSubmit={handleSend} className={cn("flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={sending} className="min-h-9">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("sending")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t("sendButton")}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={sending}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={sending}>
            <Paperclip className="h-4 w-4 mr-2" />
            {t("attach")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTo("");
              setCc("");
              setBcc("");
              setSubject("");
              if (bodyRef.current) bodyRef.current.innerHTML = "";
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            disabled={sending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("discard")}
          </Button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" />

      <div className="grid gap-3 text-sm">
        <div className="grid gap-1">
          <Label>{t("from")}</Label>
          <Input value={fromEmail} readOnly disabled className="bg-muted text-sm" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="compose-to">{t("to")} *</Label>
          <Input
            id="compose-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="email@example.com"
            className="text-sm"
            required
          />
        </div>
        <div className="flex gap-4 text-xs">
          <button type="button" className={showCc ? "font-medium text-primary" : "text-muted-foreground"} onClick={() => setShowCc((v) => !v)}>
            {t("cc")}
          </button>
          <button type="button" className={showBcc ? "font-medium text-primary" : "text-muted-foreground"} onClick={() => setShowBcc((v) => !v)}>
            {t("bcc")}
          </button>
        </div>
        {showCc && (
          <div className="grid gap-1">
            <Label htmlFor="compose-cc">{t("cc")}</Label>
            <Input id="compose-cc" value={cc} onChange={(e) => setCc(e.target.value)} className="text-sm" />
          </div>
        )}
        {showBcc && (
          <div className="grid gap-1">
            <Label htmlFor="compose-bcc">{t("bcc")}</Label>
            <Input id="compose-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} className="text-sm" />
          </div>
        )}
        <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:gap-3">
          <div className="grid gap-1">
            <Label htmlFor="compose-subject">{t("subject")} *</Label>
            <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="text-sm" />
          </div>
          <div className="grid gap-1">
            <Label>{t("importance")}</Label>
            <Select value={importance} onValueChange={(v) => setImportance(v as "normal" | "high" | "low")}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t("importanceNormal")}</SelectItem>
                <SelectItem value="high">{t("importanceHigh")}</SelectItem>
                <SelectItem value="low">{t("importanceLow")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-1">
        <Label>{t("body")}</Label>
        <div className="rounded-md border overflow-hidden bg-background">
          <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/40">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("bold")} aria-label="Bold">
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("italic")}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("underline")}>
              <Underline className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertUnorderedList")}>
              <List className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertOrderedList")}>
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>
          <div
            ref={bodyRef}
            contentEditable
            className="min-h-[200px] max-h-[min(50vh,420px)] overflow-y-auto p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring email-compose-body"
            suppressContentEditableWarning
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData("text/plain");
              document.execCommand("insertText", false, text);
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
