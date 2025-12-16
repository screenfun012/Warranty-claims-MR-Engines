"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClaimMetadataProps {
  claim: any;
  onUpdate: (updates: any) => void;
  isReadOnly?: boolean;
}

export function ClaimMetadata({ claim, onUpdate, isReadOnly = false }: ClaimMetadataProps) {
  const [assignedToName, setAssignedToName] = useState(claim.assignedTo?.fullName || "");

  // Update local state when claim changes
  useEffect(() => {
    setAssignedToName(claim.assignedTo?.fullName || "");
  }, [claim.assignedTo?.fullName]);
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Metadata</h2>
      <div className="space-y-4">
        <div>
          <Label>Claim Code</Label>
          <Input
            value={claim.claimCodeRaw || ""}
            onChange={(e) => !isReadOnly && onUpdate({ claimCodeRaw: e.target.value })}
            placeholder="MR1234/25"
            disabled={isReadOnly}
          />
        </div>
        <div>
          <Label>Prefix</Label>
          <Input 
            value={claim.claimPrefix || ""} 
            onChange={(e) => !isReadOnly && onUpdate({ claimPrefix: e.target.value })}
            placeholder="MR"
            disabled={isReadOnly}
          />
        </div>
        <div>
          <Label>Customer Name</Label>
          <Input
            value={claim.customer?.name || ""}
            placeholder="Customer name"
            onChange={async (e) => {
              if (isReadOnly) return;
              const newName = e.target.value;
              
              // Update customer name - if customer exists, update it, otherwise create new
              if (claim.customer?.id) {
                // Update existing customer
                try {
                  const res = await fetch(`/api/customers/${claim.customer.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    // Update claim with new customer data
                    onUpdate({ customerId: data.customer.id });
                  }
                } catch (error) {
                  console.error("Error updating customer:", error);
                }
              } else if (newName.trim()) {
                // Create new customer and link to claim
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
                    // Update claim with new customer ID
                    onUpdate({ customerId: data.customer.id });
                  }
                } catch (error) {
                  console.error("Error creating customer:", error);
                }
              }
            }}
          />
        </div>
        <div>
          <Label>Engine Type</Label>
          <Input
            value={claim.engineType || ""}
            onChange={(e) => !isReadOnly && onUpdate({ engineType: e.target.value })}
            disabled={isReadOnly}
          />
        </div>
        <div>
          <Label>Engine Code</Label>
          <Input
            value={claim.mrEngineCode || ""}
            onChange={(e) => !isReadOnly && onUpdate({ mrEngineCode: e.target.value })}
            placeholder="Engine code"
            disabled={isReadOnly}
          />
        </div>
        <div>
          <Label>Assigned To</Label>
          <Input
            value={assignedToName}
            placeholder="Assigned user"
            disabled={isReadOnly}
            onChange={(e) => {
              if (isReadOnly) return;
              // Only update local state, don't call onUpdate
              setAssignedToName(e.target.value);
            }}
            onBlur={async (e) => {
              if (isReadOnly) return;
              const newName = e.target.value.trim();
              const currentName = claim.assignedTo?.fullName || "";
              
              if (newName === currentName) {
                return; // No change
              }
              
              // Update assignedTo field only on blur
              try {
                const res = await fetch(`/api/claims/${claim.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ assignedToName: newName }),
                });
                if (res.ok) {
                  const data = await res.json();
                  // Update parent claim state
                  onUpdate({ assignedTo: data.claim.assignedTo });
                  // Update local state
                  setAssignedToName(data.claim.assignedTo?.fullName || "");
                } else {
                  const errorData = await res.json();
                  console.error("Error updating assignedTo:", errorData.error);
                  alert("Failed to update assigned to: " + (errorData.error || "Unknown error"));
                  // Revert to original value
                  setAssignedToName(currentName);
                }
              } catch (error) {
                console.error("Error updating assignedTo:", error);
                alert("Failed to update assigned to");
                // Revert to original value
                setAssignedToName(currentName);
              }
            }}
          />
        </div>
        {claim.serverFolderPath && (
          <div>
            <Label>Server Folder Path</Label>
            <Input value={claim.serverFolderPath} disabled />
          </div>
        )}
      </div>
    </Card>
  );
}

