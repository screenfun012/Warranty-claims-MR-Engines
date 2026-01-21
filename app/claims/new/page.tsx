"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

// Predefined list of companies
const COMPANY_LIST = [
  "APPROVED GREEN",
  "VITOBELLO",
  "AUTO STANIĆ",
  "SELMAN",
  "TVH",
  "CRD",
  "RETTIFICHE 3G",
  "BOLS MOTOREN",
];

export default function NewClaimPage() {
  const [companies, setCompanies] = useState<string[]>(COMPANY_LIST);
  const [newCompany, setNewCompany] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: "NEW",
    claimCodeRaw: "",
    customerNumber: "",
    customerName: "",
    customerCompany: "",
    dateEngineDone: undefined as Date | undefined,
    engineType: "",
    initialFinding: "", // Will be saved as first finding in Findings tab
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields - only MR Number and Engine Type are required
    const newErrors: Record<string, string> = {};
    if (!formData.claimCodeRaw.trim()) {
      newErrors.claimCodeRaw = "MR Number is required";
    }
    if (!formData.engineType.trim()) {
      newErrors.engineType = "Engine Type is required";
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
          customerNumber: formData.customerNumber || null,
          customerName: formData.customerName || null,
          customerCompany: formData.customerCompany || null,
          dateEngineDone: formData.dateEngineDone?.toISOString() || null,
          engineType: formData.engineType,
          initialFinding: formData.initialFinding || null, // Will be added to Findings tab
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
        <h1 className="text-3xl font-bold">Nova Reklamacija</h1>
        <Button variant="outline" onClick={() => router.push("/claims")}>
          Otkaži
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-4">
            {/* MR Number - Required */}
            <div>
              <Label>MR Number <span className="text-red-500">*</span></Label>
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

            {/* Customer Number - Optional */}
            <div>
              <Label>Customer Number</Label>
              <Input
                value={formData.customerNumber}
                onChange={(e) => {
                  setFormData({ ...formData, customerNumber: e.target.value });
                }}
                placeholder="Broj kupca"
              />
            </div>

            {/* Status */}
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
                  <SelectItem value="NEW">Novo</SelectItem>
                  <SelectItem value="IN_ANALYSIS">U Obradi</SelectItem>
                  <SelectItem value="APPROVED">Prihvaćeno</SelectItem>
                  <SelectItem value="REJECTED">Odbijeno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Name - Optional (for domestic market) */}
            <div>
              <Label>Customer Name</Label>
              <Input
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ime kupca (za domaće tržište)"
              />
            </div>

            {/* Customer Company - Optional */}
            <div>
              <Label>Customer Company</Label>
              <Select
                value={formData.customerCompany}
                onValueChange={(value) => {
                  if (value === "__add_new__") {
                    setShowAddCompany(true);
                  } else {
                    setFormData({ ...formData, customerCompany: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                  <SelectItem 
                    value="__add_new__" 
                    className="text-primary font-medium"
                  >
                    <Plus className="h-4 w-4 inline mr-2" />
                    Dodaj novu kompaniju
                  </SelectItem>
                </SelectContent>
              </Select>
              {showAddCompany && (
                <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Dodaj novu kompaniju</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Naziv kompanije</Label>
                        <Input
                          value={newCompany}
                          onChange={(e) => setNewCompany(e.target.value)}
                          placeholder="Unesi naziv kompanije"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newCompany.trim()) {
                              const trimmed = newCompany.trim();
                              if (!companies.includes(trimmed)) {
                                setCompanies([...companies, trimmed]);
                                setFormData({ ...formData, customerCompany: trimmed });
                                setNewCompany("");
                                setShowAddCompany(false);
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                          setShowAddCompany(false);
                          setNewCompany("");
                        }}>
                          Otkaži
                        </Button>
                        <Button 
                          onClick={() => {
                            const trimmed = newCompany.trim();
                            if (trimmed && !companies.includes(trimmed)) {
                              setCompanies([...companies, trimmed]);
                              setFormData({ ...formData, customerCompany: trimmed });
                              setNewCompany("");
                              setShowAddCompany(false);
                            }
                          }}
                          disabled={!newCompany.trim() || companies.includes(newCompany.trim())}
                        >
                          Dodaj
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Date Engine Done - Optional */}
            <div>
              <Label>Date Engine Done</Label>
              <DatePicker
                date={formData.dateEngineDone}
                onSelect={(date) => setFormData({ ...formData, dateEngineDone: date })}
                placeholder="Izaberi datum"
              />
            </div>

            {/* Engine Type - Required */}
            <div>
              <Label>Engine Type <span className="text-red-500">*</span></Label>
              <Input
                value={formData.engineType}
                onChange={(e) => {
                  setFormData({ ...formData, engineType: e.target.value });
                  if (errors.engineType) setErrors({ ...errors, engineType: "" });
                }}
                placeholder="Tip motora"
                className={errors.engineType ? "border-red-500" : ""}
              />
              {errors.engineType && (
                <p className="text-sm text-red-500 mt-1">{errors.engineType}</p>
              )}
            </div>

            {/* Initial Finding - Optional */}
            <div>
              <Label>Početno Zapažanje</Label>
              <Textarea
                value={formData.initialFinding}
                onChange={(e) => setFormData({ ...formData, initialFinding: e.target.value })}
                placeholder="Početno zapažanje o reklamaciji (opcionalno, biće sačuvano u Findings tab)"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Kreiranje..." : "Kreiraj Reklamaciju"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/claims")}>
                Otkaži
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}

