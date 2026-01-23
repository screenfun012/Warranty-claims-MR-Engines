"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { normalizeSerbianLatin } from "@/lib/utils/search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Paperclip, FileText, Link as LinkIcon, Plus, Languages, Eye, File, Download, MoreVertical, Trash2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  claim: {
    id: string;
    claimCodeRaw: string | null;
  } | null;
  messages: Array<{
    id: string;
    date: string;
    from: string;
    to: string;
    cc?: string | null;
    subject: string;
    bodyText: string | null;
    bodyHtml: string | null;
    attachments?: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      filePath: string;
      textOriginal: string | null;
      textSr: string | null;
      textEn: string | null;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
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
          <Card className="p-4 hover:shadow-md transition-shadow">
            <ResponsiveTable
              headers={[
                { key: "date", label: t("common.date") },
                { key: "sender", label: t("inbox.from") },
                { key: "subject", label: t("inbox.subject") },
                { key: "claim", label: t("inbox.claim") },
                { key: "actions", label: t("common.actions") },
              ]}
              data={filteredThreads.map((thread) => {
                const lastMessage = thread.messages[thread.messages.length - 1];
                const isUnread = !thread.viewedAt;
                const isUnassigned = !thread.claimId; // Novo samo ako nije povezan sa claim-om
                const showNewBadge = isUnassigned && isUnread;
                return {
                  date: lastMessage ? new Date(lastMessage.date).toLocaleDateString() : "-",
                  sender: (
                    <span className={isUnread ? "font-bold" : ""}>
                      {thread.originalSender 
                        ? thread.originalSender
                            .replace(/&quot;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                        : "-"}
                    </span>
                  ),
                  subject: (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={isUnread ? "font-bold truncate" : "truncate"}>
                        {thread.subjectOriginal}
                      </span>
                      {showNewBadge && (
                        <Badge variant="destructive" className="shrink-0 animate-pulse">
                          {t("claims.status.NEW")}
                        </Badge>
                      )}
                    </div>
                  ),
                  claim: thread.claim ? (
                    <Badge 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/claims/${thread.claim!.id}`);
                      }}
                    >
                      {thread.claim.claimCodeRaw || t("inbox.viewClaim")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t("inbox.unassigned")}</Badge>
                  ),
                  actions: (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Mark thread as viewed when opened
                        if (!thread.viewedAt) {
                          try {
                            const res = await fetch(`/api/inbox/${thread.id}/mark-viewed`, {
                              method: "POST",
                            });
                            if (res.ok) {
                              // Update thread in React Query cache immediately
                              queryClient.setQueryData<EmailThread[]>(["inboxThreads"], (old) => 
                                old?.map(t => 
                                  t.id === thread.id ? { ...t, viewedAt: new Date().toISOString() } : t
                                ) || []
                              );
                              // Trigger sidebar refresh
                              queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
                              window.dispatchEvent(new Event('inbox-updated'));
                            }
                          } catch (error) {
                            console.error("Error marking thread as viewed:", error);
                          }
                        }
                        setSelectedThread(thread);
                      }}
                    >
                      {t("common.view")}
                    </Button>
                  ),
                };
              })}
              emptyMessage={searchQuery ? t("inbox.noThreadsMatchingSearch") : t("inbox.noThreads")}
              onRowClick={(row, index) => {
                const thread = filteredThreads[index];
                if (!thread.viewedAt) {
                  fetch(`/api/inbox/${thread.id}/mark-viewed`, {
                    method: "POST",
                  }).then((res) => {
                    if (res.ok) {
                      // Update thread in React Query cache immediately
                      queryClient.setQueryData<EmailThread[]>(["inboxThreads"], (old) => 
                        old?.map(t => 
                          t.id === thread.id ? { ...t, viewedAt: new Date().toISOString() } : t
                        ) || []
                      );
                      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
                      window.dispatchEvent(new Event('inbox-updated'));
                    }
                  }).catch(console.error);
                }
                setSelectedThread(thread);
              }}
            />
          </Card>
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
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; fileName: string; mimeType: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        router.push(`/claims/${claimId}?refresh=${Date.now()}`);
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
        router.push(`/claims/${claimId}?refresh=${Date.now()}`);
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
          ← Back
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
        ← Back
      </Button>
      
      <Card className="p-6 mb-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{fullThread.subjectOriginal}</h2>
          {fullThread.claim && (
            <Badge 
              variant="secondary"
              className="cursor-pointer"
              onClick={() => router.push(`/claims/${fullThread.claim!.id}`)}
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

      <div className="space-y-4">
        {fullThread.messages.map((message, index) => (
          <Card 
            key={message.id} 
            className={`p-4 hover:shadow-md transition-all ${
              index === fullThread.messages.length - 1 && !fullThread.viewedAt
                ? "bg-primary/5 border-l-2 border-l-primary animate-in fade-in slide-in-from-left-2"
                : ""
            }`}
          >
            <div className="flex justify-between mb-2">
              <div>
                <strong>{t("inbox.from")}:</strong> {message.from}
                {message.to && (
                  <>
                    <br />
                    <strong>{t("inbox.to")}:</strong> {message.to}
                  </>
                )}
                {message.cc && (
                  <>
                    <br />
                    <strong>{t("inbox.cc")}:</strong> {message.cc}
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(message.date).toLocaleString()}
              </div>
            </div>
            <div className="mt-2 overflow-hidden">
              {message.bodyHtml ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: message.bodyHtml }} 
                  className="email-body overflow-x-auto max-w-full"
                  style={{ wordBreak: 'break-word' }}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.bodyText || ""}</p>
              )}
            </div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-4 pt-4">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  {t("inbox.attachments")} ({message.attachments.length})
                </h4>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-hidden">
                  {message.attachments.map((attachment) => {
                    const isImage = attachment.mimeType?.startsWith("image/") || false;
                    const isPdf = attachment.mimeType === "application/pdf";
                    const isDocx = attachment.mimeType.includes("wordprocessingml") || 
                                  attachment.mimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                                  attachment.fileName.toLowerCase().endsWith(".docx");
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
                                  alt={attachment.fileName}
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
                                    fileName: attachment.fileName,
                                    mimeType: attachment.mimeType,
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
                                    download={attachment.fileName}
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
                              title={attachment.fileName}
                            >
                              {attachment.fileName}
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
                          <Textarea
                            value={attachment.textSr || ""}
                            rows={6}
                            readOnly
                            placeholder={t("inbox.serbianTranslationPlaceholder")}
                          />
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
                          <Textarea
                            value={attachment.textEn || ""}
                            rows={6}
                            readOnly
                            placeholder={t("inbox.englishTranslationPlaceholder")}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>{previewAttachment?.fileName}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="mt-4">
              {previewAttachment.mimeType?.startsWith("image/") ? (
                <img 
                  src={`/api/files/${previewAttachment.id}`}
                  alt={previewAttachment.fileName}
                  className="max-w-full h-auto rounded"
                />
              ) : previewAttachment.mimeType === "application/pdf" ? (
                <iframe
                  src={`/api/files/${previewAttachment.id}`}
                  className="w-full h-[80vh] rounded border"
                  title={previewAttachment.fileName}
                />
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded">
                  <p className="text-muted-foreground">
                    {t("inbox.previewNotAvailable")}{" "}
                    <a 
                      href={`/api/files/${previewAttachment.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-primary underline"
                    >
                      {t("inbox.downloadInstead")}
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
