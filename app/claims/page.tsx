"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Loader2, XCircle, Circle, Search, FileText, Check, ChevronDownIcon, X, AlertCircle, Trash2, Lock, Unlock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { normalizeSerbianLatin } from "@/lib/utils/search";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSpinner } from "@/components/ui/status-spinner";
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
  claimPrefix: string | null;
  status: string;
  isLocked: boolean | null;
  customer: {
    id: string;
    name: string | null;
    company: string | null;
  } | null;
  engineType: string | null;
  mrEngineCode: string | null;
  assignedTo: {
    id: string;
    fullName: string;
  } | null;
  assignedWorkerName: string | null; // Worker who built the engine
  workerFault: string | null; // Worker at fault
  claimArrivalDate: string | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Status badge component with icons - unified status system
// Text is neutral gray, icons are colored and animated
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

export default function ClaimsPage() {
  const router = useRouter();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const t = useTranslations();
  
  // Helper to get status label
  const getStatusLabel = (status: string) => t(`claims.status.${status}` as any) || status;
  
  // Get user role
  interface Auth0User {
    role?: string;
    roles?: string[];
    'https://mr-engines-warranty/roles'?: string[] | string;
    app_metadata?: { roles?: string[] | string };
  }
  const auth0User = user as Auth0User | undefined;
  const userRolesRaw = auth0User?.role || auth0User?.roles?.[0] || auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;
  const isSuperAdmin = hasMinRole(userRole, "SUPER_ADMIN");
  const [deleteClaimId, setDeleteClaimId] = useState<string | null>(null);
  const [unlockClaimId, setUnlockClaimId] = useState<string | null>(null);
  const [lockClaimId, setLockClaimId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [filters, setFilters] = useState({
    status: [] as string[], // Changed to array for multi-select
    claimCode: "",
    customerId: "",
    urgentOnly: false, // Filter for urgent claims (NEW or IN_ANALYSIS older than 7 days)
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  // Separate state for text inputs to allow debouncing
  const [textFilters, setTextFilters] = useState({
    claimCode: "",
    customerId: "",
  });
  // Suggestions state
  const [showClaimCodeSuggestions, setShowClaimCodeSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [claimCodeSuggestions, setClaimCodeSuggestions] = useState<string[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);

  // Fetch claims data function for React Query
  const fetchClaimsData = useCallback(async (
    filters: { status: string[]; claimCode?: string; customerId?: string; urgentOnly?: boolean },
    page: number,
    limit: number,
    showAll = false
  ) => {
    const params = new URLSearchParams();
    
    // If showing all, only apply status filter for suggestions (no pagination)
    if (showAll) {
      if (filters.status.length > 0) {
        filters.status.forEach(s => params.append("status", s));
      }
      // For suggestions, fetch more items
      params.append("limit", "100");
    } else {
      if (filters.status.length > 0) {
        filters.status.forEach(s => params.append("status", s));
      }
      if (filters.claimCode) params.append("claimCode", filters.claimCode);
      if (filters.customerId) params.append("customerId", filters.customerId);
      // Add pagination
      params.append("page", page.toString());
      params.append("limit", limit.toString());
    }

    const res = await fetch(`/api/claims?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Failed to fetch claims");
    }
    const data = await res.json();
    return {
      claims: data.claims || [],
      pagination: data.pagination || null,
    };
  }, []);

  // React Query for filtered claims (displayed in table)
  const { data: claimsData, isLoading: loading, refetch: refetchClaims } = useQuery({
    queryKey: ['claims', 'filtered', filters.status, filters.claimCode, filters.customerId, currentPage, pageSize],
    queryFn: async () => {
      const result = await fetchClaimsData(
        { ...filters, claimCode: filters.claimCode || textFilters.claimCode, customerId: filters.customerId || textFilters.customerId },
        currentPage,
        pageSize,
        false
      );
      // Update pagination state
      if (result.pagination) {
        setPagination(result.pagination);
      }
      return result.claims;
    },
    staleTime: 30 * 1000, // 30 seconds - data stays fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
  });
  
  const claims = claimsData || [];

  // React Query for all claims (used for suggestions)
  const { data: allClaimsData, refetch: refetchAllClaims } = useQuery({
    queryKey: ['claims', 'all', filters.status],
    queryFn: () => fetchClaimsData({ ...filters }, 1, 100, true),
    staleTime: 60 * 1000, // 60 seconds - suggestions don't need to be as fresh
    gcTime: 5 * 60 * 1000,
  });
  
  const allClaims = allClaimsData?.claims || [];

  // Helper function to update claims in React Query cache
  const updateClaimInCache = useCallback((claimId: string, updates: Partial<Claim>) => {
    // Update filtered claims cache - use functional update to ensure React detects change
    queryClient.setQueryData<Claim[]>(['claims', 'filtered', filters.status, filters.claimCode, filters.customerId, currentPage, pageSize], (old) => {
      if (!old) return old;
      const updated = old.map(c => c.id === claimId ? { ...c, ...updates } : c);
      // Force re-render by creating new array reference
      return [...updated];
    });
    
    // Update all claims cache (for suggestions)
    queryClient.setQueryData<{ claims: Claim[]; pagination: PaginationInfo | null }>(['claims', 'all', filters.status], (old) => {
      if (!old) return old;
      const updated = old.claims.map(c => c.id === claimId ? { ...c, ...updates } : c);
      return { ...old, claims: [...updated] };
    });
    
    // Also invalidate other possible filter combinations to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    
    // Force immediate UI update by triggering a small delay to ensure React has processed the update
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['claims', 'filtered'] });
    }, 0);
  }, [queryClient, filters, currentPage, pageSize]);

  // Legacy fetchClaims function for backward compatibility (now just calls refetch)
  const fetchClaims = useCallback(async (showAll = false, customFilters?: { claimCode?: string; customerId?: string }) => {
    if (showAll) {
      await refetchAllClaims();
    } else {
      await refetchClaims();
    }
  }, [refetchClaims, refetchAllClaims]);

  const handleClaimCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextFilters(prev => ({ ...prev, claimCode: value }));
    
    // Show suggestions if there's text
    if (value.trim()) {
      setShowClaimCodeSuggestions(true);
      // Generate suggestions from allClaims with Serbian Latin support
      const normalizedValue = normalizeSerbianLatin(value);
      const suggestions: string[] = Array.from(
        new Set(
          allClaims
            .map((c: Claim) => c.claimCodeRaw)
            .filter((code: string | null): code is string => !!code && normalizeSerbianLatin(code).includes(normalizedValue))
            .slice(0, 5)
        )
      ) as string[];
      setClaimCodeSuggestions(suggestions);
    } else {
      setShowClaimCodeSuggestions(false);
      setClaimCodeSuggestions([]);
    }
  }, [allClaims]);

  const handleCustomerIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextFilters(prev => ({ ...prev, customerId: value }));
    
    // Show suggestions if there's text
    if (value.trim()) {
      setShowCustomerSuggestions(true);
      // Generate suggestions from allClaims with Serbian Latin support - use company instead of name
      const normalizedValue = normalizeSerbianLatin(value);
      const suggestions: string[] = Array.from(
        new Set(
          allClaims
            .map((c: Claim) => c.customer?.company)
            .filter((company: string | null | undefined): company is string => !!company && normalizeSerbianLatin(company).includes(normalizedValue))
            .slice(0, 5)
        )
      ) as string[];
      setCustomerSuggestions(suggestions);
    } else {
      setShowCustomerSuggestions(false);
      setCustomerSuggestions([]);
    }
  }, [allClaims]);

  // NO debounce - filters are only applied when user clicks suggestion or presses Enter
  // This keeps the list visible while typing

  // Initial load is handled by React Query automatically - no need for manual fetch

  // Initial fetch only - no refresh on status change

  // Real-time filtering while typing - filter locally from React Query data
  // Note: This runs client-side for instant filtering as user types
  const filteredClaims = useMemo(() => {
    if (!claims || claims.length === 0) return [];
    
    let filtered = [...claims];
    
    // Apply claimCode filter in real-time with Serbian Latin support
    if (textFilters.claimCode.trim()) {
      const normalizedClaimCode = normalizeSerbianLatin(textFilters.claimCode);
      filtered = filtered.filter(claim => {
        const claimCode = normalizeSerbianLatin(claim.claimCodeRaw || "");
        return claimCode.includes(normalizedClaimCode);
      });
    }
    
    // Apply customerId filter in real-time with Serbian Latin support - use company instead of name
    if (textFilters.customerId.trim()) {
      const normalizedCustomer = normalizeSerbianLatin(textFilters.customerId);
      filtered = filtered.filter(claim => {
        const customerCompany = normalizeSerbianLatin(claim.customer?.company || "");
        return customerCompany.includes(normalizedCustomer);
      });
    }
    
    // Apply status filter (multi-select) - real-time filtering using unified status
    if (filters.status.length > 0) {
      filtered = filtered.filter(claim => {
        return filters.status.some(selectedStatus => {
          // All statuses use the main status field now
          if (selectedStatus === "NEW" && claim.status === "NEW") return true;
          if (selectedStatus === "IN_ANALYSIS" && claim.status === "IN_ANALYSIS") return true;
          if (selectedStatus === "APPROVED" && claim.status === "APPROVED") return true;
          if (selectedStatus === "REJECTED" && claim.status === "REJECTED") return true;
          
          return false;
        });
      });
    }
    
    // Apply urgent filter - NEW or IN_ANALYSIS older than 7 days
    if (filters.urgentOnly) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = filtered.filter(claim => {
        const claimDate = new Date(claim.createdAt);
        const isOldEnough = claimDate < sevenDaysAgo;
        const isUrgentStatus = claim.status === "NEW" || claim.status === "IN_ANALYSIS";
        return isOldEnough && isUrgentStatus;
      });
    }
    
    // Return filtered claims - React Query will handle the state
    return filtered;
  }, [textFilters.claimCode, textFilters.customerId, filters.status.join(","), filters.urgentOnly, claims]);

  // Listen for claim updates to refresh the list
  useEffect(() => {
    const handleClaimUpdate = () => {
      // Invalidate and refetch claims when update event is received
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    };
    window.addEventListener('claim-updated', handleClaimUpdate);
    return () => {
      window.removeEventListener('claim-updated', handleClaimUpdate);
    };
  }, [queryClient]);

  // Delete claim handler (SUPER_ADMIN only)
  const handleDeleteClaim = async (claimId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/delete`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Optimistically remove from cache
        queryClient.setQueryData<Claim[]>(['claims', 'filtered', filters.status, filters.claimCode, filters.customerId], (old) => {
          if (!old) return old;
          return old.filter(c => c.id !== claimId);
        });
        queryClient.setQueryData<Claim[]>(['claims', 'all', filters.status], (old) => {
          if (!old) return old;
          return old.filter(c => c.id !== claimId);
        });
        
        setDeleteClaimId(null);
        // Dispatch event to update dashboard
        window.dispatchEvent(new CustomEvent('claim-deleted'));
        
        // Refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['claims'] });
      } else {
        const data = await res.json();
        alert(`${t("common.error")}: ${data.error || t("claims.delete.error")}`);
      }
    } catch (error) {
      alert(t("claims.delete.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Unlock claim handler (SUPER_ADMIN only)
  const handleUnlockClaim = async (claimId: string) => {
    setIsUnlocking(true);
    try {
      // Optimistic update - instant UI feedback
      updateClaimInCache(claimId, { isLocked: false });
      
      const res = await fetch(`/api/claims/${claimId}/unlock`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        // Update cache with server response
        if (data.claim) {
          updateClaimInCache(claimId, data.claim);
        }
        setUnlockClaimId(null);
        // Dispatch event to update dashboard (other users will see update via their own refresh)
        window.dispatchEvent(new CustomEvent('claim-updated'));
        // NO REFETCH - instant update via cache
      } else {
        // Revert optimistic update on error
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: ['claims'] }); // Revert by refetching
        alert(`${t("common.error")}: ${data.error || t("claims.unlock.error")}`);
      }
    } catch (error) {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['claims'] }); // Revert by refetching
      alert(t("claims.unlock.error"));
    } finally {
      setIsUnlocking(false);
    }
  };

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown]);

  // Use filtered claims for display
  const displayClaims = filteredClaims;

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
            {t("claims.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("claims.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => router.push("/claims/new")} 
            className="bg-primary hover:bg-primary/90 transition-all hover:shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("claims.newClaim")}
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-6 hover:shadow-md transition-all border border-border animate-in fade-in slide-in-from-top-2">
        {/* Active filters indicator */}
        {(filters.status.length > 0 || filters.urgentOnly || textFilters.claimCode.trim() || textFilters.customerId.trim()) && (
          <div className="mb-4 pb-4 border-b flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">{t("claims.filters.active")}:</span>
            {filters.status.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-zinc-200 dark:text-zinc-300 border border-zinc-600 dark:border-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-md px-2.5 py-1 text-sm font-medium"
              >
                {getStatusLabel(status)}
                <button
                  onClick={() => {
                    setFilters({ ...filters, status: filters.status.filter(s => s !== status) });
                  }}
                  className="ml-1 hover:text-white text-zinc-300 dark:text-zinc-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.urgentOnly && (
              <span
                className="inline-flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-zinc-200 dark:text-zinc-300 border border-zinc-600 dark:border-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-md px-2.5 py-1 text-sm font-medium"
              >
                {t("dashboard.urgentClaims")}
                <button
                  onClick={() => {
                    setFilters({ ...filters, urgentOnly: false });
                  }}
                  className="ml-1 hover:text-white text-zinc-300 dark:text-zinc-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {textFilters.claimCode.trim() && (
              <span
                className="inline-flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-zinc-200 dark:text-zinc-300 border border-zinc-600 dark:border-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-md px-2.5 py-1 text-sm font-medium"
              >
                Claim Code: {textFilters.claimCode}
                <button
                  onClick={() => {
                    setTextFilters({ ...textFilters, claimCode: "" });
                  }}
                  className="ml-1 hover:text-white text-zinc-300 dark:text-zinc-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {textFilters.customerId.trim() && (
              <span
                className="inline-flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-zinc-200 dark:text-zinc-300 border border-zinc-600 dark:border-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-md px-2.5 py-1 text-sm font-medium"
              >
                Customer: {textFilters.customerId}
                <button
                  onClick={() => {
                    setTextFilters({ ...textFilters, customerId: "" });
                  }}
                  className="ml-1 hover:text-white text-zinc-300 dark:text-zinc-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="animate-in fade-in slide-in-from-left-4 relative" style={{ animationDelay: "0ms" }}>
            <label className="text-sm font-medium mb-2 block">{t("common.status")}</label>
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 h-9 min-h-[36px]"
              >
                <span className={filters.status.length === 0 ? "text-muted-foreground" : ""}>
                  {filters.status.length === 0 
                    ? t("claims.filters.allClaims") 
                    : filters.status.length === 1 
                      ? getStatusLabel(filters.status[0])
                      : t("claims.filters.selectedCount", { count: filters.status.length })}
                </span>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </button>
              {showStatusDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  <div className="p-2 space-y-1">
                    {[
                      { value: "NEW", label: t("claims.status.NEW") },
                      { value: "IN_ANALYSIS", label: t("claims.status.IN_ANALYSIS") },
                      { value: "APPROVED", label: t("claims.status.APPROVED") },
                      { value: "REJECTED", label: t("claims.status.REJECTED") },
                    ].map((option) => {
                      const isSelected = filters.status.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm transition-colors cursor-pointer rounded-sm"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters({ ...filters, status: [...filters.status, option.value] });
                              } else {
                                setFilters({ ...filters, status: filters.status.filter(s => s !== option.value) });
                              }
                            }}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="animate-in fade-in slide-in-from-left-4 relative" style={{ animationDelay: "100ms" }}>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              {t("claims.mrNumber")}
            </label>
            <div className="relative">
              <Input
                placeholder={t("claims.filters.searchByCode")}
                value={textFilters.claimCode}
                onChange={handleClaimCodeChange}
                onFocus={() => {
                  if (textFilters.claimCode.trim()) {
                    setShowClaimCodeSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow clicking on suggestions
                  setTimeout(() => setShowClaimCodeSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowClaimCodeSuggestions(false);
                  }
                }}
                className="h-9 min-h-[36px] transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {showClaimCodeSuggestions && claimCodeSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {claimCodeSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTextFilters(prev => ({ ...prev, claimCode: suggestion }));
                        setShowClaimCodeSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="animate-in fade-in slide-in-from-left-4 relative" style={{ animationDelay: "200ms" }}>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              {t("claims.customer")}
            </label>
            <div className="relative">
              <Input
                placeholder={t("claims.filters.searchByCustomer")}
                value={textFilters.customerId}
                onChange={handleCustomerIdChange}
                onFocus={() => {
                  if (textFilters.customerId.trim()) {
                    setShowCustomerSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow clicking on suggestions
                  setTimeout(() => setShowCustomerSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowCustomerSuggestions(false);
                  }
                }}
                className="h-9 min-h-[36px] transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {customerSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTextFilters(prev => ({ ...prev, customerId: suggestion }));
                        setShowCustomerSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="animate-in fade-in slide-in-from-left-4 relative" style={{ animationDelay: "50ms" }}>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              {t("dashboard.urgentClaims")}
            </label>
            <div className="flex items-center gap-2 h-9 px-3 py-2 rounded-md border border-input bg-transparent">
              <input
                type="checkbox"
                id="urgentOnly"
                checked={filters.urgentOnly}
                onChange={(e) => {
                  setFilters({ ...filters, urgentOnly: e.target.checked });
                }}
                className="h-4 w-4 rounded border-input cursor-pointer"
              />
              <label htmlFor="urgentOnly" className="text-sm text-muted-foreground cursor-pointer flex-1">
                {t("claims.filters.olderThan7Days")}
              </label>
            </div>
          </div>
        </div>
        
        {/* Results count */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("claims.filters.showing")}: <span className="font-semibold text-foreground">{displayClaims.length}</span> {t("claims.filters.of")} <span className="font-semibold text-foreground">{allClaims.length}</span> {t("claims.filters.claims")}
          </p>
          {(filters.status.length > 0 || filters.urgentOnly || textFilters.claimCode.trim() || textFilters.customerId.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ status: [], claimCode: "", customerId: "", urgentOnly: false });
                setTextFilters({ claimCode: "", customerId: "" });
                setShowClaimCodeSuggestions(false);
                setShowCustomerSuggestions(false);
                setCurrentPage(1); // Reset to first page when clearing filters
              }}
              className="h-8"
            >
              <X className="h-3 w-3 mr-1" />
              {t("claims.filters.clearAll")}
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 hover:shadow-md transition-all border border-border animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("claims.list.title")}</h2>
            {displayClaims.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {displayClaims.length} {t("claims.list.count")}
              </Badge>
            )}
          </div>
        </div>
        <ResponsiveTable
          headers={[
            { key: "claimCode", label: t("claims.mrNumber") },
            { key: "status", label: t("common.status") },
            { key: "customer", label: t("claims.metadata.customerCompany") },
            { key: "engineType", label: t("claims.engineType") },
            { key: "assignedTo", label: t("claims.metadata.assignedWorker") },
            { key: "claimArrival", label: t("claims.claimArrivalDate") },
            ...(isSuperAdmin ? [{ key: "actions", label: t("common.actions") }] : []),
          ]}
          data={displayClaims.map((claim, index) => ({
            claimCode: (
              <span className="font-medium transition-colors group-hover:text-primary">
                {claim.claimCodeRaw || <span className="text-muted-foreground italic">Unassigned</span>}
              </span>
            ),
            status: <StatusBadge status={claim.status} label={getStatusLabel(claim.status)} />,
            customer: <span className="transition-colors group-hover:text-primary">{claim.customer?.company || "-"}</span>,
            engineType: <span className="text-muted-foreground">{claim.engineType || "-"}</span>,
            assignedTo: <span className="text-muted-foreground">{claim.assignedWorkerName || "-"}</span>,
            claimArrival: (
              <span className="text-muted-foreground text-xs">
                {claim.claimArrivalDate ? new Date(claim.claimArrivalDate).toLocaleDateString() : new Date(claim.createdAt).toLocaleDateString()}
              </span>
            ),
            ...(isSuperAdmin ? {
              actions: (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} key={`actions-${claim.id}-${claim.isLocked}`}>
                  {(() => {
                    // Check if claim is locked (CLOSED = locked by default, OR isLocked === true)
                    const isLocked = claim.isLocked === true || (claim.status === "CLOSED" && claim.isLocked !== false);
                    return isLocked ? (
                      <Button
                        key={`unlock-${claim.id}-${claim.isLocked}`}
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnlockClaimId(claim.id);
                        }}
                        title="Otključaj reklamaciju"
                      >
                        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </Button>
                    ) : (
                      <Button
                        key={`lock-${claim.id}-${claim.isLocked}`}
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLockClaimId(claim.id);
                        }}
                        title="Zaključaj reklamaciju"
                      >
                        <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </Button>
                    );
                  })()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteClaimId(claim.id);
                    }}
                    title="Obriši reklamaciju"
                  >
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              ),
            } : {}),
          }))}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-muted/50 rounded-full mb-4 animate-pulse">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold mb-2">{t("claims.noClaims")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("claims.list.emptyHint")}
              </p>
              <Button 
                onClick={() => router.push("/claims/new")} 
                variant="outline"
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("claims.newClaim")}
              </Button>
            </div>
          }
          onRowClick={(row, index) => router.push(`/claims/${displayClaims[index].id}`)}
        />
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t("claims.pagination.showing")} <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> - <span className="font-medium">{Math.min(currentPage * pageSize, pagination.total)}</span> {t("claims.pagination.of")} <span className="font-medium">{pagination.total}</span> {t("claims.pagination.claims")}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("claims.pagination.perPage")}:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1); // Reset to first page when changing page size
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm">
                    {t("claims.pagination.page")} <span className="font-medium">{currentPage}</span> {t("claims.pagination.of")} <span className="font-medium">{pagination.totalPages}</span>
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={!pagination.hasNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(pagination.totalPages)}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteClaimId}
        onOpenChange={(open) => !open && setDeleteClaimId(null)}
        onConfirm={() => deleteClaimId && handleDeleteClaim(deleteClaimId)}
        title={t("claims.delete.title")}
        description={t("claims.delete.confirm")}
        confirmText={isDeleting ? t("common.loading") : t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />

      {/* Unlock confirmation dialog */}
      <ConfirmDialog
        open={!!unlockClaimId}
        onOpenChange={(open) => !open && setUnlockClaimId(null)}
        onConfirm={() => unlockClaimId && handleUnlockClaim(unlockClaimId)}
        title={t("claims.unlock.title")}
        description={t("claims.unlock.confirm")}
        confirmText={isUnlocking ? t("common.loading") : t("claims.unlock.button")}
        cancelText={t("common.cancel")}
        variant="default"
      />

      {/* Lock confirmation dialog */}
      <ConfirmDialog
        open={!!lockClaimId}
        onOpenChange={(open) => !open && setLockClaimId(null)}
        onConfirm={async () => {
          if (!lockClaimId) return;
          setIsLocking(true);
          try {
            // Optimistic update - instant UI feedback
            updateClaimInCache(lockClaimId, { isLocked: true });
            
            const res = await fetch(`/api/claims/${lockClaimId}/lock`, {
              method: "POST",
            });
            if (res.ok) {
              const data = await res.json();
              // Update cache with server response
              if (data.claim) {
                updateClaimInCache(lockClaimId, data.claim);
              }
              setLockClaimId(null);
              // Dispatch event to update dashboard (other users will see update via their own refresh)
              window.dispatchEvent(new CustomEvent('claim-updated'));
              // NO REFETCH - instant update via cache
            } else {
              // Revert optimistic update on error
              const data = await res.json();
              queryClient.invalidateQueries({ queryKey: ['claims'] }); // Revert by refetching
              alert(`${t("common.error")}: ${data.error || t("claims.lock.error")}`);
            }
          } catch (error) {
            // Revert optimistic update on error
            queryClient.invalidateQueries({ queryKey: ['claims'] }); // Revert by refetching
            alert(t("claims.lock.error"));
          } finally {
            setIsLocking(false);
          }
        }}
        title={t("claims.lock.title")}
        description={t("claims.lock.confirm")}
        confirmText={isLocking ? t("common.loading") : t("claims.lock.button")}
        cancelText={t("common.cancel")}
        variant="default"
      />
    </div>
  );
}

