"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Mail, ArrowLeft, Paperclip, Loader2, Trash2, PenLine, Bold, Italic, Underline, List, ListOrdered } from "lucide-react";

type SentFolder = { folderName: string; path: string; subject: string; to: string; sentAt: string };

export default function MailPage() {
  const t = useTranslations("mail");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<"send" | "sent">("send");
  const [fromEmail, setFromEmail] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [importance, setImportance] = useState<"normal" | "high" | "low">("normal");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/mail/config", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setFromEmail(d.fromEmail ?? ""))
      .catch(() => {});
  }, []);

  const handleDiscard = () => {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setSendMessage(null);
    if (bodyRef.current) bodyRef.current.innerHTML = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
  };

  const [sentFolders, setSentFolders] = useState<SentFolder[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [selectedMail, setSelectedMail] = useState<SentFolder | null>(null);
  const [mailDetail, setMailDetail] = useState<{ metadata: Record<string, unknown>; bodyHtml: string | null; bodyText: string | null; files: string[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSentList = async () => {
    setSentLoading(true);
    try {
      const res = await fetch("/api/mail-archive", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setSentFolders(data.folders ?? []);
      else setSentFolders([]);
    } catch {
      setSentFolders([]);
    } finally {
      setSentLoading(false);
    }
  };

  const loadMailDetail = async (folder: SentFolder) => {
    setSelectedMail(folder);
    setDetailLoading(true);
    setMailDetail(null);
    try {
      const [metaRes, listRes] = await Promise.all([
        fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/metadata.json")}`, { credentials: "include" }),
        fetch(`/api/mail-archive/list?path=${encodeURIComponent(folder.path)}`, { credentials: "include" }),
      ]);
      const metadata = metaRes.ok ? await metaRes.json() : {};
      const listData = listRes.ok ? await listRes.json() : { files: [] };
      const files: string[] = listData.files ?? [];
      let bodyHtml: string | null = null;
      let bodyText: string | null = null;
      if (files.includes("body.html")) {
        const r = await fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/body.html")}`, { credentials: "include" });
        if (r.ok) bodyHtml = await r.text();
      }
      if (files.includes("body.txt")) {
        const r = await fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/body.txt")}`, { credentials: "include" });
        if (r.ok) bodyText = await r.text();
      }
      setMailDetail({ metadata, bodyHtml, bodyText, files: files.filter((f) => f !== "metadata.json" && f !== "body.html" && f !== "body.txt") });
    } catch {
      setMailDetail({ metadata: {}, bodyHtml: null, bodyText: null, files: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendMessage(null);
    setSending(true);
    try {
      const formData = new FormData();
      formData.set("to", to);
      if (cc) formData.set("cc", cc);
      if (bcc) formData.set("bcc", bcc);
      formData.set("subject", subject);
      formData.set("importance", importance);
      const bodyText = bodyRef.current?.innerText ?? "";
      const bodyHtmlContent = bodyRef.current?.innerHTML ?? "";
      formData.set("body", bodyText);
      if (bodyHtmlContent.trim()) formData.set("bodyHtml", bodyHtmlContent);
      const files = fileInputRef.current?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
      }
      const res = await fetch("/api/mail/send", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSendMessage({ type: "success", text: t("sendSuccess") });
        setTo("");
        setCc("");
        setBcc("");
        setSubject("");
        if (bodyRef.current) bodyRef.current.innerHTML = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setSendMessage({ type: "error", text: data.error || t("sendError") });
      }
    } catch {
      setSendMessage({ type: "error", text: t("sendError") });
    } finally {
      setSending(false);
    }
  };

  const contentUrl = (path: string, file: string) =>
    `/api/mail-archive/content?path=${encodeURIComponent(path + "/" + file)}`;

  return (
    <div className="w-full min-h-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-5xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">{t("title")}</h1>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "send" | "sent"); if (v === "sent") loadSentList(); setSelectedMail(null); setMailDetail(null); }}>
        <TabsList className="grid w-full grid-cols-2 h-11 sm:h-12">
          <TabsTrigger value="send" className="flex items-center justify-center gap-2 text-sm sm:text-base min-h-[44px] sm:min-h-0">
            <Send className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("sendTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center justify-center gap-2 text-sm sm:text-base min-h-[44px] sm:min-h-0">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("sentTab")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4 sm:mt-6">
          <Card className="p-4 sm:p-6 w-full">
            <form onSubmit={handleSend} className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={sending} size="sm" className="min-h-[40px]">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("sending")}</> : <><Send className="h-4 w-4 mr-2" />{t("sendButton")}</>}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDiscard} className="min-h-[40px]">
                  <Trash2 className="h-4 w-4 mr-2" />{t("discard")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="min-h-[40px]">
                  <Paperclip className="h-4 w-4 mr-2" />{t("attach")}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground min-h-[40px]">
                      <PenLine className="h-4 w-4" />{t("signature")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent><p>{t("signatureAuto")}</p></TooltipContent>
                </Tooltip>
              </div>
              <Input ref={fileInputRef} type="file" multiple className="hidden" />

              <fieldset className="rounded-lg border bg-muted/20 p-4 sm:p-5 space-y-4">
                <legend className="text-sm font-semibold text-foreground px-1">{t("sectionRecipients")}</legend>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium">{t("from")}</Label>
                  <Input value={fromEmail} readOnly disabled className="w-full min-h-[44px] sm:min-h-10 bg-muted" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="to" className="text-sm font-medium">{t("to")} *</Label>
                  <Input id="to" type="email" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com" required className="w-full min-h-[44px] sm:min-h-10" />
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <button type="button" onClick={() => setShowCc((v) => !v)} className={showCc ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
                    {t("cc")}
                  </button>
                  <button type="button" onClick={() => setShowBcc((v) => !v)} className={showBcc ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
                    {t("bcc")}
                  </button>
                </div>
                {showCc && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="cc" className="text-sm font-medium">{t("cc")}</Label>
                    <Input id="cc" type="text" inputMode="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" className="w-full min-h-[44px] sm:min-h-10" />
                  </div>
                )}
                {showBcc && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="bcc" className="text-sm font-medium">{t("bcc")}</Label>
                    <Input id="bcc" type="text" inputMode="email" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@example.com" className="w-full min-h-[44px] sm:min-h-10" />
                  </div>
                )}
              </fieldset>

              <fieldset className="rounded-lg border bg-muted/20 p-4 sm:p-5 space-y-4">
                <legend className="text-sm font-semibold text-foreground px-1">{t("sectionMessage")}</legend>
                <div className="grid gap-1.5 sm:grid-cols-[1fr,auto] sm:gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="subject" className="text-sm font-medium">{t("subject")} *</Label>
                    <Input id="subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required className="w-full min-h-[44px] sm:min-h-10" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium">{t("importance")}</Label>
                    <Select value={importance} onValueChange={(v) => setImportance(v as "normal" | "high" | "low")}>
                      <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-10">
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
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium">{t("body")}</Label>
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
                      data-placeholder={t("body")}
                      suppressContentEditableWarning
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text/plain");
                        document.execCommand("insertText", false, text);
                      }}
                    />
                  </div>
                </div>
              </fieldset>

              {sendMessage && (
                <p className={`text-sm ${sendMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>{sendMessage.text}</p>
              )}
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-4 sm:mt-6">
          {selectedMail ? (
            <div className="w-full">
              <Button variant="ghost" size="sm" className="mb-4 min-h-[44px] sm:min-h-9 px-3" onClick={() => { setSelectedMail(null); setMailDetail(null); }}>
                <ArrowLeft className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{t("backToList")}</span>
              </Button>
              <Card className="p-4 sm:p-6 w-full overflow-hidden">
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {tCommon("loading")}</div>
                ) : mailDetail ? (
                  <div className="space-y-4 overflow-hidden">
                    <div className="text-sm text-muted-foreground break-words">
                      <p><strong>To:</strong> {(mailDetail.metadata as { to?: string }).to}</p>
                      {(mailDetail.metadata as { cc?: string }).cc && <p><strong>CC:</strong> {(mailDetail.metadata as { cc?: string }).cc}</p>}
                      {(mailDetail.metadata as { bcc?: string }).bcc && <p><strong>Bcc:</strong> {(mailDetail.metadata as { bcc?: string }).bcc}</p>}
                      <p><strong>Subject:</strong> {(mailDetail.metadata as { subject?: string }).subject}</p>
                      <p><strong>Sent:</strong> {(mailDetail.metadata as { sentAt?: string }).sentAt ? new Date((mailDetail.metadata as { sentAt?: string }).sentAt as string).toLocaleString() : ""}</p>
                    </div>
                    {mailDetail.bodyHtml && (
                      <div className="border rounded-md p-4 bg-muted/30 prose prose-sm dark:prose-invert max-w-none overflow-x-auto break-words" dangerouslySetInnerHTML={{ __html: mailDetail.bodyHtml }} />
                    )}
                    {!mailDetail.bodyHtml && mailDetail.bodyText && (
                      <pre className="whitespace-pre-wrap break-words border rounded-md p-4 bg-muted/30 text-sm overflow-x-auto">{mailDetail.bodyText}</pre>
                    )}
                    {mailDetail.files.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">{t("attachmentsLabel")}</p>
                        <ul className="list-disc list-inside space-y-1">
                          {mailDetail.files.map((f) => (
                            <li key={f}>
                              <a href={contentUrl(selectedMail.path, f)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{f}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" className="mb-4 min-h-[44px] sm:min-h-9 w-full sm:w-auto" onClick={loadSentList} disabled={sentLoading}>
                {sentLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : null}
                {tCommon("refresh")}
              </Button>
              <Card className="p-4 sm:p-6 w-full">
                {sentLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {tCommon("loading")}</div>
                ) : sentFolders.length === 0 ? (
                  <p className="text-muted-foreground">{t("noSent")}</p>
                ) : (
                  <ul className="space-y-2">
                    {sentFolders.map((f) => (
                      <li key={f.path}>
                        <button
                          type="button"
                          className="w-full text-left flex items-center justify-between gap-4 p-3 sm:p-4 rounded-lg border hover:bg-muted/50 transition-colors min-h-[52px] sm:min-h-0 touch-manipulation"
                          onClick={() => loadMailDetail(f)}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{f.subject}</p>
                            <p className="text-sm text-muted-foreground truncate">{f.to}</p>
                            {f.sentAt && <p className="text-xs text-muted-foreground">{new Date(f.sentAt).toLocaleString()}</p>}
                          </div>
                          <span className="text-primary shrink-0">{t("viewMail")} →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
