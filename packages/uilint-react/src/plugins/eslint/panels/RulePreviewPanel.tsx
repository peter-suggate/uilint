/**
 * RulePreviewPanel - Preview pane content for a rule search item
 *
 * Shows: rule name, description, severity hint, compact config row with
 * popover for full editing, and issues grouped by file. Clicking an issue
 * drills down to a full source view with breadcrumbs.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  FileCode,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { PluginServices } from "../../../core/plugin-system/types";
import { useComposedStore } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { getAllIssues, getAvailableRules } from "../tile-provider";
import { RuleConfig } from "../../../ui/components/Inspector/RuleConfig";
import { Popover } from "../../../ui/components/primitives";
import { SettingsIcon } from "../../../ui/icons";
import { Breadcrumbs } from "../../../ui/components/Inspector/Breadcrumbs";
import { FileSourceView } from "../../../ui/components/Inspector/FileSourceView";
import type { ESLintPluginSlice } from "../slice";
import type { Issue } from "../../../ui/types";
import type { AvailableRule } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface RulePreviewPanelProps {
  ruleId: string;
  services: PluginServices;
}

interface ConfigTag {
  label: string;
  accent?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function SeverityIcon({ severity }: { severity: Issue["severity"] }) {
  switch (severity) {
    case "error":
      return <AlertCircle size={13} className="text-error flex-shrink-0" />;
    case "warning":
      return <AlertTriangle size={13} className="text-warning flex-shrink-0" />;
    case "info":
      return <Info size={13} className="text-info flex-shrink-0" />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorClass =
    severity === "error"
      ? "text-error bg-error/10"
      : severity === "warning"
        ? "text-warning bg-warning/10"
        : "text-info bg-info/10";

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        colorClass
      )}
    >
      {severity}
    </span>
  );
}

/**
 * Build compact config tags from rule metadata, following the pattern
 * from TileGrid's buildConfigTags().
 */
function buildPreviewConfigTags(
  ruleMeta: AvailableRule | undefined,
  currentSeverity: string,
  currentOptions: Record<string, unknown> | undefined
): ConfigTag[] {
  const tags: ConfigTag[] = [];

  // Category tag
  const category = ruleMeta?.category;
  if (category && category !== "static") {
    tags.push({ label: category, accent: true });
  }

  // Severity override tag (when current differs from default)
  const defaultSeverity = ruleMeta?.defaultSeverity;
  if (defaultSeverity && currentSeverity !== defaultSeverity) {
    tags.push({ label: currentSeverity });
  }

  // Key option values (first 1-2 that differ from defaults)
  const optionSchema = ruleMeta?.optionSchema;
  const defaultOptions = ruleMeta?.defaultOptions;
  const defaultOpts: Record<string, unknown> = Array.isArray(defaultOptions)
    ? (defaultOptions[0] as Record<string, unknown>) ?? {}
    : {};

  if (currentOptions && optionSchema?.fields) {
    for (const field of optionSchema.fields) {
      const value = currentOptions[field.key];
      if (value !== undefined && value !== defaultOpts[field.key]) {
        const display =
          typeof value === "boolean"
            ? `${field.label}: ${value ? "on" : "off"}`
            : `${field.label}: ${String(value)}`;
        tags.push({ label: display });
        if (tags.length >= 3) break;
      }
    }
  }

  return tags;
}

// ============================================================================
// Compact Config Row
// ============================================================================

