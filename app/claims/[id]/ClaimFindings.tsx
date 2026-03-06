"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  const [sections, setSections] = useState<any[]>(claim.reportSections || []);
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const findingsClaimIdRef = useRef(claim.id);

  useEffect(() => {
    if (findingsClaimIdRef.current !== claim.id) {
      findingsClaimIdRef.current = claim.id;
      setSections(claim.reportSections || []);
    }
  }, [claim.id, claim.reportSections]);

  // Flush all pending section saves on unmount / page unload
  const pendingTexts = useRef<Map<string, string>>(new Map());

  const flushSection = useCallback(
    async (sectionId: string, text: string) => {
      try {
        const res = await fetch(
          `/api/claims/${claim.id}/report-sections/${sectionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ textSr: text }),
          },
        );
        if (res.ok) {
          pendingTexts.current.delete(sectionId);
        }
      } catch (err) {
        console.error("Error saving section:", err);
      }
    },
    [claim.id],
  );

  useEffect(() => {
    const handleBeforeUnload = () => {
      pendingTexts.current.forEach((text, sectionId) => {
        fetch(`/api/claims/${claim.id}/report-sections/${sectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textSr: text }),
          keepalive: true,
        }).catch(console.error);
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Flush all pending saves on unmount
      saveTimeouts.current.forEach((t) => clearTimeout(t));
      saveTimeouts.current.clear();
      pendingTexts.current.forEach((text, sectionId) => {
        fetch(`/api/claims/${claim.id}/report-sections/${sectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textSr: text }),
        }).catch(console.error);
      });
    };
  }, [claim.id]);

  const handleTextChange = useCallback(
    (sectionId: string, newText: string) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, textSr: newText } : s)),
      );
      pendingTexts.current.set(sectionId, newText);

      const existing = saveTimeouts.current.get(sectionId);
      if (existing) clearTimeout(existing);

      saveTimeouts.current.set(
        sectionId,
        setTimeout(() => {
          saveTimeouts.current.delete(sectionId);
          flushSection(sectionId, newText);
        }, 1000),
      );
    },
    [flushSection],
  );

  const handleBlur = useCallback(
    (sectionId: string) => {
      const pending = pendingTexts.current.get(sectionId);
      if (pending === undefined) return;
      const existing = saveTimeouts.current.get(sectionId);
      if (existing) {
        clearTimeout(existing);
        saveTimeouts.current.delete(sectionId);
      }
      flushSection(sectionId, pending);
    },
    [flushSection],
  );

  const handleDelete = useCallback(
    async (sectionId: string) => {
      if (!confirm(t("claims.findings.deleteConfirm"))) return;
      try {
        const res = await fetch(
          `/api/claims/${claim.id}/report-sections/${sectionId}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          setSections((prev) => prev.filter((s) => s.id !== sectionId));
          pendingTexts.current.delete(sectionId);
          if (onUpdate) {
            onUpdate({
              reportSections: sections.filter((s: any) => s.id !== sectionId),
            });
          }
        } else {
          const errorData = await res.json();
          alert(
            t("claims.findings.deleteError") +
              ": " +
              (errorData.error || t("common.error")),
          );
        }
      } catch (error) {
        console.error("Error deleting section:", error);
        alert(t("claims.findings.deleteError"));
      }
    },
    [claim.id, onUpdate, sections, t],
  );

  const handleAdd = useCallback(
    async (orderIndex: number) => {
      try {
        const res = await fetch(`/api/claims/${claim.id}/report-sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionType: "FINDINGS",
            orderIndex,
            textSr: "",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const newSections = [...sections, data.section];
          setSections(newSections);
          if (onUpdate) onUpdate({ reportSections: newSections });
        } else {
          const errorData = await res.json();
          alert(
            t("claims.findings.createError") +
              ": " +
              (errorData.error || t("common.error")),
          );
        }
      } catch (error) {
        console.error("Error creating section:", error);
        alert(t("claims.findings.createError"));
      }
    },
    [claim.id, onUpdate, sections, t],
  );

  const sectionsByType = sections.reduce((acc: any, section: any) => {
    if (!acc[section.sectionType]) acc[section.sectionType] = [];
    acc[section.sectionType].push(section);
    return acc;
  }, {});

  Object.keys(sectionsByType).forEach((type) => {
    sectionsByType[type].sort((a: any, b: any) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  });

  return (
    <div className="space-y-6">
      {Object.entries(sectionsByType).map(([type, typeSections]: [string, any]) => (
        <Card key={type} className="p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold mb-6">{type}</h3>
          <div className="space-y-4">
            {typeSections.map((section: any, index: number) => (
              <div key={section.id} className="pl-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    {t("claims.findings.finding")} {index + 1}
                  </Label>
                  <div className="flex items-center gap-2">
                    {section.createdAt && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(section.createdAt).toLocaleString("sr-RS", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(section.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={section.textSr || ""}
                  rows={6}
                  onChange={(e) => {
                    if (!isReadOnly) handleTextChange(section.id, e.target.value);
                  }}
                  onBlur={() => {
                    if (!isReadOnly) handleBlur(section.id);
                  }}
                  placeholder={t("claims.findings.placeholder")}
                  disabled={isReadOnly}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button onClick={() => handleAdd(sections.length)}>
            {t("claims.findings.add")}
          </Button>
        </div>
      )}
      {sections.length === 0 && !isReadOnly && (
        <Card className="p-6">
          <p className="text-muted-foreground mb-6">{t("claims.findings.noSections")}</p>
          <Button onClick={() => handleAdd(0)}>
            {t("claims.findings.createSection")}
          </Button>
        </Card>
      )}
    </div>
  );
}
