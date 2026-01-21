"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Building2, 
  Plus, 
  Trash2,
  ArrowLeft,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Worker {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

interface Auth0User {
  'https://mr-engines-warranty/roles'?: string[] | string;
  app_metadata?: {
    roles?: string[] | string;
  };
}

export default function AdminListsPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [addingWorker, setAddingWorker] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "worker" | "company";
    id: string;
    name: string;
  }>({ open: false, type: "worker", id: "", name: "" });
  const [deleting, setDeleting] = useState(false);

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
    
    fetchData();
  }, [isLoading, user, isSuperAdmin, router]);

  const fetchData = async () => {
    try {
      const [workersRes, companiesRes] = await Promise.all([
        fetch("/api/admin/workers"),
        fetch("/api/admin/companies"),
      ]);

      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkers(data.workers || []);
      }

      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Greška pri učitavanju podataka");
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async () => {
    if (!newWorkerName.trim()) return;
    
    setAddingWorker(true);
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkerName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkers([...workers, data.worker].sort((a, b) => a.name.localeCompare(b.name)));
        setNewWorkerName("");
        toast.success("Radnik dodat");
      } else {
        const error = await res.json();
        toast.error(error.error || "Greška pri dodavanju radnika");
      }
    } catch (error) {
      toast.error("Greška pri dodavanju radnika");
    } finally {
      setAddingWorker(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    
    setAddingCompany(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompanies([...companies, data.company].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCompanyName("");
        toast.success("Firma dodata");
      } else {
        const error = await res.json();
        toast.error(error.error || "Greška pri dodavanju firme");
      }
    } catch (error) {
      toast.error("Greška pri dodavanju firme");
    } finally {
      setAddingCompany(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    
    setDeleting(true);
    try {
      const endpoint = deleteDialog.type === "worker" 
        ? `/api/admin/workers/${deleteDialog.id}`
        : `/api/admin/companies/${deleteDialog.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });

      if (res.ok) {
        if (deleteDialog.type === "worker") {
          setWorkers(workers.filter(w => w.id !== deleteDialog.id));
        } else {
          setCompanies(companies.filter(c => c.id !== deleteDialog.id));
        }
        toast.success(`${deleteDialog.type === "worker" ? "Radnik" : "Firma"} obrisana`);
        setDeleteDialog({ open: false, type: "worker", id: "", name: "" });
      } else {
        const error = await res.json();
        toast.error(error.error || "Greška pri brisanju");
      }
    } catch (error) {
      toast.error("Greška pri brisanju");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full mb-2" />
            ))}
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(5)].map((_, i) => (
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Upravljanje Listama
          </h1>
          <p className="text-muted-foreground mt-1">
            Dodaj ili ukloni radnike i firme iz padajućih lista
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Radnici ({workers.length})</h2>
          </div>

          {/* Add new worker */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Ime novog radnika..."
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWorker()}
            />
            <Button 
              onClick={handleAddWorker} 
              disabled={addingWorker || !newWorkerName.trim()}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Workers list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {workers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nema radnika</p>
            ) : (
              workers.map((worker) => (
                <div 
                  key={worker.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="font-medium">{worker.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => setDeleteDialog({
                      open: true,
                      type: "worker",
                      id: worker.id,
                      name: worker.name,
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Companies Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">Firme ({companies.length})</h2>
          </div>

          {/* Add new company */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Ime nove firme..."
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
            />
            <Button 
              onClick={handleAddCompany} 
              disabled={addingCompany || !newCompanyName.trim()}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Companies list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {companies.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nema firmi</p>
            ) : (
              companies.map((company) => (
                <div 
                  key={company.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="font-medium">{company.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => setDeleteDialog({
                      open: true,
                      type: "company",
                      id: company.id,
                      name: company.name,
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrdi brisanje</DialogTitle>
          </DialogHeader>
          <p>
            Da li ste sigurni da želite da obrišete{" "}
            <strong>{deleteDialog.name}</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            Ova akcija je nepovratna. {deleteDialog.type === "worker" ? "Radnik" : "Firma"} će biti uklonjen/a iz liste.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ ...deleteDialog, open: false })}
              disabled={deleting}
            >
              Otkaži
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Brisanje..." : "Obriši"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
