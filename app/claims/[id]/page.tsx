"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  workerFault: string | null;
  reason: string | null;
  isDomesticMarket: boolean;
  claimPrefix: string | null;
  claimNumber: number | null;
  claimYear: number | null;
  status: string;
  claimAcceptanceStatus: string | null;
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

// Status badge component with icons - styled like the table
// Text is neutral gray, icons are colored and animated
const StatusBadge = ({ status, acceptanceStatus }: { status: string; acceptanceStatus?: string | null }) => {
  const getIcon = () => {
    switch (status) {
      case "NEW":
        return <Circle className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 fill-blue-500 dark:fill-blue-400 animate-pulse" />;
      case "IN_ANALYSIS":
        return <StatusSpinner color="amber" />;
      case "CLOSED":
      case "APPROVED":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-green-400 fill-green-500 dark:fill-green-400" />;
      case "REJECTED":
        return <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 fill-red-500 dark:fill-red-400" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const getAcceptanceIcon = () => {
    if (acceptanceStatus === "ACCEPTED") {
      return <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />;
    } else if (acceptanceStatus === "REJECTED") {
      return <XCircle className="h-3 w-3 text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" />;
    }
    return null;
  };

  const getStatusColor = () => {
    switch (status) {
      case "NEW":
        return "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20";
      case "IN_ANALYSIS":
        return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
      case "CLOSED":
      case "APPROVED":
        return "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20";
      case "REJECTED":
        return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
      default:
        return "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`${getStatusColor()} text-gray-700 dark:text-gray-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all hover:shadow-sm border`}
      >
        {getIcon()}
        <span className="text-sm font-medium">
          {statusLabels[status] || status}
        </span>
      </Badge>
      {acceptanceStatus && (acceptanceStatus === "ACCEPTED" || acceptanceStatus === "REJECTED") && (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all ${
          acceptanceStatus === "ACCEPTED" 
            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
            : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        }`}>
          {getAcceptanceIcon()}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {acceptanceStatus === "ACCEPTED" ? "Prihvaćeno" : "Odbijeno"}
          </span>
        </div>
      )}
    </div>
  );
};

const statusLabels: Record<string, string> = {
  NEW: "NOVO",
  IN_ANALYSIS: "U OBRADI",
  APPROVED: "ODOBRENO",
  REJECTED: "ODBIJENO",
  CLOSED: "ZATVORENO",
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
  
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { user } = useUser();
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

  // Check if claim is locked or closed (read-only logic)
  // Default: CLOSED status = locked (read-only for non-SUPER_ADMIN)
  // SUPER_ADMIN can unlock closed claims by setting isLocked = false
  // SUPER_ADMIN can manually lock non-closed claims by setting isLocked = true
  // isLocked === null or undefined means "use default" (CLOSED = locked)
  // isLocked === true means "explicitly locked" (even if not CLOSED)
  // isLocked === false means "explicitly unlocked" (even if CLOSED)
  const isClaimLocked = claim ? 
    (claim.isLocked === true) || (claim.status === "CLOSED" && claim.isLocked !== false) : 
    false;
  
  const isReadOnly = !isSuperAdmin && isClaimLocked;

  // Reset tab when claim ID changes
  useEffect(() => {
    if (claimId) {
      setActiveTab("overview");
    }
  }, [claimId]);

  // Handle refresh parameter
  useEffect(() => {
    if (!searchParams) return;
    const refresh = typeof searchParams === 'object' && 'get' in searchParams ? searchParams.get('refresh') : null;
    if (refresh && claimId) {
      refetch();
      router.replace(`/claims/${claimId}`, { scroll: false });
    }
  }, [searchParams, claimId, refetch, router]);


  const updateClaim = useCallback(async (updates: Partial<Claim> | Claim) => {
    try {
      const updateKeys = Object.keys(updates);
      
      // If a full claim object is passed (from API response), update cache directly
      if (updateKeys.length > 15 && 'id' in updates && (updates as Claim).id === claim?.id) {
        queryClient.setQueryData(['claim', claimId], updates as Claim);
        return;
      }

      // Otherwise, treat it as a partial update
      const updateData = { ...updates } as Partial<Claim>;
      
      // Remove customer object from updateData if present (we only update customerId)
      if ('customer' in updateData) {
        delete (updateData as any).customer;
      }
      
      // Optimistic update - update cache immediately
      const previousClaim = claim;
      if (claim) {
        queryClient.setQueryData(['claim', claimId], { ...claim, ...updateData });
      }
      
      // Skip API call for claimAcceptanceStatus as it's handled by ClaimEmails component
      if (!('claimAcceptanceStatus' in updateData)) {
        try {
          const res = await fetch(`/api/claims/${claimId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          });

          if (!res.ok) {
            console.error('[updateClaim] API error:', res.status);
            // Revert optimistic update on error
            if (previousClaim) {
              queryClient.setQueryData(['claim', claimId], previousClaim);
            }
            throw new Error(`API error: ${res.status}`);
          }

          const data = await res.json();
          if (data.claim) {
            // Preserve claimAcceptanceStatus from current claim when updating
            const preservedClaim = {
              ...data.claim,
              claimAcceptanceStatus: claim?.claimAcceptanceStatus ?? data.claim.claimAcceptanceStatus,
            };
            queryClient.setQueryData(['claim', claimId], preservedClaim);
          }
        } catch (error) {
          console.error("Error saving claim update:", error);
          // Revert optimistic update on error
          if (previousClaim) {
            queryClient.setQueryData(['claim', claimId], previousClaim);
          }
        }
      }
    } catch (error) {
      console.error("Error updating claim:", error);
    }
  }, [claim, claimId, queryClient]);

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
        <p className="text-muted-foreground">Reklamacija nije pronađena</p>
        <Button variant="outline" onClick={() => router.push("/claims")} className="mt-4">
          ← Nazad na listu
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold truncate">
              {claim.claimCodeRaw || "Unassigned Claim"}
            </h1>
            <StatusBadge status={claim.status} acceptanceStatus={claim.claimAcceptanceStatus} />
          </div>
          {claim.customer?.name && (
            <p className="text-sm text-muted-foreground truncate">{claim.customer.name}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push("/claims")}
            className="h-8"
          >
            ← Nazad
          </Button>
          {claim.status === "CLOSED" && canDelete && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="h-8"
            >
              {isDeleting ? "Brisanje..." : "Obriši"}
            </Button>
          )}
        </div>
      </div>

      {/* Compact Info Banner */}
      {isClaimLocked && !isSuperAdmin && (
        <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>
              {claim.status === "CLOSED" ? "Završena reklamacija." : "Zaključana reklamacija."}
            </strong>{" "}
            Svi podaci su read-only. Kontaktirajte super admina da otključa reklamaciju.
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
                <span className="hidden sm:inline">Translation</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Mail className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Emails</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <FileText className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="findings" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Search className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Findings</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs px-2 relative z-10 pointer-events-auto cursor-pointer">
                <Folder className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Naši fajlovi</span>
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
              alert(`Greška pri brisanju: ${errorData.error || "Nepoznata greška"}`);
              setIsDeleting(false);
            }
          } catch (error) {
            console.error("Error deleting claim:", error);
            alert("Greška pri brisanju reklamacije");
            setIsDeleting(false);
          }
        }}
        title="Brisanje reklamacije"
        description="Da li ste sigurni da želite da obrišete ovu reklamaciju? Ova akcija je nepovratna i obrišće sve povezane podatke."
        confirmText="Obriši"
        cancelText="Otkaži"
        variant="destructive"
      />
    </div>
  );
}

