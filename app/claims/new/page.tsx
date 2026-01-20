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
    customerCompany: "",
    yearEngineDone: "",
    engineType: "",
    mrEngineCode: "",
    summarySr: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (!formData.claimCodeRaw.trim()) {
      newErrors.claimCodeRaw = "Claim Code is required";
    }
    if (!formData.customerCompany.trim()) {
      newErrors.customerCompany = "Customer Company is required";
    }
    if (!formData.yearEngineDone.trim()) {
      newErrors.yearEngineDone = "Year Engine Done is required";
    } else {
      const year = parseInt(formData.yearEngineDone, 10);
      if (isNaN(year) || year < 1900 || year > 2100) {
        newErrors.yearEngineDone = "Please enter a valid year (1900-2100)";
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setLoading(true);

    try {
      // Create claim with all data
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: formData.status,
          claimCodeRaw: formData.claimCodeRaw,
          customerName: formData.customerName,
          customerCompany: formData.customerCompany,
          yearEngineDone: parseInt(formData.yearEngineDone, 10),
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
              <Label>Claim Code <span className="text-red-500">*</span></Label>
              <Input
                value={formData.claimCodeRaw}
                onChange={(e) => {
                  setFormData({ ...formData, claimCodeRaw: e.target.value });
                  if (errors.claimCodeRaw) setErrors({ ...errors, claimCodeRaw: "" });
                }}
                placeholder="MR1234/25"
                className={errors.claimCodeRaw ? "border-red-500" : ""}
              />
              {errors.claimCodeRaw && (
                <p className="text-sm text-red-500 mt-1">{errors.claimCodeRaw}</p>
              )}
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
              <Label>Customer Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.customerName}
                onChange={(e) => {
                  setFormData({ ...formData, customerName: e.target.value });
                  if (errors.customerName) setErrors({ ...errors, customerName: "" });
                }}
                placeholder="Customer name"
                className={errors.customerName ? "border-red-500" : ""}
              />
              {errors.customerName && (
                <p className="text-sm text-red-500 mt-1">{errors.customerName}</p>
              )}
            </div>

            <div>
              <Label>Customer Company <span className="text-red-500">*</span></Label>
              <Input
                value={formData.customerCompany}
                onChange={(e) => {
                  setFormData({ ...formData, customerCompany: e.target.value });
                  if (errors.customerCompany) setErrors({ ...errors, customerCompany: "" });
                }}
                placeholder="Customer company"
                className={errors.customerCompany ? "border-red-500" : ""}
              />
              {errors.customerCompany && (
                <p className="text-sm text-red-500 mt-1">{errors.customerCompany}</p>
              )}
            </div>

            <div>
              <Label>Year Engine Done <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.yearEngineDone}
                onChange={(e) => {
                  setFormData({ ...formData, yearEngineDone: e.target.value });
                  if (errors.yearEngineDone) setErrors({ ...errors, yearEngineDone: "" });
                }}
                placeholder="YYYY"
                min="1900"
                max="2100"
                className={errors.yearEngineDone ? "border-red-500" : ""}
              />
              {errors.yearEngineDone && (
                <p className="text-sm text-red-500 mt-1">{errors.yearEngineDone}</p>
              )}
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

