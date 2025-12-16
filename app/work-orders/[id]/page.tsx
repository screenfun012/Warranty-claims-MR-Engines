"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface WorkOrder {
  id: string;
  workOrderCode: string;
  engineType: string | null;
  mrEngineCode: string | null;
  worker: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  assemblyDate: string | null;
  nasFolderPath: string | null;
  claims: Array<{
    id: string;
    claimCodeRaw: string | null;
    status: string;
    customer: {
      id: string;
      name: string;
    } | null;
    assignedTo: {
      id: string;
      fullName: string;
    } | null;
    createdAt: string;
  }>;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IN_ANALYSIS: "bg-yellow-100 text-yellow-800",
  WAITING_CUSTOMER: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchWorkOrder();
    }
  }, [params.id]);

  const fetchWorkOrder = async () => {
    try {
      const res = await fetch(`/api/work-orders/${params.id}`);
      const data = await res.json();
      setWorkOrder(data.workOrder);
    } catch (error) {
      console.error("Error fetching work order:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-8">
        <p>Work order not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Work Order: {workOrder.workOrderCode}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/work-orders")}>
          Back to Work Orders
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Details</h2>
          <div className="space-y-2">
            <div>
              <strong>Engine Type:</strong> {workOrder.engineType || "-"}
            </div>
            <div>
              <strong>MR Engine Code:</strong> {workOrder.mrEngineCode || "-"}
            </div>
            {workOrder.worker && (
              <div>
                <strong>Worker:</strong> {workOrder.worker.fullName} ({workOrder.worker.email})
              </div>
            )}
            {workOrder.assemblyDate && (
              <div>
                <strong>Assembly Date:</strong> {new Date(workOrder.assemblyDate).toLocaleDateString()}
              </div>
            )}
            {workOrder.nasFolderPath && (
              <div>
                <strong>NAS Folder Path:</strong> {workOrder.nasFolderPath}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Claims for this Work Order</h2>
        {workOrder.claims.length === 0 ? (
          <p className="text-muted-foreground">No claims found for this work order</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrder.claims.map((claim) => (
                <TableRow
                  key={claim.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/claims/${claim.id}`)}
                >
                  <TableCell className="font-medium">
                    {claim.claimCodeRaw || "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[claim.status] || ""}>
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{claim.customer?.name || "-"}</TableCell>
                  <TableCell>{claim.assignedTo?.fullName || "-"}</TableCell>
                  <TableCell>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

