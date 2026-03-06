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

// This is a large component - importing sub-components
import { ClaimMetadata } from "./ClaimMetadata";
import { ClaimOverview } from "./ClaimOverview";
import { ClaimEmails } from "./ClaimEmails";
import { ClaimClientDocuments } from "./ClaimClientDocuments";
import { ClaimFindings } from "./ClaimFindings";
import { ClaimPhotos } from "./ClaimPhotos";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useClaimBreadcrumb } from "@/components/claim-breadcrumb-context";

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

/** Build PATCH body from current claim (cache) so we always send what's on screen and avoid race conditions */
function buildPatchBodyFromClaim(c: Claim): Record<string, unknown> {
  const r = c as unknown as Record<string, unknown>;
  const body: Record<string, unknown> = {
    claimCodeRaw: c.claimCodeRaw ?? null,
    customerId: c.customer?.id ?? r.customerId ?? null,
    customerNumber: c.customerNumber ?? null,
    engineType: c.engineType ?? null,
    mrEngineCode: c.mrEngineCode ?? null,
    assignedWorkerName: c.assignedWorkerName ?? null,
    faultDepartmentId: c.faultDepartment?.id ?? r.faultDepartmentId ?? null,
    faultDepartmentIds: c.faultDepartments?.map((d) => d.id) ?? r.faultDepartmentIds ?? [],
    workerFault: c.workerFault ?? null,
    yearEngineDone: c.yearEngineDone ?? null,
    dateEngineDone: c.dateEngineDone ?? null,
    claimArrivalDate: c.claimArrivalDate ?? null,
    reason: c.reason ?? null,
    isDomesticMarket: c.isDomesticMarket ?? false,
    status: c.status ?? "NEW",
    summarySr: c.summarySr ?? null,
    summaryEn: c.summaryEn ?? null,
    summaryDe: r.summaryDe ?? null,
    summaryFr: r.summaryFr ?? null,
    summaryNl: r.summaryNl ?? null,
    claimPrefix: c.claimPrefix ?? null,
    claimNumber: c.claimNumber ?? null,
    claimYear: c.claimYear ?? null,
    claimAcceptanceStatus: r.claimAcceptanceStatus ?? null,
    assignedToId: c.assignedTo?.id ?? r.assignedToId ?? null,
    isLocked: c.isLocked ?? null,
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return body;
}

// Status badge component with icons - styled like the table
// Text is neutral gray, icons are colored and animated - unified status system
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
      <span className="text-sm font-medium">
        {label}
      </span>
    </Badge>
  );
};

