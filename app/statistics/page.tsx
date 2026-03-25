"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { 
  BarChart3, 
  Download, 
  Filter, 
  X,
  CalendarIcon,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponsiveTable } from "@/components/responsive-table";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MultiSelect } from "@/components/ui/multi-select";
import * as XLSX from "xlsx";
import {
  customerNumberForList,
  engineAssemblyDateForList,
  workerWhoBuiltMotorLabel,
} from "@/lib/domain/claimDisplay";

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  customerNumber: string | null;
  customerReference?: string | null;
  invoiceNumber?: string | null;
  status: string;
  createdAt: string;
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
  assignedTo: {
    id: string;
    fullName: string;
  } | null;
  assignedWorkerName: string | null;
  engineType: string | null;
  mrEngineCode: string | null;
  workerFault: string | null;
  yearEngineDone: number | null;
  dateEngineDone: string | null;
  claimArrivalDate: string | null;
  reason: string | null;
  isDomesticMarket: boolean;
  workOrder?: {
    id: string;
    assemblyDate: string | null;
    worker: { id: string; fullName: string | null } | null;
  } | null;
}

interface Filters {
  status: string[];
  customerNames: string[];
  customerCompanies: string[];
  faultDepartmentId: string[];
  yearEngineDone: string;
  isDomesticMarket: string;
  engineType: string;
  dateFrom: string;
  dateTo: string;
}

