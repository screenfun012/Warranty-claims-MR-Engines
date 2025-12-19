"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { FileText, Mail, Image as ImageIcon, CheckCircle2, Loader2, XCircle, Circle, LayoutDashboard, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { StatusSpinner } from "@/components/ui/status-spinner";

// This is a large component - importing sub-components
import { ClaimMetadata } from "./ClaimMetadata";
import { ClaimOverview } from "./ClaimOverview";
import { ClaimEmails } from "./ClaimEmails";
import { ClaimClientDocuments } from "./ClaimClientDocuments";
import { ClaimFindings } from "./ClaimFindings";
import { ClaimPhotos } from "./ClaimPhotos";

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  claimPrefix: string | null;
  claimNumber: number | null;
  claimYear: number | null;
  status: string;
  claimAcceptanceStatus: string | null;
  customer: any;
  workOrder: any;
  engineType: string | null;
  mrEngineCode: string | null;
  customerReference: string | null;
  invoiceNumber: string | null;
  assignedTo: any;
  serverFolderPath: string | null;
  summarySr: string | null;
  summaryEn: string | null;
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
      case "WAITING_CUSTOMER":
        return <StatusSpinner color="yellow" />;
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
      case "WAITING_CUSTOMER":
        return "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20";
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
  WAITING_CUSTOMER: "ČEKA KLIJENTA",
  APPROVED: "ODOBRENO",
  REJECTED: "ODBIJENO",
  CLOSED: "ZATVORENO",
};

export default function ClaimDetailPage() {
  // Extract id from params to avoid enumeration issues in dev tools
  const params = useParams<{ id: string }>();
  const claimId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const claimIdRef = useRef<string | null>(null);

  const fetchClaim = async (retryCount = 0) => {
    try {
      if (retryCount === 0) {
        setLoading(true);
      }
      
      const currentClaimId = claimIdRef.current || claimId;
      if (!currentClaimId) {
        console.error("No claim ID available");
        setClaim(null);
        setLoading(false);
        return;
      }

      console.log(`[fetchClaim] Fetching claim ${currentClaimId} (attempt ${retryCount + 1}, type: ${typeof currentClaimId})`);
      const res = await fetch(`/api/claims/${currentClaimId}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[fetchClaim] Failed to fetch claim: ${res.status}`, errorText);
        
        // Retry up to 5 times if 404 (claim might still be creating)
        if (res.status === 404 && retryCount < 5) {
          console.log(`[fetchClaim] Retrying in 1 second (attempt ${retryCount + 1}/5)...`);
          setTimeout(() => {
            fetchClaim(retryCount + 1);
          }, 1000);
          return;
        }
        
        setClaim(null);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.claim) {
        console.log('[fetchClaim] Fetched claim. claimAcceptanceStatus:', data.claim.claimAcceptanceStatus);
        setClaim(data.claim);
        setLoading(false);
      } else {
        console.error("[fetchClaim] Claim not found in response:", data);
        // Retry if claim not in response
        if (retryCount < 5) {
          console.log(`[fetchClaim] Retrying in 1 second (attempt ${retryCount + 1}/5)...`);
          setTimeout(() => {
            fetchClaim(retryCount + 1);
          }, 1000);
          return;
        }
        setClaim(null);
        setLoading(false);
      }
    } catch (error) {
      console.error("[fetchClaim] Error fetching claim:", error);
      // Retry on error
      if (retryCount < 5) {
        console.log(`[fetchClaim] Retrying in 1 second (attempt ${retryCount + 1}/5)...`);
        setTimeout(() => {
          fetchClaim(retryCount + 1);
        }, 1000);
        return;
      }
      setClaim(null);
      setLoading(false);
    }
  };

  // Update claimIdRef when claimId changes
  useEffect(() => {
    console.log(`[ClaimDetailPage] claimId changed to: ${claimId}`);
    
    if (claimId) {
      claimIdRef.current = claimId;
      console.log(`[ClaimDetailPage] Setting claimIdRef.current to ${claimId} and calling fetchClaim`);
      setActiveTab("overview"); // Reset tab when loading new claim
      fetchClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  // Refresh claim when refresh parameter is present (e.g., after linking from inbox)
  useEffect(() => {
    const refresh = searchParams.get('refresh');
    const claimId = params.id as string;
    if (refresh && claimId) {
      claimIdRef.current = claimId;
      // Small delay to ensure backend is ready, then fetch
      const timer = setTimeout(() => {
        fetchClaim();
        // Remove refresh parameter from URL after a delay
        setTimeout(() => {
          router.replace(`/claims/${claimId}`, { scroll: false });
        }, 500);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, params.id, router]);


  const updateClaim = async (updates: Partial<Claim> | Claim) => {
    try {
      const updateKeys = Object.keys(updates);
      
      // If a full claim object is passed (from API response), set it directly
      if (updateKeys.length > 15 && 'id' in updates && (updates as Claim).id === claim?.id) {
        console.log('[updateClaim] Setting full claim object. claimAcceptanceStatus:', (updates as Claim).claimAcceptanceStatus);
        setClaim(updates as Claim);
        return;
      }

      // Otherwise, treat it as a partial update
      const updateData = { ...updates } as Partial<Claim>;
      
      // Remove customer object from updateData if present (we only update customerId)
      if ('customer' in updateData) {
        delete (updateData as any).customer;
      }
      
      console.log('[updateClaim] Partial update. Data:', updateData);
      
      // Update claim state immediately (optimistic update) - this makes header update instantly
      if (claim) {
        const updatedClaim = { ...claim, ...updateData } as Claim;
        setClaim(updatedClaim);
      }
      
      // Send API request to save changes to database
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
            if (claim) {
              setClaim(claim);
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
            // Update with server response to ensure consistency
            setClaim(preservedClaim);
          }
        } catch (error) {
          console.error("Error saving claim update:", error);
          // Revert optimistic update on error
          if (claim) {
            setClaim(claim);
          }
        }
      }
    } catch (error) {
      console.error("Error updating claim:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" text="Učitavanje reklamacije..." />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8">
        <p>Claim not found</p>
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
          {claim.status === "CLOSED" && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={async () => {
                if (!confirm("Da li ste sigurni da želite da obrišete ovu reklamaciju? Ova akcija je nepovratna.")) {
                  return;
                }
                alert("Brisanje reklamacija je trenutno onemogućeno. Kontaktirajte super admin-a.");
              }}
              className="h-8"
            >
              Obriši
            </Button>
          )}
        </div>
      </div>

      {/* Compact Info Banner */}
      {claim.status === "CLOSED" && (
        <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Završena reklamacija.</strong> Svi podaci su read-only.
          </p>
        </Card>
      )}
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ClaimMetadata claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
        </div>
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full h-10">
              <TabsTrigger value="overview" className="text-xs px-2">
                <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-xs px-2">
                <Mail className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Emails</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs px-2">
                <FileText className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="findings" className="text-xs px-2">
                <Search className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Findings</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs px-2">
                <ImageIcon className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Photos</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <ClaimOverview claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="emails" className="mt-4">
              <ClaimEmails claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <ClaimClientDocuments claim={claim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="findings" className="mt-4">
              <ClaimFindings claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <ClaimPhotos claim={claim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

