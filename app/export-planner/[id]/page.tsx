"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Plus, Lock, LockOpen, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ColumnDef {
  id: string;
  label: string;
  order: number;
  color: string;
}

interface BatchItem {
  id: string;
  rn: string;
  engineNo: string;
  mrCode: string | null;
  status: string;
  sortOrder: number;
  priority: string | null;
  assignedTo: { fullName: string | null } | null;
}

interface Batch {
  id: string;
  batchCode: string;
  batchType: string;
  customName: string | null;
  frozenAt: string | null;
  columns: string | null;
  items: BatchItem[];
}

const PRIORITY_BORDER: Record<string, string> = {
  LOW: "border-l-4 border-l-blue-500",
  MEDIUM: "border-l-4 border-l-amber-500",
  HIGH: "border-l-4 border-l-red-500",
};

function parseColumns(cols: string | null): ColumnDef[] {
  if (!cols) return [];
  try {
    const arr = JSON.parse(cols);
    return Array.isArray(arr) ? arr.sort((a: ColumnDef, b: ColumnDef) => a.order - b.order) : [];
  } catch {
    return [
      { id: "PLANIRANO", label: "U planu", order: 0, color: "slate" },
      { id: "RAD", label: "U radu", order: 1, color: "blue" },
      { id: "IZVOZ", label: "Izvoz", order: 2, color: "green" },
    ];
  }
}

