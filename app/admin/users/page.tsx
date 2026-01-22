"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, UserCheck, UserX, CheckCircle, XCircle, Clock } from "lucide-react";
import { ROLES } from "@/lib/auth/roles";
import { useTranslations } from "next-intl";

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  approved: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');

  interface Auth0User {
    'https://mr-engines-warranty/roles'?: string[] | string;
    app_metadata?: {
      roles?: string[] | string;
    };
  }
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
    
    fetchUsers();
  }, [isLoading, user, isSuperAdmin, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const data = await res.json();
        alert(data.error || t('error.updateRole'));
      }
    } catch (error) {
      console.error("Error updating role:", error);
      alert(t('error.updateRole'));
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, active: !currentActive } : u));
      } else {
        const data = await res.json();
        alert(data.error || t('error.updateStatus'));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert(t('error.updateStatus'));
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleApproved = async (userId: string, currentApproved: boolean) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !currentApproved }),
      });

      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, approved: !currentApproved } : u));
      } else {
        const data = await res.json();
        alert(data.error || t('error.approveUser'));
      }
    } catch (error) {
      console.error("Error approving user:", error);
      alert(t('error.approveUser'));
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>

        {/* Table Skeleton */}
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const pendingApprovalCount = users.filter(u => !u.approved).length;
  const activeUsersCount = users.filter(u => u.active && u.approved).length;
  const totalUsersCount = users.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('totalUsers')}</p>
            <p className="text-2xl font-bold">{totalUsersCount}</p>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('activeUsers')}</p>
            <p className="text-2xl font-bold">{activeUsersCount}</p>
          </div>
        </Card>
        
        <Card className={`p-4 flex items-center gap-4 ${pendingApprovalCount > 0 ? 'border-orange-500 border-2' : ''}`}>
          <div className={`p-3 rounded-full ${pendingApprovalCount > 0 ? 'bg-orange-100 dark:bg-orange-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Clock className={`w-6 h-6 ${pendingApprovalCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('pendingApproval')}</p>
            <p className="text-2xl font-bold">{pendingApprovalCount}</p>
          </div>
        </Card>
      </div>

      {/* Pending Approvals Section */}
      {pendingApprovalCount > 0 && (
        <Card className="p-6 border-orange-500 border-2 bg-orange-50 dark:bg-orange-950/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <Clock className="w-5 h-5" />
            {t('pendingUsers', { count: pendingApprovalCount })}
          </h2>
          <div className="space-y-3">
            {users.filter(u => !u.approved).map((pendingUser) => (
              <div key={pendingUser.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <div>
                  <p className="font-medium">{pendingUser.fullName || "-"}</p>
                  <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('registeredOn')}: {new Date(pendingUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleToggleApproved(pendingUser.id, false)}
                    disabled={updating === pendingUser.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('approve')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Users Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">{t('allUsers')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">{t('user')}</th>
                <th className="text-left p-3">{tCommon('role')}</th>
                <th className="text-left p-3">{t('approval')}</th>
                <th className="text-left p-3">{tCommon('status')}</th>
                <th className="text-left p-3">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b hover:bg-muted/50">
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{u.fullName || "-"}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </td>
                  <td className="p-3">
                    {updating === u.id ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleRoleChange(u.id, value)}
                        disabled={u.role === "SUPER_ADMIN"}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(ROLES).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={u.approved ? "default" : "destructive"}
                      className={u.approved ? "bg-green-600" : "bg-orange-500"}
                    >
                      {u.approved ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t('approved')}
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          {t('pending')}
                        </>
                      )}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={u.active ? "default" : "destructive"}
                      className={u.active ? "bg-blue-600" : "bg-red-500"}
                    >
                      {u.active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      {!u.approved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleApproved(u.id, u.approved)}
                          disabled={updating === u.id}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t('approve')}
                        </Button>
                      )}
                      {u.approved && u.role !== "SUPER_ADMIN" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleApproved(u.id, u.approved)}
                          disabled={updating === u.id}
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t('revoke')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(u.id, u.active)}
                        disabled={updating === u.id || u.role === "SUPER_ADMIN"}
                      >
                        {u.active ? (
                          <>
                            <UserX className="w-4 h-4 mr-1" />
                            {t('deactivate')}
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            {t('activate')}
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('noUsers')}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
