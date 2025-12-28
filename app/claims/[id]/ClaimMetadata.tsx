"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash, Building2, Settings, User, FolderOpen, FileCode } from "lucide-react";

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
  const [assignedToName, setAssignedToName] = useState(claim.assignedTo?.fullName || "");
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [isEditingAssignedToName, setIsEditingAssignedToName] = useState(false);
  
  const prevClaimIdRef = useRef(claim.id);

  // Only update local state when claim ID changes (new claim loaded), not when editing
  useEffect(() => {
    if (prevClaimIdRef.current !== claim.id) {
      // New claim loaded, reset local state
      setAssignedToName(claim.assignedTo?.fullName || "");
      setCustomerName(claim.customer?.name || "");
      setIsEditingCustomerName(false);
      setIsEditingAssignedToName(false);
      prevClaimIdRef.current = claim.id;
    } else if (!isEditingCustomerName && !isEditingAssignedToName) {
      // Claim updated from outside (e.g., after API call), update if not editing
      const newAssignedToName = claim.assignedTo?.fullName || "";
      const newCustomerName = claim.customer?.name || "";
      
      if (newAssignedToName !== assignedToName) {
        setAssignedToName(newAssignedToName);
      }
      if (newCustomerName !== customerName) {
        setCustomerName(newCustomerName);
      }
    }
  }, [claim.id, claim.assignedTo?.fullName, claim.customer?.name]);
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
            value={claim.claimCodeRaw || ""}
            onChange={(e) => {
              if (!isReadOnly) {
                onUpdate({ 
                  claimCodeRaw: e.target.value,
                  ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
                });
              }
            }}
            placeholder="MR1234/25"
            disabled={isReadOnly}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            Prefix
          </Label>
          <Input 
            value={claim.claimPrefix || ""} 
            onChange={(e) => {
              if (!isReadOnly) {
                onUpdate({ 
                  claimPrefix: e.target.value,
                  ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
                });
              }
            }}
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
            onFocus={() => {
              if (!isReadOnly) {
                setIsEditingCustomerName(true);
              }
            }}
            onChange={(e) => {
              if (isReadOnly) return;
              const newName = e.target.value;
              setCustomerName(newName);
            }}
            onBlur={async (e) => {
              if (isReadOnly) return;
              setIsEditingCustomerName(false);
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
            value={claim.engineType || ""}
            onChange={(e) => {
              if (!isReadOnly) {
                onUpdate({ 
                  engineType: e.target.value,
                  ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
                });
              }
            }}
            disabled={isReadOnly}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2">Engine Code</Label>
          <Input
            value={claim.mrEngineCode || ""}
            onChange={(e) => {
              if (!isReadOnly) {
                onUpdate({ 
                  mrEngineCode: e.target.value,
                  ...(claim.status === "NEW" && { status: "IN_ANALYSIS" })
                });
              }
            }}
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
            onFocus={() => {
              if (!isReadOnly) {
                setIsEditingAssignedToName(true);
              }
            }}
            onChange={(e) => {
              if (isReadOnly) return;
              setAssignedToName(e.target.value);
            }}
            onBlur={async (e) => {
              if (isReadOnly) return;
              setIsEditingAssignedToName(false);
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

