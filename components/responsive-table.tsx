"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  headers: Array<{ key: string; label: string; className?: string }>;
  data: Array<Record<string, React.ReactNode>>;
  emptyMessage?: string;
  onRowClick?: (row: Record<string, React.ReactNode>, index: number) => void;
  className?: string;
}

export function ResponsiveTable({
  headers,
  data,
  emptyMessage = "No data found",
  onRowClick,
  className,
}: ResponsiveTableProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Mobile: Card layout
    return (
      <div className={cn("space-y-4", className)}>
        {data.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            {emptyMessage}
          </Card>
        ) : (
          data.map((row, index) => (
            <Card
              key={index}
              className={cn(
                "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row, index)}
            >
              <div className="space-y-3">
                {headers.map((header) => (
                  <div key={header.key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {header.label}
                    </span>
                    <span className="text-sm font-medium break-words">
                      {row[header.key]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header.key} className={header.className}>
                {header.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow
                key={index}
                className={onRowClick ? "cursor-pointer" : ""}
                onClick={() => onRowClick?.(row, index)}
              >
                {headers.map((header) => (
                  <TableCell key={header.key} className={header.className}>
                    {row[header.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

