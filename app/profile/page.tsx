"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Crown,
  UserRoundCog,
  UserCheck,
  Eye,
  Shield,
  Calendar
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface Auth0User {
  name?: string;
  email?: string;
  picture?: string;
  sub?: string;
  role?: string;
  roles?: string[];
  'https://mr-engines-warranty/roles'?: string[] | string;
  app_metadata?: {
    roles?: string[] | string;
  };
  created_at?: string;
}

export default function ProfilePage() {
  const { user, isLoading } = useUser();
  const [profile, setProfile] = useState<Auth0User | null>(null);

  useEffect(() => {
    if (user) {
      const auth0User = user as Auth0User;
      setProfile(auth0User);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="p-8">
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="p-8">
        <p>Niste prijavljeni</p>
      </div>
    );
  }

  // Get role from various possible locations
  const userRolesRaw = profile.role || profile.roles?.[0] || profile?.['https://mr-engines-warranty/roles'] || profile?.app_metadata?.roles || [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;

  const roleConfig: Record<string, { icon: typeof User; color: string; label: string }> = {
    SUPER_ADMIN: { icon: Crown, color: "bg-amber-500 dark:bg-amber-600", label: "Super Admin" },
    ADMIN: { icon: UserRoundCog, color: "bg-purple-500 dark:bg-purple-600", label: "Admin" },
    OPERATOR: { icon: UserCheck, color: "bg-blue-500 dark:bg-blue-600", label: "Operator" },
    VIEWER: { icon: Eye, color: "bg-gray-500 dark:bg-gray-600", label: "Viewer" },
  };

  const currentRole = roleConfig[userRole as string] || roleConfig.VIEWER;
  const RoleIcon = currentRole.icon;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("sr-RS", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <User className="w-10 h-10 text-primary" />
          Moj Profil
        </h1>
        <p className="text-muted-foreground mt-2">
          Pregled i upravljanje ličnim postavkama
        </p>
      </div>

      {/* Profile Information */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="relative h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
              {profile.picture ? (
                <img
                  src={profile.picture}
                  alt={profile.name || "User"}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-primary" />
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-background ${currentRole.color}`}>
              <RoleIcon className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {profile.name || "Korisnik"}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    userRole === "SUPER_ADMIN" ? "default" : 
                    userRole === "ADMIN" ? "secondary" :
                    userRole === "OPERATOR" ? "outline" :
                    "outline"
                  }
                  className={`
                    ${userRole === "SUPER_ADMIN" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"}
                    ${userRole === "ADMIN" && "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"}
                    ${userRole === "OPERATOR" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"}
                    ${userRole === "VIEWER" && "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"}
                  `}
                >
                  <div className="flex items-center gap-1.5">
                    <RoleIcon className="h-3 w-3" />
                    <span>{currentRole.label}</span>
                  </div>
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Email adresa</p>
                  <p className="font-medium break-all">{profile.email || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">User ID</p>
                  <p className="font-mono text-sm break-all">{profile.sub || "N/A"}</p>
                </div>
              </div>

              {profile.created_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Datum kreiranja naloga</p>
                    <p className="font-medium">{formatDate(profile.created_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Postavke</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium mb-1">Tema</p>
              <p className="text-sm text-muted-foreground">
                Promeni između svetle i tamne teme
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </Card>

      {/* Note */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              O bezbednosti
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Vaši podaci su zaštićeni Auth0 autentifikacijom. Za promenu email adrese ili 
              lozinke, kontaktirajte administratora sistema.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}