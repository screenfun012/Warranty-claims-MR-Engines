"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  claimCount: number;
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchWorkOrders();
  }, [search]);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      const res = await fetch(`/api/work-orders?${params.toString()}`);
      const data = await res.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Work Orders</h1>

      <Card className="p-4 mb-6">
        <Label>Search by Work Order Code</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Enter work order code..."
          className="mt-2"
        />
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Work Order Code</TableHead>
              <TableHead>Engine Type</TableHead>
              <TableHead>MR Engine Code</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Assembly Date</TableHead>
              <TableHead>Claims</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No work orders found
                </TableCell>
              </TableRow>
            ) : (
              workOrders.map((wo) => (
                <TableRow
                  key={wo.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/work-orders/${wo.id}`)}
                >
                  <TableCell className="font-medium">{wo.workOrderCode}</TableCell>
                  <TableCell>{wo.engineType || "-"}</TableCell>
                  <TableCell>{wo.mrEngineCode || "-"}</TableCell>
                  <TableCell>{wo.worker?.fullName || "-"}</TableCell>
                  <TableCell>
                    {wo.assemblyDate ? new Date(wo.assemblyDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>{wo.claimCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

