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

// Status badge component with icons - styled like the image
// Text is neutral gray, icons are colored and animated
const StatusBadge = ({ status }: { status: string }) => {
  const getIcon = () => {
    switch (status) {
      case "NEW":
        return <Circle className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 fill-blue-500 dark:fill-blue-400" />;
      case "IN_ANALYSIS":
        return <Loader2 className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 animate-spin" />;
      case "WAITING_CUSTOMER":
        return <Loader2 className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400 animate-spin" />;
      case "CLOSED":
      case "APPROVED":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-green-400 fill-green-500 dark:fill-green-400" />;
      case "REJECTED":
        return <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 fill-red-500 dark:fill-red-400" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  return (
    <Badge 
      variant="outline" 
      className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md"
    >
      {getIcon()}
      <span className="text-sm font-medium">
        {statusLabels[status] || status}
      </span>
    </Badge>
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
      <div className="p-8">
        <p>Loading...</p>
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
    <div className="p-4 sm:p-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              {claim.claimCodeRaw || "Unassigned Claim"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <StatusBadge status={claim.status} />
              {(() => {
                console.log('[Header] Rendering. claimAcceptanceStatus:', claim.claimAcceptanceStatus);
                return claim.claimAcceptanceStatus && (claim.claimAcceptanceStatus === "ACCEPTED" || claim.claimAcceptanceStatus === "REJECTED") && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                    {claim.claimAcceptanceStatus === "ACCEPTED" ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Prihvaćeno</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Odbijeno</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0">
            <Button 
              variant="outline" 
              onClick={() => router.push("/claims")}
              className="w-full sm:w-auto"
            >
              Back to Claims
            </Button>
            {/* TODO: Add super admin check - only show delete button for super admin */}
            {claim.status === "CLOSED" && (
              <Button 
                variant="destructive" 
                onClick={async () => {
                  if (!confirm("Da li ste sigurni da želite da obrišete ovu reklamaciju? Ova akcija je nepovratna.")) {
                    return;
                  }
                  // TODO: Add API call to delete claim (only for super admin)
                  alert("Brisanje reklamacija je trenutno onemogućeno. Kontaktirajte super admin-a.");
                }}
                className="w-full sm:w-auto"
              >
                Delete Claim
              </Button>
            )}
          </div>
        </div>
      </div>

      {claim.status === "CLOSED" && (
        <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Ova reklamacija je završena.</strong> Svi podaci su read-only i ne mogu se menjati.
          </p>
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <ClaimMetadata claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
        </div>
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap w-full gap-1 sm:grid sm:grid-cols-5">
              <TabsTrigger value="overview" className="flex-1 sm:flex-none px-2 sm:px-3" title="Overview">
                <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline text-xs sm:text-sm">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex-1 sm:flex-none px-2 sm:px-3" title="Emails">
                <Mail className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline text-xs sm:text-sm">Emails</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 sm:flex-none px-2 sm:px-3" title="Documents">
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline text-xs sm:text-sm">Documents</span>
              </TabsTrigger>
              <TabsTrigger value="findings" className="flex-1 sm:flex-none px-2 sm:px-3" title="Findings">
                <Search className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline text-xs sm:text-sm">Findings</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex-1 sm:flex-none px-2 sm:px-3" title="Photos">
                <ImageIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline text-xs sm:text-sm">Photos</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <ClaimOverview claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="emails">
              <ClaimEmails claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="documents">
              <ClaimClientDocuments claim={claim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="findings">
              <ClaimFindings claim={claim} onUpdate={updateClaim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
            <TabsContent value="photos">
              <ClaimPhotos claim={claim} isReadOnly={claim.status === "CLOSED"} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

