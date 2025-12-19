"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Building2, Settings, User, FolderOpen, FileCode } from "lucide-react";

interface ClaimMetadataProps {
  claim: any;
  onUpdate: (updates: any) => void;
  isReadOnly?: boolean;
}

export function ClaimMetadata({ claim, onUpdate, isReadOnly = false }: ClaimMetadataProps) {
  const [assignedToName, setAssignedToName] = useState(claim.assignedTo?.fullName || "");
  const [customerName, setCustomerName] = useState(claim.customer?.name || "");

  // Update local state when claim changes
  useEffect(() => {
    setAssignedToName(claim.assignedTo?.fullName || "");
    setCustomerName(claim.customer?.name || "");
  }, [claim.assignedTo?.fullName, claim.customer?.name]);
  return (
    <Card className="p-4 border border-border">
      <h2 className="text-sm font-semibold mb-4 text-primary flex items-center gap-2">
        <Settings className="h-4 w-4" />
        Metadata
      </h2>
      <div className="space-y-3">
        <div>
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <Hash className="h-3 w-3 text-muted-foreground" />
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
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <FileCode className="h-3 w-3 text-muted-foreground" />
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
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            Customer Name
          </Label>
          <Input
            value={customerName}
            placeholder="Customer name"
            disabled={isReadOnly}
            onChange={(e) => {
              if (isReadOnly) return;
              const newName = e.target.value;
              setCustomerName(newName);
            }}
            onBlur={async (e) => {
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
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5">Engine Type</Label>
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
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5">Engine Code</Label>
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
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            Assigned To
          </Label>
          <Input
            value={assignedToName}
            placeholder="Assigned user"
            disabled={isReadOnly}
            onChange={(e) => {
              if (isReadOnly) return;
              setAssignedToName(e.target.value);
            }}
            onBlur={async (e) => {
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
            className="h-8 text-sm"
          />
        </div>
        {claim.serverFolderPath && (
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5">
              <FolderOpen className="h-3 w-3 text-muted-foreground" />
              Server Folder Path
            </Label>
            <Input value={claim.serverFolderPath} disabled className="h-8 text-sm" />
          </div>
        )}
      </div>
    </Card>
  );
}

