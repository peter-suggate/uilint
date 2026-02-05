/**
 * RuleToggleBar - Row of toggle buttons for quickly enabling/disabling rules
 *
 * Features:
 * - Horizontal scrollable row of rule toggle buttons
 * - Visual indication for enabled/disabled state
 * - Issue count badge for each rule
 * - Click to toggle rule visibility
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";
import type { AvailableRule } from "../../../plugins/eslint/types";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

interface RuleToggleButtonProps {
  rule: AvailableRule;
  isEnabled: boolean;
  issueCount: number;
  onClick: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Individual rule toggle button
 */
function RuleToggleButton({ rule, isEnabled, issueCount, onClick }: RuleToggleButtonProps) {
  // Get a short display name (remove plugin prefix like "uilint/")
  const displayName = rule.name || rule.id.replace(/^[^/]+\//, "");

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
        "text-xs font-medium whitespace-nowrap",
        "transition-all duration-150",
        "border",
        isEnabled
          ? [
              "bg-foreground/[0.06] border-foreground/[0.08]",
              "text-foreground/90",
              "hover:bg-foreground/[0.08] hover:border-foreground/[0.12]",
            ]
          : [
              "bg-transparent border-foreground/[0.04]",
              "text-foreground/40",
              "hover:bg-foreground/[0.02] hover:text-foreground/50",
            ]
      )}
      title={isEnabled ? `Hide ${displayName} issues` : `Show ${displayName} issues`}
    >
      <span className={cn(!isEnabled && "line-through decoration-foreground/30")}>
        {displayName}
      </span>
      {issueCount > 0 && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] px-1 rounded-full",
            "text-[10px] font-semibold",
            "flex items-center justify-center",
            isEnabled
              ? "bg-foreground/[0.08] text-foreground/70"
              : "bg-foreground/[0.04] text-foreground/30"
          )}
        >
          {issueCount}
        </span>
      )}
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RuleToggleBar() {
  // Get eslint plugin state
  const eslintSlice = useComposedStore((s) => s.plugins.eslint) as ESLintPluginSlice | undefined;

  // Get available rules and disabled rules set
  const availableRules = eslintSlice?.availableRules ?? [];
  const disabledRules = eslintSlice?.disabledRules ?? new Set<string>();
  const toggleRule = eslintSlice?.toggleRule;

  // Get issues to calculate counts per rule
  const issuesMap = eslintSlice?.issues ?? new Map<string, Issue[]>();

  // Calculate issue counts by rule
  const issueCountsByRule = React.useMemo(() => {
    const counts = new Map<string, number>();

    for (const issues of issuesMap.values()) {
      for (const issue of issues) {
        if (issue.ruleId) {
          counts.set(issue.ruleId, (counts.get(issue.ruleId) ?? 0) + 1);
        }
      }
    }

    return counts;
  }, [issuesMap]);

  // Don't render if no rules or toggle function
  if (!toggleRule || availableRules.length === 0) {
    return null;
  }

  const handleToggle = (ruleId: string) => {
    toggleRule(ruleId);
  };

  return (
    <div className="px-4 py-2 border-b border-foreground/[0.04]">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <AnimatePresence mode="popLayout">
          {availableRules.map((rule) => {
            const isEnabled = !disabledRules.has(rule.id);
            const issueCount = issueCountsByRule.get(rule.id) ?? 0;

            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <RuleToggleButton
                  rule={rule}
                  isEnabled={isEnabled}
                  issueCount={issueCount}
                  onClick={() => handleToggle(rule.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default RuleToggleBar;
