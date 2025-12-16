"use client";

import { useState, useEffect } from "react";
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

  // Update sections when claim changes
  useEffect(() => {
    setSections(claim.reportSections || []);
  }, [claim.reportSections]);

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
        <Card key={type} className="p-4">
          <h3 className="font-semibold mb-4">{type}</h3>
          <div className="space-y-4">
            {sections.map((section: any, index: number) => (
              <div key={section.id} className="border-l-2 pl-4 space-y-4">
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
                      // Optimistic update
                      setSections(prev => prev.map(s => 
                        s.id === section.id ? { ...s, textSr: newText } : s
                      ));
                    }}
                    onBlur={async (e) => {
                      if (isReadOnly) return;
                      const newText = e.target.value;
                      const originalText = section.textSr || "";
                      
                      // If text hasn't changed, don't make API call
                      if (newText === originalText) {
                        return;
                      }
                      
                      try {
                        const res = await fetch(`/api/claims/${claim.id}/report-sections/${section.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ textSr: newText }),
                        });
                        if (res.ok) {
                          // Update local state with saved data
                          const data = await res.json();
                          setSections(prev => prev.map(s => 
                            s.id === section.id ? { ...s, textSr: data.section.textSr || "" } : s
                          ));
                          // Refresh claim data to ensure consistency
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
                          alert("Failed to update section: " + (errorData.error || "Unknown error"));
                          // Revert optimistic update
                          setSections(prev => prev.map(s => 
                            s.id === section.id ? { ...s, textSr: originalText } : s
                          ));
                        }
                      } catch (error) {
                        console.error("Error updating section:", error);
                        alert("Failed to update section");
                        // Revert optimistic update
                        setSections(prev => prev.map(s => 
                          s.id === section.id ? { ...s, textSr: originalText } : s
                        ));
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