function CompactConfigRow({
  ruleId,
  currentSeverity,
  ruleMeta,
  currentOptions,
  defaultOptions,
  onSeverityChange,
  onOptionChange,
  onResetOptions,
  isUpdating,
}: {
  ruleId: string;
  currentSeverity: "off" | "warn" | "error";
  ruleMeta: AvailableRule | undefined;
  currentOptions: Record<string, unknown> | undefined;
  defaultOptions: Record<string, unknown>;
  onSeverityChange: (severity: "off" | "warn" | "error") => void;
  onOptionChange: (key: string, value: unknown) => void;
  onResetOptions: () => void;
  isUpdating: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const tags = useMemo(
    () => buildPreviewConfigTags(ruleMeta, currentSeverity, currentOptions),
    [ruleMeta, currentSeverity, currentOptions]
  );

  const severities: Array<{ value: "off" | "warn" | "error"; label: string; dot: string }> = [
    { value: "off", label: "Off", dot: "bg-muted-foreground/30" },
    { value: "warn", label: "Warn", dot: "bg-warning/70" },
    { value: "error", label: "Error", dot: "bg-error/70" },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-foreground/[0.06]">
      {/* Inline severity toggle */}
      <div className="flex items-center gap-0.5 p-0.5 bg-foreground/[0.02] rounded-md border border-foreground/[0.04]">
        {severities.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSeverityChange(s.value)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded",
              "text-[10px] transition-colors duration-100",
              currentSeverity === s.value
                ? "bg-foreground/[0.08] text-foreground font-medium"
                : "text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground/70"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Config tags */}
      {tags.map((tag) => (
        <span
          key={tag.label}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] leading-tight",
            "border border-foreground/[0.06]",
            tag.accent
              ? "text-purple-500/70 bg-purple-500/[0.06]"
              : "text-muted-foreground/60 bg-foreground/[0.02]"
          )}
        >
          {tag.label}
        </span>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Configure button with popover */}
      <div
        onKeyDown={(e) => {
          if (e.key === "Escape" && popoverOpen) {
            e.stopPropagation();
          }
        }}
      >
        <Popover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          placement="bottom"
          align="end"
          width={320}
          trigger={
            <button
              type="button"
              onClick={() => setPopoverOpen(!popoverOpen)}
              className={cn(
                "inline-flex items-center gap-1.5",
                "px-2 py-1 rounded",
                "text-[11px] text-muted-foreground/60 hover:text-foreground/80",
                "hover:bg-foreground/[0.04]",
                "transition-colors duration-100",
                popoverOpen && "bg-foreground/[0.04] text-foreground/80"
              )}
            >
              <SettingsIcon size={12} />
              Configure
            </button>
          }
        >
          <div className="p-1">
            <RuleConfig
              ruleId={ruleId}
              currentSeverity={currentSeverity}
              onSeverityChange={onSeverityChange}
              optionSchema={ruleMeta?.optionSchema}
              currentOptions={currentOptions}
              defaultOptions={defaultOptions}
              onOptionChange={onOptionChange}
              onResetOptions={onResetOptions}
              isUpdating={isUpdating}
            />
          </div>
        </Popover>
      </div>
    </div>
  );
}

// ============================================================================
// File Group
// ============================================================================

