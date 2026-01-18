"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Potvrda",
  description = "Da li ste sigurni da želite da nastavite?",
  confirmText = "Potvrdi",
  cancelText = "Otkaži",
  variant = "default",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === "destructive" && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive dark:text-red-400" />
              </div>
            )}
            <DialogTitle className="text-left dark:text-gray-100">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2 dark:text-gray-300">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3 sm:gap-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-[100px] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            className="sm:min-w-[100px]"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

