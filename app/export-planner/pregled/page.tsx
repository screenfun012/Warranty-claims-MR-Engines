"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutList, ListTodo, AlertCircle, ExternalLink, Truck, LayoutDashboard, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = { assignedCount: number; lateCount: number };
type AssignmentItem = {
  id: string;
  rn: string;
  engineNo: string;
  status: string;
  dueDate: string | null;
  batchId: string;
  batchCode?: string;
  customName?: string | null;
};

type BatchSummary = { id: string; batchCode: string; customName: string | null; batchType: string };
type ActivityEntry = {
  id: string;
  batchId: string;
  action: string;
  createdAt: string;
  batch: { id: string; batchCode: string; customName: string | null } | null;
};

const fetchSummary = async (): Promise<Summary> => {
  const res = await fetch("/api/export-planner/my-summary");
  if (!res.ok) return { assignedCount: 0, lateCount: 0 };
  return res.json();
};

const fetchAssignments = async (): Promise<AssignmentItem[]> => {
  const res = await fetch("/api/export-planner/my-assignments");
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
};

const fetchBatches = async (batchType: string): Promise<BatchSummary[]> => {
  const res = await fetch(`/api/export-planner/batches?batchType=${batchType}`);
  if (!res.ok) return [];
  return res.json();
};

const fetchActivity = async (): Promise<ActivityEntry[]> => {
  const res = await fetch("/api/export-planner/activity?limit=15");
  if (!res.ok) return [];
  const data = await res.json();
  return data.activity ?? [];
};

function isLate(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    BATCH_CREATED: "Lista kreirana",
    BATCH_FROZEN: "Lista zaključana",
    BATCH_DELETED: "Lista obrisana",
    ITEM_ADDED: "Stavka dodata",
    ITEM_REMOVED: "Stavka uklonjena",
  };
  return map[action] || action;
}

export default function PlannerOverviewPage() {
  const t = useTranslations("nav");
  const tPlanner = useTranslations("exportPlanner");

  const { data: summary = { assignedCount: 0, lateCount: 0 }, isLoading: summaryLoading } = useQuery({
    queryKey: ["export-planner-my-summary"],
    queryFn: fetchSummary,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["export-planner-my-assignments"],
    queryFn: fetchAssignments,
  });

  const { data: exportBatches = [] } = useQuery({
    queryKey: ["export-planner-batches", "MR_ENGINES"],
    queryFn: () => fetchBatches("MR_ENGINES"),
  });

  const { data: generalBatches = [] } = useQuery({
    queryKey: ["export-planner-batches", "GENERIC"],
    queryFn: () => fetchBatches("GENERIC"),
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["export-planner-activity"],
    queryFn: fetchActivity,
  });

  const lateItems = items.filter((i) => isLate(i.dueDate));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const dueThisMonth = items.filter((i) => {
    if (!i.dueDate) return false;
    const d = new Date(i.dueDate);
    return d >= startOfMonth && d <= endOfMonth;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t("plannerOverview")}</h1>
        <p className="text-muted-foreground text-sm mb-2">{tPlanner("overviewSubtitle")}</p>
        <p className="text-muted-foreground text-xs max-w-xl">{tPlanner("overviewConnectionHint")}</p>
      </div>

      {/* Brzi linkovi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{tPlanner("quickLinks")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/export-planner/izvoz">
              <Truck className="h-4 w-4" />
              {t("plannerExport")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/export-planner/general">
              <LayoutDashboard className="h-4 w-4" />
              {t("plannerGeneral")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tPlanner("assignedCount")}</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <span className="text-2xl font-bold">{summary.assignedCount}</span>
            )}
          </CardContent>
        </Card>
        <Card className={lateItems.length > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tPlanner("lateCount")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <span className={cn("text-2xl font-bold", lateItems.length > 0 && "text-destructive")}>
                {summary.lateCount}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rokovi – ovaj mesec */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tPlanner("dueThisMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            {dueThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tPlanner("noItemsDueThisMonth")}</p>
            ) : (
              <ul className="space-y-1.5">
                {dueThisMonth.slice(0, 10).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{i.rn || i.engineNo}</span>
                    <span className="text-muted-foreground">
                      {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : ""}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/export-planner/${i.batchId}`} className="gap-1 shrink-0">
                        {i.customName || i.batchCode}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </li>
                ))}
                {dueThisMonth.length > 10 && (
                  <li className="text-muted-foreground text-xs pt-1">
                    +{dueThisMonth.length - 10} još
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Moja zaduženja */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutList className="h-5 w-5" />
            {tPlanner("myAssignments")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <p className="font-medium">{tPlanner("noAssignments")}</p>
              <p className="text-sm mt-1">{tPlanner("noAssignmentsHint")}</p>
              <Button asChild variant="link" size="sm" className="mt-3">
                <Link href="/export-planner/izvoz">{tPlanner("viewAll")} →</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{tPlanner("rn")}</th>
                    <th className="text-left py-2 font-medium">{tPlanner("engineNo")}</th>
                    <th className="text-left py-2 font-medium">{tPlanner("status")}</th>
                    <th className="text-left py-2 font-medium">{tPlanner("dueDateLabel")}</th>
                    <th className="text-left py-2 font-medium">{tPlanner("openBatch")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className={cn("border-b border-border/50", isLate(i.dueDate) && "bg-destructive/5")}>
                      <td className="py-2">{i.rn}</td>
                      <td className="py-2">{i.engineNo}</td>
                      <td className="py-2">{i.status}</td>
                      <td className="py-2">
                        {i.dueDate ? (
                          <span className={cn(isLate(i.dueDate) && "text-destructive font-medium")}>
                            {new Date(i.dueDate).toLocaleDateString()}
                            {isLate(i.dueDate) && ` (${tPlanner("late")})`}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/export-planner/${i.batchId}`} className="gap-1">
                            {i.customName || i.batchCode || i.batchId}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste za izvoz + General (prvih nekoliko sa linkom Sve) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{tPlanner("exportLists")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/export-planner/izvoz">{tPlanner("viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {exportBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tPlanner("noExportPlanners")}</p>
            ) : (
              <ul className="space-y-1.5">
                {exportBatches.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/export-planner/${b.id}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {b.customName || b.batchCode}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  </li>
                ))}
                {exportBatches.length > 8 && (
                  <li>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
                      <Link href="/export-planner/izvoz">+ {exportBatches.length - 8} …</Link>
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{tPlanner("generalLists")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/export-planner/general">{tPlanner("viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {generalBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tPlanner("noGeneralPlanners")}</p>
            ) : (
              <ul className="space-y-1.5">
                {generalBatches.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/export-planner/${b.id}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {b.customName || b.batchCode}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  </li>
                ))}
                {generalBatches.length > 8 && (
                  <li>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
                      <Link href="/export-planner/general">+ {generalBatches.length - 8} …</Link>
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nedavna aktivnost */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {tPlanner("recentActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{tPlanner("noActivity")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  {e.batch && (
                    <Link
                      href={`/export-planner/${e.batchId}`}
                      className="text-primary hover:underline"
                    >
                      {e.batch.customName || e.batch.batchCode}
                    </Link>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
