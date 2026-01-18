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
  AlertCircle
} from "lucide-react";

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalClaims: number;
  unreadEmails: number;
  emailConfigured: boolean;
  databaseStatus: string;
}

interface Auth0User {
  'https://mr-engines-warranty/roles'?: string[] | string;
  app_metadata?: {
    roles?: string[] | string;
  };
}

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
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16" />
            </Card>
          ))}
        </div>

        {/* Admin Sections Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-8 mb-4" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
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
    },
    {
      title: "Email status",
      description: "Pregled i upravljanje email sinchronizacijom",
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
      </div>

      {/* System Status Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Ukupno korisnika</p>
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalUsers}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.activeUsers} aktivnih
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Ukupno reklamacija</p>
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {stats.totalClaims}
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Nepročitane poruke</p>
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
              {stats.unreadEmails}
            </p>
          </Card>

          <Card className={`p-6 ${stats.emailConfigured ? 'bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20' : 'bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Email status</p>
              {stats.emailConfigured ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={stats.emailConfigured ? "default" : "destructive"}>
                {stats.emailConfigured ? "Konfigurisano" : "Nije konfigurisano"}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Admin Sections */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Admin sekcije
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className={`p-6 ${section.bgColor} hover:shadow-lg transition-all cursor-pointer group`}>
                <div className="flex items-start justify-between mb-4">
                  <section.icon className={`h-8 w-8 ${section.color} group-hover:scale-110 transition-transform`} />
                  <ArrowRight className={`h-5 w-5 ${section.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Baza podataka</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                {stats.databaseStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Email konfiguracija</span>
              </div>
              {stats.emailConfigured ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Konfigurisano
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Nije konfigurisano
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}