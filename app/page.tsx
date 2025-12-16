"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { FileText, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";

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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
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
        <p>Failed to load statistics</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard - Statistike reklamacija</h1>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ukupno reklamacija</p>
              <p className="text-3xl font-bold mt-2">{stats.totalClaims}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rešene reklamacije</p>
              <p className="text-3xl font-bold mt-2">{stats.resolvedCount}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Prihvaćene reklamacije</p>
              <p className="text-3xl font-bold mt-2">{stats.approvedCount}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Odbijene reklamacije</p>
              <p className="text-3xl font-bold mt-2">{stats.rejectedCount}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">U procesu</p>
              <p className="text-3xl font-bold mt-2">{stats.inProcessCount}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
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

      {/* Claims by Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Reklamacije po statusu</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.claimsByStatus.map((item) => (
            <div key={item.status} className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">{item.status}</p>
              <p className="text-2xl font-bold mt-2">{item.count}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
