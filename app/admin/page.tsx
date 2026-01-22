"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Shield, 
  Activity, 
  Mail, 
  Database, 
  Settings,
  FileText,
  ArrowRight,
  Server,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Building2,
  FolderOpen,
  Layers,
  RefreshCw,
  ExternalLink,
  Circle
} from "lucide-react";
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  pendingApproval: number;
  totalClaims: number;
  claimsByStatus: {
    NEW: number;
    IN_ANALYSIS: number;
    APPROVED: number;
    REJECTED: number;
  };
  unreadEmails: number;
  totalEmails: number;
  totalCustomers: number;
  totalAttachments: number;
  totalDepartments: number;
  recentActivity: {
    id: string;
    code: string | null;
    status: string;
    customer: string;
    assignedTo: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  emailConfigured: boolean;
  databaseStatus: string;
}

// Custom function for Latin Serbian time formatting
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return "upravo sada";
  if (diffMin === 1) return "pre 1 minut";
  if (diffMin < 5) return `pre ${diffMin} minuta`;
  if (diffMin < 60) return `pre ${diffMin} minuta`;
  if (diffHour === 1) return "pre 1 sat";
  if (diffHour < 5) return `pre ${diffHour} sata`;
  if (diffHour < 24) return `pre ${diffHour} sati`;
  if (diffDay === 1) return "pre 1 dan";
  if (diffDay < 5) return `pre ${diffDay} dana`;
  if (diffDay < 7) return `pre ${diffDay} dana`;
  if (diffWeek === 1) return "pre 1 nedelju";
  if (diffWeek < 5) return `pre ${diffWeek} nedelje`;
  if (diffMonth === 1) return "pre 1 mesec";
  if (diffMonth < 12) return `pre ${diffMonth} meseci`;
  return `pre više od godinu dana`;
}

interface Auth0User {
  'https://mr-engines-warranty/roles'?: string[] | string;
  app_metadata?: {
    roles?: string[] | string;
  };
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-500",
  IN_ANALYSIS: "bg-amber-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  NEW: "Novo",
  IN_ANALYSIS: "U Obradi",
  APPROVED: "Prihvaćeno",
  REJECTED: "Odbijeno",
};

export default function AdminDashboardPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  const auth0User = user as Auth0User | undefined;
  const userRoles = auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const isSuperAdmin = Array.isArray(userRoles) ? userRoles.includes('SUPER_ADMIN') : userRoles === 'SUPER_ADMIN';

  useEffect(() => {
    if (isLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    if (!isSuperAdmin) {
      router.push("/");
      return;
    }
    
    fetchStats();
  }, [isLoading, user, isSuperAdmin, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full mb-2" />
            ))}
          </Card>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const adminSections = [
    {
      title: "Upravljanje korisnicima",
      description: "Upravljaj korisnicima, ulogama i dozvolama",
      icon: Users,
      href: "/admin/users",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
      badge: stats?.pendingApproval ? `${stats.pendingApproval} čeka` : undefined,
    },
    {
      title: "Radnici i Firme",
      description: "Upravljaj listama radnika i firmi za padajuće menije",
      icon: Database,
      href: "/admin/lists",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/10 border-orange-500/20",
    },
    {
      title: "Email postavke",
      description: "Pregled i upravljanje email sinhronizacijom",
      icon: Mail,
      href: "/settings",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10 border-green-500/20",
    },
    {
      title: "Sistemske postavke",
      description: "Konfiguracija sistema i okruženja",
      icon: Settings,
      href: "/settings",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-10 h-10 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Upravljanje sistemom i korisnicima
          </p>
        </div>
        <Button variant="outline" onClick={fetchStats} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Osveži
        </Button>
      </div>

      {/* Main Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Korisnici</p>
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalUsers}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.activeUsers} aktivnih
              {stats.pendingApproval > 0 && (
                <span className="text-amber-500 ml-2">• {stats.pendingApproval} čeka odobrenje</span>
              )}
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Reklamacije</p>
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {stats.totalClaims}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.claimsByStatus.IN_ANALYSIS} u obradi
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Email poruke</p>
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
              {stats.unreadEmails}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              nepročitanih od {stats.totalEmails} ukupno
            </p>
          </Card>

          <Card className={`p-6 ${stats.emailConfigured ? 'bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20' : 'bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Sistem</p>
              {stats.emailConfigured ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <Badge variant={stats.emailConfigured ? "default" : "destructive"} className="text-sm">
              {stats.emailConfigured ? "Sve funkcioniše" : "Email nije konfigurisan"}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Baza: {stats.databaseStatus}
            </p>
          </Card>
        </div>
      )}

      {/* Middle Section - Activity & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Poslednja aktivnost
            </h2>
            <Link href="/claims">
              <Button variant="ghost" size="sm" className="gap-1">
                Sve reklamacije
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 6).map((activity) => (
                <Link key={activity.id} href={`/claims/${activity.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${statusColors[activity.status] || 'bg-gray-500'}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {activity.code || "Nova reklamacija"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {activity.customer}
                        </p>
                        {activity.assignedTo && (
                          <p className="text-xs text-blue-500 truncate">
                            Zadužen: {activity.assignedTo}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {statusLabels[activity.status] || activity.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(new Date(activity.createdAt))}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">Nema nedavne aktivnosti</p>
            )}
          </div>
        </Card>

        {/* Database Stats */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Statistika baze
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-500" />
                <span>Reklamacije</span>
              </div>
              <span className="font-bold">{stats?.totalClaims || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-500" />
                <span>Kupci</span>
              </div>
              <span className="font-bold">{stats?.totalCustomers || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-amber-500" />
                <span>Email poruke</span>
              </div>
              <span className="font-bold">{stats?.totalEmails || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-purple-500" />
                <span>Prilozi</span>
              </div>
              <span className="font-bold">{stats?.totalAttachments || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-orange-500" />
                <span>Odeljenja</span>
              </div>
              <span className="font-bold">{stats?.totalDepartments || 0}</span>
            </div>
          </div>

          {/* Claims by Status */}
          {stats?.claimsByStatus && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Reklamacije po statusu</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats.claimsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                    <Circle className={`h-3 w-3 fill-current ${
                      status === 'NEW' ? 'text-blue-500' :
                      status === 'IN_ANALYSIS' ? 'text-amber-500' :
                      status === 'APPROVED' ? 'text-green-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm">{statusLabels[status]}</span>
                    <span className="font-bold ml-auto">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Admin Sections */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Admin sekcije
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminSections.map((section) => (
            <Link key={section.href + section.title} href={section.href}>
              <Card className={`p-6 ${section.bgColor} hover:shadow-lg transition-all cursor-pointer group h-full`}>
                <div className="flex items-start justify-between mb-4">
                  <section.icon className={`h-8 w-8 ${section.color} group-hover:scale-110 transition-transform`} />
                  <div className="flex items-center gap-2">
                    {section.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {section.badge}
                      </Badge>
                    )}
                    <ArrowRight className={`h-5 w-5 ${section.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* System Health */}
      {stats && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="h-6 w-6" />
            Status sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Baza podataka</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                {stats.databaseStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Email</span>
              </div>
              {stats.emailConfigured ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Nije konfigurisano
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">API</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
