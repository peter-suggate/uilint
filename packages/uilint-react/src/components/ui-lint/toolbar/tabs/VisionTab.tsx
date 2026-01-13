"use client";

import React, { useMemo, useCallback } from "react";
import { useUILintStore, type UILintStore } from "../../store";
import type { VisionIssue } from "../../../scanner/vision-capture";
import { Icons } from "../icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
    case "error": return "var(--uilint-error)";
    case "warning": return "var(--uilint-warning)";
    case "info": return "var(--uilint-accent)";
    default: return "var(--uilint-text-secondary)";
  }
}

function CategoryIcon({ category }: { category: VisionIssue["category"] }) {
  const color = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.other;

  switch (category) {
    case "spacing": return <Icons.Layout className="w-3.5 h-3.5" style={{ color }} />;
    case "typography": return <Icons.Type className="w-3.5 h-3.5" style={{ color }} />;
    case "color": return <Icons.Palette className="w-3.5 h-3.5" style={{ color }} />;
    case "alignment": return <Icons.AlignLeft className="w-3.5 h-3.5" style={{ color }} />;
    case "layout": return <Icons.Grid className="w-3.5 h-3.5" style={{ color }} />;
    case "contrast": return <Icons.Contrast className="w-3.5 h-3.5" style={{ color }} />;
    default: return <Icons.AlertCircle className="w-3.5 h-3.5" style={{ color }} />;
  }
}

export function VisionTab() {
  const visionIssuesCache = useUILintStore((s) => s.visionIssuesCache);
  const visionAnalyzing = useUILintStore((s) => s.visionAnalyzing);
  const visionProgressPhase = useUILintStore((s) => s.visionProgressPhase);
  const visionLastError = useUILintStore((s) => s.visionLastError);
  const clearVisionLastError = useUILintStore((s) => s.clearVisionLastError);
  const triggerVisionAnalysis = useUILintStore((s) => s.triggerVisionAnalysis);
  const highlightedVisionElementId = useUILintStore((s) => s.highlightedVisionElementId);
  const setHighlightedVisionElementId = useUILintStore((s) => s.setHighlightedVisionElementId);
  const setHoveredVisionIssue = useUILintStore((s) => s.setHoveredVisionIssue);
  const captureMode = useUILintStore((s) => s.captureMode);
  const setRegionSelectionActive = useUILintStore((s) => s.setRegionSelectionActive);

  const allIssues = useMemo(() => {
    const issues: VisionIssue[] = [];
    visionIssuesCache.forEach((routeIssues) => issues.push(...routeIssues));
    return issues;
  }, [visionIssuesCache]);

  const issuesByCategory = useMemo(() => {
    const map = new Map<VisionIssue["category"], VisionIssue[]>();
    allIssues.forEach((issue) => {
      const existing = map.get(issue.category) || [];
      existing.push(issue);
      map.set(issue.category, existing);
    });
    return map;
  }, [allIssues]);

  const handleCapture = useCallback(() => {
    if (captureMode === "region") {
      setRegionSelectionActive(true);
    } else {
      triggerVisionAnalysis();
    }
  }, [captureMode, setRegionSelectionActive, triggerVisionAnalysis]);

  const handleShowInPage = useCallback((issue: VisionIssue) => {
    if (!issue.dataLoc) return;
    setHighlightedVisionElementId(issue.elementId || null);
    const element = document.querySelector(`[data-loc="${issue.dataLoc}"]`);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [setHighlightedVisionElementId]);

  return (
    <div className="space-y-4">
      {/* Capture Action */}
      <div className="space-y-2">
        <Button
          onClick={handleCapture}
          disabled={visionAnalyzing}
          className="w-full h-10 gap-2"
        >
          {visionAnalyzing ? (
            <>
              <Icons.Spinner className="w-4 h-4" />
              {visionProgressPhase || "Analyzing..."}
            </>
          ) : (
            <>
              {captureMode === "full" ? <Icons.Camera className="w-4 h-4" /> : <Icons.Crop className="w-4 h-4" />}
              Capture {captureMode === "full" ? "Full Page" : "Region"}
            </>
          )}
        </Button>
      </div>

      {visionLastError && !visionAnalyzing && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase">Vision Failed</span>
            <button onClick={clearVisionLastError} className="text-[10px] text-red-500 hover:text-red-700">Dismiss</button>
          </div>
          <p className="text-xs text-red-600 dark:text-red-300 font-mono break-words">{visionLastError.message}</p>
        </div>
      )}

      <ScrollArea className="max-h-[350px] -mx-3">
        <div className="px-3 space-y-4">
          {!visionAnalyzing && allIssues.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <Icons.Camera className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
              <p className="text-xs text-zinc-500">No vision issues found yet.<br/>Capture the page to start analysis.</p>
            </div>
          )}

          {Array.from(issuesByCategory.entries()).map(([category, issues]) => (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <CategoryIcon category={category} />
                {category}
                <span className="ml-auto opacity-50">{issues.length}</span>
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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold truncate flex-1">
                        "{issue.elementText || "Element"}"
                      </span>
                      <span 
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${getSeverityColor(issue.severity)}20`, color: getSeverityColor(issue.severity) }}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {issue.message}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleShowInPage(issue)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
                      >
                        <Icons.Eye className="w-3 h-3" /> Show in page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
