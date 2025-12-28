"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Mail,
  ArrowRight,
  Users,
  Activity
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamically import recharts to avoid SSR issues
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
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
  unreadEmailsCount?: number;
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
  claimsByMonth?: Array<{
    month: string;
    accepted: number;
    rejected: number;
  }>;
  recentClaims?: Array<{
    id: string;
    claimCodeRaw: string | null;
    status: string;
    customer: { name: string } | null;
    createdAt: string;
  }>;
  urgentClaims?: Array<{
    id: string;
    claimCodeRaw: string | null;
    status: string;
    customer: { name: string } | null;
    createdAt: string;
  }>;
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    NEW: "NOVO",
    IN_ANALYSIS: "U OBRADI",
    CLOSED: "ZATVORENO",
    APPROVED: "ODOBRENO",
    REJECTED: "ODBIJENO",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    NEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    IN_ANALYSIS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    CLOSED: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
    APPROVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return colors[status] || "bg-muted text-muted-foreground";
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    
    // Listen for claim updates
    const handleClaimUpdate = () => fetchStats();
    window.addEventListener('claim-updated', handleClaimUpdate);
    window.addEventListener('claim-created', handleClaimUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('claim-updated', handleClaimUpdate);
      window.removeEventListener('claim-created', handleClaimUpdate);
    };
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" text="Učitavanje statistika..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <Card className="p-6">
          <p className="text-destructive">Neuspešno učitavanje statistika</p>
          <Button onClick={fetchStats} className="mt-4" variant="outline">
            Pokušaj ponovo
          </Button>
        </Card>
      </div>
    );
  }

  const resolutionRate = stats.totalClaims > 0 
    ? Math.round((stats.resolvedCount / stats.totalClaims) * 100) 
    : 0;
  const approvalRate = stats.totalClaims > 0 
    ? Math.round((stats.approvedCount / stats.totalClaims) * 100) 
    : 0;

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Pregled statistika reklamacija</p>
        </div>
        <Button 
          onClick={fetchStats} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <Activity className="h-4 w-4 mr-2" />
          Osveži
        </Button>
      </div>

      {/* Unread Emails Alert - moved to top */}
      {stats.unreadEmailsCount !== undefined && stats.unreadEmailsCount > 0 && (
        <Card className="p-6 bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold">Nepročitane poruke</p>
                <p className="text-sm text-muted-foreground">
                  Imate <span className="font-bold text-blue-600 dark:text-blue-400">{stats.unreadEmailsCount}</span> nepročitanih email poruka
                </p>
              </div>
            </div>
            <Button 
              variant="default"
              onClick={() => router.push("/inbox")}
            >
              Otvori inbox
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6 bg-gradient-to-br from-background to-muted/50 transition-all hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Ukupno reklamacija</p>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-4xl font-bold">
            <AnimatedCounter value={stats.totalClaims} />
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20 transition-all hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Rešene</p>
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">
            <AnimatedCounter value={stats.resolvedCount} />
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20 transition-all hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Prihvaćene</p>
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
            <AnimatedCounter value={stats.approvedCount} />
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20 transition-all hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Odbijene</p>
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-4xl font-bold text-red-600 dark:text-red-400">
            <AnimatedCounter value={stats.rejectedCount} />
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20 transition-all hover:shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">U procesu</p>
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
            <AnimatedCounter value={stats.inProcessCount} />
          </p>
        </Card>
      </div>

      {/* Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Stopa rešavanja</h3>
            </div>
            <span className="text-2xl font-bold">{resolutionRate}%</span>
          </div>
          <Progress value={resolutionRate} className="h-2" />
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Stopa prihvatanja</h3>
            </div>
            <span className="text-2xl font-bold">{approvalRate}%</span>
          </div>
          <Progress value={approvalRate} className="h-2" />
        </Card>
      </div>

      {/* Recent & Urgent Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Claims */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Najnovije reklamacije
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push("/claims")}
            >
              Vidi sve
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          {stats.recentClaims && stats.recentClaims.length > 0 ? (
            <div className="space-y-3">
              {stats.recentClaims.slice(0, 5).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => router.push(`/claims/${claim.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {claim.claimCodeRaw || "Bez koda"}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getStatusColor(claim.status))}
                      >
                        {getStatusLabel(claim.status)}
                      </Badge>
                    </div>
                    {claim.customer && (
                      <p className="text-sm text-muted-foreground truncate">
                        {claim.customer.name}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nema nedavnih reklamacija</p>
          )}
        </Card>

        {/* Urgent Claims */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Hitne reklamacije
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push("/claims")}
            >
              Vidi sve
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          {stats.urgentClaims && stats.urgentClaims.length > 0 ? (
            <div className="space-y-3">
              {stats.urgentClaims.slice(0, 5).map((claim) => {
                const daysAgo = Math.floor(
                  (new Date().getTime() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    onClick={() => router.push(`/claims/${claim.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {claim.claimCodeRaw || "Bez koda"}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getStatusColor(claim.status))}
                        >
                          {getStatusLabel(claim.status)}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        >
                          {daysAgo} {daysAgo === 1 ? 'dan' : 'dana'}
                        </Badge>
                      </div>
                      {claim.customer && (
                        <p className="text-sm text-muted-foreground truncate">
                          {claim.customer.name}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 ml-2 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nema hitnih reklamacija</p>
          )}
        </Card>
      </div>

      {/* Claims by Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Reklamacije po statusu
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.claimsByStatus.map((item) => {
            const percentage = stats.totalClaims > 0 
              ? Math.round((item.count / stats.totalClaims) * 100) 
              : 0;
            return (
              <div 
                key={item.status} 
                className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {getStatusLabel(item.status)}
                </p>
                <p className="text-3xl font-bold mb-2">
                  <AnimatedCounter value={item.count} />
                </p>
                <Progress value={percentage} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{percentage}%</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Claims by Customer */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Reklamacije po klijentu
        </h2>
        {stats.claimsByCustomer.length > 0 ? (
          <div className="space-y-2">
            {stats.claimsByCustomer.map((item) => {
              const percentage = stats.totalClaims > 0 
                ? Math.round((item.count / stats.totalClaims) * 100) 
                : 0;
              return (
                <div 
                  key={item.customerId || "unknown"} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="font-medium flex-1">{item.customerName}</span>
                  <div className="flex items-center gap-3 flex-1 max-w-xs">
                    <Progress value={percentage} className="h-2 flex-1" />
                    <span className="text-lg font-bold min-w-[60px] text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nema podataka o reklamacijama po klijentu</p>
        )}
      </Card>

      {/* Claims Trend Chart - Prihvaćene i Odbijene tokom godine */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trend reklamacija tokom godine
        </h2>
        {stats.claimsByMonth && stats.claimsByMonth.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.claimsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="accepted" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Prihvaćene"
                  dot={{ r: 4, fill: "#22c55e" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rejected" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Odbijene"
                  dot={{ r: 4, fill: "#ef4444" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nema podataka za grafikon</p>
        )}
      </Card>
    </div>
  );
}
