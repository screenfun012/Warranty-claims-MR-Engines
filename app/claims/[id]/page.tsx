"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, CheckCircle2, XCircle, Circle, Search, Languages, Folder } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSpinner } from "@/components/ui/status-spinner";

import { ClaimMetadata } from "./ClaimMetadata";
import { ClaimOverview } from "./ClaimOverview";
import { ClaimEmails } from "./ClaimEmails";
import { ClaimClientDocuments } from "./ClaimClientDocuments";
import { ClaimFindings } from "./ClaimFindings";
import { ClaimPhotos } from "./ClaimPhotos";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useClaimBreadcrumb } from "@/components/claim-breadcrumb-context";

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

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  customerNumber: string | null;
  yearEngineDone: number | null;
  dateEngineDone: string | null;
  claimArrivalDate: string | null;
  assignedWorkerName: string | null;
  workerFault: string | null;
  reason: string | null;
  isDomesticMarket: boolean;
  claimPrefix: string | null;
  claimNumber: number | null;
  claimYear: number | null;
  status: string;
  processingEmailSentAt: string | null;
  isLocked: boolean | null;
  customer: {
    id: string;
    name: string | null;
    company: string | null;
  } | null;
  faultDepartment: {
    id: string;
    name: string;
  } | null;
  faultDepartments?: {
    id: string;
    name: string;
  }[];
  workOrder: any;
  engineType: string | null;
  mrEngineCode: string | null;
  customerReference: string | null;
  invoiceNumber: string | null;
  assignedTo: any;
  serverFolderPath: string | null;
  summarySr: string | null;
  summaryEn: string | null;
  summaryDe: string | null;
  summaryFr: string | null;
  summaryNl: string | null;
  emailThreads: any[];
  attachments: any[];
  clientDocuments: any[];
  photos: any[];
  reportSections: any[];
}

// Fields that live only in the UI / are handled by separate API calls — never sent to PATCH /api/claims/[id]
const SKIP_PATCH_FIELDS = new Set([
  "customer",
  "faultDepartment",
  "faultDepartments",
  "workOrder",
  "assignedTo",
  "emailThreads",
  "attachments",
  "clientDocuments",
  "photos",
  "reportSections",
  "id",
  "createdAt",
  "updatedAt",
  "serverFolderPath",
]);

const StatusBadge = ({ status, label }: { status: string; label: string }) => {
  const getIcon = () => {
    switch (status) {
      case "NEW":
        return <Circle className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 fill-blue-500 dark:fill-blue-400 animate-pulse" />;
      case "IN_ANALYSIS":
        return <StatusSpinner color="amber" />;
      case "APPROVED":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-green-400 fill-green-500 dark:fill-green-400" />;
      case "REJECTED":
        return <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 fill-red-500 dark:fill-red-400" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "NEW":
        return "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20";
      case "IN_ANALYSIS":
        return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
      case "APPROVED":
        return "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20";
      case "REJECTED":
        return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
      default:
        return "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800";
    }
  };

  return (
    <Badge
      variant="outline"
      className={`${getStatusColor()} text-gray-700 dark:text-gray-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all hover:shadow-sm border`}
    >
      {getIcon()}
      <span className="text-sm font-medium">{label}</span>
    </Badge>
  );
};

const fetchClaimData = async (claimId: string, light = false): Promise<Claim> => {
  const res = await fetch(`/api/claims/${claimId}${light ? "?light=1" : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch claim: ${res.status}`);
  const data = await res.json();
  if (!data.claim) throw new Error("Claim not found");
  return data.claim;
};

