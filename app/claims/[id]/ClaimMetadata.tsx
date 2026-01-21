"use client";

import { useState, useEffect, useRef } from "react";
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

interface Department {
  id: string;
  name: string;
  isSystem: boolean;
}

// Predefined list of workers
const WORKER_LIST = [
  "IVICA STANISAVLJEVĆ",
  "IVAN STANISAVLJEVIĆ",
  "EMRUŠ DULJAJ",
  "ELMEDIN DULJAJ",
  "PETAR PETROVIC",
  "DRAGAN MILOSAVLJEVIĆ",
  "MARKO ŽIVANOVIĆ",
  "DEJAN MILOVANOVIĆ",
  "MILOS ĆEBIĆ",
  "BOJAN TANASKOVIĆ",
  "DEJAN SIMIĆ",
  "NIKOLA MIRKOVIĆ",
  "STEFAN NOVAKOVIĆ",
  "NEBOJŠA NIKOLIĆ",
];

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
  const auth0User = user as any;
  const userRole = auth0User?.['https://mr-engines-warranty/roles']?.[0] || auth0User?.role || "VIEWER";
  const canManageDepartments = hasMinRole(userRole, "ADMIN");

  // Local state for all editable fields
  const [claimCode, setClaimCode] = useState(claim.claimCodeRaw || "");
  const [customerNumber, setCustomerNumber] = useState(claim.customerNumber || "");
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");
  const [customerCompany, setCustomerCompany] = useState(claim.customer?.company || "");
  const [engineType, setEngineType] = useState(claim.engineType || "");
  const [engineCode, setEngineCode] = useState(claim.mrEngineCode || "");
  const [assignedWorkerName, setAssignedWorkerName] = useState(claim.assignedWorkerName || "");
  const [faultDepartmentId, setFaultDepartmentId] = useState(claim.faultDepartment?.id || "");
  const [faultDepartmentIds, setFaultDepartmentIds] = useState<string[]>(
    claim.faultDepartments?.map((d) => d.id) || (claim.faultDepartment?.id ? [claim.faultDepartment.id] : [])
  );
  const [workerFault, setWorkerFault] = useState(claim.workerFault || "");
  const [yearEngineDone, setYearEngineDone] = useState(claim.yearEngineDone?.toString() || "");
  const [dateEngineDone, setDateEngineDone] = useState<Date | undefined>(claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined);
  const [claimArrivalDate, setClaimArrivalDate] = useState<Date | undefined>(claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined);
  const [reason, setReason] = useState(claim.reason || "");
  const [isDomesticMarket, setIsDomesticMarket] = useState(claim.isDomesticMarket || false);
  
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
  
  const prevClaimIdRef = useRef(claim.id);

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
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
    };
    loadDepartments();
  }, []);

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
        alert("Failed to add department: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error adding department:", error);
      alert("Failed to add department");
    } finally {
      setAddingDepartment(false);
    }
  };

  // Send processing notification email
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
        throw new Error(error.error || "Greška pri slanju emaila");
      }
      
      setNotificationSent(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Greška pri slanju emaila");
      setNotificationSent(false);
    } finally {
      setIsSendingNotification(false);
    }
  };

  // Sync local state when claim changes
  useEffect(() => {
    if (prevClaimIdRef.current !== claim.id) {
      // New claim loaded, reset all local state
      setClaimCode(claim.claimCodeRaw || "");
      setCustomerNumber(claim.customerNumber || "");
      setCustomerName(claim.customer?.name || "");
      setCustomerCompany(claim.customer?.company || "");
      setEngineType(claim.engineType || "");
      setEngineCode(claim.mrEngineCode || "");
      setAssignedWorkerName(claim.assignedWorkerName || "");
      setFaultDepartmentId(claim.faultDepartment?.id || "");
      setFaultDepartmentIds(claim.faultDepartments?.map((d) => d.id) || (claim.faultDepartment?.id ? [claim.faultDepartment.id] : []));
      setWorkerFault(claim.workerFault || "");
      setYearEngineDone(claim.yearEngineDone?.toString() || "");
      setDateEngineDone(claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined);
      setClaimArrivalDate(claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined);
      setReason(claim.reason || "");
      setIsDomesticMarket(claim.isDomesticMarket || false);
      setEditingField(null);
      setNotificationSent(!!claim.processingEmailSentAt);
      prevClaimIdRef.current = claim.id;
    } else if (!editingField) {
      // External update, sync if not editing
      if (claim.claimCodeRaw !== claimCode) setClaimCode(claim.claimCodeRaw || "");
      if (claim.customerNumber !== customerNumber) setCustomerNumber(claim.customerNumber || "");
      if (claim.customer?.name !== customerName) setCustomerName(claim.customer?.name || "");
      if (claim.customer?.company !== customerCompany) setCustomerCompany(claim.customer?.company || "");
      if (claim.engineType !== engineType) setEngineType(claim.engineType || "");
      if (claim.mrEngineCode !== engineCode) setEngineCode(claim.mrEngineCode || "");
      if (claim.assignedWorkerName !== assignedWorkerName) setAssignedWorkerName(claim.assignedWorkerName || "");
      if (claim.faultDepartment?.id !== faultDepartmentId) setFaultDepartmentId(claim.faultDepartment?.id || "");
      // Sync multiple fault departments
      const newFaultDepartmentIds = claim.faultDepartments?.map((d) => d.id) || (claim.faultDepartment?.id ? [claim.faultDepartment.id] : []);
      if (JSON.stringify(newFaultDepartmentIds.sort()) !== JSON.stringify(faultDepartmentIds.sort())) {
        setFaultDepartmentIds(newFaultDepartmentIds);
      }
      if (claim.workerFault !== workerFault) setWorkerFault(claim.workerFault || "");
      if (claim.yearEngineDone?.toString() !== yearEngineDone) setYearEngineDone(claim.yearEngineDone?.toString() || "");
      // Sync date fields
      const newDateEngineDone = claim.dateEngineDone ? new Date(claim.dateEngineDone) : undefined;
      if (newDateEngineDone?.toISOString() !== dateEngineDone?.toISOString()) setDateEngineDone(newDateEngineDone);
      const newClaimArrivalDate = claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : undefined;
      if (newClaimArrivalDate?.toISOString() !== claimArrivalDate?.toISOString()) setClaimArrivalDate(newClaimArrivalDate);
      if (claim.reason !== reason) setReason(claim.reason || "");
      if (claim.isDomesticMarket !== isDomesticMarket) setIsDomesticMarket(claim.isDomesticMarket || false);
      if (!!claim.processingEmailSentAt !== notificationSent) setNotificationSent(!!claim.processingEmailSentAt);
    }
  }, [
    claim.id, claim.claimCodeRaw, claim.customerNumber, claim.customer?.name, claim.customer?.company,
    claim.engineType, claim.mrEngineCode, claim.assignedWorkerName,
    claim.faultDepartment?.id, claim.faultDepartments, claim.workerFault, claim.yearEngineDone, claim.dateEngineDone, claim.claimArrivalDate,
    claim.reason, claim.isDomesticMarket, claim.processingEmailSentAt,
    editingField, claimCode, customerNumber, customerName, customerCompany, engineType, engineCode,
    assignedWorkerName, faultDepartmentId, faultDepartmentIds, workerFault, yearEngineDone, dateEngineDone, claimArrivalDate, reason, isDomesticMarket, notificationSent
  ]);

  // Save field on blur
  const handleFieldBlur = (field: string, value: string | number | boolean | null) => {
    setEditingField(null);
    if (isReadOnly) return;
    
    // Get original value
    let originalValue: any = null;
    switch (field) {
      case 'claimCodeRaw': originalValue = claim.claimCodeRaw; break;
      case 'customerNumber': originalValue = claim.customerNumber; break;
      case 'engineType': originalValue = claim.engineType; break;
      case 'mrEngineCode': originalValue = claim.mrEngineCode; break;
      case 'assignedWorkerName': originalValue = claim.assignedWorkerName; break;
      case 'workerFault': originalValue = claim.workerFault; break;
      case 'yearEngineDone': originalValue = claim.yearEngineDone; break;
      case 'reason': originalValue = claim.reason; break;
      case 'isDomesticMarket': originalValue = claim.isDomesticMarket; break;
      case 'dateEngineDone': originalValue = claim.dateEngineDone; break;
      case 'claimArrivalDate': originalValue = claim.claimArrivalDate; break;
      default: return; // Unknown field, don't save
    }
    
    // Normalize values for comparison (empty string = null for strings)
    const normalizedValue = typeof value === 'string' && value.trim() === '' ? null : value;
    const normalizedOriginal = originalValue === null || originalValue === undefined 
      ? null 
      : (typeof originalValue === 'string' && originalValue.trim() === '' ? null : originalValue);
    
    // Only save if value changed
    if (normalizedValue !== normalizedOriginal) {
      const updates: Record<string, unknown> = { [field]: normalizedValue };
      // Auto-change status to IN_ANALYSIS if currently NEW
      if (claim.status === "NEW") {
        updates.status = "IN_ANALYSIS";
      }
      onUpdate(updates);
      
      // Reset notification when claim code changes
      if (field === 'claimCodeRaw') {
        setNotificationSent(false);
      }
    }
  };

  // Handle customer name/company update
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
    
    if (claim.customer?.id) {
      try {
        const res = await fetch(`/api/customers/${claim.customer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: normalizedNewName || null, 
            company: normalizedNewCompany || null 
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onUpdate({ 
            customerId: data.customer.id,
            customer: data.customer,
            ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to update customer:", errorData);
          if (field === 'name') setCustomerName(currentName);
          if (field === 'company') setCustomerCompany(currentCompany);
          alert("Failed to update customer: " + (errorData.error || "Unknown error"));
        }
      } catch (error) {
        console.error("Error updating customer:", error);
        if (field === 'name') setCustomerName(currentName);
        if (field === 'company') setCustomerCompany(currentCompany);
        alert("Failed to update customer");
      }
    } else if (normalizedNewName || normalizedNewCompany) {
      // Allow creating customer with name OR company (at least one must be provided)
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: normalizedNewName || null,
            company: normalizedNewCompany || null,
            claimId: claim.id,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onUpdate({ 
            customerId: data.customer.id,
            customer: data.customer,
            ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to create customer:", errorData);
          setCustomerName("");
          setCustomerCompany("");
          alert("Failed to create customer: " + (errorData.error || "Unknown error"));
        }
      } catch (error) {
        console.error("Error creating customer:", error);
        setCustomerName("");
        setCustomerCompany("");
        alert("Failed to create customer");
      }
    } else {
      setCustomerName("");
      setCustomerCompany("");
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
    setIsDomesticMarket(checked);
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
        Metadata
      </h2>
      <div className="space-y-4 overflow-hidden">
        {/* MR Number - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            MR Number <span className="text-red-500">*</span>
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
          {claimCode && claim.status === "IN_ANALYSIS" && !isReadOnly && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="notificationConfirm"
                checked={notificationSent}
                disabled={isSendingNotification || notificationSent}
                onChange={(e) => {
                  if (e.target.checked && !notificationSent) {
                    sendProcessingNotification();
                  }
                }}
                className="h-4 w-4 rounded border-input cursor-pointer disabled:cursor-not-allowed"
              />
              <label 
                htmlFor="notificationConfirm" 
                className={`text-sm flex items-center gap-2 cursor-pointer ${notificationSent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
              >
                {isSendingNotification ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Slanje...
                  </>
                ) : notificationSent ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Obaveštenje poslato
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Potvrdi i pošalji obaveštenje klijentu
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Customer Number */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Customer Number
          </Label>
          <Input
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            onFocus={() => setEditingField('customerNumber')}
            onBlur={(e) => handleFieldBlur('customerNumber', e.target.value)}
            placeholder="Customer number"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Customer Name - Optional */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Customer Name
          </Label>
          <Input
            value={customerName}
            placeholder="Customer name"
            disabled={isReadOnly}
            onFocus={() => setEditingField('customerName')}
            onChange={(e) => setCustomerName(e.target.value)}
            onBlur={(e) => handleCustomerUpdate('name', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Customer Company - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Customer Company <span className="text-red-500">*</span>
          </Label>
          <Select
            value={customerCompany}
            onValueChange={(value) => {
              setCustomerCompany(value);
              handleCustomerUpdate('company', value);
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_LIST.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Engine Type */}
        <div>
          <Label className="text-sm font-medium mb-2">Engine Type</Label>
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
          <Label className="text-sm font-medium mb-2">Engine Code</Label>
          <Input
            value={engineCode}
            onChange={(e) => setEngineCode(e.target.value)}
            onFocus={() => setEditingField('mrEngineCode')}
            onBlur={(e) => handleFieldBlur('mrEngineCode', e.target.value)}
            placeholder="Engine code"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Assigned Worker (Worker who worked on engine) - Select dropdown */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Assigned Worker (Ko je radio motor)
          </Label>
          <Select
            value={assignedWorkerName}
            onValueChange={(value) => {
              setAssignedWorkerName(value);
              handleFieldBlur('assignedWorkerName', value);
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select worker" />
            </SelectTrigger>
            <SelectContent>
              {WORKER_LIST.map((worker) => (
                <SelectItem key={worker} value={worker}>
                  {worker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fault Department - Multi-select */}
        <div>
          <Label className="text-sm font-medium mb-2">Fault Department</Label>
          <div className="flex gap-2 min-w-0">
            <MultiSelect
              options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
              selected={faultDepartmentIds}
              onChange={(selected) => {
                setFaultDepartmentIds(selected);
                // Update claim with multiple departments
                onUpdate({ faultDepartmentIds: selected });
              }}
              placeholder="Select departments..."
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
                    <DialogTitle>Add New Department</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Department Name</Label>
                      <Input
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        placeholder="Enter department name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !addingDepartment) {
                            handleAddDepartment();
                          }
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddDepartment(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddDepartment} disabled={!newDepartmentName.trim() || addingDepartment}>
                        {addingDepartment ? "Adding..." : "Add"}
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
          <Label className="text-sm font-medium mb-2">Worker Fault</Label>
          <Input
            value={workerFault}
            onChange={(e) => setWorkerFault(e.target.value)}
            onFocus={() => setEditingField('workerFault')}
            onBlur={(e) => handleFieldBlur('workerFault', e.target.value)}
            placeholder="Worker responsible for fault"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>

        {/* Date Engine Done */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Date Engine Done
          </Label>
          <DatePicker
            date={dateEngineDone}
            onSelect={(date) => {
              setDateEngineDone(date);
              // Auto-update when date is selected
              const updates: Record<string, unknown> = { dateEngineDone: date?.toISOString() || null };
              if (claim.status === "NEW") {
                updates.status = "IN_ANALYSIS";
              }
              onUpdate(updates);
            }}
            placeholder="Select date"
            disabled={isReadOnly}
          />
        </div>

        {/* Claim Arrival Date */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Claim Arrival Date
          </Label>
          <DatePicker
            date={claimArrivalDate}
            onSelect={(date) => {
              setClaimArrivalDate(date);
              // Auto-update when date is selected
              const updates: Record<string, unknown> = { claimArrivalDate: date?.toISOString() || null };
              if (claim.status === "NEW") {
                updates.status = "IN_ANALYSIS";
              }
              onUpdate(updates);
            }}
            placeholder="Select date"
            disabled={isReadOnly}
          />
        </div>

        {/* Reason */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Reason
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onFocus={() => setEditingField('reason')}
            onBlur={(e) => handleFieldBlur('reason', e.target.value)}
            placeholder="Short reason for the claim"
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
            Domestic Market
          </Label>
        </div>

        {/* Server Folder Path (read-only) */}
        {claim.serverFolderPath && (
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Server Folder Path
            </Label>
            <Input value={claim.serverFolderPath} disabled className="h-9" />
          </div>
        )}
      </div>
    </Card>
  );
}
