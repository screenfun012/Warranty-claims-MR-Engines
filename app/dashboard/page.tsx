"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";

// Dynamically import recharts to avoid SSR issues
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((mod) => mod.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((mod) => mod.Legend),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

interface DashboardStats {
  totalClaims: number;
  resolvedCount: number;
  approvedCount: number;
  rejectedCount: number;
  inProcessCount: number;
  claimsByCustomer: Array<{
    customerId: string | null;
    customerName: string;
    count: number;
  }>;
  claimsByStatus: Array<{
    status: string;
    count: number;
  }>;
  claimsByAcceptanceStatus?: Array<{
    acceptanceStatus: string;
    count: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 10 seconds for real-time updates
    const interval = setInterval(fetchStats, 10000);
    
    // Listen for claim updates from other pages
    const handleClaimUpdate = () => {
      fetchStats(false); // Don't show loading for automatic refreshes
    };
    window.addEventListener('claim-updated', handleClaimUpdate);
    window.addEventListener('claim-created', handleClaimUpdate);
    window.addEventListener('claim-deleted', handleClaimUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('claim-updated', handleClaimUpdate);
      window.removeEventListener('claim-created', handleClaimUpdate);
      window.removeEventListener('claim-deleted', handleClaimUpdate);
    };
  }, []);

  const fetchStats = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Error fetching stats:", res.status, errorData);
        setStats(null);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <Card className="p-6">
          <p className="text-destructive">Failed to load statistics</p>
          <Button 
            onClick={() => fetchStats(true)} 
            className="mt-4"
            variant="outline"
            disabled={loading}
          >
            {loading ? "Osvežavanje..." : "Pokušaj ponovo"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard - Statistike reklamacija</h1>
        <Button 
          onClick={() => fetchStats(true)} 
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
        >
          <TrendingUp className="h-4 w-4" />
          {loading ? "Osvežavanje..." : "Osveži"}
        </Button>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex flex-col h-full">
            <div className="h-10 mb-4">
              <p className="text-sm font-medium text-muted-foreground">Ukupno reklamacija</p>
            </div>
            <div className="flex items-end justify-between flex-1">
              <p className="text-3xl font-bold">{stats.totalClaims}</p>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col h-full">
            <div className="h-10 mb-4">
              <p className="text-sm font-medium text-muted-foreground">Rešene reklamacije</p>
            </div>
            <div className="flex items-end justify-between flex-1">
              <p className="text-3xl font-bold">{stats.resolvedCount}</p>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col h-full">
            <div className="h-10 mb-4">
              <p className="text-sm font-medium text-muted-foreground">Prihvaćene reklamacije</p>
            </div>
            <div className="flex items-end justify-between flex-1">
              <p className="text-3xl font-bold">{stats.approvedCount}</p>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col h-full">
            <div className="h-10 mb-4">
              <p className="text-sm font-medium text-muted-foreground">Odbijene reklamacije</p>
            </div>
            <div className="flex items-end justify-between flex-1">
              <p className="text-3xl font-bold">{stats.rejectedCount}</p>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col h-full">
            <div className="h-10 mb-4">
              <p className="text-sm font-medium text-muted-foreground">U procesu</p>
            </div>
            <div className="flex items-end justify-between flex-1">
              <p className="text-3xl font-bold">{stats.inProcessCount}</p>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Claims by Customer */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Reklamacije po klijentu
        </h2>
        {stats.claimsByCustomer.length > 0 ? (
          <div className="space-y-2">
            {stats.claimsByCustomer.map((item) => (
              <div key={item.customerId || "unknown"} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">{item.customerName}</span>
                <span className="text-lg font-bold">{item.count} reklamacija</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Nema podataka o reklamacijama po klijentu</p>
        )}
      </Card>

      {/* Claims by Status Chart */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Reklamacije po statusu</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.claimsByStatus.map((item) => ({
              status: item.status === "NEW" ? "NOVO" : 
                      item.status === "IN_ANALYSIS" ? "U OBRADI" :
                      item.status === "CLOSED" ? "ZATVORENO" :
                      item.status === "APPROVED" ? "ODOBRENO" :
                      item.status === "REJECTED" ? "ODBIJENO" : item.status,
              count: item.count,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="status" 
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Claims by Status Grid */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Detalji po statusu</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.claimsByStatus.map((item) => (
            <div key={item.status} className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">
                {item.status === "NEW" ? "NOVO" : 
                 item.status === "IN_ANALYSIS" ? "U OBRADI" :
                 item.status === "CLOSED" ? "GOTOVO" :
                 item.status === "APPROVED" ? "ODOBRENO" :
                 item.status === "REJECTED" ? "ODBIJENO" : item.status}
              </p>
              <p className="text-2xl font-bold mt-2">{item.count}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Claims by Acceptance Status */}
      {stats.claimsByAcceptanceStatus && stats.claimsByAcceptanceStatus.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Ishod reklamacija (Prihvaćeno/Odbijeno)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.claimsByAcceptanceStatus.map((item) => (
              <div 
                key={item.acceptanceStatus} 
                className={`p-4 rounded-lg border-2 ${
                  item.acceptanceStatus === "ACCEPTED" 
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                    : item.acceptanceStatus === "REJECTED"
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    : "bg-muted border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.acceptanceStatus === "ACCEPTED" ? (
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : item.acceptanceStatus === "REJECTED" ? (
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    ) : null}
                    <p className="text-lg font-semibold">
                      {item.acceptanceStatus === "ACCEPTED" ? "Prihvaćeno" : 
                       item.acceptanceStatus === "REJECTED" ? "Odbijeno" : 
                       item.acceptanceStatus}
                    </p>
                  </div>
                  <p className="text-3xl font-bold">{item.count}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

