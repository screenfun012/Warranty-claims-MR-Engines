"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutList, ListTodo, AlertCircle, ExternalLink } from "lucide-react";
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

function isLate(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today && due.toDateString() !== today.toDateString();
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

  const lateItems = items.filter((i) => isLate(i.dueDate));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">{t("plannerOverview")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{tPlanner("overviewSubtitle")}</p>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
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
            <div className="py-8 text-center text-muted-foreground">
              <p className="font-medium">{tPlanner("noAssignments")}</p>
              <p className="text-sm mt-1">{tPlanner("noAssignmentsHint")}</p>
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
    </div>
  );
}
