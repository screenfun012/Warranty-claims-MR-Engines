"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Building2,
  FolderOpen,
  Layers,
  RefreshCw,
  ExternalLink,
  Circle,
  Plus,
  Trash2,
  Edit,
  Eye,
  Upload,
  LogIn,
  Lock,
  Unlock,
  User
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

interface ActivityLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
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

const actionIcons: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-4 w-4 text-green-500" />,
  UPDATE: <Edit className="h-4 w-4 text-blue-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  VIEW: <Eye className="h-4 w-4 text-gray-500" />,
  LOGIN: <LogIn className="h-4 w-4 text-emerald-500" />,
  UPLOAD: <Upload className="h-4 w-4 text-purple-500" />,
  LOCK: <Lock className="h-4 w-4 text-amber-500" />,
  UNLOCK: <Unlock className="h-4 w-4 text-amber-500" />,
};

export default function AdminDashboardPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const t = useTranslations();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogEntry | null>(null);

  const auth0User = user as Auth0User | undefined;
  const userRoles = auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const isSuperAdmin = Array.isArray(userRoles) ? userRoles.includes('SUPER_ADMIN') : userRoles === 'SUPER_ADMIN';

  // Time formatting with translations
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return t("time.justNow");
    if (diffMin === 1) return t("time.minuteAgo");
    if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
    if (diffHour === 1) return t("time.hourAgo");
    if (diffHour < 5) return t("time.hoursAgo2to4", { count: diffHour });
    if (diffHour < 24) return t("time.hoursAgo", { count: diffHour });
    if (diffDay === 1) return t("time.dayAgo");
    if (diffDay < 7) return t("time.daysAgo", { count: diffDay });
    if (diffWeek === 1) return t("time.weekAgo");
    if (diffWeek < 5) return t("time.weeksAgo", { count: diffWeek });
    if (diffMonth === 1) return t("time.monthAgo");
    if (diffMonth < 12) return t("time.monthsAgo", { count: diffMonth });
    return t("time.overYearAgo");
  };

  // Translation helpers for dynamic keys
  const getStatusLabel = (status: string) => t(`claims.status.${status}` as any) || status;
  const getActionLabel = (action: string) => t(`admin.actions.${action}` as any) || action;
  const getEntityLabel = (entityType: string) => t(`admin.entities.${entityType}` as any) || entityType;

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
    fetchActivityLog();
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

  const fetchActivityLog = async () => {
    try {
      setLoadingActivity(true);
      const res = await fetch("/api/admin/activity?limit=20");
      console.log("[Admin] Activity log fetch response:", {
        status: res.status,
        ok: res.ok,
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("[Admin] Activity log data:", {
          activitiesCount: data.activities?.length || 0,
          total: data.total,
          activities: data.activities,
        });
        setActivityLog(data.activities || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("[Admin] Activity log fetch error:", {
          status: res.status,
          error: errorData,
        });
      }
    } catch (error) {
      console.error("[Admin] Error fetching activity log:", error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const refreshAll = () => {
    setLoading(true);
    setLoadingActivity(true);
    fetchStats();
    fetchActivityLog();
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
      title: t("admin.users.title"),
      description: t("admin.users.description"),
      icon: Users,
      href: "/admin/users",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
      badge: stats?.pendingApproval ? t("admin.users.waitingCount", { count: stats.pendingApproval }) : undefined,
    },
    {
      title: t("admin.lists.title"),
      description: t("admin.lists.description"),
      icon: Database,
      href: "/admin/lists",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/10 border-orange-500/20",
    },
    {
      title: t("admin.email.title"),
      description: t("admin.email.description"),
      icon: Mail,
      href: "/settings",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10 border-green-500/20",
    },
    {
      title: t("admin.system.title"),
      description: t("admin.system.description"),
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
            {t("admin.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.subtitle")}
          </p>
        </div>
        <Button variant="outline" onClick={refreshAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Main Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">{t("admin.stats.users")}</p>
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalUsers}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("admin.stats.activeOf", { active: stats.activeUsers })}
              {stats.pendingApproval > 0 && (
                <span className="text-amber-500 ml-2">• {stats.pendingApproval} {t("admin.users.pending").toLowerCase()}</span>
              )}
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">{t("admin.stats.claims")}</p>
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {stats.totalClaims}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("admin.stats.inAnalysis", { count: stats.claimsByStatus.IN_ANALYSIS })}
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">{t("admin.stats.emails")}</p>
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
              {stats.unreadEmails}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("admin.stats.unreadOf", { total: stats.totalEmails })}
            </p>
          </Card>

          <Card className={`p-6 ${stats.emailConfigured ? 'bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20' : 'bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">{t("admin.stats.system")}</p>
              {stats.emailConfigured ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <Badge variant={stats.emailConfigured ? "default" : "destructive"} className="text-sm">
              {stats.emailConfigured ? t("admin.stats.allWorking") : t("admin.stats.emailNotConfigured")}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {t("admin.stats.database")}: {stats.databaseStatus}
            </p>
          </Card>
        </div>
      )}

      {/* Middle Section - Activity Log & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t("admin.activity.title")}
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchActivityLog} className="gap-1">
              <RefreshCw className="h-3 w-3" />
              {t("common.refresh")}
            </Button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loadingActivity ? (
              [...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : activityLog.length > 0 ? (
              activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => setSelectedActivity(entry)}
                >
                  <div className="mt-0.5">
                    {actionIcons[entry.action] || <Circle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-primary">
                        {entry.userName || entry.userEmail?.split("@")[0] || t("common.system")}
                      </span>
                      {" "}
                      <span className="text-muted-foreground">
                        {getActionLabel(entry.action).toLowerCase()}
                      </span>
                      {" "}
                      <span className="text-muted-foreground">
                        {getEntityLabel(entry.entityType)}
                      </span>
                      {entry.entityName && (
                        <>
                          {" "}
                          <span className="font-medium">{entry.entityName}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(new Date(entry.createdAt))}
                      {entry.ipAddress && (
                        <span className="ml-2">• IP: {entry.ipAddress}</span>
                      )}
                    </p>
                  </div>
                  {entry.entityType === "CLAIM" && entry.entityId && (
                    <Link 
                      href={`/claims/${entry.entityId}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("admin.activity.noActivity")}</p>
                <p className="text-xs mt-1">{t("admin.activity.noActivityDesc")}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Database Stats */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t("admin.dbStats.title")}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-500" />
                <span>{t("admin.dbStats.claims")}</span>
              </div>
              <span className="font-bold">{stats?.totalClaims || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-500" />
                <span>{t("admin.dbStats.customers")}</span>
              </div>
              <span className="font-bold">{stats?.totalCustomers || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-amber-500" />
                <span>{t("admin.dbStats.emails")}</span>
              </div>
              <span className="font-bold">{stats?.totalEmails || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-purple-500" />
                <span>{t("admin.dbStats.attachments")}</span>
              </div>
              <span className="font-bold">{stats?.totalAttachments || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-orange-500" />
                <span>{t("admin.dbStats.departments")}</span>
              </div>
              <span className="font-bold">{stats?.totalDepartments || 0}</span>
            </div>
          </div>

          {/* Claims by Status */}
          {stats?.claimsByStatus && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">{t("admin.dbStats.byStatus")}</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats.claimsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                    <Circle className={`h-3 w-3 fill-current ${
                      status === 'NEW' ? 'text-blue-500' :
                      status === 'IN_ANALYSIS' ? 'text-amber-500' :
                      status === 'APPROVED' ? 'text-green-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm">{getStatusLabel(status)}</span>
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
          {t("admin.sections")}
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
            {t("admin.systemStatus.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t("admin.systemStatus.database")}</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("admin.systemStatus.connected")}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t("admin.systemStatus.email")}</span>
              </div>
              {stats.emailConfigured ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t("admin.systemStatus.ok")}
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {t("admin.systemStatus.notConfigured")}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t("admin.systemStatus.api")}</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("admin.systemStatus.online")}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Activity Detail Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedActivity && actionIcons[selectedActivity.action]}
              {t("admin.activity.details")}
            </DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.activity.user")}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">
                      {selectedActivity.userName || selectedActivity.userEmail || t("common.system")}
                    </p>
                  </div>
                  {selectedActivity.userEmail && selectedActivity.userName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedActivity.userEmail}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.activity.action")}</p>
                  <Badge variant="outline" className="mt-1">
                    {getActionLabel(selectedActivity.action)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.activity.entityType")}</p>
                  <p className="font-medium capitalize">
                    {getEntityLabel(selectedActivity.entityType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.activity.entityName")}</p>
                  <p className="font-medium">
                    {selectedActivity.entityName || "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t("admin.activity.time")}</p>
                <p className="font-medium">
                  {new Date(selectedActivity.createdAt).toLocaleString("sr-Latn-RS", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>

              {selectedActivity.ipAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.activity.ipAddress")}</p>
                  <p className="font-medium font-mono text-sm">
                    {selectedActivity.ipAddress}
                  </p>
                </div>
              )}

              {selectedActivity.details && Object.keys(selectedActivity.details).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t("admin.activity.additionalDetails")}</p>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                    {Object.entries(selectedActivity.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}:
                        </span>
                        <span className="font-medium">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedActivity.entityType === "CLAIM" && selectedActivity.entityId && (
                <Link href={`/claims/${selectedActivity.entityId}`}>
                  <Button className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("admin.activity.openClaim")}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