export default function ClaimDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const claimId = params?.id as string;
  const queryClient = useQueryClient();
  const t = useTranslations();

  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { setLabel: setClaimBreadcrumbLabel } = useClaimBreadcrumb();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});
  const flushToServerRef = useRef<(silent?: boolean) => Promise<boolean>>(async () => true);
  const PATCH_DEBOUNCE_MS = 250;

  const getStatusLabel = (status: string) => t(`claims.status.${status}` as any) || status;

  interface Auth0User {
    role?: string;
    roles?: string[];
    "https://mr-engines-warranty/roles"?: string[] | string;
    app_metadata?: { roles?: string[] | string };
  }
  const auth0User = user as Auth0User | undefined;
  const userRolesRaw =
    auth0User?.role ||
    auth0User?.roles?.[0] ||
    auth0User?.["https://mr-engines-warranty/roles"] ||
    auth0User?.app_metadata?.roles ||
    [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;
  const isSuperAdmin = hasMinRole(userRole, "SUPER_ADMIN");
  const canEdit = hasMinRole(userRole, "OPERATOR");
  const canDelete = isSuperAdmin;

  const {
    data: claim,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["claim", claimId],
    // Light fetch: fast open without hydrating every email body from NAS.
    queryFn: () => fetchClaimData(claimId, true),
    enabled: !!claimId,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });

  // Full (email-hydrated) claim — fetched only when the Emails tab is opened,
  // so opening a claim never waits on NAS reads for every message body.
  const { data: claimEmailsFull } = useQuery({
    queryKey: ["claim", claimId, "emails-full"],
    queryFn: () => fetchClaimData(claimId, false),
    enabled: !!claimId && activeTab === "emails",
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const claimForEmails = claimEmailsFull ?? claim;

  const isClaimLocked = claim?.isLocked === true;
  const isReadOnly = !isSuperAdmin && isClaimLocked;

  useEffect(() => {
    if (claimId) setActiveTab("overview");
  }, [claimId]);

  useEffect(() => {
    if (claim) {
      const label =
        claim.claimCodeRaw?.trim() ||
        claim.customer?.company?.trim() ||
        claim.customer?.name?.trim() ||
        claim.id.slice(0, 12);
      setClaimBreadcrumbLabel(label);
    } else {
      setClaimBreadcrumbLabel(null);
    }
    return () => setClaimBreadcrumbLabel(null);
  }, [claim, setClaimBreadcrumbLabel]);

  useEffect(() => {
    if (!searchParams) return;
    const refresh =
      typeof searchParams === "object" && "get" in searchParams
        ? searchParams.get("refresh")
        : null;
    if (refresh && claimId) {
      refetch();
      router.replace(`/claims/${claimId}`, { scroll: false });
    }
  }, [searchParams, claimId, refetch, router]);

  // ── Flush pending changes to server ──────────────────────────────
  const flushToServer = useCallback(
    async (silent?: boolean): Promise<boolean> => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Build PATCH body from pending changes only
      const snapshot = { ...pendingRef.current };
      const patchBody: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(snapshot)) {
        if (!SKIP_PATCH_FIELDS.has(k)) {
          patchBody[k] = v;
        }
      }
      if (Object.keys(patchBody).length === 0) return true;

      // Clear pending for the fields we're about to send
      pendingRef.current = {};
      if (!silent) setIsSaving(true);

      try {
        const res = await fetch(`/api/claims/${claimId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });

        if (!res.ok) {
          // Re-add to pending so next attempt includes them
          Object.assign(pendingRef.current, snapshot);
          const errorText = await res.text();
          // Uvek osveži detalj sa servera — optimistic UI je pogrešan dok PATCH ne uspe
          void queryClient.invalidateQueries({ queryKey: ["claim", claimId] });
          alert(`Greška pri čuvanju: ${res.status} ${errorText}`);
          return false;
        }

        const data = await res.json();
        if (data.claim) {
          // Apply server response, then layer any NEW pending changes on top
          const freshPending = pendingRef.current;
          const merged = Object.keys(freshPending).length > 0
            ? { ...data.claim, ...freshPending }
            : data.claim;
          queryClient.setQueryData(["claim", claimId], merged);

          // Update claims list caches
          queryClient.setQueriesData<{ claims: Claim[]; pagination: unknown }>(
            { queryKey: ["claims", "filtered"], exact: false },
            (old) => {
              if (!old?.claims?.length) return old;
              const idx = old.claims.findIndex((c) => c.id === data.claim.id);
              if (idx === -1) return old;
              const next = { ...old, claims: [...old.claims] };
              next.claims[idx] = { ...next.claims[idx], ...data.claim };
              return next;
            },
          );
        }

        return true;
      } catch (error) {
        Object.assign(pendingRef.current, snapshot);
        console.error("Error saving claim:", error);
        void queryClient.invalidateQueries({ queryKey: ["claim", claimId] });
        alert(
          `Greška pri čuvanju: ${error instanceof Error ? error.message : "Unknown"}`,
        );
        return false;
      } finally {
        if (!silent) setIsSaving(false);
      }
    },
    [claimId, queryClient],
  );

  flushToServerRef.current = flushToServer;

  // ── Update claim (called by Metadata, Overview, etc.) ────────────
  const updateClaim = useCallback(
    (
      updates: Partial<Claim> | Claim,
      opts?: { flushImmediately?: boolean },
    ) => {
      const updateKeys = Object.keys(updates);

      // Full claim replacement (from server / child components that push entire claim)
      if (updateKeys.length > 15 && "id" in updates && (updates as Claim).id === claim?.id) {
        // Apply pending on top so unsaved edits are preserved
        const pending = pendingRef.current;
        const merged = Object.keys(pending).length > 0
          ? { ...(updates as Claim), ...pending }
          : (updates as Claim);
        queryClient.setQueryData(["claim", claimId], merged as Claim);
        return;
      }

      // Only track patchable fields; UI-only fields just update cache
      let hasPatchable = false;
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined) continue;
        if (!SKIP_PATCH_FIELDS.has(k)) {
          pendingRef.current[k] = v;
          hasPatchable = true;
        }
      }

      // Optimistic cache update (all fields, including UI-only)
      const current = queryClient.getQueryData<Claim>(["claim", claimId]) ?? claim;
      if (current) {
        const nextClaim = { ...current } as Record<string, unknown>;
        for (const [k, v] of Object.entries(updates)) {
          if (v === undefined) continue;
          nextClaim[k] = v;
        }
        queryClient.setQueryData(["claim", claimId], nextClaim as unknown as Claim);
      }

      if (hasPatchable) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (opts?.flushImmediately) {
          queueMicrotask(() => {
            void flushToServer(true);
          });
        } else {
          debounceTimerRef.current = setTimeout(() => flushToServer(), PATCH_DEBOUNCE_MS);
        }
      }
    },
    [claim, claimId, queryClient, flushToServer],
  );

  // Pri napuštanju stranice: isti flush kao dugme (vraća pending ako PATCH padne — ne gubi se u ćorsokaku)
  useEffect(() => {
    return () => {
      void flushToServerRef.current(true);
    };
  }, [claimId]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-[350px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">{t("claims.notFound")}</p>
        <Button variant="outline" onClick={() => router.push("/claims")} className="mt-4">
          ← {t("claims.backToList")}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {claim.claimCodeRaw || t("claims.unassigned")}
            </h1>
            <StatusBadge status={claim.status} label={getStatusLabel(claim.status)} />
          </div>
          {claim.customer?.name && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {claim.customer.name}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canEdit && (
            <Button
              variant="default"
              size="sm"
              disabled={isSaving}
              onClick={async () => {
                const ok = await flushToServer(false);
                if (!ok) {
                  window.dispatchEvent(
                    new CustomEvent("claim-save-failed", { detail: { claimId } }),
                  );
                  return;
                }
                void queryClient.invalidateQueries({ queryKey: ["claims"], exact: false });
                router.push("/claims");
              }}
              className="h-8 text-xs sm:text-sm"
            >
              {isSaving ? t("common.loading") : t("claims.saveAndBackToList")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={async () => {
              const ok = await flushToServer(false);
              if (!ok) return;
              void queryClient.invalidateQueries({ queryKey: ["claims"], exact: false });
              router.push("/claims");
            }}
            className="h-8 text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">← </span>
            {t("common.back")}
          </Button>
          {claim.status === "CLOSED" && canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="h-8 text-xs sm:text-sm"
            >
              {isDeleting ? t("common.loading") : t("common.delete")}
            </Button>
          )}
        </div>
      </div>

      {isClaimLocked && !isSuperAdmin && (
        <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>
              {claim.status === "CLOSED"
                ? t("claims.lockedInfo.closed")
                : t("claims.lockedInfo.locked")}
            </strong>{" "}
            {t("claims.lockedInfo.readOnly")}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ClaimMetadata
            claim={claim}
            onUpdate={updateClaim}
            isReadOnly={!canEdit || (isReadOnly ?? false)}
          />
        </div>
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full h-10 relative z-10">
              <TabsTrigger
                value="overview"
                className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer"
              >
                <Languages className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.summary")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="emails"
                className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.emails")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.documents")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="findings"
                className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.findings")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer"
              >
                <Folder className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.photos")}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <ClaimOverview
                claim={claim}
                onUpdate={updateClaim}
                isReadOnly={!canEdit || (isReadOnly ?? false)}
              />
            </TabsContent>
            <TabsContent value="emails" className="mt-4">
              <ClaimEmails
                claim={claimForEmails}
                onUpdate={updateClaim}
                isReadOnly={!canEdit || (isReadOnly ?? false)}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <ClaimClientDocuments
                claim={claim}
                isReadOnly={!canEdit || (isReadOnly ?? false)}
                onRefresh={() => refetch()}
              />
            </TabsContent>
            <TabsContent value="findings" className="mt-4">
              <ClaimFindings
                claim={claim}
                onUpdate={updateClaim}
                isReadOnly={!canEdit || (isReadOnly ?? false)}
              />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <ClaimPhotos
                claim={claim}
                isReadOnly={!canEdit || (isReadOnly ?? false)}
                onRefresh={() => refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={async () => {
          if (!claim) return;
          setIsDeleting(true);
          try {
            const res = await fetch(`/api/claims/${claim.id}/delete`, { method: "DELETE" });
            if (res.ok) {
              router.push("/claims");
            } else {
              const errorData = await res.json();
              alert(`${t("common.error")}: ${errorData.error || t("common.error")}`);
              setIsDeleting(false);
            }
          } catch {
            alert(t("claims.delete.error"));
            setIsDeleting(false);
          }
        }}
        title={t("claims.delete.title")}
        description={t("claims.delete.confirm")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </div>
  );
}
