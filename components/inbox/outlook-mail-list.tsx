"use client";

import { isToday, isYesterday, isThisWeek, isSameMonth } from "date-fns";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { useRouter } from "next/navigation";
import { isThreadEffectivelyUnread } from "@/lib/inbox/effectiveUnread";

/** Minimal row shape; app passes full EmailThread (extra fields allowed). */
export type OutlookThread = {
  id: string;
  subjectOriginal: string;
  originalSender: string | null;
  forwardedBy?: string | null;
  claimId?: string | null;
  viewedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  claim: { id: string; claimCodeRaw: string | null } | null;
  messages: Array<{
    id: string;
    date: string;
    from: string;
    bodyText?: string | null;
    attachments?: Array<{ id: string }>;
  }>;
};

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

/** Two-letter initials from email display name or address */
export function senderInitials(sender: string): string {
  const s = decodeEmailEntities(sender).trim();
  if (!s) return "?";
  const noAngle = s.includes("<") ? s.replace(/^[^<]*<([^>]+)>.*/, "$1") : s;
  const local = noAngle.split("@")[0] ?? noAngle;
  const parts = local.replace(/[._]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return local.slice(0, 2).toUpperCase();
}

const AVATAR_HUES = [210, 160, 280, 35, 330, 190, 240, 25];

function avatarBg(sender: string): string {
  let h = 0;
  for (let i = 0; i < sender.length; i++) h = (h + sender.charCodeAt(i) * 17) % 360;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return `hsl(${hue} 45% 36%)`;
}

function bucketLabelForDate(date: Date, labels: Record<string, string>): string {
  if (isToday(date)) return labels.today;
  if (isYesterday(date)) return labels.yesterday;
  if (isThisWeek(date, { weekStartsOn: 1 })) return labels.thisWeek;
  if (isSameMonth(date, new Date())) return labels.earlierThisMonth;
  return labels.older;
}

export function groupThreadsByOutlookBuckets(
  threads: OutlookThread[],
  labels: Record<string, string>
): { label: string; threads: OutlookThread[] }[] {
  const sorted = [...threads].sort((a, b) => {
    const ta = new Date(a.messages?.[0]?.date ?? a.createdAt).getTime();
    const tb = new Date(b.messages?.[0]?.date ?? b.createdAt).getTime();
    return tb - ta;
  });

  const out: { label: string; threads: OutlookThread[] }[] = [];
  let currentLabel = "";
  let bucket: OutlookThread[] = [];

  for (const thread of sorted) {
    const d = new Date(thread.messages?.[0]?.date ?? thread.createdAt);
    const label = bucketLabelForDate(d, labels);
    if (label !== currentLabel) {
      if (bucket.length) out.push({ label: currentLabel, threads: bucket });
      currentLabel = label;
      bucket = [thread];
    } else {
      bucket.push(thread);
    }
  }
  if (bucket.length) out.push({ label: currentLabel, threads: bucket });
  return out;
}

type OutlookMailListProps = {
  groups: { label: string; threads: OutlookThread[] }[];
  selectedThreadId: string | null;
  emphasizeUnread: boolean;
  onActivate: (thread: OutlookThread) => void;
  router: ReturnType<typeof useRouter>;
  claimLabel: string;
  unassignedLabel: string;
};

export function OutlookMailList({
  groups,
  selectedThreadId,
  emphasizeUnread,
  onActivate,
  router,
  claimLabel,
  unassignedLabel,
}: OutlookMailListProps) {
  const flatCount = groups.reduce((n, g) => n + g.threads.length, 0);
  if (flatCount === 0) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-col">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="sticky top-0 z-[1] bg-muted/90 backdrop-blur-sm border-b border-border px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </span>
          </div>
          <div className="divide-y divide-border">
            {group.threads.map((thread) => {
              const latest = thread.messages?.[0];
              const sender = thread.originalSender ? decodeEmailEntities(thread.originalSender) : "—";
              const snippet = threadSnippet(latest?.bodyText);
              const attCount = latest?.attachments?.length ?? 0;
              const latestAt = thread.messages?.[0]?.date ?? thread.createdAt;
              const rowUnread = isThreadEffectivelyUnread(thread.viewedAt, latestAt);
              const showUnreadDot = emphasizeUnread && rowUnread;
              const boldRow = emphasizeUnread && rowUnread;
              const selected = selectedThreadId === thread.id;
              const initials = senderInitials(sender);
              const bg = avatarBg(sender);

              const dateStr = latest
                ? new Date(latest.date).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                : "";

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onActivate(thread)}
                  className={cn(
                    "w-full text-left flex gap-2 pl-0 pr-2 py-2.5 sm:py-3 transition-colors relative",
                    "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    selected && "bg-muted/80"
                  )}
                >
                  <span
                    className={cn(
                      "w-1 shrink-0 rounded-full self-stretch min-h-[3rem]",
                      selected ? "bg-primary" : "bg-transparent"
                    )}
                    aria-hidden
                  />
                  <span className="flex w-5 shrink-0 justify-center pt-1" aria-hidden>
                    {showUnreadDot ? (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shadow-sm" />
                    ) : (
                      <span className="h-2 w-2" />
                    )}
                  </span>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground shadow-sm"
                    style={{ backgroundColor: bg }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span
                            className={cn(
                              "truncate text-sm",
                              boldRow ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                            )}
                          >
                            {sender}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-sm truncate mt-0.5",
                            boldRow ? "font-semibold text-foreground" : "text-foreground/85"
                          )}
                        >
                          {thread.subjectOriginal || "—"}
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground pt-0.5">
                        {dateStr}
                      </time>
                    </div>
                    {snippet ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 pr-1">{snippet}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {attCount > 0 && (
                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      {thread.claim ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal h-5 px-1.5 cursor-pointer hover:bg-secondary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/claims/${thread.claim!.id}?from=inbox`);
                          }}
                        >
                          {thread.claim.claimCodeRaw || claimLabel}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{unassignedLabel}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
