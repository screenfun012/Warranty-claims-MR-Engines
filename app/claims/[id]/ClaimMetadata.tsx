"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash, Building2, Settings, User, FolderOpen, FileCode, Mail, CheckCircle2, Loader2 } from "lucide-react";

interface ClaimMetadataProps {
  claim: {
    id: string;
    claimCodeRaw: string | null;
    claimPrefix: string | null;
    claimNumber: number | null;
    claimYear: number | null;
    status: string;
    engineType: string | null;
    mrEngineCode: string | null;
    customerReference: string | null;
    invoiceNumber: string | null;
    serverFolderPath: string | null;
    processingEmailSentAt: string | null; // ISO date string
    assignedTo: {
      id: string;
      fullName: string;
    } | null;
    customer: {
      id: string;
      name: string;
    } | null;
  };
  onUpdate: (updates: Record<string, unknown>) => void;
  isReadOnly?: boolean;
}

export function ClaimMetadata({ claim, onUpdate, isReadOnly = false }: ClaimMetadataProps) {
  // Local state for all editable fields - prevents race conditions while typing
  const [claimCode, setClaimCode] = useState(claim.claimCodeRaw || "");
  const [prefix, setPrefix] = useState(claim.claimPrefix || "");
  const [engineType, setEngineType] = useState(claim.engineType || "");
  const [engineCode, setEngineCode] = useState(claim.mrEngineCode || "");
  const [assignedToName, setAssignedToName] = useState(claim.assignedTo?.fullName || "");
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");
  
  // Track which fields are being edited
  const [editingField, setEditingField] = useState<string | null>(null);
  // Initialize notificationSent from database value
  const [notificationSent, setNotificationSent] = useState(!!claim.processingEmailSentAt);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  
  const prevClaimIdRef = useRef(claim.id);
  
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

  // Sync local state when claim changes (new claim loaded or external update)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prevClaimIdRef.current !== claim.id) {
      // New claim loaded, reset all local state
      setClaimCode(claim.claimCodeRaw || "");
      setPrefix(claim.claimPrefix || "");
      setEngineType(claim.engineType || "");
      setEngineCode(claim.mrEngineCode || "");
      setAssignedToName(claim.assignedTo?.fullName || "");
      setCustomerName(claim.customer?.name || "");
      setEditingField(null);
      setNotificationSent(!!claim.processingEmailSentAt);
      prevClaimIdRef.current = claim.id;
    } else if (!editingField) {
      // External update (e.g., from another tab), sync if not editing
      if (claim.claimCodeRaw !== claimCode) setClaimCode(claim.claimCodeRaw || "");
      if (claim.claimPrefix !== prefix) setPrefix(claim.claimPrefix || "");
      if (claim.engineType !== engineType) setEngineType(claim.engineType || "");
      if (claim.mrEngineCode !== engineCode) setEngineCode(claim.mrEngineCode || "");
      if (claim.assignedTo?.fullName !== assignedToName) setAssignedToName(claim.assignedTo?.fullName || "");
      if (claim.customer?.name !== customerName) setCustomerName(claim.customer?.name || "");
      // Sync notification status
      if (!!claim.processingEmailSentAt !== notificationSent) setNotificationSent(!!claim.processingEmailSentAt);
    }
  }, [claim.id, claim.claimCodeRaw, claim.claimPrefix, claim.engineType, claim.mrEngineCode, claim.assignedTo?.fullName, claim.customer?.name, claim.processingEmailSentAt, editingField]);

  // Save field on blur
  const handleFieldBlur = (field: string, value: string) => {
    setEditingField(null);
    
    // Get original value
    let originalValue: string | null = null;
    switch (field) {
      case 'claimCodeRaw': originalValue = claim.claimCodeRaw; break;
      case 'claimPrefix': originalValue = claim.claimPrefix; break;
      case 'engineType': originalValue = claim.engineType; break;
      case 'mrEngineCode': originalValue = claim.mrEngineCode; break;
    }
    
    // Only save if value changed
    if (value !== (originalValue || "")) {
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
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6 text-primary flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Metadata
      </h2>
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Claim Code
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
          {/* Notification checkbox - only show when claim has code and is in analysis */}
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
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            Prefix
          </Label>
          <Input 
            value={prefix} 
            onChange={(e) => setPrefix(e.target.value)}
            onFocus={() => setEditingField('claimPrefix')}
            onBlur={(e) => handleFieldBlur('claimPrefix', e.target.value)}
            placeholder="MR"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>
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
            onBlur={async (e) => {
              setEditingField(null);
              if (isReadOnly) return;
              const newName = e.target.value.trim();
              const currentName = claim.customer?.name || "";
              
              if (newName === currentName) {
                return;
              }
              
              if (claim.customer?.id) {
                try {
                  const res = await fetch(`/api/customers/${claim.customer.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    onUpdate({ 
                      customerId: data.customer.id,
                      customer: data.customer,
                      ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
                    });
                  } else {
                    setCustomerName(currentName);
                    alert("Failed to update customer name");
                  }
                } catch (error) {
                  console.error("Error updating customer:", error);
                  setCustomerName(currentName);
                  alert("Failed to update customer name");
                }
              } else if (newName.trim()) {
                try {
                  const res = await fetch("/api/customers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      name: newName,
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
                    alert("Failed to create customer");
                  }
                } catch (error) {
                  console.error("Error creating customer:", error);
                  setCustomerName("");
                  alert("Failed to create customer");
                }
              } else {
                setCustomerName("");
              }
            }}
            className="h-9"
          />
        </div>
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
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Assigned To
          </Label>
          <Input
            value={assignedToName}
            placeholder="Assigned user"
            disabled={isReadOnly}
            onFocus={() => setEditingField('assignedTo')}
            onChange={(e) => setAssignedToName(e.target.value)}
            onBlur={async (e) => {
              setEditingField(null);
              if (isReadOnly) return;
              const newName = e.target.value.trim();
              const currentName = claim.assignedTo?.fullName || "";
              
              if (newName === currentName) {
                return;
              }
              
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
                  console.error("Error updating assignedTo:", errorData.error);
                  alert("Failed to update assigned to: " + (errorData.error || "Unknown error"));
                  setAssignedToName(currentName);
                }
              } catch (error) {
                console.error("Error updating assignedTo:", error);
                alert("Failed to update assigned to");
                setAssignedToName(currentName);
              }
            }}
            className="h-9"
          />
        </div>
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

