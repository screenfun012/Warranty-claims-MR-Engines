"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface FileViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: Array<{
    id: string;
    url: string;
    fileName?: string;
    mimeType?: string;
  }>;
  initialIndex?: number;
}

export function FileViewerModal({
  open,
  onOpenChange,
  files,
  initialIndex = 0,
}: FileViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentFile = files[currentIndex];

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (currentIndex !== initialIndex) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(currentFile?.fileName || "");
  };

  const isPdf = (mimeType?: string) => {
    return mimeType?.includes("pdf") || 
           /\.pdf$/i.test(currentFile?.fileName || "");
  };

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
  }, [files.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
  }, [files.length]);

  const handleDownload = () => {
    if (currentFile) {
      const link = document.createElement("a");
      link.href = currentFile.url;
      link.download = currentFile.fileName || "file";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((prev) => Math.min(prev + 0.25, 5));
      }
      if (e.key === "-") {
        e.preventDefault();
        setZoom((prev) => Math.max(prev - 0.25, 0.5));
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRotation((prev) => (prev + 90) % 360);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, files.length, onOpenChange, handlePrevious, handleNext]);

  if (!currentFile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 bg-transparent border-0 shadow-none" showCloseButton={false}>
        <DialogTitle className="sr-only">
          {currentFile.fileName || `File ${currentIndex + 1}`}
        </DialogTitle>
        <div className="relative w-full h-full flex flex-col bg-background rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {files.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevious}
                    className="shrink-0"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {currentIndex + 1} / {files.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNext}
                    className="shrink-0"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <span className="text-sm font-medium truncate flex-1">
                {currentFile.fileName || `File ${currentIndex + 1}`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isImage(currentFile.mimeType) && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 5}
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRotate}
                    title="Rotate (R)"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetZoom}
                    disabled={zoom === 1 && rotation === 0}
                    title="Reset Zoom & Rotation (0)"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Download"
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-hidden flex items-center justify-center bg-gray-900/95 dark:bg-black/95 relative"
            onWheel={handleWheel}
          >
            {isImage(currentFile.mimeType) ? (
              <div
                className="w-full h-full flex items-center justify-center overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
              >
                <img
                  ref={imageRef}
                  src={currentFile.url}
                  alt={currentFile.fileName || "Image"}
                  className="object-contain select-none"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                    transition: isDragging ? "none" : "transform 0.2s ease-out",
                    maxWidth: zoom > 1 ? "none" : "100%",
                    maxHeight: zoom > 1 ? "none" : "100%",
                  }}
                  draggable={false}
                />
              </div>
            ) : isPdf(currentFile.mimeType) ? (
              <iframe
                src={currentFile.url}
                className="w-full h-full min-h-[600px] border-0"
                title={currentFile.fileName || "PDF"}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-8">
                <p className="text-muted-foreground">
                  Preview not available for this file type
                </p>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

