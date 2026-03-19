"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { normalizeSerbianLatin } from "@/lib/utils/search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw, Paperclip, FileText, Link as LinkIcon, Plus, Languages, Eye, File, Download, MoreVertical, Trash2, Search, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TRANSLATION_LANGUAGES } from "@/lib/translation/languages";
import { isThreadEffectivelyUnread } from "@/lib/inbox/effectiveUnread";

const FileViewerModal = dynamic(
  () => import("@/components/file-viewer-modal").then((m) => ({ default: m.FileViewerModal })),
  { ssr: false, loading: () => <Skeleton className="h-0 w-0 overflow-hidden" /> }
);

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function hasMinRole(userRole: string | undefined, minRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole || "VIEWER"] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

interface EmailThread {
  id: string;
  subjectOriginal: string;
  originalSender: string | null;
  forwardedBy: string | null;
  claimId: string | null;
  viewedAt: string | null;
  threadStatus?: string;   // NEW_CLAIM | HAS_REPLIES
  messageCount?: number;
  claim: {
    id: string;
    claimCodeRaw: string | null;
  } | null;
  messages: Array<{
    id: string;
    messageId?: string | null;
    date: string;
    from: string;
    to?: string;
    cc?: string | null;
    subject?: string;
    bodyText?: string | null;
    bodyHtml?: string | null;
    attachments?: Array<{
      id: string;
      fileName?: string;
      mimeType?: string;
      filePath?: string;
      textOriginal?: string | null;
      textSr?: string | null;
      textEn?: string | null;
      translationsJson?: string | null;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

function decodeEmailEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function threadSnippet(body: string | null | undefined): string {
  if (!body?.trim()) return "";
  const oneLine = body.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 137)}…` : oneLine;
}

interface InboxOutlookListProps {
  threads: EmailThread[];
  emptyMessage: string;
  emphasizeUnread: boolean;
  onActivate: (thread: EmailThread) => void;
  router: ReturnType<typeof useRouter>;
  claimLabel: string;
  unassignedLabel: string;
}

function InboxOutlookList({
  threads,
  emptyMessage,
  emphasizeUnread,
  onActivate,
  router,
  claimLabel,
  unassignedLabel,
}: InboxOutlookListProps) {
  if (threads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
      {threads.map((thread) => {
        const latest = thread.messages?.[0];
        const sender = thread.originalSender ? decodeEmailEntities(thread.originalSender) : "—";
        const snippet = threadSnippet(latest?.bodyText);
        const attCount = latest?.attachments?.length ?? 0;
        const dateStr = latest
          ? new Date(latest.date).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
          : "";
        const latestAt = thread.messages?.[0]?.date ?? thread.createdAt;
        const rowUnread = isThreadEffectivelyUnread(thread.viewedAt, latestAt);
        const showUnreadDot = emphasizeUnread && rowUnread;
        const boldRow = emphasizeUnread && rowUnread;

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onActivate(thread)}
            className={cn(
              "w-full text-left flex gap-3 px-3 py-3 sm:px-4 sm:py-3.5 transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            )}
          >
            <span className="flex w-2 shrink-0 justify-center pt-1.5" aria-hidden>
              {showUnreadDot ? (
                <span className="h-2 w-2 rounded-full bg-primary" />
              ) : (
                <span className="h-2 w-2" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span
                    className={cn(
                      "truncate text-sm max-w-[min(100%,18rem)] sm:max-w-[14rem]",
                      boldRow ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                    )}
                  >
                    {sender}
                  </span>
                  <span
                    className={cn(
                      "text-sm min-w-0 flex-1 truncate",
                      boldRow ? "font-semibold" : "font-normal text-foreground/80"
                    )}
                  >
                    {thread.subjectOriginal || "—"}
                  </span>
                  {attCount > 0 && (
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{dateStr}</time>
              </div>
              {snippet ? (
                <p className="text-xs text-muted-foreground line-clamp-1 pr-2">{snippet}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {thread.claim ? (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal cursor-pointer hover:bg-secondary/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/claims/${thread.claim!.id}?from=inbox`);
                    }}
                  >
                    {thread.claim.claimCodeRaw || claimLabel}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{unassignedLabel}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  status: string;
  customer: {
    name: string;
  } | null;
}

