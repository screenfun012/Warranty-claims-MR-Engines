"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Hash, Building2, Settings, User, FolderOpen, Mail, CheckCircle2, Loader2, 
  Calendar, AlertCircle, Wrench, FileText, Plus, X
} from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Department {
  id: string;
  name: string;
  isSystem: boolean;
}

interface ClaimMetadataProps {
  claim: {
    id: string;
    claimCodeRaw: string | null;
    status: string;
    engineType: string | null;
    mrEngineCode: string | null;
    serverFolderPath: string | null;
    processingEmailSentAt: string | null;
    yearEngineDone: number | null;
    workerFault: string | null;
    reason: string | null;
    isDomesticMarket: boolean;
    assignedTo: {
      id: string;
      fullName: string;
    } | null;
    customer: {
      id: string;
      name: string;
      company: string | null;
    } | null;
    faultDepartment: {
      id: string;
      name: string;
    } | null;
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
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");
  const [customerCompany, setCustomerCompany] = useState(claim.customer?.company || "");
  const [engineType, setEngineType] = useState(claim.engineType || "");
  const [engineCode, setEngineCode] = useState(claim.mrEngineCode || "");
  const [assignedToName, setAssignedToName] = useState(claim.assignedTo?.fullName || "");
  const [faultDepartmentId, setFaultDepartmentId] = useState(claim.faultDepartment?.id || "");
  const [workerFault, setWorkerFault] = useState(claim.workerFault || "");
  const [yearEngineDone, setYearEngineDone] = useState(claim.yearEngineDone?.toString() || "");
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
        setFaultDepartmentId(data.department.id);
        setNewDepartmentName("");
        setShowAddDepartment(false);
        // Update claim
        onUpdate({ faultDepartmentId: data.department.id });
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
      setCustomerName(claim.customer?.name || "");
      setCustomerCompany(claim.customer?.company || "");
      setEngineType(claim.engineType || "");
      setEngineCode(claim.mrEngineCode || "");
      setAssignedToName(claim.assignedTo?.fullName || "");
      setFaultDepartmentId(claim.faultDepartment?.id || "");
      setWorkerFault(claim.workerFault || "");
      setYearEngineDone(claim.yearEngineDone?.toString() || "");
      setReason(claim.reason || "");
      setIsDomesticMarket(claim.isDomesticMarket || false);
      setEditingField(null);
      setNotificationSent(!!claim.processingEmailSentAt);
      prevClaimIdRef.current = claim.id;
    } else if (!editingField) {
      // External update, sync if not editing
      if (claim.claimCodeRaw !== claimCode) setClaimCode(claim.claimCodeRaw || "");
      if (claim.customer?.name !== customerName) setCustomerName(claim.customer?.name || "");
      if (claim.customer?.company !== customerCompany) setCustomerCompany(claim.customer?.company || "");
      if (claim.engineType !== engineType) setEngineType(claim.engineType || "");
      if (claim.mrEngineCode !== engineCode) setEngineCode(claim.mrEngineCode || "");
      if (claim.assignedTo?.fullName !== assignedToName) setAssignedToName(claim.assignedTo?.fullName || "");
      if (claim.faultDepartment?.id !== faultDepartmentId) setFaultDepartmentId(claim.faultDepartment?.id || "");
      if (claim.workerFault !== workerFault) setWorkerFault(claim.workerFault || "");
      if (claim.yearEngineDone?.toString() !== yearEngineDone) setYearEngineDone(claim.yearEngineDone?.toString() || "");
      if (claim.reason !== reason) setReason(claim.reason || "");
      if (claim.isDomesticMarket !== isDomesticMarket) setIsDomesticMarket(claim.isDomesticMarket || false);
      if (!!claim.processingEmailSentAt !== notificationSent) setNotificationSent(!!claim.processingEmailSentAt);
    }
  }, [
    claim.id, claim.claimCodeRaw, claim.customer?.name, claim.customer?.company,
    claim.engineType, claim.mrEngineCode, claim.assignedTo?.fullName,
    claim.faultDepartment?.id, claim.workerFault, claim.yearEngineDone,
    claim.reason, claim.isDomesticMarket, claim.processingEmailSentAt,
    editingField, claimCode, customerName, customerCompany, engineType, engineCode,
    assignedToName, faultDepartmentId, workerFault, yearEngineDone, reason, isDomesticMarket, notificationSent
  ]);

  // Save field on blur
  const handleFieldBlur = (field: string, value: string | number | boolean | null) => {
    setEditingField(null);
    
    // Get original value
    let originalValue: any = null;
    switch (field) {
      case 'claimCodeRaw': originalValue = claim.claimCodeRaw; break;
      case 'engineType': originalValue = claim.engineType; break;
      case 'mrEngineCode': originalValue = claim.mrEngineCode; break;
      case 'workerFault': originalValue = claim.workerFault; break;
      case 'yearEngineDone': originalValue = claim.yearEngineDone; break;
      case 'reason': originalValue = claim.reason; break;
      case 'isDomesticMarket': originalValue = claim.isDomesticMarket; break;
    }
    
    // Only save if value changed
    if (value !== (originalValue ?? (typeof value === 'string' ? "" : typeof value === 'number' ? null : false))) {
      const updates: Record<string, unknown> = { [field]: value };
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
    const newName = field === 'name' ? value.trim() : currentName;
    const newCompany = field === 'company' ? value.trim() : currentCompany;
    
    if ((field === 'name' && newName === currentName) || (field === 'company' && newCompany === currentCompany)) {
      return;
    }
    
    if (claim.customer?.id) {
      try {
        const res = await fetch(`/api/customers/${claim.customer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, company: newCompany }),
        });
        if (res.ok) {
          const data = await res.json();
          onUpdate({ 
            customerId: data.customer.id,
            customer: data.customer,
            ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
          });
        } else {
          if (field === 'name') setCustomerName(currentName);
          if (field === 'company') setCustomerCompany(currentCompany);
          alert("Failed to update customer");
        }
      } catch (error) {
        console.error("Error updating customer:", error);
        if (field === 'name') setCustomerName(currentName);
        if (field === 'company') setCustomerCompany(currentCompany);
        alert("Failed to update customer");
      }
    } else if (newName.trim()) {
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: newName,
            company: newCompany || undefined,
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
          setCustomerName("");
          setCustomerCompany("");
          alert("Failed to create customer");
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

  // Handle assigned to update
  const handleAssignedToUpdate = async (value: string) => {
    setEditingField(null);
    if (isReadOnly) return;
    
    const newName = value.trim();
    const currentName = claim.assignedTo?.fullName || "";
    
    if (newName === currentName) return;
    
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToName: newName }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate({ assignedTo: data.claim.assignedTo });
        setAssignedToName(data.claim.assignedTo?.fullName || "");
      } else {
        const errorData = await res.json();
        alert("Failed to update assigned to: " + (errorData.error || "Unknown error"));
        setAssignedToName(currentName);
      }
    } catch (error) {
      console.error("Error updating assignedTo:", error);
      alert("Failed to update assigned to");
      setAssignedToName(currentName);
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
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6 text-primary flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Metadata
      </h2>
      <div className="space-y-4">
        {/* Claim Code - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Claim Code <span className="text-red-500">*</span>
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

        {/* Customer Name - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Customer Name <span className="text-red-500">*</span>
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
          <Input
            value={customerCompany}
            placeholder="Customer company"
            disabled={isReadOnly}
            onFocus={() => setEditingField('customerCompany')}
            onChange={(e) => setCustomerCompany(e.target.value)}
            onBlur={(e) => handleCustomerUpdate('company', e.target.value)}
            className="h-9"
          />
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

        {/* Assigned To (Worker who worked on engine) */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Assigned To (Worker)
          </Label>
          <Input
            value={assignedToName}
            placeholder="Worker who worked on engine"
            disabled={isReadOnly}
            onFocus={() => setEditingField('assignedTo')}
            onChange={(e) => setAssignedToName(e.target.value)}
            onBlur={(e) => handleAssignedToUpdate(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Fault Department */}
        <div>
          <Label className="text-sm font-medium mb-2">Fault Department</Label>
          <div className="flex gap-2">
            <Select
              value={faultDepartmentId}
              onValueChange={handleFaultDepartmentChange}
              disabled={isReadOnly || loadingDepartments}
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManageDepartments && (
              <Dialog open={showAddDepartment} onOpenChange={setShowAddDepartment}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={isReadOnly}>
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

        {/* Year Engine Done - Required */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Year Engine Done <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            value={yearEngineDone}
            onChange={(e) => setYearEngineDone(e.target.value)}
            onFocus={() => setEditingField('yearEngineDone')}
            onBlur={(e) => {
              const year = e.target.value ? parseInt(e.target.value, 10) : null;
              handleFieldBlur('yearEngineDone', year);
            }}
            placeholder="YYYY"
            min="1900"
            max="2100"
            disabled={isReadOnly}
            className="h-9"
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
