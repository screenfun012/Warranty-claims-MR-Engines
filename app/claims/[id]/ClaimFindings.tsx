"use client";

import { useState, useEffect, useRef } from "react";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

interface ClaimFindingsProps {
  claim: any;
  onUpdate?: (updates: any) => void;
  isReadOnly?: boolean;
}

export function ClaimFindings({ claim, onUpdate, isReadOnly = false }: ClaimFindingsProps) {
  const [sections, setSections] = useState<any[]>(claim.reportSections || []);
  const [pendingSaves, setPendingSaves] = useState<Map<string, string>>(new Map());
  const saveTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Update sections when claim changes
  useEffect(() => {
    setSections(claim.reportSections || []);
  }, [claim.reportSections]);

  // Save pending changes when component unmounts or tab changes
  useEffect(() => {
    const currentPendingSaves = new Map(pendingSaves);
    const currentClaimId = claim.id;
    
    return () => {
      // Clear all timeouts
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      
      // Save any pending changes immediately
      currentPendingSaves.forEach((text, sectionId) => {
        fetch(`/api/claims/${currentClaimId}/report-sections/${sectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textSr: text }),
        }).catch(error => {
          console.error("Error saving section on unmount:", error);
        });
      });
    };
  }, [pendingSaves, claim.id]);

  const sectionsByType = sections.reduce((acc: any, section: any) => {
    if (!acc[section.sectionType]) {
      acc[section.sectionType] = [];
    }
    acc[section.sectionType].push(section);
    return acc;
  }, {});

  // Sort sections by orderIndex or createdAt
  Object.keys(sectionsByType).forEach((type) => {
    sectionsByType[type].sort((a: any, b: any) => {
      if (a.orderIndex !== b.orderIndex) {
        return a.orderIndex - b.orderIndex;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  });

  return (
    <div className="space-y-4">
      {Object.entries(sectionsByType).map(([type, sections]: [string, any]) => (
        <Card key={type} className="p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold mb-4">{type}</h3>
          <div className="space-y-4">
            {sections.map((section: any, index: number) => (
              <div key={section.id} className="pl-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Zapazanje {index + 1}</Label>
                  <div className="flex items-center gap-2">
                    {section.createdAt && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(section.createdAt).toLocaleString('sr-RS', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                    {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!confirm("Da li ste sigurni da želite da obrišete ovo zapazanje?")) {
                          return;
                        }
                        try {
                          const res = await fetch(`/api/claims/${claim.id}/report-sections/${section.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) {
                            // Remove from local state
                            setSections(prev => prev.filter(s => s.id !== section.id));
                            // Refresh claim data to ensure consistency
                            if (onUpdate) {
                              // Fetch updated claim
                              const claimRes = await fetch(`/api/claims/${claim.id}`);
                              if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                onUpdate({ reportSections: claimData.claim.reportSections });
                              }
                            } else {
                              // Fallback: reload page
                              window.location.reload();
                            }
                          } else {
                            const errorData = await res.json();
                            alert("Failed to delete section: " + (errorData.error || "Unknown error"));
                          }
                        } catch (error) {
                          console.error("Error deleting section:", error);
                          alert("Failed to delete section");
                        }
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Textarea 
                    value={section.textSr || ""} 
                    rows={6} 
                    onChange={(e) => {
                      if (isReadOnly) return;
                      const newText = e.target.value;
                      const sectionId = section.id;
                      
                      // Optimistic update
                      setSections(prev => prev.map(s => 
                        s.id === sectionId ? { ...s, textSr: newText } : s
                      ));
                      
                      // Clear existing timeout for this section
                      const existingTimeout = saveTimeouts.current.get(sectionId);
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                      }
                      
                      // Set pending save
                      setPendingSaves(prev => new Map(prev).set(sectionId, newText));
                      
                      // Debounce save - save after 1 second of no typing
                      const timeout = setTimeout(async () => {
                        try {
                          const res = await fetch(`/api/claims/${claim.id}/report-sections/${sectionId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ textSr: newText }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            // Update local state with saved data
                            setSections(prev => prev.map(s => 
                              s.id === sectionId ? { ...s, textSr: data.section.textSr || "" } : s
                            ));
                            // Remove from pending saves
                            setPendingSaves(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(sectionId);
                              return newMap;
                            });
                            // Update parent claim state
                            if (onUpdate) {
                              const claimRes = await fetch(`/api/claims/${claim.id}`);
                              if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                onUpdate({ reportSections: claimData.claim.reportSections });
                              }
                            }
                          } else {
                            const errorData = await res.json();
                            console.error("Error updating section:", errorData.error);
                            // Revert optimistic update
                            setSections(prev => prev.map(s => 
                              s.id === sectionId ? { ...s, textSr: section.textSr || "" } : s
                            ));
                          }
                        } catch (error) {
                          console.error("Error updating section:", error);
                          // Revert optimistic update
                          setSections(prev => prev.map(s => 
                            s.id === sectionId ? { ...s, textSr: section.textSr || "" } : s
                          ));
                        }
                        saveTimeouts.current.delete(sectionId);
                      }, 1000);
                      
                      saveTimeouts.current.set(sectionId, timeout);
                    }}
                    onBlur={async (e) => {
                      if (isReadOnly) return;
                      const sectionId = section.id;
                      const newText = e.target.value;
                      
                      // Clear timeout and save immediately
                      const existingTimeout = saveTimeouts.current.get(sectionId);
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                        saveTimeouts.current.delete(sectionId);
                      }
                      
                      // Save immediately on blur
                      const pendingText = pendingSaves.get(sectionId) || newText;
                      if (pendingText !== (section.textSr || "")) {
                        try {
                          const res = await fetch(`/api/claims/${claim.id}/report-sections/${sectionId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ textSr: pendingText }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setSections(prev => prev.map(s => 
                              s.id === sectionId ? { ...s, textSr: data.section.textSr || "" } : s
                            ));
                            setPendingSaves(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(sectionId);
                              return newMap;
                            });
                            if (onUpdate) {
                              const claimRes = await fetch(`/api/claims/${claim.id}`);
                              if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                onUpdate({ reportSections: claimData.claim.reportSections });
                              }
                            }
                          }
                        } catch (error) {
                          console.error("Error saving section on blur:", error);
                        }
                      }
                    }}
                    placeholder="Unesi zapazanja..."
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {!isReadOnly && (
      <div className="flex justify-end">
        <Button
          onClick={async () => {
            try {
              const res = await fetch(`/api/claims/${claim.id}/report-sections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sectionType: "FINDINGS",
                  orderIndex: sections.length,
                  textSr: "",
                }),
              });
              if (res.ok) {
                const data = await res.json();
                setSections([...sections, data.section]);
              } else {
                const errorData = await res.json();
                alert("Failed to create section: " + (errorData.error || "Unknown error"));
              }
            } catch (error) {
              console.error("Error creating section:", error);
              alert("Failed to create section");
            }
          }}
        >
          + Add New Section
        </Button>
      </div>
      )}
      {sections.length === 0 && !isReadOnly && (
        <Card className="p-6">
          <p className="text-muted-foreground mb-4">No report sections found. Create one to add findings.</p>
          <Button
            onClick={async () => {
              try {
                const res = await fetch(`/api/claims/${claim.id}/report-sections`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sectionType: "FINDINGS",
                    orderIndex: 0,
                    textSr: "",
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setSections([data.section]);
                } else {
                  const errorData = await res.json();
                  alert("Failed to create section: " + (errorData.error || "Unknown error"));
                }
              } catch (error) {
                console.error("Error creating section:", error);
                alert("Failed to create section");
              }
            }}
          >
            Create New Section
          </Button>
        </Card>
      )}
    </div>
  );
}

