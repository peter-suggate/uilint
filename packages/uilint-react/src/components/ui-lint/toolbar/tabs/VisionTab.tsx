"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useUILintStore } from "../../store";
import type { VisionIssue } from "../../../../scanner/vision-capture";
import type { ScreenshotCapture } from "../../types";
import { Icons } from "../icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Vision Tab modes
 */
type VisionTabMode = "capture" | "gallery";

/**
 * Get the image source URL for a screenshot capture.
 * For in-memory captures, returns the dataUrl.
 * For persisted captures, returns the API URL.
 */
function getScreenshotSrc(capture: ScreenshotCapture): string | undefined {
  if (capture.dataUrl) {
    return capture.dataUrl;
  }
  if (capture.filename) {
    return `/api/.uilint/screenshots?filename=${encodeURIComponent(capture.filename)}`;
  }
  return undefined;
}

/**
 * Design tokens for Vision Tab
 */
const CATEGORY_COLORS = {
  spacing: "oklch(0.585 0.233 283.04)",
  typography: "oklch(0.656 0.241 354.31)",
  color: "var(--uilint-success)",
  alignment: "oklch(0.715 0.143 215.22)",
  layout: "oklch(0.702 0.191 41.12)",
  contrast: "var(--uilint-error)",
  "visual-hierarchy": "oklch(0.627 0.265 303.9)",
  other: "var(--uilint-text-muted)",
};

function getSeverityColor(severity: VisionIssue["severity"]): string {
  switch (severity) {
    case "error":
      return "var(--uilint-error)";
    case "warning":
      return "var(--uilint-warning)";
    case "info":
      return "var(--uilint-accent)";
    default:
      return "var(--uilint-text-secondary)";
  }
}

function CategoryIcon({ category }: { category: VisionIssue["category"] }) {
  const color =
    CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ||
    CATEGORY_COLORS.other;

  switch (category) {
    case "spacing":
      return <Icons.Layout className="w-3.5 h-3.5" style={{ color }} />;
    case "typography":
      return <Icons.Type className="w-3.5 h-3.5" style={{ color }} />;
    case "color":
      return <Icons.Palette className="w-3.5 h-3.5" style={{ color }} />;
    case "alignment":
      return <Icons.AlignLeft className="w-3.5 h-3.5" style={{ color }} />;
    case "layout":
      return <Icons.Grid className="w-3.5 h-3.5" style={{ color }} />;
    case "contrast":
      return <Icons.Contrast className="w-3.5 h-3.5" style={{ color }} />;
    default:
      return <Icons.AlertCircle className="w-3.5 h-3.5" style={{ color }} />;
  }
}

/**
 * Screenshot thumbnail component for the gallery
 * Simplified: image-only with minimal overlay
 */
