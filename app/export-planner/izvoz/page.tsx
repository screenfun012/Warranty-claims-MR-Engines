"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Lock, LockOpen, Trash2, ListFilter, BookmarkPlus, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchCode: string;
  batchType: string;
  customName: string | null;
  frozenAt: string | null;
  exportDate: string;
  _count: { items: number };
  exportCount?: number;
  createdBy: { fullName: string | null; email: string } | null;
}

type SortBy = "dateDesc" | "dateAsc" | "nameAsc";
const fetchBatches = async (mine?: boolean, sortBy: SortBy = "dateDesc"): Promise<Batch[]> => {
  const params = new URLSearchParams({ batchType: "MR_ENGINES", sortBy });
  if (mine) params.set("mine", "1");
  const res = await fetch(`/api/export-planner/batches?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

type SavedView = { id: string; name: string; batchType: string | null; mineOnly: boolean; sortBy: string };
const fetchSavedViews = async (): Promise<SavedView[]> => {
  const res = await fetch("/api/export-planner/saved-views");
  if (!res.ok) return [];
  return res.json();
};
const createSavedView = async (data: { name: string; batchType: string | null; mineOnly: boolean; sortBy: string }) => {
  const res = await fetch("/api/export-planner/saved-views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, batchType: data.batchType || null }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed");
  }
  return res.json();
};
const deleteSavedView = async (id: string) => {
  const res = await fetch(`/api/export-planner/saved-views/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed");
};

const createBatch = async (data: { batchType: string; customName?: string }) => {
  const res = await fetch("/api/export-planner/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, batchType: "MR_ENGINES" }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed");
  }
  return res.json();
};