function FileGroup({
  filePath,
  issues,
  defaultExpanded,
  onIssueClick,
}: {
  filePath: string;
  issues: Issue[];
  defaultExpanded: boolean;
  onIssueClick: (filePath: string, issueId: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const fileName = filePath.split("/").pop() || filePath;
  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => a.line - b.line),
    [issues]
  );

  return (
    <div className="border-b border-foreground/[0.04] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "text-left hover:bg-foreground/[0.03] transition-colors duration-100"
        )}
      >
        {expanded ? (
          <ChevronDown size={12} className="text-muted-foreground/50 flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground/50 flex-shrink-0" />
        )}
        <FileCode size={13} className="text-muted-foreground/60 flex-shrink-0" />
        <span className="text-xs font-medium text-foreground/80 truncate flex-1">
          {fileName}
        </span>
        <span className="text-[10px] text-muted-foreground/50 tabular-nums flex-shrink-0">
          {issues.length}
        </span>
      </button>

      {expanded && (
        <motion.div
          initial={false}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.1 }}
        >
          {sortedIssues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onIssueClick(filePath, issue.id)}
              className={cn(
                "w-full flex items-center gap-2 pl-8 pr-3 py-1.5",
                "border-t border-foreground/[0.02]",
                "text-left hover:bg-foreground/[0.03] transition-colors duration-100",
                "cursor-pointer"
              )}
            >
              <SeverityIcon severity={issue.severity} />
              <span className="text-[11px] font-mono text-muted-foreground/50 tabular-nums w-7 flex-shrink-0">
                {issue.line}
              </span>
              <span className="text-[11px] text-foreground/60 truncate">
                {issue.message}
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RulePreviewPanel({ ruleId, services }: RulePreviewPanelProps) {
  const allIssues = getAllIssues(services);
  const availableRules = getAvailableRules(services);

  // Drill-down state (local, not global store)
  const [drillDownFile, setDrillDownFile] = useState<string | null>(null);
  const [drillDownIssueId, setDrillDownIssueId] = useState<string | null>(null);

  // Reset drill-down when rule changes
  useEffect(() => {
    setDrillDownFile(null);
    setDrillDownIssueId(null);
  }, [ruleId]);

  const ruleMeta = useMemo(
    () => availableRules.find((r) => r.id === ruleId),
    [availableRules, ruleId]
  );

  const ruleIssues = useMemo(
    () => allIssues.filter((i) => i.ruleId === ruleId),
    [allIssues, ruleId]
  );

  // Group issues by file, sorted by count
  const fileGroups = useMemo(() => {
    const groups = new Map<string, Issue[]>();
    for (const issue of ruleIssues) {
      const existing = groups.get(issue.filePath) || [];
      groups.set(issue.filePath, [...existing, issue]);
    }

    return Array.from(groups.entries()).sort(
      ([, a], [, b]) => b.length - a.length
    );
  }, [ruleIssues]);

  // Issues for the drilled-down file
  const drillDownIssues = useMemo(
    () => (drillDownFile ? ruleIssues.filter((i) => i.filePath === drillDownFile) : []),
    [ruleIssues, drillDownFile]
  );

  // --- Reactive config from store ---
  const ruleConfig = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    return eslintState?.ruleConfigs?.get(ruleId);
  });

  const isUpdating = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    return eslintState?.ruleConfigUpdating?.get(ruleId) ?? false;
  });

  const currentSeverity: "off" | "warn" | "error" = useMemo(() => {
    return ruleConfig?.severity ?? ruleMeta?.defaultSeverity ?? "warn";
  }, [ruleConfig?.severity, ruleMeta?.defaultSeverity]);

  const defaultOptions = useMemo(() => {
    if (!ruleMeta?.defaultOptions) return {};
    return Array.isArray(ruleMeta.defaultOptions)
      ? (ruleMeta.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMeta.defaultOptions as Record<string, unknown>) ?? {};
  }, [ruleMeta?.defaultOptions]);

  // --- Config callbacks ---
  const handleSeverityChange = useCallback(
    (severity: "off" | "warn" | "error") => {
      const apiSeverity = severity === "warn" ? "warning" : severity;
      pluginRegistry.setRuleSeverity(ruleId, apiSeverity);
    },
    [ruleId]
  );

  const handleOptionChange = useCallback(
    (key: string, value: unknown) => {
      const currentOptions = ruleConfig?.options ?? {};
      const newOptions = { ...currentOptions, [key]: value };
      pluginRegistry.setRuleConfig(ruleId, newOptions);
    },
    [ruleId, ruleConfig?.options]
  );

  const handleResetOptions = useCallback(() => {
    if (!ruleMeta?.defaultOptions) return;
    const defaultOpts = Array.isArray(ruleMeta.defaultOptions)
      ? (ruleMeta.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMeta.defaultOptions as Record<string, unknown>) ?? {};
    pluginRegistry.setRuleConfig(ruleId, defaultOpts);
  }, [ruleId, ruleMeta?.defaultOptions]);

  // --- Drill-down callbacks ---
  const handleIssueClick = useCallback((filePath: string, issueId: string) => {
    setDrillDownFile(filePath);
    setDrillDownIssueId(issueId);
  }, []);

  const handleBackToRuleView = useCallback(() => {
    setDrillDownFile(null);
    setDrillDownIssueId(null);
  }, []);

  const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
  const highestSeverity = ruleIssues.some((i) => i.severity === "error")
    ? "error"
    : ruleIssues.some((i) => i.severity === "warning")
      ? "warning"
      : "info";

  // --- Drill-down view: Breadcrumbs + FileSourceView ---
  if (drillDownFile) {
    const drillDownFileName = drillDownFile.split("/").pop() || drillDownFile;
    return (
      <div className="flex flex-col h-full">
        <Breadcrumbs
          expandedRuleName={ruleMeta?.name || shortName}
          expandedFileName={drillDownFileName}
          onCollapseToRoot={handleBackToRuleView}
          onCollapseFile={handleBackToRuleView}
          variant="embedded"
        />
        <div className="flex-1 overflow-y-auto">
          {drillDownIssues.length > 0 ? (
            <FileSourceView
              filePath={drillDownFile}
              issues={drillDownIssues}
              contextLines={2}
              selectedIssueId={drillDownIssueId}
              onIssueSelect={setDrillDownIssueId}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground/50">
              No issues in this file
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Default view: Header + Compact Config + File Groups ---
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-foreground/[0.06]">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-foreground/90 truncate">
            {ruleMeta?.name || shortName}
          </h3>
          {ruleIssues.length > 0 && (
            <SeverityBadge severity={highestSeverity} />
          )}
        </div>

        {ruleMeta?.description && (
          <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
            {ruleMeta.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/50">
          <span className="tabular-nums">
            {ruleIssues.length} issue{ruleIssues.length !== 1 ? "s" : ""}
          </span>
          <span className="tabular-nums">
            {fileGroups.length} file{fileGroups.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Compact configuration row */}
      <CompactConfigRow
        ruleId={ruleId}
        currentSeverity={currentSeverity}
        ruleMeta={ruleMeta}
        currentOptions={ruleConfig?.options}
        defaultOptions={defaultOptions}
        onSeverityChange={handleSeverityChange}
        onOptionChange={handleOptionChange}
        onResetOptions={handleResetOptions}
        isUpdating={isUpdating}
      />

      {/* File groups */}
      <div className="flex-1 overflow-y-auto">
        {fileGroups.length > 0 ? (
          fileGroups.map(([filePath, issues], index) => (
            <FileGroup
              key={filePath}
              filePath={filePath}
              issues={issues}
              defaultExpanded={index < 3}
              onIssueClick={handleIssueClick}
            />
          ))
        ) : (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground/50">
            No issues found for this rule
          </div>
        )}
      </div>
    </div>
  );
}
