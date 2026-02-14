"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrInstanceRef = useRef<Plyr | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentFile = files[currentIndex];

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsFullscreen(false);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (currentIndex !== initialIndex) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  // Sync image transform/zoom to CSS variables (avoids inline styles for linter)
  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    el.style.setProperty("--img-rotation", `${rotation}deg`);
    el.style.setProperty("--img-zoom", String(zoom));
    el.style.setProperty("--img-x", `${position.x / zoom}px`);
    el.style.setProperty("--img-y", `${position.y / zoom}px`);
    el.style.setProperty("--img-max-w", zoom > 1 ? "none" : "100%");
    el.style.setProperty("--img-max-h", zoom > 1 ? "none" : "100%");
  }, [zoom, rotation, position]);

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(currentFile?.fileName || "");
  };

  const isPdf = (mimeType?: string) => {
    return mimeType?.includes("pdf") || 
           /\.pdf$/i.test(currentFile?.fileName || "");
  };

  const isVideo = (mimeType?: string) => {
    return mimeType?.startsWith("video/") ||
           /\.(mp4|webm|ogg|mov|m4v)$/i.test(currentFile?.fileName || "");
  };

  const isDocx = (mimeType?: string) => {
    return mimeType?.includes("wordprocessingml") ||
           mimeType === "application/msword" ||
           /\.(docx|doc)$/i.test(currentFile?.fileName || "");
  };

  const isExcel = (mimeType?: string) => {
    return mimeType?.includes("spreadsheetml") ||
           mimeType === "application/vnd.ms-excel" ||
           /\.(xlsx|xls)$/i.test(currentFile?.fileName || "");
  };

  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [excelHtml, setExcelHtml] = useState<string | null>(null);
  const [docLoadError, setDocLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFile || (!isDocx(currentFile.mimeType) && !isExcel(currentFile.mimeType))) {
      setDocxHtml(null);
      setExcelHtml(null);
      setDocLoadError(null);
      return;
    }
    setDocxHtml(null);
    setExcelHtml(null);
    setDocLoadError(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(currentFile.url);
        if (!res.ok) throw new Error("Failed to fetch");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        if (isDocx(currentFile.mimeType)) {
          const mammoth = await import("mammoth");
          const result = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (!cancelled) setDocxHtml(result.value);
        } else if (isExcel(currentFile.mimeType)) {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(buf, { type: "array" });
          const first = wb.SheetNames[0];
          if (!first) {
            if (!cancelled) setDocLoadError("No sheet");
            return;
          }
          const sheet = wb.Sheets[first];
          const html = XLSX.utils.sheet_to_html(sheet);
          if (!cancelled) setExcelHtml(html);
        }
      } catch (e) {
        if (!cancelled) {
          setDocLoadError(e instanceof Error ? e.message : "Failed to load");
          setDocxHtml(null);
          setExcelHtml(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentFile?.id, currentFile?.url, currentFile?.mimeType]);

  // Init/destroy Plyr when viewing a video
  useEffect(() => {
    if (!open || !currentFile || !isVideo(currentFile.mimeType)) {
      if (plyrInstanceRef.current) {
        plyrInstanceRef.current.destroy();
        plyrInstanceRef.current = null;
      }
      return;
    }
    const id = setTimeout(() => {
      if (videoRef.current && !plyrInstanceRef.current) {
        plyrInstanceRef.current = new Plyr(videoRef.current, {
          controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "fullscreen"],
        });
      }
    }, 100);
    return () => {
      clearTimeout(id);
      if (plyrInstanceRef.current) {
        plyrInstanceRef.current.destroy();
        plyrInstanceRef.current = null;
      }
    };
  }, [open, currentIndex, currentFile?.id, currentFile?.mimeType]);

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
      <DialogContent
        className={`p-0 gap-0 bg-transparent border-0 shadow-none transition-all ${isFullscreen ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none" : "max-w-[95vw] max-h-[95vh] w-full h-full"}`}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {currentFile.fileName || `File ${currentIndex + 1}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          File viewer for {currentFile.fileName || "attachment"}.
        </DialogDescription>
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
                  <span className="text-sm text-muted-foreground min-w-12 text-center">
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
                onClick={() => setIsFullscreen((v) => !v)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
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

          {/* Content - flex-1 min-h-0 flex flex-col so PDF/video use full height */}
          <div 
            ref={containerRef}
            className="flex-1 min-h-0 overflow-hidden flex flex-col items-stretch bg-gray-900/95 dark:bg-black/95 relative"
            onWheel={handleWheel}
          >
            {isImage(currentFile.mimeType) ? (
              <div
                className={`flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden ${zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={currentFile.url}
                  alt={currentFile.fileName || "Image"}
                  className={`object-contain select-none file-viewer-img ${isDragging ? "file-viewer-img-no-transition" : ""}`}
                  draggable={false}
                />
              </div>
            ) : isPdf(currentFile.mimeType) ? (
              <div className="w-full h-full min-h-0 flex-1 flex flex-col">
                <iframe
                  src={currentFile.url}
                  className="min-h-0 flex-1 w-full border-0"
                  title={currentFile.fileName || "PDF"}
                />
              </div>
            ) : isVideo(currentFile.mimeType) ? (
              <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-end overflow-hidden p-4 pb-20">
                <div className="file-viewer-video-container w-full max-w-full max-h-[calc(100%-3.5rem)] min-h-0 flex flex-col items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    className="file-viewer-video max-w-full max-h-full w-auto object-contain"
                    playsInline
                    preload="metadata"
                    src={currentFile.url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            ) : isDocx(currentFile.mimeType) ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {docLoadError && (
                  <p className="text-destructive text-sm p-2">{docLoadError}</p>
                )}
                {docxHtml && (
                  <div
                    className="flex-1 min-h-0 overflow-auto p-6 prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                  />
                )}
                {!docxHtml && !docLoadError && (
                  <p className="text-muted-foreground p-4">Loading document…</p>
                )}
              </div>
            ) : isExcel(currentFile.mimeType) ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {docLoadError && (
                  <p className="text-destructive text-sm p-2">{docLoadError}</p>
                )}
                {excelHtml && (
                  <div
                    className="flex-1 min-h-0 overflow-auto p-4 [&_table]:min-w-full [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:bg-muted [&_th]:px-2 [&_td]:px-2"
                    dangerouslySetInnerHTML={{ __html: excelHtml }}
                  />
                )}
                {!excelHtml && !docLoadError && (
                  <p className="text-muted-foreground p-4">Loading spreadsheet…</p>
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-8">
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

