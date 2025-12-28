"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function NewClaimPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: "NEW",
    claimCodeRaw: "",
    customerName: "",
    engineType: "",
    mrEngineCode: "",
    summarySr: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First, create customer if name is provided
      let customerId = null;
      if (formData.customerName.trim()) {
        const customerRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.customerName }),
        });
        const customerData = await customerRes.json();
        if (customerData.customer) {
          customerId = customerData.customer.id;
        }
      }

      // Create claim
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: formData.status,
          claimCodeRaw: formData.claimCodeRaw,
          customerId,
          engineType: formData.engineType,
          mrEngineCode: formData.mrEngineCode,
          summarySr: formData.summarySr,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.claim && data.claim.id) {
          // Notify dashboard to refresh
          window.dispatchEvent(new Event('claim-created'));
          router.push(`/claims/${data.claim.id}`);
        } else {
          alert("Failed to create claim: Invalid response");
        }
      } else {
        const errorData = await res.json();
        alert("Failed to create claim: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error creating claim:", error);
      alert("Failed to create claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">New Claim</h1>
        <Button variant="outline" onClick={() => router.push("/claims")}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label>Claim Code</Label>
              <Input
                value={formData.claimCodeRaw}
                onChange={(e) => setFormData({ ...formData, claimCodeRaw: e.target.value })}
                placeholder="MR1234/25"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="IN_ANALYSIS">In Analysis</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Customer Name</Label>
              <Input
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Customer name"
              />
            </div>

            <div>
              <Label>Engine Type</Label>
              <Input
                value={formData.engineType}
                onChange={(e) => setFormData({ ...formData, engineType: e.target.value })}
                placeholder="Engine type"
              />
            </div>

            <div>
              <Label>MR Engine Code</Label>
              <Input
                value={formData.mrEngineCode}
                onChange={(e) => setFormData({ ...formData, mrEngineCode: e.target.value })}
                placeholder="MR Engine Code"
              />
            </div>

            <div>
              <Label>Summary (Serbian)</Label>
              <Textarea
                value={formData.summarySr}
                onChange={(e) => setFormData({ ...formData, summarySr: e.target.value })}
                placeholder="Claim summary in Serbian"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Claim"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/claims")}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}

