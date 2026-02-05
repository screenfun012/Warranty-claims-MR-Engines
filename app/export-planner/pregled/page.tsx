"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { List, Activity, FolderPlus, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sr } from "date-fns/locale";

type BatchFromList = {
  id: string;
  batchCode: string;
  customName: string | null;
  batchType?: string;
  exportDate?: string;
  frozenAt: string | null;
  _count?: { items: number };
  exportCount?: number;
};

type AssignmentBatch = {
  id: string;
  customName: string | null;
  batchCode: string;
  myAssignedCount: number;
  frozenAt: string | null;
};

type AssignedItem = {
  id: string;
  rn: string;
  engineNo: string;
  status: string;
  details: string | null;
  dueDate: string | null;
  batch: { id: string; customName: string | null; batchCode: string };
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Kreirana lista",
  FROZEN: "Zamrznuto",
  UNFROZEN: "Odmrznuto",
  ITEM_ADDED: "Dodata stavka",
  ITEM_REMOVED: "Uklonjena stavka",
  STATUS_CHANGED: "Promena statusa",
  QC_CHECKED: "QC provereno",
  ITEM_ASSIGNED: "Dodeljena stavka",
  OVERRIDE: "Admin override",
};

const fetchMyCreatedBatches = async (): Promise<BatchFromList[]> => {
  const res = await fetch("/api/export-planner/batches?mine=1");
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

const fetchMyAssignments = async () => {
  const res = await fetch("/api/export-planner/my-assignments");
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

const fetchActivity = async () => {
  const res = await fetch("/api/export-planner/activity?limit=20");
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

export default function PlannerOverviewPage() {
  const t = useTranslations("nav");

  const { data: myCreatedBatches = [], isLoading: myCreatedLoading } = useQuery({
    queryKey: ["export-planner-batches", "mine"],
    queryFn: fetchMyCreatedBatches,
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["export-planner-my-assignments"],
    queryFn: fetchMyAssignments,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["export-planner-activity"],
    queryFn: fetchActivity,
  });

  const batches = assignments?.batches ?? [];
  const items = assignments?.items ?? [];
  const activity = activityData?.activity ?? [];

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom_right,var(--muted)/0.15,transparent_50%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0/.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0/.02)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
      <div className="relative p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{t("plannerOverview")}</h1>
          <p className="text-muted-foreground mt-1">
            Liste koje si kreirao, stavke dodeljene tebi i nedavna aktivnost
          </p>
        </div>

        {/* Liste koje sam kreirao */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Liste koje sam kreirao
            </h2>
          </CardHeader>
          <CardContent>
            {myCreatedLoading ? (
              <p className="text-muted-foreground">Učitavanje...</p>
            ) : myCreatedBatches.length === 0 ? (
              <p className="text-muted-foreground">Nisi kreirao nijednu listu.</p>
            ) : (
              <div className="grid gap-3">
                {myCreatedBatches.map((b: BatchFromList) => (
                  <Link key={b.id} href={`/export-planner/${b.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <span className="font-medium">{b.customName || b.batchCode}</span>
                      <span className="text-sm text-muted-foreground">
                        {b._count?.items ?? 0} stavki
                        {b.frozenAt && " · Zaključano"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liste u kojima sam dodeljen */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <List className="h-5 w-5" />
              Liste u kojima sam dodeljen
            </h2>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <p className="text-muted-foreground">Učitavanje...</p>
            ) : batches.length === 0 ? (
              <p className="text-muted-foreground">Nisi dodeljen ni na jednu listu.</p>
            ) : (
              <div className="grid gap-3">
                {batches.map((b: AssignmentBatch) => (
                  <Link key={b.id} href={`/export-planner/${b.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <span className="font-medium">{b.customName || b.batchCode}</span>
                      <span className="text-sm text-muted-foreground">
                        {b.myAssignedCount} tvojih stavki
                        {b.frozenAt && " · Zaključano"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stavke dodeljene meni */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Stavke dodeljene meni
            </h2>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <p className="text-muted-foreground">Učitavanje...</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground">Nema stavki dodeljenih tebi.</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {items.map((item: AssignedItem) => (
                  <Link
                    key={item.id}
                    href={`/export-planner/${item.batch.id}`}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                  >
                    <span className="font-medium truncate">
                      {item.engineNo || item.rn}
                      {item.details ? ` · ${item.details}` : ""}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {item.batch.customName || item.batch.batchCode}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nedavna aktivnost */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Nedavna aktivnost
            </h2>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <p className="text-muted-foreground">Učitavanje...</p>
            ) : activity.length === 0 ? (
              <p className="text-muted-foreground">Nema nedavne aktivnosti.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((e: { id: string; action: string; createdAt: string; batch: { id?: string; customName: string; batchCode: string } | null; details: string | null }) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0 text-sm"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: sr })}
                    </span>
                    <span>{ACTION_LABELS[e.action] || e.action}</span>
                    {e.batch && "id" in e.batch && e.batch.id && (
                      <Link
                        href={`/export-planner/${e.batch.id}`}
                        className="text-primary hover:underline shrink-0"
                      >
                        {e.batch.customName || e.batch.batchCode}
                      </Link>
                    )}
                    {e.details && (
                      <span className="text-muted-foreground truncate flex-1">{e.details}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
