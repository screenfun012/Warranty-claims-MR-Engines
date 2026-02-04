"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  pointerWithin,
} from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Plus, Lock, LockOpen, GripVertical, Printer, FileText, Download, Calendar, Trash2, X, Clock, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface ColumnDef {
  id: string;
  label: string;
  order: number;
  color: string;
}

/** Za General planer: imageUrl, link, itd. */
type GeneralCustomData = { imageUrl?: string; link?: string };

type PlannerUser = { id: string; fullName: string | null; email: string };

interface BatchItem {
  id: string;
  rn: string;
  engineNo: string;
  engineType: string | null;
  mrCode: string | null;
  status: string;
  sortOrder: number;
  priority: string | null;
  assignedTo: { id: string; fullName: string | null } | null;
  qcOk?: boolean;
  details?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  customData?: string | null;
}

function parseGeneralCustomData(item: BatchItem): GeneralCustomData {
  if (!item.customData) return {};
  try {
    return (JSON.parse(item.customData) as GeneralCustomData) || {};
  } catch {
    return {};
  }
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

const COLUMN_PREFIX = "col-";
const COLUMN_COLORS = ["slate", "blue", "green", "amber", "rose", "violet"] as const;

/** Kad vučemo kolonu, ciljamo samo sortable kolone (col-*), da ne upadnemo na droppable za kartice (status id). */
const columnAwareCollisionDetection: CollisionDetection = (args) => {
  const isColumnDrag = String(args.active.id).startsWith(COLUMN_PREFIX);
  if (isColumnDrag) {
    const columnContainers = args.droppableContainers.filter((c) => String(c.id).startsWith(COLUMN_PREFIX));
    const columnRects = new Map<unknown, unknown>();
    for (const c of columnContainers) {
      const rect = args.droppableRects.get(c.id);
      if (rect != null) columnRects.set(c.id, rect);
    }
    return pointerWithin({ ...args, droppableContainers: columnContainers, droppableRects: columnRects as typeof args.droppableRects });
  }
  return pointerWithin(args);
};
const SELECT_NONE = "__none__";
const colorMap: Record<string, string> = {
  slate: "border-slate-200 bg-white dark:bg-slate-900/80 dark:border-slate-700",
  blue: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-800",
  green: "border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800",
  amber: "border-amber-200 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800",
  rose: "border-rose-200 bg-rose-50/50 dark:bg-rose-950/30 dark:border-rose-800",
  violet: "border-violet-200 bg-violet-50/50 dark:bg-violet-950/30 dark:border-violet-800",
};

function DroppableColumn({
  id,
  label,
  color,
  items,
  canEdit,
  onAddClick,
  renderCard,
  addLabel,
  onLabelChange,
  onRemoveColumn,
  columnItemCount = 0,
  columnDragHandleProps,
}: {
  id: string;
  label: string;
  color: string;
  items: BatchItem[];
  canEdit: boolean;
  onAddClick: () => void;
  renderCard: (item: BatchItem) => React.ReactNode;
  addLabel: string;
  onLabelChange?: (newLabel: string) => void;
  onRemoveColumn?: () => void;
  columnItemCount?: number;
  columnDragHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(label);
  const colClass = colorMap[color] || colorMap.slate;

  useEffect(() => {
    setLabelValue(label);
  }, [label]);

  const saveLabel = () => {
    setEditingLabel(false);
    const trimmed = labelValue.trim();
    if (trimmed && trimmed !== label && onLabelChange) onLabelChange(trimmed);
    else setLabelValue(label);
  };

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] w-[280px] rounded-lg border bg-card/50 shadow-sm shrink-0 overflow-visible transition-all duration-300 ease-out",
        colClass,
        isOver && "z-40 ring-2 ring-primary/50 ring-offset-2 scale-[1.02]"
      )}
    >
      <div className="relative z-20 shrink-0 px-3 py-3 font-medium flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur rounded-t-lg">
        {columnDragHandleProps && (
          <div {...columnDragHandleProps.attributes} {...columnDragHandleProps.listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-0.5 rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {editingLabel && canEdit ? (
          <Input
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") { setEditingLabel(false); setLabelValue(label); } }}
            className="h-7 text-sm flex-1 min-w-0"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && onLabelChange && setEditingLabel(true)}
            className={cn(
              "text-sm uppercase tracking-wide text-muted-foreground truncate text-left flex-1 min-w-0",
              canEdit && onLabelChange && "hover:text-foreground cursor-pointer"
            )}
          >
            {label}
          </button>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{items.length}</span>
          {canEdit && onRemoveColumn && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              disabled={columnItemCount > 0}
              onClick={onRemoveColumn}
              title={columnItemCount > 0 ? "Prvo premesti stavke" : "Ukloni kolonu"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "p-3 flex-1 min-h-[180px] flex flex-col gap-2 overflow-y-auto transition-[background-color,box-shadow] duration-300 ease-out",
          isOver && "bg-primary/5"
        )}
      >
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground shrink-0 border border-dashed"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        )}
        {items.map((item) => renderCard(item))}
      </div>
    </div>
  );
}

function SortableColumn({
  col,
  items,
  canEdit,
  onAddClick,
  addLabel,
  onLabelChange,
  onRemoveColumn,
  columnItemCount,
  renderCard,
}: {
  col: ColumnDef;
  items: BatchItem[];
  canEdit: boolean;
  onAddClick: () => void;
  addLabel: string;
  onLabelChange?: (newLabel: string) => void;
  onRemoveColumn?: () => void;
  columnItemCount: number;
  renderCard: (item: BatchItem) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: COLUMN_PREFIX + col.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn("shrink-0 transition-opacity duration-200 ease-out", isDragging && "opacity-0 pointer-events-none")}>
      <DroppableColumn
        id={col.id}
        label={col.label}
        color={col.color}
        items={items}
        canEdit={canEdit}
        onAddClick={onAddClick}
        addLabel={addLabel}
        onLabelChange={onLabelChange}
        onRemoveColumn={onRemoveColumn}
        columnItemCount={columnItemCount}
        columnDragHandleProps={canEdit ? { attributes: attributes as unknown as Record<string, unknown>, listeners: (listeners ?? {}) as unknown as Record<string, unknown> } : undefined}
        renderCard={renderCard}
      />
    </div>
  );
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleDateString("sr-RS", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** Broj dana kašnjenja: rok prošao i stavka nije u završnoj koloni. */
function getDaysLate(item: BatchItem, columns: ColumnDef[]): number {
  if (!item.dueDate) return 0;
  const due = new Date(item.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due >= today) return 0;
  const lastCol = columns[columns.length - 1];
  if (lastCol && item.status === lastCol.id) return 0;
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

function ItemCardContent({
  item,
  batchType,
  className,
  showQc,
  canEdit,
  onQcToggle,
  onRemove,
  daysLate,
}: {
  item: BatchItem;
  batchType: string;
  className?: string;
  showQc?: boolean;
  canEdit?: boolean;
  onQcToggle?: () => void;
  onRemove?: () => void;
  daysLate?: number;
}) {
  const borderClass = (item.priority && PRIORITY_BORDER[item.priority]) || "";
  const dueStr = formatDate(item.dueDate);
  const isMr = batchType === "MR_ENGINES";
  const generalCustom = !isMr ? parseGeneralCustomData(item) : null;
  const hasImage = generalCustom?.imageUrl?.trim();
  return (
    <Card
      className={cn(
        "group transition-all duration-300 ease-out hover:shadow-md hover:border-primary/20 bg-background border cursor-grab active:cursor-grabbing",
        borderClass,
        className
      )}
    >
      <CardContent className="p-3 flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5 cursor-grab group-hover:text-muted-foreground transition-colors" />
        {hasImage && (
          <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={generalCustom!.imageUrl!} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-0.5">
          {isMr ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">{item.rn}</span>
                {item.mrCode && <span className="text-xs text-muted-foreground">·</span>}
                {item.mrCode && <span className="text-xs font-medium truncate">{item.mrCode}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.engineType && <span className="text-xs text-muted-foreground truncate">{item.engineType}</span>}
                <span className="text-sm font-medium truncate">{item.engineNo}</span>
              </div>
            </>
          ) : (
            <div className="font-medium truncate text-sm">{item.engineNo}</div>
          )}
          {item.assignedTo && (
            <p className="text-xs text-muted-foreground truncate">{item.assignedTo.fullName}</p>
          )}
          {dueStr && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              {dueStr}
            </p>
          )}
          {daysLate != null && daysLate > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1" title="Rok je prošao, stavka nije u završnoj koloni">
              <Clock className="h-3 w-3 shrink-0" />
              Kasni {daysLate} {daysLate === 1 ? "dan" : "dana"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showQc && isMr && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onQcToggle?.(); }}
              disabled={!canEdit}
              className={cn(
                "shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors border",
                item.qcOk ? "bg-green-500 text-white border-green-600" : "bg-muted border-border",
                canEdit && "cursor-pointer hover:ring-2 hover:ring-primary/30"
              )}
              title={item.qcOk ? "QC OK (klik da ukloniš)" : "QC (klik da potvrdiš)"}
            >
              {item.qcOk ? "✓" : "—"}
            </button>
          )}
          {canEdit && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Ukloni stavku"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
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
  showQc,
  canEdit,
  onQcToggle,
  onRemove,
  daysLate,
}: {
  item: BatchItem;
  batchType: string;
  onClick: () => void;
  showQc?: boolean;
  canEdit?: boolean;
  onQcToggle?: () => void;
  onRemove?: () => void;
  daysLate?: number;
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
      className={cn(
        "cursor-grab active:cursor-grabbing transition-[opacity,transform,box-shadow] duration-300 ease-out",
        isDragging && "opacity-60 rotate-1 scale-105 shadow-lg z-50"
      )}
    >
      <ItemCardContent
        item={item}
        batchType={batchType}
        showQc={batchType === "MR_ENGINES"}
        canEdit={canEdit}
        onQcToggle={onQcToggle}
        onRemove={onRemove}
        daysLate={daysLate}
        className="hover:shadow-md"
      />
    </div>
  );
}

function DetailModal({
  item,
  batch,
  canEdit,
  columns,
  users,
  onClose,
  onSave,
  isSaving,
  t,
  tCommon,
}: {
  item: BatchItem | null;
  batch: Batch;
  canEdit: boolean;
  columns: ColumnDef[];
  users: { id: string; fullName: string | null; email: string }[];
  onClose: () => void;
  onSave: (itemId: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
  t: (k: string) => string;
  tCommon: (k: string) => string;
}) {
  const [rn, setRn] = useState(item?.rn ?? "");
  const [engineNo, setEngineNo] = useState(item?.engineNo ?? "");
  const [engineType, setEngineType] = useState(item?.engineType ?? "");
  const [mrCode, setMrCode] = useState(item?.mrCode ?? "");
  const [status, setStatus] = useState(item?.status ?? "");
  const [qcOk, setQcOk] = useState(item?.qcOk ?? false);
  const [details, setDetails] = useState(item?.details ?? "");
  const [priority, setPriority] = useState(item?.priority ?? "");
  const [assignedToId, setAssignedToId] = useState(item?.assignedTo?.id ?? "");
  const [startDate, setStartDate] = useState(item?.startDate ? item.startDate.slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(item?.dueDate ? item.dueDate.slice(0, 10) : "");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    if (item) {
      setRn(item.rn);
      setEngineNo(item.engineNo);
      setEngineType(item.engineType ?? "");
      setMrCode(item.mrCode ?? "");
      setStatus(item.status);
      setQcOk(item.qcOk ?? false);
      setDetails(item.details ?? "");
      setPriority(item.priority ?? "");
      setAssignedToId(item.assignedTo?.id ?? "");
      setStartDate(item.startDate ? String(item.startDate).slice(0, 10) : "");
      setDueDate(item.dueDate ? String(item.dueDate).slice(0, 10) : "");
      const custom = parseGeneralCustomData(item);
      setImageUrl(custom.imageUrl ?? "");
      setLinkUrl(custom.link ?? "");
    }
  }, [item?.id]);

  const handleSave = () => {
    if (!item) return;
    const title = engineNo.trim();
    const payload: Record<string, unknown> = {
      rn: batch.batchType === "GENERIC" ? title : rn.trim(),
      engineNo: title,
      engineType: engineType.trim() || null,
      mrCode: batch.batchType === "MR_ENGINES" ? (mrCode.trim() || null) : undefined,
      status,
      qcOk,
      details: details.trim() || null,
      priority: priority === SELECT_NONE || !priority ? null : priority,
      assignedToId: assignedToId === SELECT_NONE || !assignedToId ? null : assignedToId,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };
    if (batch.batchType === "GENERIC") {
      payload.customData = imageUrl.trim() || linkUrl.trim()
        ? { imageUrl: imageUrl.trim() || undefined, link: linkUrl.trim() || undefined }
        : null;
    }
    onSave(item.id, payload);
  };

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={onClose} onInteractOutside={onClose}>
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>
            {batch.batchType === "MR_ENGINES" && item.mrCode
              ? `${item.mrCode} · ${item.engineNo}`
              : item.engineNo}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-6">
          {batch.batchType === "GENERIC" ? (
            <div className="space-y-2">
              <Label>Naslov</Label>
              <Input value={engineNo} onChange={(e) => setEngineNo(e.target.value)} disabled={!canEdit} placeholder="Naslov stavke" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("rn")}</Label>
                <Input value={rn} onChange={(e) => setRn(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>{t("engineNo")} (Kod motora)</Label>
                <Input value={engineNo} onChange={(e) => setEngineNo(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          )}
          {batch.batchType === "MR_ENGINES" && (
            <>
              <div className="space-y-2">
                <Label>{t("mrCode")}</Label>
                <Input value={mrCode} onChange={(e) => setMrCode(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>{t("engineType")} (Tip motora)</Label>
                <Input value={engineType} onChange={(e) => setEngineType(e.target.value)} disabled={!canEdit} />
              </div>
              {(canEdit || item.qcOk) && (
                <div className="flex items-center gap-2">
                  <Checkbox id="qc" checked={qcOk} onCheckedChange={(c) => setQcOk(!!c)} disabled={!canEdit} />
                  <Label htmlFor="qc">{t("qcOk")}</Label>
                </div>
              )}
            </>
          )}
          {/* Datumi – uvek vidljivi */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Početak</Label>
              {canEdit ? (
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              ) : (
                <p className="text-sm py-2 text-muted-foreground">{startDate ? formatDate(startDate) : "—"}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Rok</Label>
              {canEdit ? (
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              ) : (
                <p className="text-sm py-2 text-muted-foreground">{dueDate ? formatDate(dueDate) : "—"}</p>
              )}
            </div>
          </div>
          {canEdit && (
            <>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("assignedTo")}</Label>
                <Select value={assignedToId || SELECT_NONE} onValueChange={(v) => setAssignedToId(v === SELECT_NONE ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Izaberi..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>—</SelectItem>
                    {users.map((u: PlannerUser) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Select value={priority || SELECT_NONE} onValueChange={(v) => setPriority(v === SELECT_NONE ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>—</SelectItem>
                    <SelectItem value="LOW">{t("priorityLow")}</SelectItem>
                    <SelectItem value="MEDIUM">{t("priorityMedium")}</SelectItem>
                    <SelectItem value="HIGH">{t("priorityHigh")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Napomene</Label>
                <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detalji..." />
              </div>
              {batch.batchType === "GENERIC" && (
                <>
                  <div className="space-y-2">
                    <Label>Slika (URL)</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                    {imageUrl.trim() && (
                      <div className="mt-2 rounded-lg border overflow-hidden bg-muted/30 max-w-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl.trim()} alt="" className="w-full h-32 object-cover object-center" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Link (URL)</Label>
                    <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                    {linkUrl.trim() && (
                      <a href={linkUrl.trim()} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                        {linkUrl.trim()}
                      </a>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {batch.batchType === "GENERIC" && !canEdit && (imageUrl.trim() || linkUrl.trim()) && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-muted-foreground">Prilozi</Label>
              {imageUrl.trim() && (
                <div className="rounded-lg border overflow-hidden bg-muted/30 max-w-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl.trim()} alt="" className="w-full h-32 object-cover object-center" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              )}
              {linkUrl.trim() && (
                <a href={linkUrl.trim()} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                  {linkUrl.trim()}
                </a>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="border-t pt-4 mt-auto">
          <Button variant="outline" onClick={onClose}>{tCommon("close")}</Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "..." : tCommon("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Timeline (Gantt) prikaz: stavke po vremenu, ko radi, kašnjenje. */
function PlannerTimelineView({
  batch,
  columns,
  items,
  onItemClick,
  getDaysLate,
}: {
  batch: Batch;
  columns: ColumnDef[];
  items: BatchItem[];
  onItemClick: (item: BatchItem) => void;
  getDaysLate: (item: BatchItem, cols: ColumnDef[]) => number;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates = items.flatMap((i) => {
      const start = i.startDate ? new Date(i.startDate).getTime() : null;
      const end = i.dueDate ? new Date(i.dueDate).getTime() : null;
      return [start, end].filter((x): x is number => x != null);
    });
    const pad = 30 * 86400000;
    const min = dates.length ? Math.min(...dates) : today - pad;
    const max = dates.length ? Math.max(...dates) : today + 90 * 86400000;
    return {
      rangeStart: Math.min(min, today - pad),
      rangeEnd: Math.max(max, today + pad),
    };
  }, [items, today]);

  const toPercent = (ts: number) => ((ts - rangeStart) / (rangeEnd - rangeStart)) * 100;
  const todayPercent = toPercent(today);

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <CalendarRange className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Timeline</p>
          <p className="text-xs text-muted-foreground">Pregled stavki po vremenu · klik na red za detalje</p>
        </div>
      </div>
      <div className="w-full">
        <div className="w-full min-w-0">
          {/* Vremenska os */}
          <div className="flex border-b bg-muted/20">
            <div className="w-40 shrink-0 py-2.5 pl-3 pr-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Stavka
            </div>
            <div className="flex-1 relative min-h-[32px] py-2 pr-3 pl-0 min-w-0">
              <div className="absolute inset-0 flex text-xs text-muted-foreground">
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => (
                  <span key={p} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${p * 100}%` }}>
                    {new Date(rangeStart + p * (rangeEnd - rangeStart)).toLocaleDateString("sr-RS", { month: "short", day: "numeric", year: "2-digit" })}
                  </span>
                ))}
              </div>
              {todayPercent >= 0 && todayPercent <= 100 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-green-500 z-10 shadow-sm"
                  style={{ left: `${todayPercent}%` }}
                  title="Danas"
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-green-600 dark:text-green-400 whitespace-nowrap">Danas</span>
                </div>
              )}
            </div>
          </div>
          {/* Redovi */}
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarRange className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nema stavki za prikaz na timeline-u.</p>
              <p className="text-xs text-muted-foreground mt-1">Dodajte stavke u tablo prikazu.</p>
            </div>
          ) : (
            items.map((item, idx) => {
              const startTs = item.startDate ? new Date(item.startDate).getTime() : rangeStart;
              const endTs = item.dueDate ? new Date(item.dueDate).getTime() : rangeEnd;
              const left = Math.max(0, toPercent(startTs));
              const width = Math.min(100 - left, toPercent(endTs) - left);
              const late = getDaysLate(item, columns);
              const colLabel = columns.find((c) => c.id === item.status)?.label;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex border-b border-border/50 last:border-b-0 transition-colors cursor-pointer group",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                    "hover:bg-primary/5"
                  )}
                  onClick={() => onItemClick(item)}
                >
                  <div className="w-40 shrink-0 py-2 pl-3 pr-2 flex flex-col gap-0.5 border-r border-border/50">
                    <span className="text-sm font-medium text-foreground truncate leading-tight">
                      {batch.batchType === "MR_ENGINES" ? (item.mrCode ? `${item.mrCode} · ` : "") + item.engineNo : item.engineNo}
                    </span>
                    {item.assignedTo && (
                      <span className="text-xs text-muted-foreground truncate">{item.assignedTo.fullName}</span>
                    )}
                    {colLabel && (
                      <span className="text-[10px] text-muted-foreground/80 truncate">{colLabel}</span>
                    )}
                    {late > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                        <Clock className="h-3 w-3 shrink-0" /> Kasni {late} {late === 1 ? "dan" : "dana"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 relative h-10 py-1.5 pr-3 pl-1 min-w-0">
                    <div className="absolute inset-y-0 right-0 left-0">
                      {todayPercent >= 0 && todayPercent <= 100 && (
                        <div className="absolute top-0 bottom-0 w-px bg-green-500/60 z-0" style={{ left: `${todayPercent}%` }} />
                      )}
                      <div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 h-6 rounded min-w-[6px] z-[1] shadow-sm transition-all",
                          "bg-primary/80 group-hover:bg-primary group-hover:shadow",
                          late > 0 && "ring-1 ring-red-400/60 bg-red-500/80 group-hover:bg-red-500/90"
                        )}
                        style={{ left: `${left}%`, width: `${Math.max(2, width)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
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
  const [addRn, setAddRn] = useState("");
  const [addEngineNo, setAddEngineNo] = useState("");
  const [addEngineType, setAddEngineType] = useState("");
  const [addMrCode, setAddMrCode] = useState("");
  const [addStartDate, setAddStartDate] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addDetails, setAddDetails] = useState("");
  const [addAssignedToId, setAddAssignedToId] = useState("");
  const [addPriority, setAddPriority] = useState("");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addLink, setAddLink] = useState("");
  const [detailItem, setDetailItem] = useState<BatchItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("slate");

  const { data: batch, isLoading } = useQuery({
    queryKey: ["export-batch", id],
    queryFn: () => fetchBatch(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["export-planner-users"],
    queryFn: async () => {
      const r = await fetch("/api/export-planner/users");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
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
    mutationFn: async (payload: {
      rn: string;
      engineNo: string;
      engineType?: string;
      mrCode?: string;
      status: string;
      startDate?: string | null;
      dueDate?: string | null;
      details?: string | null;
      assignedToId?: string | null;
      priority?: string | null;
      customData?: GeneralCustomData | null;
    }) => {
      const res = await fetch(`/api/export-planner/batches/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rn: payload.rn,
          engineNo: payload.engineNo,
          engineType: payload.engineType || null,
          mrCode: payload.mrCode || null,
          status: payload.status,
          startDate: payload.startDate || null,
          dueDate: payload.dueDate || null,
          details: payload.details || null,
          assignedToId: payload.assignedToId || null,
          priority: payload.priority || null,
          customData: payload.customData ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: (newItem: BatchItem) => {
      queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) => {
        if (!old) return old;
        const items = [...old.items, newItem].sort((a, b) => a.sortOrder - b.sortOrder);
        return { ...old, items };
      });
      setAddColumnId(null);
      setAddRn("");
      setAddEngineNo("");
      setAddEngineType("");
      setAddMrCode("");
      setAddStartDate("");
      setAddImageUrl("");
      setAddLink("");
      setAddDueDate("");
      setAddDetails("");
      setAddAssignedToId("");
      setAddPriority("");
      toast.success(t("addItem"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/export-planner/batches/${id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: (_, itemId) => {
      queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) => {
        if (!old) return old;
        return { ...old, items: old.items.filter((i) => i.id !== itemId) };
      });
      toast.success("Stavka uklonjena");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const freezeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/export-planner/batches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozenAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to freeze");
      return res.json();
    },
    onSuccess: (data: Batch) => {
      queryClient.setQueryData(["export-batch", id], data);
      toast.success(t("frozen"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) => {
      const res = await fetch(
        `/api/export-planner/batches/${id}/items?itemId=${itemId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (updatedItem: BatchItem) => {
      queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
        };
      });
      setDetailItem((prev) => (prev?.id === updatedItem.id ? updatedItem : prev));
      toast.success("Sačuvano");
    },
    onError: () => toast.error("Greška"),
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
    onSuccess: (updatedItem: BatchItem) => {
      queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
        };
      });
    },
    onError: () => toast.error("Greška pri premeštanju"),
  });

  const updateColumnsMutation = useMutation({
    mutationFn: async (newColumns: ColumnDef[]) => {
      const res = await fetch(`/api/export-planner/batches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: newColumns }),
      });
      if (!res.ok) throw new Error("Failed to update columns");
      return res.json();
    },
    onSuccess: (data: Batch) => {
      queryClient.setQueryData(["export-batch", id], data);
      toast.success("Kolone sačuvane");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const renderCard = useCallback(
    (item: BatchItem) => (
      <DraggableCard
        key={item.id}
        item={item}
        batchType={batch?.batchType ?? "MR_ENGINES"}
        showQc={batch?.batchType === "MR_ENGINES"}
        canEdit={canEdit}
        onClick={() => setDetailItem(item)}
        onQcToggle={() => updateItemMutation.mutate({ itemId: item.id, data: { qcOk: !item.qcOk } })}
        onRemove={() => deleteItemMutation.mutate(item.id)}
        daysLate={getDaysLate(item, columns)}
      />
    ),
    [batch?.batchType, canEdit, columns, updateItemMutation, deleteItemMutation]
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const activeIdStr = String(e.active.id);
      let overId = e.over?.id ? String(e.over.id) : null;

      if (activeIdStr.startsWith(COLUMN_PREFIX)) {
        // Normalizuj: over može biti col-X (sortable) ili X (droppable unutra) – oba znače kolonu X
        const overColumnId =
          overId?.startsWith(COLUMN_PREFIX)
            ? overId
            : columns.some((c) => c.id === overId)
              ? COLUMN_PREFIX + overId
              : null;
        if (overColumnId) {
          const oldIndex = columns.findIndex((c) => COLUMN_PREFIX + c.id === activeIdStr);
          const newIndex = columns.findIndex((c) => COLUMN_PREFIX + c.id === overColumnId);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
            queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) =>
              old ? { ...old, columns: JSON.stringify(reordered) } : old
            );
            updateColumnsMutation.mutate(reordered);
          }
        }
        return;
      }

      const itemId = activeIdStr;
      if (!overId) return;
      let colId = columns.some((c) => c.id === overId) ? overId : null;
      if (!colId) {
        const overItem = batch?.items.find((i) => i.id === overId);
        colId = overItem?.status ?? null;
      }
      if (!colId) return;
      const item = batch?.items.find((i) => i.id === itemId);
      if (!item || item.status === colId) return;
      queryClient.setQueryData(["export-batch", id], (old: Batch | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i) => (i.id === itemId ? { ...i, status: colId } : i)),
        };
      });
      updateStatusMutation.mutate({ itemId, status: colId });
    },
    [id, batch?.items, columns, queryClient, updateStatusMutation, updateColumnsMutation]
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
    <div className="p-6 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" asChild>
          <Link href={batch.batchType === "MR_ENGINES" ? "/export-planner/izvoz" : "/export-planner/general"}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {batch.customName || batch.batchCode}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {batch.frozenAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2.5 py-0.5 text-xs font-medium">
                <Lock className="h-3 w-3" />
                {t("frozen")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-2.5 py-0.5 text-xs font-medium">
                <LockOpen className="h-3 w-3" />
                {t("unfrozen")}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {batch.batchType === "MR_ENGINES"
                ? `${batch.items.length} ${t("items")} • ${batch.items.filter((i) => i.status === "IZVOZ").length} ${t("exportCount")}`
                : `${batch.items.length} ${t("itemsGeneric")}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setNewColumnLabel(""); setNewColumnColor("slate"); setAddColumnDialogOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Dodaj novu kolonu
              </Button>
              <Button size="sm" variant="outline" onClick={() => freezeMutation.mutate()} disabled={freezeMutation.isPending}>
                <Lock className="h-4 w-4 mr-1" />
                {t("freeze")}
              </Button>
            </>
          )}
          {batch.batchType === "MR_ENGINES" && (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/export-planner/batches/${id}/print-dado`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4 mr-1" />
                  {t("printDado")}
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/export-planner/batches/${id}/print-final`} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-1" />
                  {t("printFinal")}
                </a>
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/export-planner/batches/${id}/export-csv`} download>
              <Download className="h-4 w-4 mr-1" />
              {t("exportCsv")}
            </a>
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={columnAwareCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-6 min-h-[400px]">
          {columns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[320px] rounded-xl border-2 border-dashed bg-muted/30 p-8">
              <p className="text-muted-foreground mb-4">Nema kolona. Dodaj prvu kolonu da kreneš.</p>
              <Button onClick={() => { setNewColumnLabel(""); setNewColumnColor("slate"); setAddColumnDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj novu kolonu
              </Button>
            </div>
          ) : (
            <SortableContext items={columns.map((c) => COLUMN_PREFIX + c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((col) => (
                <SortableColumn
                  key={col.id}
                  col={col}
                  items={itemsByColumn[col.id] ?? []}
                  canEdit={canEdit}
                  onAddClick={() => setAddColumnId(col.id)}
                  addLabel={t("addItem")}
                  onLabelChange={(newLabel) => {
                    const next = columns.map((c) => (c.id === col.id ? { ...c, label: newLabel } : c));
                    updateColumnsMutation.mutate(next);
                  }}
                  onRemoveColumn={() => {
                    if ((itemsByColumn[col.id] ?? []).length > 0) return;
                    const next = columns.filter((c) => c.id !== col.id).map((c, i) => ({ ...c, order: i }));
                    updateColumnsMutation.mutate(next);
                  }}
                  columnItemCount={(itemsByColumn[col.id] ?? []).length}
                  renderCard={renderCard}
                />
              ))}
            </SortableContext>
          )}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 350,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          {activeId?.startsWith(COLUMN_PREFIX) ? (() => {
            const col = columns.find((c) => COLUMN_PREFIX + c.id === activeId);
            if (!col) return null;
            const colClass = colorMap[col.color] || colorMap.slate;
            return (
              <div
                className={cn(
                  "flex flex-col min-w-[280px] w-[280px] rounded-lg border-2 border-primary shadow-2xl cursor-grabbing opacity-95 scale-[1.02] ring-4 ring-primary/20",
                  colClass
                )}
              >
                <div className="relative z-20 shrink-0 px-3 py-3 font-medium flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur rounded-t-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm uppercase tracking-wide truncate flex-1 text-center">{col.label}</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{(itemsByColumn[col.id] ?? []).length}</span>
                </div>
                <div className="p-3 flex-1 min-h-[120px] rounded-b-lg" />
              </div>
            );
          })() : activeItem ? (
            <div className="w-72 shadow-xl opacity-95 cursor-grabbing will-change-transform transition-transform duration-200 ease-out">
              <ItemCardContent item={activeItem} batchType={batch.batchType} showQc={batch.batchType === "MR_ENGINES"} daysLate={getDaysLate(activeItem, columns)} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-8">
        <PlannerTimelineView
          batch={batch}
          columns={columns}
          items={[...batch.items].sort((a, b) => a.sortOrder - b.sortOrder)}
          onItemClick={setDetailItem}
          getDaysLate={getDaysLate}
        />
      </div>

      {/* Add item dialog – MR: MR Code, RN, Kod, Tip, datumi, opis, dodela; General: naslov, prioritet, opis, dodela */}
      <Dialog open={!!addColumnId} onOpenChange={(o) => !o && setAddColumnId(null)}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={() => setAddColumnId(null)}
          onInteractOutside={() => setAddColumnId(null)}
        >
          <DialogHeader>
            <DialogTitle>{t("addItem")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {batch.batchType === "MR_ENGINES" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("mrCode")}</Label>
                    <Input value={addMrCode} onChange={(e) => setAddMrCode(e.target.value)} placeholder="MR Code" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("rn")}</Label>
                    <Input value={addRn} onChange={(e) => setAddRn(e.target.value)} placeholder="RN" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("engineNo")} (Kod motora)</Label>
                    <Input value={addEngineNo} onChange={(e) => setAddEngineNo(e.target.value)} placeholder="Kod motora" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("engineType")} (Tip motora)</Label>
                    <Input value={addEngineType} onChange={(e) => setAddEngineType(e.target.value)} placeholder="Tip motora" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datum početka</Label>
                    <Input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Datum završetka</Label>
                    <Input type="date" value={addDueDate} onChange={(e) => setAddDueDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Opis / napomene</Label>
                  <Textarea value={addDetails} onChange={(e) => setAddDetails(e.target.value)} placeholder="Dodatni opis..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>{t("assignedTo")}</Label>
                  <Select value={addAssignedToId || SELECT_NONE} onValueChange={(v) => setAddAssignedToId(v === SELECT_NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Izaberi korisnika..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>—</SelectItem>
                      {users.map((u: PlannerUser) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Naslov stavke</Label>
                  <Input value={addEngineNo} onChange={(e) => setAddEngineNo(e.target.value)} placeholder="npr. Zadatak 1" />
                </div>
                <div className="space-y-2">
                  <Label>Prioritet</Label>
                  <Select value={addPriority || SELECT_NONE} onValueChange={(v) => setAddPriority(v === SELECT_NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>—</SelectItem>
                      <SelectItem value="LOW">{t("priorityLow")}</SelectItem>
                      <SelectItem value="MEDIUM">{t("priorityMedium")}</SelectItem>
                      <SelectItem value="HIGH">{t("priorityHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Opis</Label>
                  <Textarea value={addDetails} onChange={(e) => setAddDetails(e.target.value)} placeholder="Opis zadatka..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Slika (URL)</Label>
                  <Input
                    value={addImageUrl}
                    onChange={(e) => setAddImageUrl(e.target.value)}
                    placeholder="https://... (opciono)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link (URL)</Label>
                  <Input
                    value={addLink}
                    onChange={(e) => setAddLink(e.target.value)}
                    placeholder="https://... (opciono)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("assignedTo")}</Label>
                  <Select value={addAssignedToId || SELECT_NONE} onValueChange={(v) => setAddAssignedToId(v === SELECT_NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Izaberi..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>—</SelectItem>
                      {users.map((u: PlannerUser) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnId(null)}>{tCommon("cancel")}</Button>
            <Button
              onClick={() => {
                if (!addColumnId) return;
                const engineNo = addEngineNo.trim();
                const rn = batch.batchType === "MR_ENGINES" ? addRn.trim() || engineNo : engineNo || `RN-${Date.now()}`;
                if (!engineNo && batch.batchType === "GENERIC") return;
                if (batch.batchType === "MR_ENGINES" && !rn) return;
                addMutation.mutate({
                  rn,
                  engineNo: engineNo || rn,
                  engineType: addEngineType.trim() || undefined,
                  mrCode: addMrCode.trim() || undefined,
                  status: addColumnId,
                  startDate: addStartDate || null,
                  dueDate: addDueDate || null,
                  details: addDetails.trim() || null,
                  assignedToId: (addAssignedToId === SELECT_NONE || !addAssignedToId) ? null : addAssignedToId,
                  priority: (addPriority === SELECT_NONE || !addPriority) ? null : addPriority,
                  customData: batch.batchType === "GENERIC"
                    ? (addImageUrl.trim() || addLink.trim()
                        ? { imageUrl: addImageUrl.trim() || undefined, link: addLink.trim() || undefined }
                        : null)
                    : undefined,
                });
              }}
              disabled={(batch.batchType === "MR_ENGINES" ? !addRn.trim() || !addEngineNo.trim() : !addEngineNo.trim()) || addMutation.isPending}
            >
              {addMutation.isPending ? "..." : tCommon("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dodaj novu kolonu – naziv + boja */}
      <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
        <DialogContent
          className="max-w-sm"
          onPointerDownOutside={() => setAddColumnDialogOpen(false)}
          onInteractOutside={() => setAddColumnDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>Dodaj novu kolonu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Naziv kolone</Label>
              <Input
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                placeholder="npr. U reviziji"
              />
            </div>
            <div className="space-y-2">
              <Label>Boja</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColumnColor(c)}
                    className={cn(
                      "h-9 w-9 rounded-full border-2 transition-all shrink-0",
                      newColumnColor === c
                        ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background ring-foreground/30"
                        : "border-transparent hover:scale-105",
                      c === "slate" && "bg-slate-500",
                      c === "blue" && "bg-blue-500",
                      c === "green" && "bg-green-500",
                      c === "amber" && "bg-amber-500",
                      c === "rose" && "bg-rose-500",
                      c === "violet" && "bg-violet-500"
                    )}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnDialogOpen(false)}>{tCommon("cancel")}</Button>
            <Button
              onClick={() => {
                const label = newColumnLabel.trim() || "Nova kolona";
                const newCol: ColumnDef = { id: `COL_${Date.now()}`, label, order: columns.length, color: newColumnColor };
                updateColumnsMutation.mutate([...columns, newCol]);
                setAddColumnDialogOpen(false);
                setNewColumnLabel("");
                setNewColumnColor("slate");
              }}
              disabled={updateColumnsMutation.isPending}
            >
              {updateColumnsMutation.isPending ? "..." : tCommon("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog – pun pregled i edit */}
      {detailItem && (
      <DetailModal
        item={detailItem}
        batch={batch}
        canEdit={canEdit}
        columns={columns}
        users={users}
        onClose={() => setDetailItem(null)}
        onSave={(itemId, data) => updateItemMutation.mutate({ itemId, data })}
        isSaving={updateItemMutation.isPending}
        t={t}
        tCommon={tCommon}
      />
      )}
    </div>
  );
}