function ScreenshotThumbnail({
  capture,
  isSelected,
  onClick,
}: {
  capture: ScreenshotCapture;
  isSelected: boolean;
  onClick: () => void;
}) {
  const imageSrc = getScreenshotSrc(capture);
  const issueCount = capture.issues?.length || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0 h-12 min-w-[48px] max-w-[80px] rounded-md overflow-hidden transition-all",
        "hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500",
        isSelected
          ? "ring-2 ring-blue-500 shadow-lg"
          : "ring-1 ring-zinc-300 dark:ring-zinc-600"
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Screenshot thumbnail"
          className="w-full h-full object-cover object-top bg-zinc-100 dark:bg-zinc-800"
        />
      ) : (
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icons.Image className="w-4 h-4 text-zinc-400" />
        </div>
      )}
      {/* Issue count badge - only show if there are issues */}
      {issueCount > 0 && (
        <div className="absolute bottom-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-sm">
          {issueCount}
        </div>
      )}
      {/* Green check for no issues */}
      {issueCount === 0 && (
        <div className="absolute bottom-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-green-500 shadow-sm">
          <Icons.Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

/**
 * Capture Mode - UI for initiating a new capture
 */
function CaptureMode({
  onFullPage,
  onRegion,
  onBack,
  hasScreenshots,
  isAnalyzing,
  progressPhase,
  error,
  onClearError,
}: {
  onFullPage: () => void;
  onRegion: () => void;
  onBack: () => void;
  hasScreenshots: boolean;
  isAnalyzing: boolean;
  progressPhase: string | null;
  error: { message: string } | null;
  onClearError: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Capture Page
        </h4>
        {hasScreenshots && !isAnalyzing && (
          <button
            onClick={onBack}
            className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <Icons.ChevronLeft className="w-3 h-3" />
            Back to captures
          </button>
        )}
      </div>

      {/* Instructions */}
      {!isAnalyzing && !error && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Capture a screenshot to analyze your UI for design issues. The AI will check for:
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <li className="flex items-center gap-2">
              <Icons.Layout className="w-3 h-3 text-blue-500" />
              Spacing and layout consistency
            </li>
            <li className="flex items-center gap-2">
              <Icons.Type className="w-3 h-3 text-pink-500" />
              Typography hierarchy
            </li>
            <li className="flex items-center gap-2">
              <Icons.Palette className="w-3 h-3 text-green-500" />
              Color and contrast issues
            </li>
            <li className="flex items-center gap-2">
              <Icons.AlignLeft className="w-3 h-3 text-cyan-500" />
              Alignment problems
            </li>
          </ul>
        </div>
      )}

      {/* Analyzing Progress */}
      {isAnalyzing && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 p-4 flex flex-col items-center">
          <Icons.Spinner className="w-8 h-8 text-blue-500 mb-3" />
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {progressPhase || "Analyzing..."}
          </p>
          <p className="text-[10px] text-blue-500/70 dark:text-blue-400/50 mt-1">
            This may take a few seconds
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && !isAnalyzing && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase">
              Capture Failed
            </span>
            <button
              onClick={onClearError}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-red-600 dark:text-red-300 font-mono break-words">
            {error.message}
          </p>
        </div>
      )}

      {/* Capture Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onFullPage}
          disabled={isAnalyzing}
          className="flex-1 h-10 gap-2"
          variant="default"
        >
          <Icons.Camera className="w-4 h-4" />
          Full Page
        </Button>
        <Button
          onClick={onRegion}
          disabled={isAnalyzing}
          className="flex-1 h-10 gap-2"
          variant="outline"
        >
          <Icons.Crop className="w-4 h-4" />
          Select Region
        </Button>
      </div>
    </div>
  );
}

/**
 * Gallery Mode - View captures and their issues
 * Layout optimized for bottom-aligned toolbar:
 * - Issues at top (scrollable)
 * - Preview in middle (dynamic aspect ratio)
 * - Thumbnails at bottom (most stable/clickable)
 */
function GalleryMode({
  screenshots,
  selectedScreenshot,
  onSelectScreenshot,
  onNewCapture,
  highlightedVisionElementId,
  setHighlightedVisionElementId,
  setHoveredVisionIssue,
}: {
  screenshots: ScreenshotCapture[];
  selectedScreenshot: ScreenshotCapture | null;
  onSelectScreenshot: (id: string) => void;
  onNewCapture: () => void;
  highlightedVisionElementId: string | null;
  setHighlightedVisionElementId: (id: string | null) => void;
  setHoveredVisionIssue: (issue: VisionIssue | null) => void;
}) {
  // Track aspect ratio of selected screenshot
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait" | "square">("landscape");

  // Get issues from the selected screenshot (capture-specific)
  const selectedIssues = useMemo(() => {
    if (!selectedScreenshot) return [];
    return selectedScreenshot.issues || [];
  }, [selectedScreenshot]);

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const map = new Map<VisionIssue["category"], VisionIssue[]>();
    selectedIssues.forEach((issue) => {
      const existing = map.get(issue.category) || [];
      existing.push(issue);
      map.set(issue.category, existing);
    });
    return map;
  }, [selectedIssues]);

  const handleShowInPage = useCallback(
    (issue: VisionIssue) => {
      if (!issue.dataLoc) return;
      setHighlightedVisionElementId(issue.elementId || null);
      const element = document.querySelector(`[data-loc="${issue.dataLoc}"]`);
      if (element)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [setHighlightedVisionElementId]
  );

  // Handle image load to detect aspect ratio
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    if (ratio > 1.2) {
      setAspectRatio("landscape");
    } else if (ratio < 0.8) {
      setAspectRatio("portrait");
    } else {
      setAspectRatio("square");
    }
  }, []);

  // Compute preview dimensions based on aspect ratio
  const previewStyle = useMemo(() => {
    switch (aspectRatio) {
      case "portrait":
        return { maxHeight: "180px", maxWidth: "120px" };
      case "square":
        return { maxHeight: "140px", maxWidth: "140px" };
      case "landscape":
      default:
        return { maxHeight: "100px", maxWidth: "100%" };
    }
  }, [aspectRatio]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Issues Section - scrollable, fills available space */}
      {selectedScreenshot && (
        <ScrollArea className="flex-1 min-h-0 -mx-3 max-h-[40vh]">
          <div className="px-3 space-y-2">
            {selectedIssues.length === 0 ? (
              <div className="py-3 text-center">
                <Icons.CheckCircle className="w-5 h-5 mx-auto text-green-500 mb-1.5" />
                <p className="text-[11px] text-zinc-500">
                  No issues found
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Issues ({selectedIssues.length})
                  </h4>
                </div>

                {Array.from(issuesByCategory.entries()).map(
                  ([category, issues]) => (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                        <CategoryIcon category={category} />
                        {category}
                        <span className="ml-auto opacity-50">
                          {issues.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {issues.map((issue, idx) => (
                          <div
                            key={`${issue.elementId}-${idx}`}
                            onMouseEnter={() => setHoveredVisionIssue(issue)}
                            onMouseLeave={() => setHoveredVisionIssue(null)}
                            className={cn(
                              "p-2 rounded-md border border-transparent transition-all cursor-default",
                              highlightedVisionElementId === issue.elementId
                                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-[11px] font-semibold truncate flex-1">
                                "{issue.elementText || "Element"}"
                              </span>
                              <span
                                className="text-[8px] font-bold uppercase px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${getSeverityColor(issue.severity)}20`,
                                  color: getSeverityColor(issue.severity),
                                }}
                              >
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {issue.message}
                            </p>
                            <button
                              onClick={() => handleShowInPage(issue)}
                              className="mt-1.5 text-[9px] text-blue-500 hover:text-blue-600 flex items-center gap-1"
                            >
                              <Icons.Eye className="w-2.5 h-2.5" /> Show
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Preview Section - dynamic size based on aspect ratio */}
      {selectedScreenshot && (
        <div className={cn(
          "flex-shrink-0 flex gap-3",
          aspectRatio === "portrait" ? "flex-row items-start" : "flex-col"
        )}>
          {/* Screenshot preview */}
          <div
            className={cn(
              "rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-900/50 flex items-center justify-center",
              aspectRatio === "portrait" ? "flex-shrink-0" : "w-full"
            )}
          >
            {getScreenshotSrc(selectedScreenshot) ? (
              <img
                src={getScreenshotSrc(selectedScreenshot)}
                alt={`Screenshot of ${selectedScreenshot.route}`}
                className="object-contain"
                style={previewStyle}
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="w-full h-[80px] flex items-center justify-center">
                <Icons.Image className="w-6 h-6 text-zinc-600" />
              </div>
            )}
          </div>

          {/* Route info - beside preview for portrait, below for landscape */}
          <div className={cn(
            "flex items-center gap-2 text-[10px]",
            aspectRatio === "portrait" ? "flex-col items-start flex-1" : "justify-between"
          )}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {selectedScreenshot.route === "/" ? "/home" : selectedScreenshot.route}
              </span>
              {selectedScreenshot.type === "region" && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500">
                  Region
                </span>
              )}
            </div>
            <span className="text-zinc-500">
              {new Date(selectedScreenshot.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      )}

      {/* Thumbnails Section - at bottom for easy access */}
      <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-700 pt-2 -mx-3 px-3">
        <div className="flex items-center gap-2">
          {/* New capture button */}
          <button
            onClick={onNewCapture}
            className={cn(
              "flex-shrink-0 h-12 w-12 rounded-md border-2 border-dashed",
              "border-zinc-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500",
              "flex items-center justify-center transition-colors",
              "text-zinc-400 hover:text-blue-500"
            )}
            title="New capture"
          >
            <Icons.Plus className="w-5 h-5" />
          </button>

          {/* Thumbnail gallery - horizontal scroll */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-1.5 py-0.5">
              {screenshots.map((capture) => (
                <ScreenshotThumbnail
                  key={capture.id}
                  capture={capture}
                  isSelected={selectedScreenshot?.id === capture.id}
                  onClick={() => onSelectScreenshot(capture.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisionTab() {
  const visionAnalyzing = useUILintStore((s) => s.visionAnalyzing);
  const visionProgressPhase = useUILintStore((s) => s.visionProgressPhase);
  const visionLastError = useUILintStore((s) => s.visionLastError);
  const clearVisionLastError = useUILintStore((s) => s.clearVisionLastError);
  const triggerVisionAnalysis = useUILintStore((s) => s.triggerVisionAnalysis);
  const highlightedVisionElementId = useUILintStore(
    (s) => s.highlightedVisionElementId
  );
  const setHighlightedVisionElementId = useUILintStore(
    (s) => s.setHighlightedVisionElementId
  );
  const setHoveredVisionIssue = useUILintStore((s) => s.setHoveredVisionIssue);
  const setRegionSelectionActive = useUILintStore(
    (s) => s.setRegionSelectionActive
  );
  const screenshotHistory = useUILintStore((s) => s.screenshotHistory);
  const selectedScreenshotId = useUILintStore((s) => s.selectedScreenshotId);
  const setSelectedScreenshotId = useUILintStore(
    (s) => s.setSelectedScreenshotId
  );
  const loadingPersistedScreenshots = useUILintStore(
    (s) => s.loadingPersistedScreenshots
  );
  const fetchPersistedScreenshots = useUILintStore(
    (s) => s.fetchPersistedScreenshots
  );

  // Mode state - capture or gallery
  const [mode, setMode] = useState<VisionTabMode>("gallery");

  // Load persisted screenshots from disk on mount
  useEffect(() => {
    fetchPersistedScreenshots();
  }, [fetchPersistedScreenshots]);

  // Get screenshots sorted by timestamp (newest first)
  const sortedScreenshots = useMemo(() => {
    const screenshots = Array.from(screenshotHistory.values());
    return screenshots.sort((a, b) => b.timestamp - a.timestamp);
  }, [screenshotHistory]);

  // Get the selected screenshot
  const selectedScreenshot = useMemo(() => {
    if (!selectedScreenshotId) return sortedScreenshots[0] || null;
    return screenshotHistory.get(selectedScreenshotId) || sortedScreenshots[0] || null;
  }, [selectedScreenshotId, screenshotHistory, sortedScreenshots]);

  // Determine effective mode based on state
  const effectiveMode = useMemo(() => {
    // If analyzing, show capture mode (with progress)
    if (visionAnalyzing) return "capture";
    // If no screenshots, show capture mode
    if (sortedScreenshots.length === 0) return "capture";
    // Otherwise, use the user's selected mode
    return mode;
  }, [visionAnalyzing, sortedScreenshots.length, mode]);

  // When analysis completes successfully, switch to gallery mode
  const prevAnalyzing = React.useRef(visionAnalyzing);
  useEffect(() => {
    if (prevAnalyzing.current && !visionAnalyzing && sortedScreenshots.length > 0) {
      setMode("gallery");
    }
    prevAnalyzing.current = visionAnalyzing;
  }, [visionAnalyzing, sortedScreenshots.length]);

  const handleCaptureFullPage = useCallback(() => {
    triggerVisionAnalysis();
  }, [triggerVisionAnalysis]);

  const handleSelectRegion = useCallback(() => {
    setRegionSelectionActive(true);
  }, [setRegionSelectionActive]);

  const handleNewCapture = useCallback(() => {
    setMode("capture");
  }, []);

  const handleBackToGallery = useCallback(() => {
    setMode("gallery");
  }, []);

  // Loading state
  if (loadingPersistedScreenshots && sortedScreenshots.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 flex flex-col items-center justify-center">
        <Icons.Spinner className="w-8 h-8 text-zinc-400 mb-3" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Loading saved screenshots...
        </p>
      </div>
    );
  }

  // Capture mode
  if (effectiveMode === "capture") {
    return (
      <CaptureMode
        onFullPage={handleCaptureFullPage}
        onRegion={handleSelectRegion}
        onBack={handleBackToGallery}
        hasScreenshots={sortedScreenshots.length > 0}
        isAnalyzing={visionAnalyzing}
        progressPhase={visionProgressPhase}
        error={visionLastError}
        onClearError={clearVisionLastError}
      />
    );
  }

  // Gallery mode
  return (
    <GalleryMode
      screenshots={sortedScreenshots}
      selectedScreenshot={selectedScreenshot}
      onSelectScreenshot={setSelectedScreenshotId}
      onNewCapture={handleNewCapture}
      highlightedVisionElementId={highlightedVisionElementId}
      setHighlightedVisionElementId={setHighlightedVisionElementId}
      setHoveredVisionIssue={setHoveredVisionIssue}
    />
  );
}
