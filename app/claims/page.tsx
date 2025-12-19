"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Loader2, XCircle, Circle, Search, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSpinner } from "@/components/ui/status-spinner";

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  claimPrefix: string | null;
  status: string;
  claimAcceptanceStatus: string | null;
  customer: {
    id: string;
    name: string;
  } | null;
  engineType: string | null;
  mrEngineCode: string | null;
  assignedTo: {
    id: string;
    fullName: string;
  } | null;
  createdAt: string;
}

// Status badge component with icons - styled like the image
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

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    claimCode: "",
    customerId: "",
  });
  // Separate state for text inputs to allow debouncing
  const [textFilters, setTextFilters] = useState({
    claimCode: "",
    customerId: "",
  });

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.claimCode) params.append("claimCode", filters.claimCode);
      if (filters.customerId) params.append("customerId", filters.customerId);

      const res = await fetch(`/api/claims?${params.toString()}`);
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (error) {
      console.error("Error fetching claims:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleClaimCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextFilters(prev => ({ ...prev, claimCode: e.target.value }));
  }, []);

  const handleCustomerIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextFilters(prev => ({ ...prev, customerId: e.target.value }));
  }, []);

  // Debounce text filters - only update filters after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => {
        // Only update if values actually changed to avoid unnecessary re-renders
        if (prev.claimCode !== textFilters.claimCode || prev.customerId !== textFilters.customerId) {
          return {
            ...prev,
            claimCode: textFilters.claimCode,
            customerId: textFilters.customerId,
          };
        }
        return prev;
      });
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [textFilters.claimCode, textFilters.customerId]);

  // Fetch claims when filters change (status changes immediately, text filters are debounced)
  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Listen for claim updates to refresh the list
  useEffect(() => {
    const handleClaimUpdate = () => {
      fetchClaims();
    };
    window.addEventListener('claim-updated', handleClaimUpdate);
    return () => {
      window.removeEventListener('claim-updated', handleClaimUpdate);
    };
  }, [fetchClaims]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-2">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Claims
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upravljanje svim reklamacijama
          </p>
        </div>
        <Button 
          onClick={() => router.push("/claims/new")} 
          className="bg-primary hover:bg-primary/90 transition-all hover:shadow-lg animate-in fade-in slide-in-from-right-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          New claim
        </Button>
      </div>

      <Card className="p-4 mb-6 hover:shadow-md transition-all border border-border animate-in fade-in slide-in-from-top-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="animate-in fade-in slide-in-from-left-4" style={{ animationDelay: "0ms" }}>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filters.status || undefined} onValueChange={(value) => setFilters({ ...filters, status: value || "" })}>
              <SelectTrigger className="transition-all hover:border-primary/50 focus:border-primary">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">Novo</SelectItem>
                <SelectItem value="IN_ANALYSIS">U obradi</SelectItem>
                <SelectItem value="WAITING_CUSTOMER">Čeka klijenta</SelectItem>
                <SelectItem value="APPROVED">Odobreno</SelectItem>
                <SelectItem value="REJECTED">Odbijeno</SelectItem>
                <SelectItem value="CLOSED">Gotovo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="animate-in fade-in slide-in-from-left-4" style={{ animationDelay: "100ms" }}>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Claim Code
            </label>
            <Input
              placeholder="Search by claim code"
              value={textFilters.claimCode}
              onChange={handleClaimCodeChange}
              className="transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="animate-in fade-in slide-in-from-left-4" style={{ animationDelay: "200ms" }}>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Customer
            </label>
            <Input
              placeholder="Pretraži po imenu klijenta"
              value={textFilters.customerId}
              onChange={handleCustomerIdChange}
              className="transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 hover:shadow-md transition-all border border-border animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Lista reklamacija</h2>
            {claims.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {claims.length} {claims.length === 1 ? "reklamacija" : "reklamacija"}
              </Badge>
            )}
          </div>
        </div>
        <ResponsiveTable
          headers={[
            { key: "claimCode", label: "Claim Code" },
            { key: "prefix", label: "Prefix" },
            { key: "status", label: "Status" },
            { key: "customer", label: "Customer" },
            { key: "engineType", label: "Engine Type" },
            { key: "engineCode", label: "Engine Code" },
            { key: "assignedTo", label: "Assigned To" },
            { key: "created", label: "Created" },
          ]}
          data={claims.map((claim, index) => ({
            claimCode: (
              <span className="font-medium transition-colors group-hover:text-primary">
                {claim.claimCodeRaw || <span className="text-muted-foreground italic">Unassigned</span>}
              </span>
            ),
            prefix: <span className="text-muted-foreground">{claim.claimPrefix || "-"}</span>,
            status: <StatusBadge status={claim.status} acceptanceStatus={claim.claimAcceptanceStatus} />,
            customer: <span className="transition-colors group-hover:text-primary">{claim.customer?.name || "-"}</span>,
            engineType: <span className="text-muted-foreground">{claim.engineType || "-"}</span>,
            engineCode: <span className="text-muted-foreground font-mono text-xs">{claim.mrEngineCode || "-"}</span>,
            assignedTo: <span className="text-muted-foreground">{claim.assignedTo?.fullName || "-"}</span>,
            created: (
              <span className="text-muted-foreground text-xs">
                {new Date(claim.createdAt).toLocaleDateString()}
              </span>
            ),
          }))}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-muted/50 rounded-full mb-4 animate-pulse">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold mb-2">No claims found</p>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your filters or create a new claim
              </p>
              <Button 
                onClick={() => router.push("/claims/new")} 
                variant="outline"
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Claim
              </Button>
            </div>
          }
          onRowClick={(row, index) => router.push(`/claims/${claims[index].id}`)}
        />
      </Card>
    </div>
  );
}

