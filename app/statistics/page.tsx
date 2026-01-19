"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  Download, 
  Filter, 
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Claim {
  id: string;
  claimCodeRaw: string | null;
  status: string;
  claimAcceptanceStatus: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    company: string | null;
  } | null;
  faultDepartment: {
    id: string;
    name: string;
  } | null;
  assignedTo: {
    id: string;
    fullName: string;
  } | null;
  engineType: string | null;
  mrEngineCode: string | null;
  workerFault: string | null;
  yearEngineDone: number | null;
  reason: string | null;
  isDomesticMarket: boolean;
}

interface Filters {
  status: string[];
  customerId: string;
  customerCompany: string;
  faultDepartmentId: string[];
  yearEngineDone: string;
  isDomesticMarket: string;
  engineType: string;
  dateFrom: string;
  dateTo: string;
}

export default function StatisticsPage() {
  const [filters, setFilters] = useState<Filters>({
    status: [],
    customerId: "",
    customerCompany: "",
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

  // Fetch statistics with filters
  const { data: statisticsData, isLoading } = useQuery({
    queryKey: ["statistics", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      filters.status.forEach(s => params.append("status", s));
      if (filters.customerId) params.append("customerId", filters.customerId);
      if (filters.customerCompany) params.append("customerCompany", filters.customerCompany);
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
        aVal = a.faultDepartment?.name || "";
        bVal = b.faultDepartment?.name || "";
      } else if (sortField === "assignedTo") {
        aVal = a.assignedTo?.fullName || "";
        bVal = b.assignedTo?.fullName || "";
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

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = [
      "Claim Code",
      "Status",
      "Customer Name",
      "Customer Company",
      "Engine Type",
      "Engine Code",
      "Fault Department",
      "Worker Fault",
      "Year Engine Done",
      "Assigned To",
      "Reason",
      "Domestic Market",
      "Created At",
    ];

    const rows = sortedClaims.map(claim => [
      claim.claimCodeRaw || "",
      claim.status,
      claim.customer?.name || "",
      claim.customer?.company || "",
      claim.engineType || "",
      claim.mrEngineCode || "",
      claim.faultDepartment?.name || "",
      claim.workerFault || "",
      claim.yearEngineDone?.toString() || "",
      claim.assignedTo?.fullName || "",
      claim.reason || "",
      claim.isDomesticMarket ? "Yes" : "No",
      new Date(claim.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `statistics_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [sortedClaims]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: [],
      customerId: "",
      customerCompany: "",
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
      filters.customerId !== "" ||
      filters.customerCompany !== "" ||
      filters.faultDepartmentId.length > 0 ||
      filters.yearEngineDone !== "" ||
      filters.isDomesticMarket !== "" ||
      filters.engineType !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== ""
    );
  }, [filters]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Statistics</h1>
            <p className="text-muted-foreground">Claim metadata statistics and analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button
            onClick={handleExport}
            className="flex items-center gap-2"
            disabled={sortedClaims.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Claims</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-1">{totalCount}</p>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {totalCount} claim{totalCount !== 1 ? "s" : ""} match filter{totalCount !== 1 ? "s" : ""}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
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
              <h2 className="text-lg font-semibold">Filters</h2>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear All
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <Label>Status</Label>
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
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="IN_ANALYSIS">In Analysis</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Name */}
              <div>
                <Label>Customer Name</Label>
                <Input
                  value={filters.customerId}
                  onChange={(e) => setFilters(prev => ({ ...prev, customerId: e.target.value }))}
                  placeholder="Filter by customer name"
                />
              </div>

              {/* Customer Company */}
              <div>
                <Label>Customer Company</Label>
                <Input
                  value={filters.customerCompany}
                  onChange={(e) => setFilters(prev => ({ ...prev, customerCompany: e.target.value }))}
                  placeholder="Filter by company"
                />
              </div>

              {/* Fault Department */}
              <div>
                <Label>Fault Department</Label>
                <Select
                  value={filters.faultDepartmentId.length > 0 ? filters.faultDepartmentId.join(",") : "all"}
                  onValueChange={(value) => {
                    setFilters(prev => ({
                      ...prev,
                      faultDepartmentId: value === "all" ? [] : value.split(","),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departmentsData?.departments?.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Engine Done */}
              <div>
                <Label>Year Engine Done</Label>
                <Input
                  type="number"
                  value={filters.yearEngineDone}
                  onChange={(e) => setFilters(prev => ({ ...prev, yearEngineDone: e.target.value }))}
                  placeholder="Filter by year"
                  min="1900"
                  max="2100"
                />
              </div>

              {/* Engine Type */}
              <div>
                <Label>Engine Type</Label>
                <Input
                  value={filters.engineType}
                  onChange={(e) => setFilters(prev => ({ ...prev, engineType: e.target.value }))}
                  placeholder="Filter by engine type"
                />
              </div>

              {/* Domestic Market */}
              <div>
                <Label>Market</Label>
                <Select
                  value={filters.isDomesticMarket || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, isDomesticMarket: value === "all" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All markets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All markets</SelectItem>
                    <SelectItem value="true">Domestic</SelectItem>
                    <SelectItem value="false">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>

              {/* Date To */}
              <div>
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
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
            <p className="text-muted-foreground">No claims found matching the filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("claimCodeRaw")}
                  >
                    Claim Code {sortField === "claimCodeRaw" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("customer")}
                  >
                    Customer {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("customer")}
                  >
                    Company {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("engineType")}
                  >
                    Engine Type {sortField === "engineType" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("mrEngineCode")}
                  >
                    Engine Code {sortField === "mrEngineCode" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("faultDepartment")}
                  >
                    Fault Dept {sortField === "faultDepartment" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("yearEngineDone")}
                  >
                    Year {sortField === "yearEngineDone" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("assignedTo")}
                  >
                    Assigned To {sortField === "assignedTo" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("isDomesticMarket")}
                  >
                    Market {sortField === "isDomesticMarket" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("createdAt")}
                  >
                    Created {sortField === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      {claim.claimCodeRaw || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{claim.status}</Badge>
                    </TableCell>
                    <TableCell>{claim.customer?.name || "-"}</TableCell>
                    <TableCell>{claim.customer?.company || "-"}</TableCell>
                    <TableCell>{claim.engineType || "-"}</TableCell>
                    <TableCell>{claim.mrEngineCode || "-"}</TableCell>
                    <TableCell>{claim.faultDepartment?.name || "-"}</TableCell>
                    <TableCell>{claim.yearEngineDone || "-"}</TableCell>
                    <TableCell>{claim.assignedTo?.fullName || "-"}</TableCell>
                    <TableCell>
                      {claim.isDomesticMarket ? (
                        <Badge variant="secondary">Domestic</Badge>
                      ) : (
                        <Badge variant="outline">International</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
