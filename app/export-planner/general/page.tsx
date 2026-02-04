"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Plus, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Batch {
  id: string;
  batchCode: string;
  batchType: string;
  customName: string | null;
  frozenAt: string | null;
  exportDate: string;
  _count: { items: number };
  createdBy: { fullName: string | null; email: string } | null;
}

const fetchBatches = async (): Promise<Batch[]> => {
  const res = await fetch("/api/export-planner/batches?batchType=GENERIC");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

const createBatch = async (data: { batchType: string; customName?: string }) => {
  const res = await fetch("/api/export-planner/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, batchType: "GENERIC" }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed");
  }
  return res.json();
};

export default function PlanerGeneralPage() {
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["export-planner-batches", "GENERIC"],
    queryFn: fetchBatches,
  });

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ["export-planner-batches"] });
      setDialogOpen(false);
      setNewName("");
      toast.success("Planer kreiran");
      window.location.href = `/export-planner/${batch.id}`;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">General planer</h1>
          <p className="text-muted-foreground mt-1">
            Fleksibilni planer za bilo koji projekat – prilagodi kolone, boje, dodeljuj radnike
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Novi planer
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse overflow-hidden">
              <div className="h-24 bg-muted/50" />
              <CardContent className="p-6 pt-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nema generalnih planera</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Kreiraj planer za bilo koji projekat – dodaj kolone, menjaj boje, dodeljuj ljude.
          </p>
          <Button onClick={() => setDialogOpen(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Novi planer
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/export-planner/${batch.id}`} className="block group">
              <Card
                className={`transition-all duration-200 hover:shadow-lg hover:border-primary/40 group-hover:scale-[1.02] overflow-hidden ${
                  batch.frozenAt
                    ? "border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/30"
                    : "border-green-500/20 hover:border-green-500/40"
                }`}
              >
                <div className={`h-1.5 ${batch.frozenAt ? "bg-amber-500" : "bg-green-500/60"}`} />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">
                      {batch.customName || batch.batchCode}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {batch._count.items} stavki
                    </p>
                  </div>
                  <div className="shrink-0 ml-2">
                    {batch.frozenAt ? (
                      <Lock className="h-5 w-5 text-amber-600" />
                    ) : (
                      <LockOpen className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background px-3 py-1.5 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                    Otvori →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi general planer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naziv planera</Label>
              <Input
                placeholder="npr. Projekat X, Nedeljni plan..."
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
              onClick={() => createMutation.mutate({ batchType: "GENERIC", customName: newName.trim() || undefined })}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "..." : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
