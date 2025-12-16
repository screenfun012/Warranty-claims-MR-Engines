"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";

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

  const getAcceptanceIcon = () => {
    if (acceptanceStatus === "ACCEPTED") {
      return <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />;
    } else if (acceptanceStatus === "REJECTED") {
      return <XCircle className="h-3 w-3 text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" />;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md"
      >
        {getIcon()}
        <span className="text-sm font-medium">
          {statusLabels[status] || status}
        </span>
      </Badge>
      {acceptanceStatus && (acceptanceStatus === "ACCEPTED" || acceptanceStatus === "REJECTED") && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Claims</h1>
        <Button onClick={() => router.push("/claims/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New claim
        </Button>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filters.status || undefined} onValueChange={(value) => setFilters({ ...filters, status: value || "" })}>
              <SelectTrigger>
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
          <div>
            <label className="text-sm font-medium mb-2 block">Claim Code</label>
            <Input
              placeholder="Search by claim code"
              value={textFilters.claimCode}
              onChange={handleClaimCodeChange}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Customer</label>
            <Input
              placeholder="Pretraži po imenu klijenta"
              value={textFilters.customerId}
              onChange={handleCustomerIdChange}
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim Code</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Engine Type</TableHead>
              <TableHead>Engine Code</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No claims found
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim) => (
                <TableRow
                  key={claim.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/claims/${claim.id}`)}
                >
                  <TableCell className="font-medium">
                    {claim.claimCodeRaw || "Unassigned"}
                  </TableCell>
                  <TableCell>{claim.claimPrefix || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status} acceptanceStatus={claim.claimAcceptanceStatus} />
                  </TableCell>
                  <TableCell>{claim.customer?.name || "-"}</TableCell>
                  <TableCell>{claim.engineType || "-"}</TableCell>
                  <TableCell>{claim.mrEngineCode || "-"}</TableCell>
                  <TableCell>{claim.assignedTo?.fullName || "-"}</TableCell>
                  <TableCell>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

