"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ClaimWorkOrderProps {
  claim: any;
}

export function ClaimWorkOrder({ claim }: ClaimWorkOrderProps) {
  const router = useRouter();

  if (!claim.workOrder) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No work order linked to this claim</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Work Order: {claim.workOrder.workOrderCode}</h2>
      <div className="space-y-2">
        <div>
          <strong>Engine Type:</strong> {claim.workOrder.engineType || "-"}
        </div>
        <div>
          <strong>MR Engine Code:</strong> {claim.workOrder.mrEngineCode || "-"}
        </div>
        {claim.workOrder.worker && (
          <div>
            <strong>Worker:</strong> {claim.workOrder.worker.fullName}
          </div>
        )}
        {claim.workOrder.assemblyDate && (
          <div>
            <strong>Assembly Date:</strong> {new Date(claim.workOrder.assemblyDate).toLocaleDateString()}
          </div>
        )}
      </div>
      <Button
        className="mt-4"
        onClick={() => router.push(`/work-orders/${claim.workOrder.id}`)}
      >
        Open Work Order Page
      </Button>
    </Card>
  );
}

