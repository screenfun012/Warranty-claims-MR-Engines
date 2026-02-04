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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck, Plus, Lock, LockOpen } from "lucide-react";
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
  const res = await fetch("/api/export-planner/batches");
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
};

const createBatch = async (data: { batchType: string; customName?: string }) => {
  const res = await fetch("/api/export-planner/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create");
  }
  return res.json();
};

export default function ExportPlannerPage() {
  const t = useTranslations("exportPlanner");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newType, setNewType] = useState("MR_ENGINES");
  const [newName, setNewName] = useState("");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["export-planner-batches"],
    queryFn: fetchBatches,
  });

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ["export-planner-batches"] });
      setDialogOpen(false);
      setNewName("");
      setNewType("MR_ENGINES");
      toast.success(t("newList") + " – " + (batch.customName || batch.batchCode));
      window.location.href = `/export-planner/${batch.id}`;
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      batchType: newType,
      customName: newName.trim() || undefined,
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{tNav("exportPlanner")}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newList")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20" />
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-12 text-center">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Nema listi. Kreiraj prvu listu da započneš.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("newList")}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              className={`transition-colors hover:border-primary/50 ${
                batch.frozenAt ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20" : ""
              }`}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <h3 className="font-semibold">
                    {batch.customName || batch.batchCode}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {batch.batchType === "MR_ENGINES"
                      ? t("typeMrEngines")
                      : t("typeGeneric")}
                  </p>
                </div>
                {batch.frozenAt ? (
                  <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <LockOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("itemsCount", { count: batch._count.items })}
                </p>
                <Link href={`/export-planner/${batch.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    {t("open")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newList")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("type")}</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MR_ENGINES">{t("typeMrEngines")}</SelectItem>
                  <SelectItem value="GENERIC">{t("typeGeneric")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("listName")}</Label>
              <Input
                placeholder={t("listName")}
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
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "..." : t("newList")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
