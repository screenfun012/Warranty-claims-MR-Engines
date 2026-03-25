"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { 
  Hash, Building2, Settings, User, FolderOpen, Mail, CheckCircle2, Loader2, 
  Calendar, AlertCircle, Wrench, FileText, Plus, X
} from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  SEED_PREDEFINED_COMPANY_NAMES,
  SEED_PREDEFINED_WORKER_NAMES,
} from "@/lib/config/predefinedSeeds";
import { workerWhoBuiltMotorLabel } from "@/lib/domain/claimDisplay";

interface Department {
  id: string;
  name: string;
  isSystem: boolean;
}

// Fallback lists (API error ili prazan odgovor 200 + [])
const FALLBACK_WORKER_LIST = [...SEED_PREDEFINED_WORKER_NAMES];
const FALLBACK_COMPANY_LIST = [...SEED_PREDEFINED_COMPANY_NAMES];

interface ClaimMetadataProps {
  claim: {
    id: string;
    claimCodeRaw: string | null;
    customerNumber: string | null;
    status: string;
    engineType: string | null;
    mrEngineCode: string | null;
    serverFolderPath: string | null;
    processingEmailSentAt: string | null;
    yearEngineDone: number | null;
    dateEngineDone: string | null;
    claimArrivalDate: string | null;
    assignedWorkerName: string | null; // Worker who built the engine (simple text)
    workerFault: string | null; // Worker at fault
    reason: string | null;
    isDomesticMarket: boolean;
    assignedTo: {
      id: string;
      fullName: string;
    } | null;
    customer: {
      id: string;
      name: string | null;
      company: string | null;
    } | null;
    faultDepartment: {
      id: string;
      name: string;
    } | null;
    faultDepartments?: {
      id: string;
      name: string;
    }[];
    claimAcceptanceStatus?: string | null;
  };
  onUpdate: (updates: Record<string, unknown>) => void;
  isReadOnly?: boolean;
}

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function hasMinRole(userRole: string | undefined, minRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole || "VIEWER"] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function ClaimMetadata({ claim, onUpdate, isReadOnly = false }: ClaimMetadataProps) {
  const { user } = useUser();
  const t = useTranslations();
  const auth0User = user as any;
  const userRole = auth0User?.['https://mr-engines-warranty/roles']?.[0] || auth0User?.role || "VIEWER";
  const canManageDepartments = hasMinRole(userRole, "ADMIN");
  
  // State for workers and companies (fetched from API with ability to add new ones)
  const [workers, setWorkers] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [newWorker, setNewWorker] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);

  // Local state for all editable fields
  const [claimCode, setClaimCode] = useState(claim.claimCodeRaw || "");
  const [customerNumber, setCustomerNumber] = useState(claim.customerNumber || "");
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");
  const [engineType, setEngineType] = useState(claim.engineType || "");
  const [engineCode, setEngineCode] = useState(claim.mrEngineCode || "");
  // assignedWorkerName i isDomesticMarket dolaze direktno iz claim (server/optimistički cache) — lokalni state je pravio nesinhron prikaz i "ne čuva se"
  const [faultDepartmentId, setFaultDepartmentId] = useState(claim.faultDepartment?.id || "");
  const [faultDepartmentIds, setFaultDepartmentIds] = useState<string[]>(
    claim.faultDepartments?.map((d) => d.id) || (claim.faultDepartment?.id ? [claim.faultDepartment.id] : [])
  );
  const [workerFault, setWorkerFault] = useState(claim.workerFault || "");
  const [yearEngineDone, setYearEngineDone] = useState(claim.yearEngineDone?.toString() || "");
  const [dateEngineDone, setDateEngineDone] = useState<Date | undefined>(claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined);
  const [claimArrivalDate, setClaimArrivalDate] = useState<Date | undefined>(claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined);
  const [reason, setReason] = useState(claim.reason || "");

  /** Tekst ili (legacy) assignedTo.fullName — isto kao lista reklamacija */
  const assignedWorkerDisplay = workerWhoBuiltMotorLabel(claim);
  const isDomesticMarket = !!claim.isDomesticMarket;

  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [addingDepartment, setAddingDepartment] = useState(false);
  
  // Track which fields are being edited
  const [editingField, setEditingField] = useState<string | null>(null);
  const [notificationSent, setNotificationSent] = useState(!!claim.processingEmailSentAt);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [statusNotificationSent, setStatusNotificationSent] = useState(false);
  const [isSendingStatusNotification, setIsSendingStatusNotification] = useState(false);
  const prevClaimIdRef = useRef(claim.id);

  // Load departments, workers, and companies from API
  useEffect(() => {
    const loadData = async () => {
      // Load departments
      try {
        const res = await fetch("/api/admin/departments");
        if (res.ok) {
          const data = await res.json();
          setDepartments(data.departments || []);
        }
      } catch (error) {
        console.error("Error loading departments:", error);
      } finally {
        setLoadingDepartments(false);
      }

      // Load workers from API
      try {
        const res = await fetch("/api/admin/workers");
        if (res.ok) {
          const data = await res.json();
          let workerNames = (data.workers || []).map((w: { name: string }) => w.name);
          if (workerNames.length === 0) {
            workerNames = [...FALLBACK_WORKER_LIST];
          }
          const currentWorkerLabel = workerWhoBuiltMotorLabel(claim);
          if (currentWorkerLabel && !workerNames.includes(currentWorkerLabel)) {
            workerNames.push(currentWorkerLabel);
          }
          setWorkers(workerNames);
        } else {
          // Fallback to hardcoded list
          const fallback = [...FALLBACK_WORKER_LIST];
          const cur = workerWhoBuiltMotorLabel(claim);
          if (cur && !fallback.includes(cur)) {
            fallback.push(cur);
          }
          setWorkers(fallback);
        }
      } catch (error) {
        console.error("Error loading workers:", error);
        const fallback = [...FALLBACK_WORKER_LIST];
        const cur = workerWhoBuiltMotorLabel(claim);
        if (cur && !fallback.includes(cur)) {
          fallback.push(cur);
        }
        setWorkers(fallback);
      } finally {
        setLoadingWorkers(false);
      }

      // Load companies from API
      try {
        const res = await fetch("/api/admin/companies");
        if (res.ok) {
          const data = await res.json();
          let companyNames = (data.companies || []).map((c: { name: string }) => c.name);
          if (companyNames.length === 0) {
            companyNames = [...FALLBACK_COMPANY_LIST];
          }
          // Add current claim's company if not in list
          if (claim.customer?.company && !companyNames.includes(claim.customer.company)) {
            companyNames.push(claim.customer.company);
          }
          setCompanies(companyNames);
        } else {
          // Fallback to hardcoded list
          const fallback = [...FALLBACK_COMPANY_LIST];
          if (claim.customer?.company && !fallback.includes(claim.customer.company)) {
            fallback.push(claim.customer.company);
          }
          setCompanies(fallback);
        }
      } catch (error) {
        console.error("Error loading companies:", error);
        const fallback = [...FALLBACK_COMPANY_LIST];
        if (claim.customer?.company && !fallback.includes(claim.customer.company)) {
          fallback.push(claim.customer.company);
        }
        setCompanies(fallback);
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadData();
  }, [claim.id]);

  // Add new department
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    
    setAddingDepartment(true);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDepartmentName.trim() }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setDepartments([...departments, data.department]);
        const newIds = [...faultDepartmentIds, data.department.id];
        setFaultDepartmentIds(newIds);
        setNewDepartmentName("");
        setShowAddDepartment(false);
        // Update claim with multiple departments
        onUpdate({ faultDepartmentIds: newIds });
      } else {
        const errorData = await res.json();
        alert(t("claims.metadata.addDepartmentError") + ": " + (errorData.error || t("common.error")));
      }
    } catch (error) {
      console.error("Error adding department:", error);
      alert(t("claims.metadata.addDepartmentError"));
    } finally {
      setAddingDepartment(false);
    }
  };

  // Send processing notification email (samo za domaće tržište)
  const sendProcessingNotification = async () => {
    if (!claimCode || isSendingNotification) return;
    setIsSendingNotification(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "processing" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t("claims.metadata.email.error"));
      }
      setNotificationSent(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : t("claims.metadata.email.error"));
      setNotificationSent(false);
    } finally {
      setIsSendingNotification(false);
    }
  };

  // Pošalji mail klijentu o statusu reklamacije (template) — samo za domaće tržište
  const sendStatusNotification = async () => {
    if (isSendingStatusNotification || statusNotificationSent) return;
    const status = claim.status === "APPROVED" ? "ACCEPTED" : claim.status === "REJECTED" ? "REJECTED" : null;
    if (!status) return;
    setIsSendingStatusNotification(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimAcceptanceStatus: status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t("claims.metadata.email.error"));
      }
      setStatusNotificationSent(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : t("claims.metadata.email.error"));
    } finally {
      setIsSendingStatusNotification(false);
    }
  };

  // Sinhronizuj formu samo pri promeni reklamacije (drugi id)
  useEffect(() => {
    if (prevClaimIdRef.current !== claim.id) {
      prevClaimIdRef.current = claim.id;
      setClaimCode(claim.claimCodeRaw || "");
      setCustomerNumber(claim.customerNumber || "");
      setCustomerName(claim.customer?.name || "");
      setEngineType(claim.engineType || "");
      setEngineCode(claim.mrEngineCode || "");
      setFaultDepartmentId(claim.faultDepartment?.id || "");
      if (claim.faultDepartments && claim.faultDepartments.length > 0) {
        setFaultDepartmentIds(claim.faultDepartments.map((d) => d.id));
      } else if (claim.faultDepartment?.id) {
        setFaultDepartmentIds([claim.faultDepartment.id]);
      } else {
        setFaultDepartmentIds([]);
      }
      setWorkerFault(claim.workerFault || "");
      setYearEngineDone(claim.yearEngineDone?.toString() || "");
      setDateEngineDone(claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined);
      setClaimArrivalDate(claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined);
      setReason(claim.reason || "");
      setEditingField(null);
      setNotificationSent(!!claim.processingEmailSentAt);
    }
  }, [claim.id]);

  // Ime kupca: osveži iz servera kad se customer promeni (npr. posle čuvanja), ali ne tokom kucanja
  useEffect(() => {
    if (editingField === "customerName") return;
    setCustomerName(claim.customer?.name || "");
  }, [claim.customer?.name, claim.customer?.id, editingField]);

  // Ostala polja: lokalni useState se inicijalizuje pre nego što React Query učita pun claim — moraju da prate claim.*
  useEffect(() => {
    if (editingField === "customerNumber") return;
    setCustomerNumber(claim.customerNumber ?? "");
  }, [claim.customerNumber, claim.id, editingField]);

  useEffect(() => {
    if (editingField === "claimCodeRaw") return;
    setClaimCode(claim.claimCodeRaw || "");
  }, [claim.claimCodeRaw, claim.id, editingField]);

  useEffect(() => {
    if (editingField === "engineType") return;
    setEngineType(claim.engineType || "");
  }, [claim.engineType, claim.id, editingField]);

  useEffect(() => {
    if (editingField === "mrEngineCode") return;
    setEngineCode(claim.mrEngineCode || "");
  }, [claim.mrEngineCode, claim.id, editingField]);

  useEffect(() => {
    if (editingField === "workerFault") return;
    setWorkerFault(claim.workerFault || "");
  }, [claim.workerFault, claim.id, editingField]);

  useEffect(() => {
    if (editingField === "reason") return;
    setReason(claim.reason || "");
  }, [claim.reason, claim.id, editingField]);

  useEffect(() => {
    setYearEngineDone(claim.yearEngineDone != null ? String(claim.yearEngineDone) : "");
  }, [claim.yearEngineDone, claim.id]);

  useEffect(() => {
    setDateEngineDone(claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined);
  }, [claim.dateEngineDone, claim.id]);

  useEffect(() => {
    setClaimArrivalDate(claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined);
  }, [claim.claimArrivalDate, claim.id]);

  const handleFieldBlur = (field: string, value: string | number | boolean | null) => {
    setEditingField(null);
    if (isReadOnly) return;

    const originalValue: any = (claim as any)[field] ?? null;

    // Normalize: empty string → null, numeric strings → number for int fields
    let normalizedValue: unknown = typeof value === "string" && value.trim() === "" ? null : value;
    if (field === "yearEngineDone" && typeof normalizedValue === "string") {
      const parsed = parseInt(normalizedValue, 10);
      normalizedValue = Number.isNaN(parsed) ? null : parsed;
    }
    const normalizedOriginal =
      originalValue == null
        ? null
        : typeof originalValue === "string" && originalValue.trim() === ""
          ? null
          : originalValue;

    if (normalizedValue === normalizedOriginal) return;

    const updates: Record<string, unknown> = { [field]: normalizedValue };
    if (claim.status === "NEW") updates.status = "IN_ANALYSIS";
    onUpdate(updates);

    if (field === "claimCodeRaw") setNotificationSent(false);
  };

  // Handle customer name/company update with optimistic update
  const handleCustomerUpdate = async (field: 'name' | 'company', value: string) => {
    setEditingField(null);
    if (isReadOnly) return;
    
    const currentName = claim.customer?.name || "";
    const currentCompany = claim.customer?.company || "";
    const trimmedValue = value.trim();
    const newName = field === 'name' ? trimmedValue : currentName;
    const newCompany = field === 'company' ? trimmedValue : currentCompany;
    
    // Normalize for comparison (empty string = null)
    const normalizedCurrentName = currentName || "";
    const normalizedCurrentCompany = currentCompany || "";
    const normalizedNewName = newName || "";
    const normalizedNewCompany = newCompany || "";
    
    if ((field === 'name' && normalizedNewName === normalizedCurrentName) || 
        (field === 'company' && normalizedNewCompany === normalizedCurrentCompany)) {
      return;
    }
    
    // Optimistic update - update UI immediately
    const optimisticCustomer = {
      ...claim.customer,
      name: normalizedNewName || null,
      company: normalizedNewCompany || null,
    };
    
    if (field === 'name') setCustomerName(normalizedNewName);

    // Optimistically update the claim cache (company comes from claim after cache update)
    onUpdate({ 
      customer: optimisticCustomer,
      ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
    });
    
    // Then update in background (non-blocking)
    if (claim.customer?.id) {
      fetch(`/api/customers/${claim.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: normalizedNewName || null, 
          company: normalizedNewCompany || null 
        }),
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Update with server response
          onUpdate({ 
            customerId: data.customer.id,
            customer: data.customer,
          });
        } else {
          // Revert on error
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to update customer:", errorData);
          if (field === 'name') setCustomerName(currentName);
          onUpdate({ customer: claim.customer });
          alert(t("claims.metadata.customer.updateError") + ": " + (errorData.error || t("common.error")));
        }
      })
      .catch((error) => {
        console.error("Error updating customer:", error);
        if (field === 'name') setCustomerName(currentName);
        onUpdate({ customer: claim.customer });
        alert(t("claims.metadata.customer.updateError"));
      });
    } else if (normalizedNewName || normalizedNewCompany) {
      // Allow creating customer with name OR company (at least one must be provided)
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: normalizedNewName || null,
          company: normalizedNewCompany || null,
          claimId: claim.id,
        }),
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Update with server response
          onUpdate({ 
            customerId: data.customer.id,
            customer: data.customer,
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to create customer:", errorData);
          setCustomerName("");
          onUpdate({ customer: null });
          alert(t("claims.metadata.customer.createError") + ": " + (errorData.error || t("common.error")));
        }
      })
      .catch((error) => {
        console.error("Error creating customer:", error);
        setCustomerName("");
        onUpdate({ customer: null });
        alert(t("claims.metadata.customer.createError"));
      });
    } else {
      setCustomerName("");
    }
  };

  // Handle fault department change
  const handleFaultDepartmentChange = (departmentId: string) => {
    setFaultDepartmentId(departmentId);
    const updates: Record<string, unknown> = { faultDepartmentId: departmentId || null };
    if (claim.status === "NEW") {
      updates.status = "IN_ANALYSIS";
    }
    onUpdate(updates);
  };

  // Handle isDomesticMarket change
  const handleIsDomesticMarketChange = (checked: boolean) => {
    const updates: Record<string, unknown> = { isDomesticMarket: checked };
    if (claim.status === "NEW") {
      updates.status = "IN_ANALYSIS";
    }
    onUpdate(updates);
  };

  return (
    <Card className="p-4 sm:p-6 overflow-hidden">
      <h2 className="text-lg font-semibold mb-6 text-primary flex items-center gap-2">
        <Settings className="h-5 w-5" />
        {t("claims.tabs.metadata")}
      </h2>
      <div className="space-y-4 overflow-hidden">
        {/* MR Number - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            {t("claims.mrNumber")} <span className="text-red-500">*</span>
          </Label>
          <Input
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            onFocus={() => setEditingField('claimCodeRaw')}
            onBlur={(e) => handleFieldBlur('claimCodeRaw', e.target.value)}
            placeholder="MR1234/25"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Customer Number */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            {t("claims.customerNumber")}
          </Label>
          <Input
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            onFocus={() => setEditingField('customerNumber')}
            onBlur={(e) => handleFieldBlur('customerNumber', e.target.value)}
            placeholder={t("claims.customerNumber")}
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Domaće tržište: primarno ime kupca; strano: firma obavezna */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {t("claims.metadata.customerName")}
            {isDomesticMarket && <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={customerName}
            placeholder={t("claims.metadata.customerName")}
            disabled={isReadOnly}
            onFocus={() => setEditingField('customerName')}
            onChange={(e) => setCustomerName(e.target.value)}
            onBlur={(e) => handleCustomerUpdate('name', e.target.value)}
            className="h-9"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {t("claims.metadata.customerCompany")}
            {!isDomesticMarket && <span className="text-red-500">*</span>}
          </Label>
          <Select
            value={claim.customer?.company || "__empty__"}
            onValueChange={(value) => {
              if (value === "__add_new__") {
                setShowAddCompany(true);
              } else if (value === "__clear__") {
                handleCustomerUpdate("company", "");
              } else {
                handleCustomerUpdate("company", value);
              }
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("claims.metadata.selectCompany")} />
            </SelectTrigger>
            <SelectContent>
              {claim.customer?.company && (
                <SelectItem value="__clear__" className="text-destructive font-medium">
                  <X className="h-4 w-4 inline mr-2" />
                  {t("common.clear")}
                </SelectItem>
              )}
              <SelectItem value="__empty__" className="hidden" disabled>
                {t("claims.metadata.selectCompany")}
              </SelectItem>
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
                            handleCustomerUpdate('company', trimmed);
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
                          handleCustomerUpdate('company', trimmed);
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

        {/* Engine Type */}
        <div>
          <Label className="text-sm font-medium mb-2">{t("claims.engineType")}</Label>
          <Input
            value={engineType}
            onChange={(e) => setEngineType(e.target.value)}
            onFocus={() => setEditingField('engineType')}
            onBlur={(e) => handleFieldBlur('engineType', e.target.value)}
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Engine Code */}
        <div>
          <Label className="text-sm font-medium mb-2">{t("claims.engineCode")}</Label>
          <Input
            value={engineCode}
            onChange={(e) => setEngineCode(e.target.value)}
            onFocus={() => setEditingField('mrEngineCode')}
            onBlur={(e) => handleFieldBlur('mrEngineCode', e.target.value)}
            placeholder={t("claims.engineCode")}
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Assigned Worker (Worker who worked on engine) - Select dropdown */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {t("claims.metadata.assignedWorker")}
          </Label>
          <Select
            value={assignedWorkerDisplay || "__empty__"}
            onValueChange={(value) => {
              if (value === "__add_new__") {
                setShowAddWorker(true);
              } else if (value === "__clear__") {
                setEditingField(null);
                if (!isReadOnly) {
                  const updates: Record<string, unknown> = { assignedWorkerName: null };
                  if (claim.assignedTo?.id) updates.assignedToId = null;
                  if (claim.status === "NEW") updates.status = "IN_ANALYSIS";
                  onUpdate(updates);
                }
              } else {
                handleFieldBlur("assignedWorkerName", value);
              }
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("claims.metadata.selectWorker")} />
            </SelectTrigger>
            <SelectContent>
              {assignedWorkerDisplay && (
                <SelectItem value="__clear__" className="text-destructive font-medium">
                  <X className="h-4 w-4 inline mr-2" />
                  {t("common.clear")}
                </SelectItem>
              )}
              <SelectItem value="__empty__" className="hidden" disabled>
                {t("claims.metadata.selectWorker")}
              </SelectItem>
              {workers.map((worker) => (
                <SelectItem key={worker} value={worker}>
                  {worker}
                </SelectItem>
              ))}
              <SelectItem
                value="__add_new__"
                className="text-primary font-medium"
              >
                <Plus className="h-4 w-4 inline mr-2" />
                {t("claims.metadata.addWorker")}
              </SelectItem>
            </SelectContent>
          </Select>
          {showAddWorker && (
            <Dialog open={showAddWorker} onOpenChange={setShowAddWorker}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("claims.metadata.addWorker")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("claims.metadata.workerName")}</Label>
                    <Input
                      value={newWorker}
                      onChange={(e) => setNewWorker(e.target.value)}
                      placeholder={t("claims.metadata.enterWorkerName")}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newWorker.trim()) {
                          const trimmed = newWorker.trim();
                          if (!workers.includes(trimmed)) {
                            setWorkers([...workers, trimmed]);
                            handleFieldBlur('assignedWorkerName', trimmed);
                            setNewWorker("");
                            setShowAddWorker(false);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setShowAddWorker(false);
                      setNewWorker("");
                    }}>
                      {t("common.cancel")}
                    </Button>
                    <Button 
                      onClick={() => {
                        const trimmed = newWorker.trim();
                        if (trimmed && !workers.includes(trimmed)) {
                          setWorkers([...workers, trimmed]);
                          handleFieldBlur('assignedWorkerName', trimmed);
                          setNewWorker("");
                          setShowAddWorker(false);
                        }
                      }}
                      disabled={!newWorker.trim() || workers.includes(newWorker.trim())}
                    >
                      {t("common.add")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Fault Department - Multi-select */}
        <div>
          <Label className="text-sm font-medium mb-2">{t("claims.metadata.faultDepartment")}</Label>
          <div className="flex gap-2 min-w-0">
            <MultiSelect
              options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
              selected={faultDepartmentIds}
              onChange={(selected) => {
                setFaultDepartmentIds(selected);
                // Update claim with multiple departments
                onUpdate({ faultDepartmentIds: selected });
              }}
              placeholder={t("claims.metadata.selectDepartments")}
              disabled={isReadOnly || loadingDepartments}
              className="flex-1 min-w-0"
            />
            {canManageDepartments && (
              <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={isReadOnly}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("claims.metadata.addDepartment")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{t("claims.metadata.departmentName")}</Label>
                      <Input
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        placeholder={t("claims.metadata.enterDepartmentName")}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !addingDepartment) {
                            handleAddDepartment();
                          }
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddDepartment(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleAddDepartment} disabled={!newDepartmentName.trim() || addingDepartment}>
                        {addingDepartment ? t("common.loading") : t("common.add")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Worker Fault */}
        <div>
          <Label className="text-sm font-medium mb-2">{t("claims.metadata.workerFault")}</Label>
          <Input
            value={workerFault}
            onChange={(e) => setWorkerFault(e.target.value)}
            onFocus={() => setEditingField('workerFault')}
            onBlur={(e) => handleFieldBlur('workerFault', e.target.value)}
            placeholder={t("claims.metadata.workerFault")}
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Date Engine Done */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {t("claims.dateEngineDone")}
          </Label>
          <DatePicker
            date={dateEngineDone}
            onSelect={(date) => {
              setDateEngineDone(date);
              // Auto-update when date is selected
              const isoDate = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T12:00:00.000Z` : null;
              const updates: Record<string, unknown> = { dateEngineDone: isoDate };
              if (claim.status === "NEW") {
                updates.status = "IN_ANALYSIS";
              }
              onUpdate(updates);
            }}
            placeholder={t("common.select") + " " + t("common.date")}
            disabled={isReadOnly}
          />
        </div>

        {/* Claim Arrival Date */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {t("claims.claimArrivalDate")}
          </Label>
          <DatePicker
            date={claimArrivalDate}
            onSelect={(date) => {
              setClaimArrivalDate(date);
              const isoDate = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T12:00:00.000Z` : null;
              const updates: Record<string, unknown> = { claimArrivalDate: isoDate };
              if (claim.status === "NEW") {
                updates.status = "IN_ANALYSIS";
              }
              onUpdate(updates);
            }}
            placeholder={t("common.select") + " " + t("common.date")}
            disabled={isReadOnly}
          />
        </div>

        {/* Reason */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {t("claims.metadata.reason")}
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onFocus={() => setEditingField('reason')}
            onBlur={(e) => handleFieldBlur('reason', e.target.value)}
            placeholder={t("claims.metadata.reasonPlaceholder")}
            disabled={isReadOnly}
            rows={3}
            className="resize-y"
          />
        </div>

        {/* Is Domestic Market */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="isDomesticMarket"
            checked={isDomesticMarket}
            onCheckedChange={handleIsDomesticMarketChange}
            disabled={isReadOnly}
          />
          <Label htmlFor="isDomesticMarket" className="text-sm font-medium cursor-pointer">
            {t("claims.metadata.domesticMarket")}
          </Label>
        </div>

        {/* Odluka o reklamaciji (Prihvaćeno / Odbijeno) — uvek vidljivo */}
        <div>
          <Label className="text-sm font-medium mb-2 block">{t("claims.metadata.acceptanceDecision")}</Label>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="acceptance-approved"
                checked={claim.status === "APPROVED"}
                onCheckedChange={() => {
                  if (isReadOnly) return;
                  const isDeselecting = claim.status === "APPROVED";
                  onUpdate({
                    status: isDeselecting ? "IN_ANALYSIS" : "APPROVED",
                    claimAcceptanceStatus: isDeselecting ? null : "ACCEPTED",
                  });
                }}
                disabled={isReadOnly}
              />
              <Label htmlFor="acceptance-approved" className="text-sm font-normal cursor-pointer">
                {t("claims.status.APPROVED")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="acceptance-rejected"
                checked={claim.status === "REJECTED"}
                onCheckedChange={() => {
                  if (isReadOnly) return;
                  const isDeselecting = claim.status === "REJECTED";
                  onUpdate({
                    status: isDeselecting ? "IN_ANALYSIS" : "REJECTED",
                    claimAcceptanceStatus: isDeselecting ? null : "REJECTED",
                  });
                }}
                disabled={isReadOnly}
              />
              <Label htmlFor="acceptance-rejected" className="text-sm font-normal cursor-pointer">
                {t("claims.status.REJECTED")}
              </Label>
            </div>
          </div>
          {/* Jedan checkbox: "Potvrdi i pošalji obaveštenje klijentu" — samo za domaće; gleda status (U obradi / Prihvaćeno / Odbijeno) i šalje odgovarajući mail */}
          {isDomesticMarket && ((claim.status === "IN_ANALYSIS" && claimCode) || claim.status === "APPROVED" || claim.status === "REJECTED") && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="notificationConfirm"
                checked={
                  (claim.status === "IN_ANALYSIS" && notificationSent) ||
                  ((claim.status === "APPROVED" || claim.status === "REJECTED") && statusNotificationSent)
                }
                disabled={
                  (claim.status === "IN_ANALYSIS" && (isSendingNotification || notificationSent)) ||
                  ((claim.status === "APPROVED" || claim.status === "REJECTED") && (isSendingStatusNotification || statusNotificationSent))
                }
                onChange={(e) => {
                  if (!e.target.checked) return;
                  if (claim.status === "IN_ANALYSIS" && !notificationSent) {
                    sendProcessingNotification();
                  } else if ((claim.status === "APPROVED" || claim.status === "REJECTED") && !statusNotificationSent) {
                    sendStatusNotification();
                  }
                }}
                className="h-4 w-4 rounded border-input cursor-pointer disabled:cursor-not-allowed"
              />
              <label
                htmlFor="notificationConfirm"
                className={`text-sm flex items-center gap-2 cursor-pointer ${
                  (claim.status === "IN_ANALYSIS" && notificationSent) || ((claim.status === "APPROVED" || claim.status === "REJECTED") && statusNotificationSent)
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                }`}
              >
                {isSendingNotification || isSendingStatusNotification ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("claims.metadata.email.sending")}
                  </>
                ) : (claim.status === "IN_ANALYSIS" && notificationSent) || ((claim.status === "APPROVED" || claim.status === "REJECTED") && statusNotificationSent) ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {t("claims.metadata.email.sent")}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {t("claims.metadata.email.sendNotification")}
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Server Folder Path (read-only). Folder se automatski kreira kada se popune Firma i MR Code. */}
        {claim.serverFolderPath ? (
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              {t("claims.metadata.serverFolderPath")}
            </Label>
            <Input value={claim.serverFolderPath} disabled className="h-9" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              {t("claims.metadata.serverFolderPath")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("claims.metadata.folderAutoCreateHint")}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
