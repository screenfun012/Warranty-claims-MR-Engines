"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, List, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sr } from "date-fns/locale";

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
  const tPlanner = useTranslations("exportPlanner");

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["export-planner-my-assignments"],
    queryFn: fetchMyAssignments,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["export-planner-activity"],
    queryFn: fetchActivity,
  });

  const batches = assignments?.batches ?? [];
  const activity = activityData?.activity ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("plannerOverview")}</h1>
        <p className="text-muted-foreground mt-1">
          Liste u kojima si uključen i nedavna aktivnost
        </p>
      </div>

      <Card>
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
              {batches.map((b: { id: string; customName: string | null; batchCode: string; myAssignedCount: number; frozenAt: string | null }) => (
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

      <Card>
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
              {activity.map((e: { id: string; action: string; createdAt: string; batch: { customName: string; batchCode: string } | null; details: string | null }) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 py-2 border-b last:border-0 text-sm"
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: sr })}
                  </span>
                  <span>{ACTION_LABELS[e.action] || e.action}</span>
                  {e.batch && "id" in e.batch && (
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
  );
}