const deleteBatch = async (id: string) => {
  const res = await fetch(`/api/export-planner/batches/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed");
  }
};

export default function PlanerIzvozPage() {
  const t = useTranslations("exportPlanner");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("dateDesc");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["export-planner-batches", "MR_ENGINES", showMineOnly, sortBy],
    queryFn: () => fetchBatches(showMineOnly, sortBy),
  });

  const { data: savedViews = [], refetch: refetchSavedViews } = useQuery({
    queryKey: ["export-planner-saved-views", "MR_ENGINES"],
    queryFn: fetchSavedViews,
  });
  const saveViewMutation = useMutation({
    mutationFn: createSavedView,
    onSuccess: () => {
      refetchSavedViews();
      setSaveViewOpen(false);
      setSavedViewName("");
      toast.success("Prikaz sačuvan");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ["export-planner-batches"] });
      setDialogOpen(false);
      setNewName("");
      toast.success("Lista kreirana");
      window.location.href = `/export-planner/${batch.id}`;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-planner-batches"] });
      setDeleteId(null);
      toast.success("Lista je obrisana.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const prefetchBatch = useCallback(
    (batchId: string) => {
      queryClient.prefetchQuery({
        queryKey: ["export-batch", batchId],
        queryFn: async () => {
          const res = await fetch(`/api/export-planner/batches/${batchId}`);
          if (!res.ok) throw new Error("Failed");
          return res.json();
        },
        staleTime: 2 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] relative">
      {/* Suptilna pozadina: grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30 dark:opacity-20 pointer-events-none" />
      <div className="relative p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80 mb-1">
            Export planner
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Plan izvoza
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm md:text-base max-w-xl">
            MR Engines Global – motori, liste za izvoz
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setShowMineOnly(false)}
              className={cn("rounded-md px-2.5 py-1 text-sm font-medium transition-colors", !showMineOnly && "bg-background shadow text-foreground")}
            >
              Sve liste
            </button>
            <button
              type="button"
              onClick={() => setShowMineOnly(true)}
              className={cn("rounded-md px-2.5 py-1 text-sm font-medium transition-colors", showMineOnly && "bg-background shadow text-foreground")}
            >
              Samo moje
            </button>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sortiraj" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dateDesc">Datum ↓</SelectItem>
              <SelectItem value="dateAsc">Datum ↑</SelectItem>
              <SelectItem value="nameAsc">Naziv A–Ž</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <BookmarkPlus className="h-4 w-4" />
                Sačuvani prikazi
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {savedViews.filter((v: SavedView) => v.batchType === "MR_ENGINES" || !v.batchType).map((v: SavedView) => (
                <DropdownMenuItem
                  key={v.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowMineOnly(v.mineOnly);
                    setSortBy((v.sortBy as SortBy) || "dateDesc");
                  }}
                >
                  <span className="flex-1">{v.name}</span>
                </DropdownMenuItem>
              ))}
              {savedViews.filter((v: SavedView) => v.batchType === "MR_ENGINES" || !v.batchType).length === 0 && (
                <DropdownMenuItem disabled>Nema sačuvanih prikaza</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaveViewOpen(true)}>
                Sačuvaj trenutni prikaz…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl h-11 px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kreiraj novi izvoz
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse overflow-hidden rounded-2xl border-0 shadow-lg bg-card/50">
              <div className="h-2 bg-muted/50 rounded-t-2xl" />
              <CardContent className="p-6 pt-5">
                <div className="h-5 bg-muted/50 rounded-lg w-3/4 mb-3" />
                <div className="h-4 bg-muted/50 rounded-lg w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-16 md:p-20 text-center border-2 border-dashed rounded-2xl bg-card/50 dark:bg-card/30 shadow-sm">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-6 shadow-inner">
            <Truck className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Nema planova izvoza</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm leading-relaxed">
            Kreiraj prvi plan – npr. Izvoz Januar, Izvoz Februar...
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kreiraj novi izvoz
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              onMouseEnter={() => prefetchBatch(batch.id)}
              className={cn(
                "group overflow-hidden flex flex-col rounded-2xl border-2 transition-all duration-300",
                "hover:shadow-xl hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-primary/50",
                batch.frozenAt
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/40 dark:border-amber-500/30 shadow-md"
                  : "bg-card dark:bg-card/80 border-green-500/20 dark:border-green-500/20 hover:border-green-500/40 dark:hover:border-green-500/40 shadow-lg shadow-black/5 dark:shadow-black/20"
              )}
            >
              <div
                className={cn(
                  "h-1.5 shrink-0",
                  batch.frozenAt
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-500 dark:to-emerald-600"
                )}
              />
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2 pt-5 px-5">
                <Link
                  href={`/export-planner/${batch.id}`}
                  className="min-w-0 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-background"
                >
                  <h3 className="font-semibold text-lg truncate text-foreground group-hover:text-primary transition-colors">
                    {batch.customName || batch.batchCode}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {batch._count.items} motora{batch.exportCount != null ? ` • ${batch.exportCount} za izvoz` : ""}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {batch.frozenAt ? (
                    <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                  ) : (
                    <LockOpen className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => { e.preventDefault(); setDeleteId(batch.id); }}
                    aria-label="Obriši listu"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-5 px-5">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-xl h-10 font-medium shadow-sm hover:shadow transition-shadow border border-border/80"
                >
                  <Link href={`/export-planner/${batch.id}`}>
                    Otvori →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Obriši listu izvoza?"
        description="Cela lista i sve stavke će biti trajno obrisane. Ovu radnju nije moguće poništiti."
        confirmText="Obriši"
        cancelText="Odustani"
        variant="destructive"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kreiraj novi izvoz</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naziv (npr. Izvoz Januar)</Label>
              <Input
                placeholder="Izvoz Januar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate({ batchType: "MR_ENGINES", customName: newName.trim() || undefined })}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "..." : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sačuvaj prikaz</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naziv prikaza</Label>
              <Input
                placeholder="npr. Moj izvoz, Sve aktivno..."
                value={savedViewName}
                onChange={(e) => setSavedViewName(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Trenutno: {showMineOnly ? "Samo moje" : "Sve liste"}, sort: {sortBy === "dateDesc" ? "Datum ↓" : sortBy === "dateAsc" ? "Datum ↑" : "Naziv A–Ž"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate({ name: savedViewName.trim(), batchType: "MR_ENGINES", mineOnly: showMineOnly, sortBy })}
              disabled={!savedViewName.trim() || saveViewMutation.isPending}
            >
              {saveViewMutation.isPending ? "..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
