"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Loader2, XCircle, Circle, Search, FileText, Check, ChevronDownIcon, X, AlertCircle } from "lucide-react";
import { normalizeSerbianLatin } from "@/lib/utils/search";
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

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]); // Store all claims for suggestions
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: [] as string[], // Changed to array for multi-select
    claimCode: "",
    customerId: "",
    urgentOnly: false, // Filter for urgent claims (NEW or IN_ANALYSIS older than 7 days)
  });
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

  const fetchClaims = useCallback(async (showAll = false, customFilters?: { claimCode?: string; customerId?: string }) => {
    // Don't show loading if user is typing (to prevent "panic")
    const isTyping = textFilters.claimCode !== filters.claimCode || textFilters.customerId !== filters.customerId;
    if (!isTyping) {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams();
      const activeFilters = customFilters || filters;
      
      // If showing all, only apply status filter for suggestions
      if (showAll) {
        if (filters.status.length > 0) {
          filters.status.forEach(s => params.append("status", s));
        }
      } else {
        if (filters.status.length > 0) {
          filters.status.forEach(s => params.append("status", s));
        }
        if (activeFilters.claimCode) params.append("claimCode", activeFilters.claimCode);
        if (activeFilters.customerId) params.append("customerId", activeFilters.customerId);
      }

      const res = await fetch(`/api/claims?${params.toString()}`);
      const data = await res.json();
      const fetchedClaims = data.claims || [];
      
      if (showAll) {
        setAllClaims(fetchedClaims);
        // Also update displayed claims if no text filters are active
        if (!filters.claimCode && !filters.customerId) {
          setClaims(fetchedClaims);
        }
      } else {
        setClaims(fetchedClaims);
      }
    } catch (error) {
      console.error("Error fetching claims:", error);
    } finally {
      if (!isTyping) {
        setLoading(false);
      }
    }
  }, [filters, textFilters]);

  const handleClaimCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextFilters(prev => ({ ...prev, claimCode: value }));
    
    // Show suggestions if there's text
    if (value.trim()) {
      setShowClaimCodeSuggestions(true);
      // Generate suggestions from allClaims with Serbian Latin support
      const normalizedValue = normalizeSerbianLatin(value);
      const suggestions = Array.from(
        new Set(
          allClaims
            .map(c => c.claimCodeRaw)
            .filter((code): code is string => !!code && normalizeSerbianLatin(code).includes(normalizedValue))
            .slice(0, 5)
        )
      );
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
      // Generate suggestions from allClaims with Serbian Latin support
      const normalizedValue = normalizeSerbianLatin(value);
      const suggestions = Array.from(
        new Set(
          allClaims
            .map(c => c.customer?.name)
            .filter((name): name is string => !!name && normalizeSerbianLatin(name).includes(normalizedValue))
            .slice(0, 5)
        )
      );
      setCustomerSuggestions(suggestions);
    } else {
      setShowCustomerSuggestions(false);
      setCustomerSuggestions([]);
    }
  }, [allClaims]);

  // NO debounce - filters are only applied when user clicks suggestion or presses Enter
  // This keeps the list visible while typing

  // Initial load - fetch all claims
  useEffect(() => {
    fetchClaims(true); // Fetch all claims for suggestions
  }, []);

  // Initial fetch only - no refresh on status change

  // Real-time filtering while typing - filter locally from allClaims
  useEffect(() => {
    // Filter claims locally in real-time as user types
    if (allClaims.length === 0) return;
    
    let filtered = [...allClaims];
    
    // Apply claimCode filter in real-time with Serbian Latin support
    if (textFilters.claimCode.trim()) {
      const normalizedClaimCode = normalizeSerbianLatin(textFilters.claimCode);
      filtered = filtered.filter(claim => {
        const claimCode = normalizeSerbianLatin(claim.claimCodeRaw || "");
        return claimCode.includes(normalizedClaimCode);
      });
    }
    
    // Apply customerId filter in real-time with Serbian Latin support
    if (textFilters.customerId.trim()) {
      const normalizedCustomer = normalizeSerbianLatin(textFilters.customerId);
      filtered = filtered.filter(claim => {
        const customerName = normalizeSerbianLatin(claim.customer?.name || "");
        return customerName.includes(normalizedCustomer);
      });
    }
    
    // Apply status filter (multi-select) - real-time filtering
    if (filters.status.length > 0) {
      filtered = filtered.filter(claim => {
        return filters.status.some(selectedStatus => {
          // For NEW and IN_ANALYSIS, check status field
          if (selectedStatus === "NEW" && claim.status === "NEW") return true;
          if (selectedStatus === "IN_ANALYSIS" && claim.status === "IN_ANALYSIS") return true;
          
          // For ACCEPTED and REJECTED, check claimAcceptanceStatus
          if (selectedStatus === "ACCEPTED" && claim.claimAcceptanceStatus === "ACCEPTED") return true;
          if (selectedStatus === "REJECTED" && claim.claimAcceptanceStatus === "REJECTED") return true;
          
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
    
    setClaims(filtered);
  }, [textFilters.claimCode, textFilters.customerId, filters.status.join(","), filters.urgentOnly, allClaims]);

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
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => router.push("/claims/new")} 
            className="bg-primary hover:bg-primary/90 transition-all hover:shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            New claim
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-6 hover:shadow-md transition-all border border-border animate-in fade-in slide-in-from-top-2">
        {/* Active filters indicator */}
        {(filters.status.length > 0 || filters.urgentOnly || textFilters.claimCode.trim() || textFilters.customerId.trim()) && (
          <div className="mb-4 pb-4 border-b flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Aktivni filteri:</span>
            {filters.status.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-zinc-200 dark:text-zinc-300 border border-zinc-600 dark:border-zinc-600 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-md px-2.5 py-1 text-sm font-medium"
              >
                {status === "NEW" ? "Novo" : 
                 status === "IN_ANALYSIS" ? "U obradi" :
                 status === "ACCEPTED" ? "Završeno (Prihvaćeno)" :
                 status === "REJECTED" ? "Završeno (Odbijeno)" : status}
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
                Hitne reklamacije
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
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-all hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 h-9 min-h-[36px]"
              >
                <span className={filters.status.length === 0 ? "text-muted-foreground" : ""}>
                  {filters.status.length === 0 
                    ? "Sve reklamacije" 
                    : filters.status.length === 1 
                      ? (filters.status[0] === "NEW" ? "Novo" : 
                         filters.status[0] === "IN_ANALYSIS" ? "U obradi" :
                         filters.status[0] === "ACCEPTED" ? "Završeno (Prihvaćeno)" :
                         filters.status[0] === "REJECTED" ? "Završeno (Odbijeno)" : filters.status[0])
                      : `${filters.status.length} izabrano`}
                </span>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </button>
              {showStatusDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  <div className="p-2 space-y-1">
                    {[
                      { value: "NEW", label: "Novo" },
                      { value: "IN_ANALYSIS", label: "U obradi" },
                      { value: "ACCEPTED", label: "Završeno (Prihvaćeno)" },
                      { value: "REJECTED", label: "Završeno (Odbijeno)" },
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
              Claim Code
            </label>
            <div className="relative">
              <Input
                placeholder="Search by claim code"
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
              Customer
            </label>
            <div className="relative">
              <Input
                placeholder="Pretraži po imenu klijenta"
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
              Hitne reklamacije
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
                Starije od 7 dana
              </label>
            </div>
          </div>
        </div>
        
        {/* Results count */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Prikazano: <span className="font-semibold text-foreground">{claims.length}</span> od <span className="font-semibold text-foreground">{allClaims.length}</span> reklamacija
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
              }}
              className="h-8"
            >
              <X className="h-3 w-3 mr-1" />
              Obriši sve filtere
            </Button>
          )}
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

