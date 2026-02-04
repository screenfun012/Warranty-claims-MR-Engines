"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Cog } from "lucide-react";

export default function PlannerSettingsPage() {
  const t = useTranslations("nav");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("plannerSettings")}</h1>
      <Card className="p-12 text-center">
        <Cog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Podešavanja planera – u pripremi</p>
      </Card>
    </div>
  );
}