const fetchThreads = async (): Promise<EmailThread[]> => {
  const res = await fetch("/api/inbox");
  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", res.status, text);
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  return data.threads || [];
};

const checkForUpdates = async (lastCheck?: string | null): Promise<{ hasUpdates: boolean; lastUpdated: string }> => {
  if (document.hidden) return { hasUpdates: false, lastUpdated: new Date().toISOString() };
  
  const url = lastCheck 
    ? `/api/inbox/check-updates?lastCheck=${encodeURIComponent(lastCheck)}`
    : '/api/inbox/check-updates';
  
  const res = await fetch(url);
  if (!res.ok) return { hasUpdates: false, lastUpdated: new Date().toISOString() };
  const data = await res.json();
  return { 
    hasUpdates: data.hasUpdates || false, 
    lastUpdated: data.lastUpdated || new Date().toISOString() 
  };
};

export default function InboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations();
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch threads sa React Query
  const { 
    data: threads = [], 
    isLoading: loading,
    refetch: refetchThreads 
  } = useQuery({
    queryKey: ["inboxThreads"],
    queryFn: fetchThreads,
    refetchInterval: 5000, // 5 sekundi - brza detekcija novih mailova (kao u mail aplikacijama)
    refetchIntervalInBackground: false,
    staleTime: 3 * 1000, // 3 sekunde - data je fresh 3 sekunde
  });

  // Get last updated time from threads
  const lastCheckTime = useMemo(() => {
    return threads.length > 0 ? threads[0]?.updatedAt : null;
  }, [threads]);

  // Listen for inbox-updated events
  useEffect(() => {
    const handleInboxUpdate = () => {
      refetchThreads();
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    };
    window.addEventListener('inbox-updated', handleInboxUpdate);
    return () => window.removeEventListener('inbox-updated', handleInboxUpdate);
  }, [refetchThreads, queryClient]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter threads based on search query with Serbian Latin support (memoized)
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }

    const normalizedQuery = normalizeSerbianLatin(searchQuery);
    return threads.filter((thread) => {
      const subject = normalizeSerbianLatin(thread.subjectOriginal || "");
      const sender = normalizeSerbianLatin(thread.originalSender || "");
      const claimCode = normalizeSerbianLatin(thread.claim?.claimCodeRaw || "");
      
      return subject.includes(normalizedQuery) || sender.includes(normalizedQuery) || claimCode.includes(normalizedQuery);
    });
  }, [threads, searchQuery]);

  const unreadThreads = useMemo(
    () =>
      filteredThreads.filter((t) =>
        isThreadEffectivelyUnread(t.viewedAt, t.messages?.[0]?.date ?? t.createdAt)
      ),
    [filteredThreads]
  );
  const readThreads = useMemo(
    () =>
      filteredThreads.filter(
        (t) => !isThreadEffectivelyUnread(t.viewedAt, t.messages?.[0]?.date ?? t.createdAt)
      ),
    [filteredThreads]
  );

  // Check for updates sa React Query - ovo trigger-uje sync u pozadini
  const { data: updateCheck } = useQuery({
    queryKey: ["inboxUpdates", lastCheckTime],
    queryFn: () => checkForUpdates(lastCheckTime),
    enabled: !!lastCheckTime && !document.hidden,
    refetchInterval: 30000, // 30 sekundi - trigger-uje sync svakih 30 sekundi
    refetchIntervalInBackground: false,
    staleTime: 15 * 1000, // 15 sekundi - data je fresh 15 sekundi
  });

  // Refetch kada se detektuju update-i
  useEffect(() => {
    if (updateCheck?.hasUpdates) {
      refetchThreads();
      // Trigger sidebar refresh
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      window.dispatchEvent(new Event('inbox-updated'));
    }
  }, [updateCheck?.hasUpdates, refetchThreads, queryClient]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const res = await fetch("/api/admin/mail/sync-now", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        console.error("Sync API error:", res.status, text);
        clearInterval(progressInterval);
        setSyncProgress(0);
        alert(`Sync failed: ${res.status} ${text.substring(0, 100)}`);
        return;
      }
      const data = await res.json();
      clearInterval(progressInterval);
      setSyncProgress(100);
      
      setTimeout(() => {
        if (data.success) {
          alert(`Synced: ${data.newMessages} new messages, ${data.newThreads} new threads`);
          refetchThreads();
          queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
          window.dispatchEvent(new Event('inbox-updated'));
        } else {
          alert("Sync failed: " + data.error);
        }
        setSyncProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error syncing:", error);
      clearInterval(progressInterval);
      setSyncProgress(0);
      alert(t("inbox.sync.error") + ": " + (error instanceof Error ? error.message : t("common.error")));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card className="p-4">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t("inbox.title")}</h1>
          <Button 
            onClick={handleSync} 
            disabled={syncing} 
            className="bg-primary hover:bg-primary/90 relative overflow-hidden"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? t("inbox.syncing") : t("inbox.syncEmails")}
            {syncing && syncProgress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/20">
                <div 
                  className="h-full bg-primary-foreground/40 transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            )}
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <Label>{t("common.search")}</Label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("inbox.searchPlaceholder")}
              className="pl-9"
            />
          </div>
        </Card>

        {selectedThread ? (
          <ThreadDetail 
            key={selectedThread.id}
            thread={selectedThread} 
            onBack={() => {
              setSelectedThread(null);
              refetchThreads(); // Refresh threads to update unread count
              queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
              // Trigger sidebar refresh
              window.dispatchEvent(new Event('inbox-updated'));
            }}
            onThreadUpdated={() => {
              refetchThreads(); // Refresh threads when thread is updated (linked to claim)
              queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
              // Trigger sidebar refresh
              window.dispatchEvent(new Event('inbox-updated'));
            }}
          />
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t("inbox.unreadSection")} <span className="tabular-nums">({unreadThreads.length})</span>
              </h2>
              <InboxOutlookList
                threads={unreadThreads}
                emptyMessage={t("inbox.noUnread")}
                emphasizeUnread
                router={router}
                claimLabel={t("inbox.viewClaim")}
                unassignedLabel={t("inbox.unassigned")}
                onActivate={(thread) => {
                  fetch(`/api/inbox/${thread.id}/mark-viewed`, { method: "POST" }).then((res) => {
                    if (res.ok) {
                      queryClient.setQueryData<EmailThread[]>(["inboxThreads"], (old) =>
                        old?.map((t) => (t.id === thread.id ? { ...t, viewedAt: new Date().toISOString() } : t)) || []
                      );
                      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
                      window.dispatchEvent(new Event("inbox-updated"));
                    }
                  }).catch(console.error);
                  setSelectedThread(thread);
                }}
              />
            </section>
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t("inbox.readSection")} <span className="tabular-nums">({readThreads.length})</span>
              </h2>
              <InboxOutlookList
                threads={readThreads}
                emptyMessage={t("inbox.noRead")}
                emphasizeUnread={false}
                router={router}
                claimLabel={t("inbox.viewClaim")}
                unassignedLabel={t("inbox.unassigned")}
                onActivate={(thread) => setSelectedThread(thread)}
              />
            </section>
          </div>
        )}
      </div>
  );
}

