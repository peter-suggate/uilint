/**
 * RulePreviewPanel - Preview pane content for a rule search item
 *
 * Shows: rule name, description, severity hint, interactive config,
 * and issues grouped by file. Reuses RuleConfig for live editing.
 */

import React, { useState, useMemo, useCallback } from "react";
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
import type { ESLintPluginSlice } from "../slice";
import type { Issue } from "../../../ui/types";

// ============================================================================
// Types
// ============================================================================

export interface RulePreviewPanelProps {
  ruleId: string;
  services: PluginServices;
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

// ============================================================================
// File Group
// ============================================================================

function FileGroup({
  filePath,
  issues,
  defaultExpanded,
}: {
  filePath: string;
  issues: Issue[];
  defaultExpanded: boolean;
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
            <div
              key={issue.id}
              className={cn(
                "flex items-center gap-2 pl-8 pr-3 py-1.5",
                "border-t border-foreground/[0.02]"
              )}
            >
              <SeverityIcon severity={issue.severity} />
              <span className="text-[11px] font-mono text-muted-foreground/50 tabular-nums w-7 flex-shrink-0">
                {issue.line}
              </span>
              <span className="text-[11px] text-foreground/60 truncate">
                {issue.message}
              </span>
            </div>
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

  const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
  const highestSeverity = ruleIssues.some((i) => i.severity === "error")
    ? "error"
    : ruleIssues.some((i) => i.severity === "warning")
      ? "warning"
      : "info";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-foreground/[0.06]">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-foreground/90 truncate">
            {ruleMeta?.name || shortName}
          </h3>
          <SeverityBadge severity={highestSeverity} />
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
          {ruleMeta?.category && (
            <span className="px-1.5 py-0.5 rounded bg-foreground/[0.04]">
              {ruleMeta.category}
            </span>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="border-b border-foreground/[0.06]">
        <RuleConfig
          ruleId={ruleId}
          currentSeverity={currentSeverity}
          onSeverityChange={handleSeverityChange}
          optionSchema={ruleMeta?.optionSchema}
          currentOptions={ruleConfig?.options}
          defaultOptions={defaultOptions}
          onOptionChange={handleOptionChange}
          onResetOptions={handleResetOptions}
          isUpdating={isUpdating}
        />
      </div>

      {/* File groups */}
      <div className="flex-1 overflow-y-auto">
        {fileGroups.map(([filePath, issues], index) => (
          <FileGroup
            key={filePath}
            filePath={filePath}
            issues={issues}
            defaultExpanded={index < 3}
          />
        ))}
      </div>
    </div>
  );
}
