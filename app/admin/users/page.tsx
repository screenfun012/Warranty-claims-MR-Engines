"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, UserCheck, UserX } from "lucide-react";
import { ROLES } from "@/lib/auth/roles";

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
        alert(data.error || "Greška pri ažuriranju role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Greška pri ažuriranju role");
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
        alert(data.error || "Greška pri ažuriranju statusa");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Greška pri ažuriranju statusa");
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

        {/* Table Skeleton */}
        <Card className="p-6">
          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 pb-2 border-b">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Table Rows */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 py-3 border-b">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-red-500",
    ADMIN: "bg-purple-500",
    MANAGER: "bg-blue-500",
    OPERATOR: "bg-green-500",
    TECHNICIAN: "bg-yellow-500",
    WORKER: "bg-gray-500",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Upravljanje korisnicima
          </h1>
          <p className="text-muted-foreground mt-2">
            Upravljajte korisnicima i njihovim ulogama u sistemu
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Ime i prezime</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Uloga</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Datum kreiranja</th>
                <th className="text-left p-3">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">{user.fullName}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">
                    {updating === user.id ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={user.role === "SUPER_ADMIN"}
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
                      className={user.active ? "bg-green-500" : "bg-red-500"}
                    >
                      {user.active ? "Aktivan" : "Neaktivan"}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("sr-RS")}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(user.id, user.active)}
                      disabled={updating === user.id || user.role === "SUPER_ADMIN"}
                    >
                      {user.active ? (
                        <>
                          <UserX className="w-4 h-4 mr-2" />
                          Deaktiviraj
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Aktiviraj
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nema korisnika u sistemu
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
