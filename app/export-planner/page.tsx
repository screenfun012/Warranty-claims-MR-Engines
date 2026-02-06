"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ExportPlannerPage() {
  const router = useRouter();
  const t = useTranslations("exportPlanner");
  useEffect(() => {
    router.replace("/export-planner/izvoz");
  }, [router]);
  return (
    <div className="p-6 flex items-center justify-center min-h-[200px]">
      <p className="text-muted-foreground">{t("redirecting")}</p>
    </div>
  );
}
