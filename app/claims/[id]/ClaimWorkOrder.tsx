"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface ClaimWorkOrderProps {
  claim: any;
}

export function ClaimWorkOrder({ claim }: ClaimWorkOrderProps) {
  const router = useRouter();
  const t = useTranslations();

  if (!claim.workOrder) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">{t("claims.workOrder.noWorkOrder")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">
        {t("claims.workOrder.title")}: {claim.workOrder.workOrderCode}
      </h2>
      <div className="space-y-2">
        <div>
          <strong>{t("claims.workOrder.engineType")}:</strong> {claim.workOrder.engineType || "-"}
        </div>
        <div>
          <strong>{t("claims.workOrder.mrEngineCode")}:</strong> {claim.workOrder.mrEngineCode || "-"}
        </div>
        {claim.workOrder.worker && (
          <div>
            <strong>{t("claims.workOrder.worker")}:</strong> {claim.workOrder.worker.fullName}
          </div>
        )}
        {claim.workOrder.assemblyDate && (
          <div>
            <strong>{t("claims.workOrder.assemblyDate")}:</strong> {new Date(claim.workOrder.assemblyDate).toLocaleDateString()}
          </div>
        )}
      </div>
      <Button
        className="mt-4"
        onClick={() => router.push(`/work-orders/${claim.workOrder.id}`)}
      >
        {t("claims.workOrder.openWorkOrder")}
      </Button>
    </Card>
  );
}