function ThreadDetail({ 
  thread, 
  onBack, 
  onThreadUpdated 
}: { 
  thread: EmailThread; 
  onBack: () => void;
  onThreadUpdated: () => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const t = useTranslations();
  interface Auth0User {
    email?: string;
    role?: string;
    roles?: string[];
    'https://mr-engines-warranty/roles'?: string[] | string;
    app_metadata?: {
      roles?: string[] | string;
    };
  }
  const auth0User = user as Auth0User | undefined;
  
  // Get role from various possible locations
  const userRolesRaw = auth0User?.role || auth0User?.roles?.[0] || auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;
  
  // Permission checks
  const canDelete = hasMinRole(userRole, "SUPER_ADMIN"); // Only SUPER_ADMIN can delete
  const canCreate = hasMinRole(userRole, "OPERATOR"); // OPERATOR+ can create claims
  const userEmail = auth0User?.email || null;
  const [fullThread, setFullThread] = useState<EmailThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateClaim, setShowCreateClaim] = useState(false);
  const [showLinkClaim, setShowLinkClaim] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [translating, setTranslating] = useState<{ attachmentId: string; lang: string } | null>(null);
  const [otherTargetLang, setOtherTargetLang] = useState<Record<string, string>>({});
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());

  const getAttTranslations = (att: { translationsJson?: string | null }) => {
    if (!att.translationsJson) return {} as Record<string, string>;
    try {
      return (typeof att.translationsJson === "string" ? JSON.parse(att.translationsJson) : att.translationsJson) || {};
    } catch {
      return {} as Record<string, string>;
    }
  };
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; fileName: string; mimeType: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  /** viewedAt from the list row when thread was opened — used to highlight new messages since last read */
  const viewedAtOnOpenRef = useRef<string | null>(thread.viewedAt ?? null);

  const allAttachmentFiles = useMemo(() => {
    if (!fullThread?.messages?.length) return [];
    return fullThread.messages.flatMap((m) =>
      (m.attachments || []).map((a) => ({
        id: a.id,
        url: `/api/files/${a.id}`,
        fileName: a.fileName,
        mimeType: a.mimeType,
      }))
    );
  }, [fullThread?.messages]);

  const sortedMessages = useMemo(() => {
    if (!fullThread?.messages?.length) return [];
    const list = [...fullThread.messages];
    const seen = new Set<string>();
    const deduped = list.filter((m) => {
      const key = m.messageId ?? `${m.date}-${m.from}-${m.subject}-${(m.bodyText ?? "").slice(0, 300)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [fullThread?.id, fullThread?.messages]);

  const fetchFullThread = useCallback(async () => {
    setLoading(true);
    try {
      // Mark thread as viewed when opened
      try {
        const res = await fetch(`/api/inbox/${thread.id}/mark-viewed`, {
          method: "POST",
        });
        if (res.ok) {
          // Trigger sidebar refresh
          window.dispatchEvent(new Event('inbox-updated'));
        }
      } catch (error) {
        console.error("Error marking thread as viewed:", error);
      }

      const res = await fetch(`/api/inbox/${thread.id}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Thread API error:", res.status, text);
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json();
      setFullThread(data.thread);
      
    } catch (error) {
      console.error("Error fetching thread:", error);
    } finally {
      setLoading(false);
    }
  }, [thread.id]);

  useEffect(() => {
    fetchFullThread();
    if (showLinkClaim) {
      fetchClaims();
    }
  }, [thread.id, showLinkClaim, fetchFullThread]);

  const fetchClaims = async () => {
    try {
      const res = await fetch("/api/claims");
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch (error) {
      console.error("Error fetching claims:", error);
    }
  };

  const handleCreateClaim = async () => {
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailThreadId: thread.id,
          subject: thread.subjectOriginal,
          customerEmail: thread.originalSender,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("[handleCreateClaim] Response data:", data);
        if (!data.claim || !data.claim.id) {
          console.error("[handleCreateClaim] Invalid response - no claim or claim.id:", data);
          alert("Failed to create claim: Invalid response");
          return;
        }
        console.log(`[handleCreateClaim] Created claim ${data.claim.id} (type: ${typeof data.claim.id}), waiting before navigation...`);
        if (data.message) {
          alert(data.message);
        }
        // Refresh threads to update unread count
        onThreadUpdated();
        // Notify dashboard to refresh
        window.dispatchEvent(new Event('claim-created'));
        // Navigate immediately - claim is already created and persisted
        const claimId = data.claim.id;
        console.log(`[handleCreateClaim] Navigating to /claims/${claimId} (type: ${typeof claimId})`);
        router.push(`/claims/${claimId}?from=inbox&refresh=${Date.now()}`);
      } else {
        const errorData = await res.json();
        alert(t("claims.new.error.failed") + ": " + (errorData.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error creating claim:", error);
      alert(t("claims.new.error.failed"));
    }
  };

  const handleLinkClaim = async (claimId: string) => {
    try {
      const res = await fetch(`/api/inbox/${thread.id}/link-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const message = data.message || "Thread linked to claim successfully";
        alert(message);
        setShowLinkClaim(false);
        fetchFullThread();
        onThreadUpdated(); // This will refresh threads and update unread count
        // Navigate to claim with refresh parameter to force reload
        router.push(`/claims/${claimId}?from=inbox&refresh=${Date.now()}`);
      } else {
        const errorData = await res.json();
        alert(t("inbox.linkClaim.error") + ": " + (errorData.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error linking claim:", error);
      alert(t("inbox.linkClaim.error"));
    }
  };

  const handleExtractText = async (attachmentId: string) => {
    setExtracting(attachmentId);
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/extract-pdf`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        alert(t("inbox.extractTextSuccess"));
        fetchFullThread();
      } else {
        alert(t("inbox.extractTextError") + ": " + data.error);
      }
    } catch (error) {
      console.error("Error extracting text:", error);
      alert(t("inbox.extractTextError"));
    } finally {
      setExtracting(null);
    }
  };

  const handleTranslate = async (attachmentId: string, targetLang: string) => {
    setTranslating({ attachmentId, lang: targetLang });
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });
      const data = await res.json();
      if (data.translated) {
        alert(t("inbox.translateSuccess"));
        fetchFullThread();
      } else {
        alert(t("inbox.translateError") + ": " + data.error);
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert(t("inbox.translateError"));
    } finally {
      setTranslating(null);
    }
  };

  const toggleAttachmentExpanded = (attachmentId: string) => {
    const newExpanded = new Set(expandedAttachments);
    if (newExpanded.has(attachmentId)) {
      newExpanded.delete(attachmentId);
    } else {
      newExpanded.add(attachmentId);
    }
    setExpandedAttachments(newExpanded);
  };


  if (loading || !fullThread) {
    return (
      <div>
        <Button onClick={onBack} variant="ghost" className="mb-4">
          ← {t("inbox.backToList")}
        </Button>
        <div className="space-y-4">
          {/* Header Skeleton */}
          <Card className="p-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-40" />
            </div>
          </Card>

          {/* Message Cards Skeleton */}
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={onBack} variant="ghost" className="mb-4">
        ← {t("inbox.backToList")}
      </Button>
      
      <Card className="p-6 mb-4 border shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
          <h2 className="text-xl font-semibold leading-tight pr-2">{fullThread.subjectOriginal}</h2>
          {fullThread.claim && (
            <Badge 
              variant="secondary"
              className="cursor-pointer"
              onClick={() => router.push(`/claims/${fullThread.claim!.id}?from=inbox`)}
            >
              {fullThread.claim.claimCodeRaw || "View Claim"}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {!fullThread.claimId && canCreate && (
            <>
              <Button onClick={() => setShowCreateClaim(true)} className="flex-1 sm:flex-none min-w-0">
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{t("inbox.createClaim")}</span>
              </Button>
              <Button variant="outline" onClick={() => setShowLinkClaim(true)} className="flex-1 sm:flex-none min-w-0">
                <LinkIcon className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{t("inbox.linkToClaim")}</span>
              </Button>
            </>
          )}
          {canDelete && (
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? t("common.loading") : t("inbox.deleteThread")}
            </Button>
          )}
        </div>

        {showCreateClaim && (
          <Card className="p-4 mb-4 bg-muted/50 border border-border">
            <p className="mb-2">{t("inbox.createClaimConfirm")}</p>
            <div className="flex gap-2">
              <Button onClick={handleCreateClaim} size="sm">{t("inbox.createClaimButton")}</Button>
              <Button variant="outline" onClick={() => setShowCreateClaim(false)} size="sm">{t("common.cancel")}</Button>
            </div>
          </Card>
        )}

        {showLinkClaim && (
          <Card className="p-4 mb-4 bg-muted/50 border border-border">
            <Label className="mb-2 block">{t("inbox.selectClaimToLink")}</Label>
            <Select onValueChange={handleLinkClaim}>
              <SelectTrigger>
                <SelectValue placeholder={t("inbox.selectClaim")} />
              </SelectTrigger>
              <SelectContent>
                {claims.map((claim) => (
                  <SelectItem key={claim.id} value={claim.id}>
                    {claim.claimCodeRaw || claim.id} - {claim.customer?.name || t("inbox.noCustomer")} ({t(`claims.status.${claim.status}` as any) || claim.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowLinkClaim(false)} className="mt-2" size="sm">
              {t("common.cancel")}
            </Button>
          </Card>
        )}

      </Card>

      <div className="space-y-3">
        {sortedMessages.map((message, index) => {
          const sentAt = new Date(message.date).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });
          const snap = viewedAtOnOpenRef.current;
          const messageIsNew = snap
            ? new Date(message.date).getTime() > new Date(snap).getTime()
            : index === sortedMessages.length - 1;
          return (
            <Card
              key={message.id}
              className={cn(
                "overflow-hidden border shadow-sm",
                messageIsNew && "ring-1 ring-primary/35 bg-primary/[0.04]"
              )}
            >
              <div
                className={cn(
                  "border-b px-4 py-3 text-sm space-y-1",
                  messageIsNew ? "bg-primary/10" : "bg-muted/40"
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-foreground min-w-0 break-words">{message.from}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    {messageIsNew ? (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 font-semibold">
                        {t("inbox.newSinceLastRead")}
                      </Badge>
                    ) : null}
                    <time className="text-xs tabular-nums text-muted-foreground">{sentAt}</time>
                  </div>
                </div>
                {message.to ? (
                  <div className="text-muted-foreground text-xs">
                    <span className="font-medium text-foreground/70">{t("inbox.to")}: </span>
                    {message.to}
                  </div>
                ) : null}
                {message.cc ? (
                  <div className="text-muted-foreground text-xs">
                    <span className="font-medium text-foreground/70">{t("inbox.cc")}: </span>
                    {message.cc}
                  </div>
                ) : null}
                {sortedMessages.length > 1 ? (
                  <div className="text-[11px] text-muted-foreground pt-0.5">
                    {t("inbox.messageInConversation", { current: index + 1, total: sortedMessages.length })}
                  </div>
                ) : null}
              </div>
              <div className="px-4 py-4 overflow-hidden">
              {message.bodyHtml ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: message.bodyHtml }} 
                  className="email-body overflow-x-auto max-w-full break-words text-sm"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{message.bodyText || ""}</p>
              )}
            </div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="border-t px-4 py-4 bg-muted/20">
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                  <Paperclip className="h-4 w-4" />
                  {t("inbox.attachments")} ({message.attachments.length})
                </h4>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-hidden">
                  {message.attachments.map((attachment) => {
                    const mt = attachment.mimeType ?? "";
                    const fn = attachment.fileName ?? "";
                    const isImage = mt.startsWith("image/");
                    const isPdf = mt === "application/pdf";
                    const isDocx =
                      mt.includes("wordprocessingml") ||
                      mt.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                      fn.toLowerCase().endsWith(".docx");
                    const isExpanded = expandedAttachments.has(attachment.id);
                    const hasText = !!attachment.textOriginal;
                    const canExtractText = isPdf || isDocx;
                    
                    return (
                      <div
                        key={attachment.id}
                        className="relative group min-w-0"
                      >
                        <Card className="p-3 transition-all hover:shadow-md overflow-hidden w-full max-w-full">
                          <div className="relative">
                            {isImage ? (
                              <AspectRatio ratio={1} className="mb-2">
                                <img 
                                  src={`/api/files/${attachment.id}`}
                                  alt={fn}
                                  className="w-full h-full object-cover rounded"
                                  onError={(e) => {
                                    // Fallback to placeholder if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const fallback = document.createElement('div');
                                      fallback.className = 'flex items-center justify-center h-full w-full bg-muted rounded';
                                      fallback.innerHTML = '<svg class="h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                  loading="lazy"
                                />
                              </AspectRatio>
                            ) : isPdf ? (
                              <div className="flex items-center justify-center h-20 bg-red-50 dark:bg-red-950/20 rounded mb-2">
                                <FileText className="h-10 w-10 text-red-600 dark:text-red-400" />
                              </div>
                            ) : isDocx ? (
                              <div className="flex items-center justify-center h-20 bg-blue-50 dark:bg-blue-950/20 rounded mb-2">
                                <File className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-20 bg-muted rounded mb-2">
                                <Paperclip className="h-10 w-10 text-muted-foreground" />
                              </div>
                            )}
                            
                            {/* Actions dropdown menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => setPreviewAttachment({
                                    id: attachment.id,
                                    fileName: fn,
                                    mimeType: mt,
                                  })}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t("common.view")}
                                </DropdownMenuItem>
                                {canExtractText && !hasText && (
                                  <DropdownMenuItem
                                    onClick={() => handleExtractText(attachment.id)}
                                    disabled={extracting === attachment.id}
                                  >
                                    {extracting === attachment.id ? (
                                      <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        {t("inbox.extractTextExtracting")}
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="h-4 w-4 mr-2" />
                                        {t("inbox.extractText")}
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                {hasText && (
                                  <DropdownMenuItem
                                    onClick={() => toggleAttachmentExpanded(attachment.id)}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    {isExpanded ? t("inbox.hideText") : t("inbox.showText")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`/api/files/${attachment.id}`}
                                    download={fn}
                                    className="flex items-center w-full"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    {t("common.download")}
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="w-full overflow-hidden px-1">
                            <p 
                              className="text-xs text-center break-words line-clamp-2 min-h-[2rem] overflow-hidden" 
                              title={fn}
                            >
                              {fn}
                            </p>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
                
                {/* Expanded text view for attachments with extracted text */}
                {Array.from(expandedAttachments).map((attachmentId) => {
                  const attachment = message.attachments?.find(a => a.id === attachmentId);
                  if (!attachment || !attachment.textOriginal) return null;
                  
                  return (
                    <Card key={attachmentId} className="mt-4 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium">{attachment.fileName}</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAttachmentExpanded(attachmentId)}
                        >
                          {t("inbox.hideText")}
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <Label className="mb-2 block">{t("inbox.originalText")}</Label>
                          <Textarea 
                            value={attachment.textOriginal || ""} 
                            rows={6} 
                            readOnly 
                            className="font-mono text-sm"
                          />
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>{t("inbox.serbianTranslation")}</Label>
                            {!attachment.textSr && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTranslate(attachment.id, "SR")}
                                disabled={translating?.attachmentId === attachment.id && translating?.lang === "SR"}
                              >
                                <Languages className="h-4 w-4 mr-2" />
                                {translating?.attachmentId === attachment.id && translating?.lang === "SR" 
                                  ? t("inbox.translating") 
                                  : t("inbox.translateToSR")}
                              </Button>
                            )}
                          </div>
                          <div className="relative">
                            {translating?.attachmentId === attachment.id && translating?.lang === "SR" && (
                              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                  <span className="text-sm font-medium">{t("inbox.translating")}</span>
                                </div>
                              </div>
                            )}
                            <Textarea
                              value={
                                translating?.attachmentId === attachment.id && translating?.lang === "SR"
                                  ? (attachment.textOriginal || "")
                                  : (attachment.textSr || "")
                              }
                              rows={6}
                              readOnly
                              placeholder={t("inbox.serbianTranslationPlaceholder")}
                              className={translating?.attachmentId === attachment.id && translating?.lang === "SR" ? "opacity-60" : ""}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>{t("inbox.englishTranslation")}</Label>
                            {!attachment.textEn && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTranslate(attachment.id, "EN")}
                                disabled={translating?.attachmentId === attachment.id && translating?.lang === "EN"}
                              >
                                <Languages className="h-4 w-4 mr-2" />
                                {translating?.attachmentId === attachment.id && translating?.lang === "EN" 
                                  ? t("inbox.translating") 
                                  : t("inbox.translateToEN")}
                              </Button>
                            )}
                          </div>
                          <div className="relative">
                            {translating?.attachmentId === attachment.id && translating?.lang === "EN" && (
                              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                  <span className="text-sm font-medium">{t("inbox.translating")}</span>
                                </div>
                              </div>
                            )}
                            <Textarea
                              value={
                                translating?.attachmentId === attachment.id && translating?.lang === "EN"
                                  ? (attachment.textOriginal || "")
                                  : (attachment.textEn || "")
                              }
                              rows={6}
                              readOnly
                              placeholder={t("inbox.englishTranslationPlaceholder")}
                              className={translating?.attachmentId === attachment.id && translating?.lang === "EN" ? "opacity-60" : ""}
                            />
                          </div>
                        </div>

                        {/* Other languages (DE, NL, FR, IT, PL, DA, ES, SV) */}
                        <div>
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <Label>{t("inbox.otherLanguage")}</Label>
                            <div className="flex items-center gap-2">
                              <Select
                                value={otherTargetLang[attachment.id] || "DE"}
                                onValueChange={(val) => setOtherTargetLang((prev) => ({ ...prev, [attachment.id]: val }))}
                                disabled={!!translating?.attachmentId}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TRANSLATION_LANGUAGES.filter((l) => l.code !== "SR" && l.code !== "EN").map((l) => (
                                    <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTranslate(attachment.id, otherTargetLang[attachment.id] || "DE")}
                                disabled={translating?.attachmentId === attachment.id && translating?.lang === (otherTargetLang[attachment.id] || "DE")}
                              >
                                <Languages className="h-4 w-4 mr-2" />
                                {translating?.attachmentId === attachment.id && translating?.lang === (otherTargetLang[attachment.id] || "DE")
                                  ? t("inbox.translating")
                                  : t("inbox.translateTo")}
                              </Button>
                            </div>
                          </div>
                          <div className="relative">
                            {translating?.attachmentId === attachment.id && translating?.lang === (otherTargetLang[attachment.id] || "DE") && (
                              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                  <span className="text-sm font-medium">{t("inbox.translating")}</span>
                                </div>
                              </div>
                            )}
                            <Textarea
                              value={
                                translating?.attachmentId === attachment.id && translating?.lang === (otherTargetLang[attachment.id] || "DE")
                                  ? (attachment.textOriginal || "")
                                  : (getAttTranslations(attachment)[otherTargetLang[attachment.id] || "DE"] || "")
                              }
                              rows={6}
                              readOnly
                              placeholder={t("inbox.otherLanguagePlaceholder")}
                              className={translating?.attachmentId === attachment.id && translating?.lang === (otherTargetLang[attachment.id] || "DE") ? "opacity-60" : ""}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
          );
        })}
      </div>

      {/* Preview / file viewer (images, PDF, video, etc.) */}
      <FileViewerModal
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
        files={allAttachmentFiles}
        initialIndex={
          previewAttachment
            ? Math.max(
                0,
                allAttachmentFiles.findIndex((f) => f.id === previewAttachment.id)
              )
            : 0
        }
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={async () => {
          if (!fullThread || !userEmail) return;
          
          setIsDeleting(true);
          try {
          const res = await fetch(`/api/inbox/${fullThread.id}/delete`, {
            method: "DELETE",
          });

            if (res.ok) {
              // Navigate back to inbox list
              onThreadUpdated();
              onBack();
            } else {
              const errorData = await res.json();
              alert(`${t("common.error")}: ${errorData.error || t("common.error")}`);
              setIsDeleting(false);
            }
          } catch (error) {
            console.error("Error deleting email thread:", error);
            alert(t("inbox.deleteThreadError"));
            setIsDeleting(false);
          }
        }}
        title={fullThread?.claimId ? t("inbox.deleteThreadWithClaimTitle") : t("inbox.deleteThreadTitle")}
        description={
          fullThread?.claimId
            ? t("inbox.deleteThreadWarning", { claimCode: fullThread.claim?.claimCodeRaw || "" })
            : t("inbox.deleteThreadConfirm")
        }
        confirmText={t("inbox.deletePermanently")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </div>
  );
}
