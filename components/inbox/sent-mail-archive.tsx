"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

type SentFolder = { folderName: string; path: string; subject: string; to: string; sentAt: string };

export function SentMailArchive() {
  const t = useTranslations("mail");
  const tCommon = useTranslations("common");
  const [sentFolders, setSentFolders] = useState<SentFolder[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [selectedMail, setSelectedMail] = useState<SentFolder | null>(null);
  const [mailDetail, setMailDetail] = useState<{
    metadata: Record<string, unknown>;
    bodyHtml: string | null;
    bodyText: string | null;
    files: string[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSentList = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadSentList();
  }, [loadSentList]);

  const loadMailDetail = async (folder: SentFolder) => {
    setSelectedMail(folder);
    setDetailLoading(true);
    setMailDetail(null);
    try {
      const [metaRes, listRes] = await Promise.all([
        fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/metadata.json")}`, {
          credentials: "include",
        }),
        fetch(`/api/mail-archive/list?path=${encodeURIComponent(folder.path)}`, { credentials: "include" }),
      ]);
      const metadata = metaRes.ok ? await metaRes.json() : {};
      const listData = listRes.ok ? await listRes.json() : { files: [] };
      const files: string[] = listData.files ?? [];
      let bodyHtml: string | null = null;
      let bodyText: string | null = null;
      if (files.includes("body.html")) {
        const r = await fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/body.html")}`, {
          credentials: "include",
        });
        if (r.ok) bodyHtml = await r.text();
      }
      if (files.includes("body.txt")) {
        const r = await fetch(`/api/mail-archive/content?path=${encodeURIComponent(folder.path + "/body.txt")}`, {
          credentials: "include",
        });
        if (r.ok) bodyText = await r.text();
      }
      setMailDetail({
        metadata,
        bodyHtml,
        bodyText,
        files: files.filter((f) => f !== "metadata.json" && f !== "body.html" && f !== "body.txt"),
      });
    } catch {
      setMailDetail({ metadata: {}, bodyHtml: null, bodyText: null, files: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const contentUrl = (path: string, file: string) =>
    `/api/mail-archive/content?path=${encodeURIComponent(path + "/" + file)}`;

  if (selectedMail) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Button variant="ghost" size="sm" className="mb-2 shrink-0 w-fit" onClick={() => { setSelectedMail(null); setMailDetail(null); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToList")}
        </Button>
        <Card className="flex-1 min-h-0 overflow-y-auto p-4">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {tCommon("loading")}
            </div>
          ) : mailDetail ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground break-words">
                <p>
                  <strong>To:</strong> {(mailDetail.metadata as { to?: string }).to}
                </p>
                {(mailDetail.metadata as { cc?: string }).cc && (
                  <p>
                    <strong>CC:</strong> {(mailDetail.metadata as { cc?: string }).cc}
                  </p>
                )}
                <p>
                  <strong>Subject:</strong> {(mailDetail.metadata as { subject?: string }).subject}
                </p>
              </div>
              {mailDetail.bodyHtml && (
                <div
                  className="border rounded-md p-4 bg-muted/30 prose prose-sm dark:prose-invert max-w-none overflow-x-auto break-words"
                  dangerouslySetInnerHTML={{ __html: mailDetail.bodyHtml }}
                />
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
                        <a
                          href={contentUrl(selectedMail.path, f)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {f}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <Button variant="outline" size="sm" className="mb-2 shrink-0 w-fit" onClick={loadSentList} disabled={sentLoading}>
        {sentLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {tCommon("refresh")}
      </Button>
      {sentLoading && sentFolders.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground p-4">
          <Loader2 className="h-5 w-5 animate-spin" /> {tCommon("loading")}
        </div>
      ) : sentFolders.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">{t("noSent")}</p>
      ) : (
        <ul className="space-y-1 overflow-y-auto">
          {sentFolders.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                className="w-full text-left rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                onClick={() => loadMailDetail(f)}
              >
                <p className="font-medium truncate">{f.subject}</p>
                <p className="text-xs text-muted-foreground truncate">{f.to}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