const fetchBatch = async (id: string): Promise<Batch> => {
  const res = await fetch(`/api/export-planner/batches/${id}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

function DroppableColumn({
  id,
  label,
  color,
  items,
  canEdit,
  onAddClick,
  renderCard,
}: {
  id: string;
  label: string;
  color: string;
  items: BatchItem[];
  canEdit: boolean;
  onAddClick: () => void;
  renderCard: (item: BatchItem) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const colorMap: Record<string, string> = {
    slate: "border-slate-400 bg-slate-50 dark:bg-slate-900/50",
    blue: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
    green: "border-green-400 bg-green-50 dark:bg-green-900/20",
    amber: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
    rose: "border-rose-400 bg-rose-50 dark:bg-rose-900/20",
  };
  const colClass = colorMap[color] || colorMap.slate;

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] rounded-lg border-2 transition-colors",
        colClass,
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="p-3 font-medium flex items-center justify-between">
        <span>{label}</span>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="p-2 flex-1 min-h-[120px] space-y-2"
      >
        {items.map((item) => renderCard(item))}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj
          </Button>
        )}
      </div>
    </div>
  );
}

function ItemCardContent({
  item,
  batchType,
  className,
}: {
  item: BatchItem;
  batchType: string;
  className?: string;
}) {
  const borderClass = (item.priority && PRIORITY_BORDER[item.priority]) || "";
  return (
    <Card className={cn("transition-shadow", borderClass, className)}>
      <CardContent className="p-3 flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {batchType === "MR_ENGINES" && item.mrCode
              ? `${item.mrCode} · ${item.engineNo}`
              : item.engineNo}
          </div>
          {item.assignedTo && (
            <p className="text-xs text-muted-foreground truncate">
              {item.assignedTo.fullName || "-"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableCard({
  item,
  batchType,
  onClick,
}: {
  item: BatchItem;
  batchType: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}
    >
      <ItemCardContent
        item={item}
        batchType={batchType}
        className="hover:shadow-md"
      />
    </div>
  );
}

export default function ExportBatchPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations("exportPlanner");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [addColumnId, setAddColumnId] = useState<string | null>(null);
  const [addEngineNo, setAddEngineNo] = useState("");
  const [addMrCode, setAddMrCode] = useState("");
  const [detailItem, setDetailItem] = useState<BatchItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: batch, isLoading } = useQuery({
    queryKey: ["export-batch", id],
    queryFn: () => fetchBatch(id),
    enabled: !!id,
  });

  const columns = useMemo(
    () => parseColumns(batch?.columns ?? null),
    [batch?.columns]
  );

  const itemsByColumn = useMemo(() => {
    const map: Record<string, BatchItem[]> = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const item of batch?.items ?? []) {
      const colId = item.status in map ? item.status : columns[0]?.id ?? "PLANIRANO";
      if (!map[colId]) map[colId] = [];
      map[colId].push(item);
    }
    for (const col of columns) {
      if (!map[col.id]) map[col.id] = [];
      map[col.id].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [batch?.items, columns]);

  const canEdit = !batch?.frozenAt;

  const addMutation = useMutation({
    mutationFn: async (payload: { engineNo: string; mrCode?: string; status: string }) => {
      const res = await fetch(`/api/export-planner/batches/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineNo: payload.engineNo,
          rn: payload.engineNo,
          mrCode: payload.mrCode || null,
          status: payload.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-batch", id] });
      setAddColumnId(null);
      setAddEngineNo("");
      setAddMrCode("");
      toast.success(t("addItem"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await fetch(
        `/api/export-planner/batches/${id}/items?itemId=${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["export-batch", id] });
    },
    onError: () => toast.error("Greška pri premeštanju"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const itemId = String(e.active.id);
      const overId = e.over?.id ? String(e.over.id) : null;
      if (!overId) return;
      // overId can be column id or another item id - resolve to column
      let colId = columns.some((c) => c.id === overId) ? overId : null;
      if (!colId) {
        const overItem = batch?.items.find((i) => i.id === overId);
        colId = overItem?.status ?? null;
      }
      if (!colId) return;
      const item = batch?.items.find((i) => i.id === itemId);
      if (!item || item.status === colId) return;
      updateStatusMutation.mutate({ itemId, status: colId });
    },
    [batch?.items, columns, updateStatusMutation]
  );

  if (isLoading || !batch) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 w-48 mb-4 rounded bg-muted" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 w-72 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const activeItem = activeId
    ? batch.items.find((i) => i.id === activeId)
    : null;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/export-planner">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {batch.customName || batch.batchCode}
          </h1>
          <p className="text-sm text-muted-foreground">
            {batch.frozenAt ? (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {t("frozen")}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <LockOpen className="h-3 w-3" />
                {t("unfrozen")}
              </span>
            )}
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <DroppableColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              items={itemsByColumn[col.id] ?? []}
              canEdit={canEdit}
              onAddClick={() => setAddColumnId(col.id)}
              renderCard={(item) => (
                <DraggableCard
                  item={item}
                  batchType={batch.batchType}
                  onClick={() => setDetailItem(item)}
                />
              )}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="w-72 shadow-lg rotate-1">
              <ItemCardContent item={activeItem} batchType={batch.batchType} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add item dialog */}
      <Dialog open={!!addColumnId} onOpenChange={(o) => !o && setAddColumnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addItem")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("engineNo")}</Label>
              <Input
                value={addEngineNo}
                onChange={(e) => setAddEngineNo(e.target.value)}
                placeholder={t("engineNo")}
              />
            </div>
            {batch.batchType === "MR_ENGINES" && (
              <div className="grid gap-2">
                <Label>{t("mrCode")}</Label>
                <Input
                  value={addMrCode}
                  onChange={(e) => setAddMrCode(e.target.value)}
                  placeholder={t("mrCode")}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!addColumnId || !addEngineNo.trim()) return;
                addMutation.mutate({
                  engineNo: addEngineNo.trim(),
                  mrCode: addMrCode.trim() || undefined,
                  status: addColumnId,
                });
              }}
              disabled={!addEngineNo.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "..." : tCommon("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog (placeholder) */}
      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailItem
                ? batch.batchType === "MR_ENGINES" && detailItem.mrCode
                  ? `${detailItem.mrCode} · ${detailItem.engineNo}`
                  : detailItem.engineNo
                : ""}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t("engineNo")}:</span>{" "}
                {detailItem.engineNo}
              </p>
              {batch.batchType === "MR_ENGINES" && detailItem.mrCode && (
                <p>
                  <span className="text-muted-foreground">{t("mrCode")}:</span>{" "}
                  {detailItem.mrCode}
                </p>
              )}
              {detailItem.assignedTo && (
                <p>
                  <span className="text-muted-foreground">{t("assignedTo")}:</span>{" "}
                  {detailItem.assignedTo.fullName}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailItem(null)}>{tCommon("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