// Fetch function for React Query
const fetchClaimData = async (claimId: string): Promise<Claim> => {
  const res = await fetch(`/api/claims/${claimId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch claim: ${res.status}`);
  }
  const data = await res.json();
  if (!data.claim) {
    throw new Error("Claim not found");
  }
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

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PATCH_DEBOUNCE_MS = 500;
  const [isSaving, setIsSaving] = useState(false);
  const [savingAndBack, setSavingAndBack] = useState(false);
  
  // Helper to get status label
  const getStatusLabel = (status: string) => t(`claims.status.${status}` as any) || status;
  interface Auth0User {
    role?: string;
    roles?: string[];
    'https://mr-engines-warranty/roles'?: string[] | string;
    app_metadata?: { roles?: string[] | string };
  }
  const auth0User = user as Auth0User | undefined;
  
  // Get role from various possible locations
  const userRolesRaw = auth0User?.role || auth0User?.roles?.[0] || auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;
  
  // Permission checks
  const isSuperAdmin = hasMinRole(userRole, "SUPER_ADMIN");
  const canEdit = hasMinRole(userRole, "OPERATOR");
  const canDelete = isSuperAdmin;

  // React Query for data fetching with caching
  const { data: claim, isLoading: loading, refetch } = useQuery({
    queryKey: ['claim', claimId],
    queryFn: () => fetchClaimData(claimId),
    enabled: !!claimId,
    staleTime: 60 * 1000, // 1 minute - data stays fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    retry: 2,
    retryDelay: 1000,
  });

  // Read-only only when explicitly locked (isLocked === true). APPROVED/REJECTED/CLOSED do not auto-lock – user locks manually.
  const isClaimLocked = claim?.isLocked === true;
  
  const isReadOnly = !isSuperAdmin && isClaimLocked;

  // Reset tab when claim ID changes
  useEffect(() => {
    if (claimId) {
      setActiveTab("overview");
    }
  }, [claimId]);

  // Breadcrumb: human-readable label for this claim (cleared on unmount)
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

  // Handle refresh parameter
  useEffect(() => {
    if (!searchParams) return;
    const refresh = typeof searchParams === 'object' && 'get' in searchParams ? searchParams.get('refresh') : null;
    if (refresh && claimId) {
      refetch();
      router.replace(`/claims/${claimId}`, { scroll: false });
    }
  }, [searchParams, claimId, refetch, router]);

  /** @param silent - when true (e.g. "save and back"), don't set isSaving so UI doesn't show loading and navigation feels instant */
  const sendCurrentClaimToServer = useCallback((silent?: boolean): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const current = queryClient.getQueryData<Claim>(["claim", claimId]);
    if (!current) return Promise.resolve(false);
    const body = buildPatchBodyFromClaim(current);
    const previousClaim = current;
    if (!silent) setIsSaving(true);
    return fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          queryClient.setQueryData(["claim", claimId], previousClaim);
          alert(`Greška pri čuvanju: ${res.status} ${errorText}`);
          return false;
        }
        const data = await res.json();
        if (data.claim) {
          queryClient.setQueryData(["claim", claimId], data.claim);
          queryClient.invalidateQueries({ queryKey: ["statistics"] });
          queryClient.setQueriesData<{ claims: Claim[]; pagination: unknown }>(
            { queryKey: ["claims", "filtered"], exact: false },
            (old) => {
              if (!old?.claims?.length) return old;
              const idx = old.claims.findIndex((c) => c.id === data.claim.id);
              if (idx === -1) return old;
              const next = { ...old, claims: [...old.claims] };
              next.claims[idx] = { ...next.claims[idx], ...data.claim };
              return next;
            }
          );
          queryClient.invalidateQueries({ queryKey: ["claims"] });
        }
        return true;
      })
      .catch((error) => {
        console.error("Error saving claim update:", error);
        queryClient.setQueryData(["claim", claimId], previousClaim);
        alert(`Greška pri čuvanju: ${error instanceof Error ? error.message : "Unknown error"}`);
        return false;
      })
      .finally(() => { if (!silent) setIsSaving(false); });
  }, [claimId, queryClient]);

  const updateClaim = useCallback((updates: Partial<Claim> | Claim) => {
    try {
      const updateKeys = Object.keys(updates);

      if (updateKeys.length > 15 && "id" in updates && (updates as Claim).id === claim?.id) {
        queryClient.setQueryData(["claim", claimId], updates as Claim);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        return;
      }

      const updateData = { ...updates } as Partial<Claim>;
      const customerFromUpdates = (updates as Record<string, unknown>).customer;
      if ("customer" in updateData) {
        delete (updateData as Record<string, unknown>).customer;
      }

      const current = queryClient.getQueryData<Claim>(["claim", claimId]) ?? claim;
      if (current) {
        const nextClaim = {
          ...current,
          ...updateData,
          ...(customerFromUpdates !== undefined && { customer: customerFromUpdates as Claim["customer"] }),
        };
        queryClient.setQueryData(["claim", claimId], nextClaim);
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(sendCurrentClaimToServer, PATCH_DEBOUNCE_MS);
    } catch (error) {
      console.error("Error updating claim:", error);
    }
  }, [claim, claimId, queryClient]);

  useEffect(() => {
    const id = claimId;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const current = queryClient.getQueryData<Claim>(["claim", id]);
      if (!current) return;
      const body = buildPatchBodyFromClaim(current);
      fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err) => console.error("[updateClaim] Flush on unmount failed:", err));
    };
  }, [claimId, queryClient]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        {/* Skeleton Content */}
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
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {claim.claimCodeRaw || t("claims.unassigned")}
            </h1>
            <StatusBadge status={claim.status} label={getStatusLabel(claim.status)} />
          </div>
          {claim.customer?.name && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{claim.customer.name}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                queryClient.prefetchQuery({
                  queryKey: ["claims", "filtered", [], "", "", false, 1, 10],
                  queryFn: async () => {
                    const res = await fetch("/api/claims?page=1&limit=10");
                    if (!res.ok) throw new Error("Failed");
                    const data = await res.json();
                    return { claims: data.claims ?? [], pagination: data.pagination ?? null };
                  },
                  staleTime: 60 * 1000,
                });
                setSavingAndBack(true);
                try {
                  const ok = await sendCurrentClaimToServer(true);
                  if (ok) router.push("/claims");
                } finally {
                  setSavingAndBack(false);
                }
              }}
              disabled={savingAndBack}
              className="h-8 text-xs sm:text-sm"
            >
              {savingAndBack ? t("common.loading") : t("claims.saveAndBackToList")}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push("/claims")}
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

      {/* Compact Info Banner */}
      {isClaimLocked && !isSuperAdmin && (
        <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>
              {claim.status === "CLOSED" ? t("claims.lockedInfo.closed") : t("claims.lockedInfo.locked")}
            </strong>{" "}
            {t("claims.lockedInfo.readOnly")}
          </p>
        </Card>
      )}
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ClaimMetadata claim={claim} onUpdate={updateClaim} isReadOnly={!canEdit || (isReadOnly ?? false)} />
        </div>
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full h-10 relative z-10">
              <TabsTrigger value="overview" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Languages className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.summary")}</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Mail className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.emails")}</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <FileText className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.documents")}</span>
              </TabsTrigger>
              <TabsTrigger value="findings" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Search className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.findings")}</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Folder className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("claims.tabs.photos")}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <ClaimOverview claim={claim} onUpdate={updateClaim} isReadOnly={!canEdit || (isReadOnly ?? false)} />
            </TabsContent>
            <TabsContent value="emails" className="mt-4">
              <ClaimEmails claim={claim} onUpdate={updateClaim} isReadOnly={!canEdit || (isReadOnly ?? false)} />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <ClaimClientDocuments claim={claim} isReadOnly={!canEdit || (isReadOnly ?? false)} onRefresh={() => refetch()} />
            </TabsContent>
            <TabsContent value="findings" className="mt-4">
              <ClaimFindings claim={claim} onUpdate={updateClaim} isReadOnly={!canEdit || (isReadOnly ?? false)} />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <ClaimPhotos claim={claim} isReadOnly={!canEdit || (isReadOnly ?? false)} onRefresh={() => refetch()} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={async () => {
          if (!claim) return;
          
          setIsDeleting(true);
          try {
            const res = await fetch(`/api/claims/${claim.id}/delete`, {
              method: "DELETE",
            });

            if (res.ok) {
              // Navigate back to claims list
              router.push("/claims");
            } else {
              const errorData = await res.json();
              alert(`${t("common.error")}: ${errorData.error || t("common.error")}`);
              setIsDeleting(false);
            }
          } catch (error) {
            console.error("Error deleting claim:", error);
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