export default function StatisticsPage() {
  const router = useRouter();
  const t = useTranslations();
  const [filters, setFilters] = useState<Filters>({
    status: [],
    customerNames: [],
    customerCompanies: [],
    faultDepartmentId: [],
    yearEngineDone: "",
    isDomesticMarket: "",
    engineType: "",
    dateFrom: "",
    dateTo: "",
  });
  const [showFilters, setShowFilters] = useState(true);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch departments for filter
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/departments");
      if (!res.ok) return { departments: [] };
      return res.json();
    },
  });

  // Fetch customers for filter
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) return { customers: [] };
      return res.json();
    },
  });

  // Get unique customer names and companies for multi-select filters
  const uniqueCustomerNames = useMemo(() => {
    const customers = customersData?.customers || [];
    const names = new Set<string>();
    customers.forEach((c: any) => {
      if (c.name && c.name.trim()) names.add(c.name.trim());
    });
    return Array.from(names).sort().map(name => ({ value: name, label: name }));
  }, [customersData]);

  const uniqueCustomerCompanies = useMemo(() => {
    const customers = customersData?.customers || [];
    const companies = new Set<string>();
    customers.forEach((c: any) => {
      if (c.company && c.company.trim()) companies.add(c.company.trim());
    });
    return Array.from(companies).sort().map(company => ({ value: company, label: company }));
  }, [customersData]);

  // Fetch statistics with filters
  const { data: statisticsData, isLoading } = useQuery({
    queryKey: ["statistics", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      filters.status.forEach(s => params.append("status", s));
      filters.customerNames.forEach(n => params.append("customerName", n));
      filters.customerCompanies.forEach(c => params.append("customerCompany", c));
      filters.faultDepartmentId.forEach(d => params.append("faultDepartmentId", d));
      if (filters.yearEngineDone) params.append("yearEngineDone", filters.yearEngineDone);
      if (filters.isDomesticMarket !== "") params.append("isDomesticMarket", filters.isDomesticMarket);
      if (filters.engineType) params.append("engineType", filters.engineType);
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);

      const res = await fetch(`/api/statistics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json();
    },
  });

  const claims: Claim[] = statisticsData?.claims || [];
  const totalCount = statisticsData?.totalCount || 0;

  // Sort claims
  const sortedClaims = useMemo(() => {
    const sorted = [...claims];
    sorted.sort((a, b) => {
      let aVal: any = a[sortField as keyof Claim];
      let bVal: any = b[sortField as keyof Claim];
      
      // Handle nested objects
      if (sortField === "customer") {
        aVal = a.customer?.name || "";
        bVal = b.customer?.name || "";
      } else if (sortField === "faultDepartment") {
        // Prefer faultDepartments (multiple) over faultDepartment (legacy single)
        aVal = a.faultDepartments && a.faultDepartments.length > 0
          ? a.faultDepartments.map((d) => d.name).join(", ")
          : a.faultDepartment?.name || "";
        bVal = b.faultDepartments && b.faultDepartments.length > 0
          ? b.faultDepartments.map((d) => d.name).join(", ")
          : b.faultDepartment?.name || "";
      } else if (sortField === "assignedTo") {
        aVal = workerWhoBuiltMotorLabel(a);
        bVal = workerWhoBuiltMotorLabel(b);
      } else if (sortField === "customerNumber") {
        aVal = customerNumberForList(a);
        bVal = customerNumberForList(b);
      } else if (sortField === "dateEngineDone") {
        const ad = a.dateEngineDone || a.workOrder?.assemblyDate;
        const bd = b.dateEngineDone || b.workOrder?.assemblyDate;
        aVal = ad ? new Date(ad as string).getTime() : 0;
        bVal = bd ? new Date(bd as string).getTime() : 0;
      }
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    return sorted;
  }, [claims, sortField, sortDirection]);

  // Pagination: reset to page 1 when filters or sort change
  const totalPages = Math.max(1, Math.ceil(sortedClaims.length / pageSize));
  const paginatedClaims = useMemo(
    () => sortedClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedClaims, currentPage, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortField, sortDirection]);

  // Clamp current page when result set shrinks
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages));
  }, [totalPages, currentPage]);

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  /** Excel .xlsx — pravi UTF-8 u ćelijama (CSV + Excel na Windows često kvare srpska slova). */
  const handleExport = useCallback(() => {
    const headers = [
      t("claims.mrNumber"),
      t("claims.customerNumber"),
      t("common.status"),
      t("statistics.customerName"),
      t("statistics.customerCompany"),
      t("claims.engineType"),
      t("claims.engineCode"),
      t("claims.metadata.faultDepartment"),
      t("claims.metadata.workerFault"),
      t("claims.dateEngineDone"),
      t("claims.claimArrivalDate"),
      t("claims.metadata.assignedWorker"),
      t("claims.metadata.reason"),
      t("claims.metadata.domesticMarket"),
      t("claims.createdAt"),
    ];

    const rows = sortedClaims.map((claim) => {
      const faultDeptStr =
        claim.faultDepartments && claim.faultDepartments.length > 0
          ? claim.faultDepartments.map((d) => d.name).join(", ")
          : claim.faultDepartment?.name || "";
      const engineDateLabel = engineAssemblyDateForList(claim);
      return [
        claim.claimCodeRaw || "",
        customerNumberForList(claim),
        t(`claims.status.${claim.status}` as never) || claim.status,
        claim.customer?.name || "",
        claim.customer?.company || "",
        claim.engineType || "",
        claim.mrEngineCode || "",
        faultDeptStr,
        claim.workerFault || "",
        engineDateLabel === "–" ? "" : engineDateLabel,
        claim.claimArrivalDate ? new Date(claim.claimArrivalDate).toLocaleDateString() : "",
        workerWhoBuiltMotorLabel(claim),
        claim.reason || "",
        claim.isDomesticMarket ? t("common.yes") : t("common.no"),
        new Date(claim.createdAt).toLocaleDateString(),
      ];
    });

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statistika");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `statistika_${dateStr}.xlsx`);
  }, [sortedClaims, t]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: [],
      customerNames: [],
      customerCompanies: [],
      faultDepartmentId: [],
      yearEngineDone: "",
      isDomesticMarket: "",
      engineType: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status.length > 0 ||
      filters.customerNames.length > 0 ||
      filters.customerCompanies.length > 0 ||
      filters.faultDepartmentId.length > 0 ||
      filters.yearEngineDone !== "" ||
      filters.isDomesticMarket !== "" ||
      filters.engineType !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== ""
    );
  }, [filters]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{t("statistics.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">{t("statistics.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 flex-1 sm:flex-initial"
          >
            <Filter className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{showFilters ? t("statistics.hideFilters") : t("statistics.showFilters")}</span>
            <span className="sm:hidden">{t("statistics.filters")}</span>
          </Button>
          <Button
            onClick={handleExport}
            className="flex items-center gap-2 flex-1 sm:flex-initial"
            disabled={sortedClaims.length === 0}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("statistics.exportExcel")}</span>
            <span className="sm:hidden">{t("statistics.export")}</span>
          </Button>
        </div>
      </div>

      {/* Statistics Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t("statistics.totalClaims")}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-1">{totalCount}</p>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t("statistics.matchesFilters", { count: totalCount })}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                {t("statistics.clearFilters")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("statistics.filters")}</h2>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t("statistics.clearFilters")}
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <Label>{t("common.status")}</Label>
                <Select
                  value={filters.status.length > 0 ? filters.status.join(",") : "all"}
                  onValueChange={(value) => {
                    setFilters(prev => ({
                      ...prev,
                      status: value === "all" ? [] : value.split(","),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("statistics.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("statistics.allStatuses")}</SelectItem>
                    <SelectItem value="NEW">{t("claims.status.NEW")}</SelectItem>
                    <SelectItem value="IN_ANALYSIS">{t("claims.status.IN_ANALYSIS")}</SelectItem>
                    <SelectItem value="APPROVED">{t("claims.status.APPROVED")}</SelectItem>
                    <SelectItem value="REJECTED">{t("claims.status.REJECTED")}</SelectItem>
                    <SelectItem value="CLOSED">{t("claims.status.CLOSED")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Name - Multi-select */}
              <div>
                <Label>{t("statistics.customerName")}</Label>
                <MultiSelect
                  options={uniqueCustomerNames}
                  selected={filters.customerNames}
                  onChange={(selected) => setFilters(prev => ({ ...prev, customerNames: selected }))}
                  placeholder={t("statistics.selectCustomers")}
                />
              </div>

              {/* Customer Company - Multi-select */}
              <div>
                <Label>{t("statistics.customerCompany")}</Label>
                <MultiSelect
                  options={uniqueCustomerCompanies}
                  selected={filters.customerCompanies}
                  onChange={(selected) => setFilters(prev => ({ ...prev, customerCompanies: selected }))}
                  placeholder={t("statistics.selectCompanies")}
                />
              </div>

              {/* Fault Department - Multi-select */}
              <div>
                <Label>{t("claims.metadata.faultDepartment")}</Label>
                <MultiSelect
                  options={departmentsData?.departments?.map((dept: any) => ({
                    value: dept.id,
                    label: dept.name,
                  })) || []}
                  selected={filters.faultDepartmentId}
                  onChange={(selected) => {
                    setFilters(prev => ({
                      ...prev,
                      faultDepartmentId: selected,
                    }));
                  }}
                  placeholder={t("statistics.allDepartments")}
                />
              </div>

              {/* Year Engine Done */}
              <div>
                <Label>{t("claims.metadata.yearEngineDone")}</Label>
                <Input
                  type="number"
                  value={filters.yearEngineDone}
                  onChange={(e) => setFilters(prev => ({ ...prev, yearEngineDone: e.target.value }))}
                  placeholder={t("statistics.filterByYear")}
                  min="1900"
                  max="2100"
                />
              </div>

              {/* Engine Type */}
              <div>
                <Label>{t("claims.engineType")}</Label>
                <Input
                  value={filters.engineType}
                  onChange={(e) => setFilters(prev => ({ ...prev, engineType: e.target.value }))}
                  placeholder={t("statistics.filterByEngineType")}
                />
              </div>

              {/* Domestic Market */}
              <div>
                <Label>{t("statistics.market")}</Label>
                <Select
                  value={filters.isDomesticMarket || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, isDomesticMarket: value === "all" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("statistics.allMarkets")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("statistics.allMarkets")}</SelectItem>
                    <SelectItem value="true">{t("statistics.domestic")}</SelectItem>
                    <SelectItem value="false">{t("statistics.international")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <Label>{t("statistics.dateFrom")}</Label>
                <DatePicker
                  date={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={(date) => setFilters(prev => ({ 
                    ...prev, 
                    dateFrom: date ? format(date, "yyyy-MM-dd") : "" 
                  }))}
                  placeholder={t("statistics.selectStartDate")}
                />
              </div>

              {/* Date To */}
              <div>
                <Label>{t("statistics.dateTo")}</Label>
                <DatePicker
                  date={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={(date) => setFilters(prev => ({ 
                    ...prev, 
                    dateTo: date ? format(date, "yyyy-MM-dd") : "" 
                  }))}
                  placeholder={t("statistics.selectEndDate")}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedClaims.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("statistics.noClaimsFound")}</p>
          </div>
        ) : (
          <ResponsiveTable
            headers={[
              { key: "mrNumber", label: t("claims.mrNumber") },
              { key: "customerNumber", label: t("claims.customerNumber") },
              { key: "status", label: t("common.status") },
              { key: "customer", label: t("claims.customer") },
              { key: "company", label: t("claims.company") },
              { key: "engineType", label: t("claims.engineType") },
              { key: "engineCode", label: t("claims.engineCode") },
              { key: "faultDept", label: t("claims.metadata.faultDepartment") },
              { key: "dateEngineDone", label: t("claims.dateEngineDone") },
              { key: "claimArrivalDate", label: t("claims.claimArrivalDate") },
              { key: "assignedTo", label: t("claims.metadata.assignedWorker") },
              { key: "market", label: t("statistics.market") },
              { key: "created", label: t("claims.createdAt") },
              { key: "reason", label: "" },
            ]}
            data={paginatedClaims.map((claim) => ({
              mrNumber: (
                <span className="font-medium">{claim.claimCodeRaw || "-"}</span>
              ),
              customerNumber: (
                <span className="font-medium">{customerNumberForList(claim) || "-"}</span>
              ),
              status: <Badge variant="outline">{t(`claims.status.${claim.status}` as any) || claim.status}</Badge>,
              customer: claim.customer?.name || "-",
              company: claim.customer?.company || "-",
              engineType: claim.engineType || "-",
              engineCode: claim.mrEngineCode || "-",
              faultDept: claim.faultDepartments && claim.faultDepartments.length > 0
                ? claim.faultDepartments.map((d) => d.name).join(", ")
                : claim.faultDepartment?.name || "-",
              dateEngineDone: engineAssemblyDateForList(claim),
              claimArrivalDate: claim.claimArrivalDate ? new Date(claim.claimArrivalDate).toLocaleDateString() : "-",
              assignedTo: workerWhoBuiltMotorLabel(claim) || "-",
              market: claim.isDomesticMarket ? (
                <Badge variant="secondary">{t("statistics.domestic")}</Badge>
              ) : (
                <Badge variant="outline">{t("statistics.international")}</Badge>
              ),
              created: new Date(claim.createdAt).toLocaleDateString(),
              reason: claim.reason ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p className="font-semibold mb-1">{t("claims.metadata.reason")}:</p>
                      <p>{claim.reason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : "-",
            }))}
            emptyMessage={
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t("statistics.noClaimsFound")}</p>
              </div>
            }
            onRowClick={(row, index) => {
              const claim = paginatedClaims[index];
              if (claim) {
                router.push(`/claims/${claim.id}`);
              }
            }}
          />
        )}
      </Card>

      {/* Pagination - same UX as claims */}
      {!isLoading && sortedClaims.length > 0 && totalPages >= 1 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {t("claims.pagination.showing")}{" "}
              <span className="font-medium">
                {sortedClaims.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>
              {" - "}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, sortedClaims.length)}
              </span>{" "}
              {t("claims.pagination.of")}{" "}
              <span className="font-medium">{sortedClaims.length}</span>{" "}
              {t("claims.pagination.claims")}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("claims.pagination.perPage")}:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
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
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm">
                    {t("claims.pagination.page")}{" "}
                    <span className="font-medium">{currentPage}</span>{" "}
                    {t("claims.pagination.of")}{" "}
                    <span className="font-medium">{totalPages}</span>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
