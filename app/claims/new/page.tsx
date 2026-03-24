"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { SEED_PREDEFINED_COMPANY_NAMES } from "@/lib/config/predefinedSeeds";

const FALLBACK_COMPANY_LIST = [...SEED_PREDEFINED_COMPANY_NAMES];

export default function NewClaimPage() {
  const t = useTranslations();
  const [companies, setCompanies] = useState<string[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [newCompany, setNewCompany] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Helper to get status label
  const getStatusLabel = (status: string) => t(`claims.status.${status}` as any) || status;

  // Load companies from API
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await fetch("/api/admin/companies");
        if (res.ok) {
          const data = await res.json();
          let companyNames = (data.companies || []).map((c: { name: string }) => c.name);
          if (companyNames.length === 0) {
            companyNames = [...FALLBACK_COMPANY_LIST];
          }
          setCompanies(companyNames);
        } else {
          setCompanies(FALLBACK_COMPANY_LIST);
        }
      } catch (error) {
        console.error("Error loading companies:", error);
        setCompanies(FALLBACK_COMPANY_LIST);
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);
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
      newErrors.claimCodeRaw = t("claims.new.required.mrNumber");
    }
    if (!formData.engineType.trim()) {
      newErrors.engineType = t("claims.new.required.engineType");
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
          alert(t("claims.new.error.invalidResponse"));
        }
      } else {
        const errorData = await res.json();
        alert(t("claims.new.error.failed") + ": " + (errorData.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error creating claim:", error);
      alert(t("claims.new.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t("claims.newClaim")}</h1>
        <Button variant="outline" onClick={() => router.push("/claims")}>
          {t("common.cancel")}
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-4">
            {/* MR Number - Required */}
            <div>
              <Label>{t("claims.mrNumber")} <span className="text-red-500">*</span></Label>
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
              <Label>{t("claims.customerNumber")}</Label>
              <Input
                value={formData.customerNumber}
                onChange={(e) => {
                  setFormData({ ...formData, customerNumber: e.target.value });
                }}
                placeholder={t("claims.customerNumber")}
              />
            </div>

            {/* Status */}
            <div>
              <Label>{t("common.status")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">{getStatusLabel("NEW")}</SelectItem>
                  <SelectItem value="IN_ANALYSIS">{getStatusLabel("IN_ANALYSIS")}</SelectItem>
                  <SelectItem value="APPROVED">{getStatusLabel("APPROVED")}</SelectItem>
                  <SelectItem value="REJECTED">{getStatusLabel("REJECTED")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Name - Optional (for domestic market) */}
            <div>
              <Label>{t("claims.metadata.customerName")}</Label>
              <Input
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder={t("claims.new.customerNamePlaceholder")}
              />
            </div>

            {/* Customer Company - Optional */}
            <div>
              <Label>{t("claims.metadata.customerCompany")}</Label>
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
                  <SelectValue placeholder={t("claims.metadata.selectCompany")} />
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
                    {t("claims.metadata.addCompany")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {showAddCompany && (
                <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("claims.metadata.addCompany")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>{t("claims.metadata.companyName")}</Label>
                        <Input
                          value={newCompany}
                          onChange={(e) => setNewCompany(e.target.value)}
                          placeholder={t("claims.metadata.enterCompanyName")}
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
                          {t("common.cancel")}
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
                          {t("common.add")}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Date Engine Done - Optional */}
            <div>
              <Label>{t("claims.dateEngineDone")}</Label>
              <DatePicker
                date={formData.dateEngineDone}
                onSelect={(date) => setFormData({ ...formData, dateEngineDone: date })}
                placeholder={t("claims.new.selectDate")}
              />
            </div>

            {/* Engine Type - Required */}
            <div>
              <Label>{t("claims.engineType")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.engineType}
                onChange={(e) => {
                  setFormData({ ...formData, engineType: e.target.value });
                  if (errors.engineType) setErrors({ ...errors, engineType: "" });
                }}
                placeholder={t("claims.engineType")}
                className={errors.engineType ? "border-red-500" : ""}
              />
              {errors.engineType && (
                <p className="text-sm text-red-500 mt-1">{errors.engineType}</p>
              )}
            </div>

            {/* Initial Finding - Optional */}
            <div>
              <Label>{t("claims.findings.initialFinding")}</Label>
              <Textarea
                value={formData.initialFinding}
                onChange={(e) => setFormData({ ...formData, initialFinding: e.target.value })}
                placeholder={t("claims.new.initialFindingPlaceholder")}
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? t("claims.new.creating") : t("claims.new.createButton")}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/claims")}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}

