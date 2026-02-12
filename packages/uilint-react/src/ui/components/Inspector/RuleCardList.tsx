/**
 * RuleCardList - Main content component for the redesigned inspector.
 *
 * Replaces IssuesList. Renders a vertical scrollable list of RuleCards
 * inside a Radix Accordion.Root for accessible expand/collapse.
 * Sorted by severity then count. Manages expansion state and connects to store.
 */
import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { useComposedStore, selectRuleCards } from "../../../core/store";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import type { AvailableRule } from "../../../plugins/eslint/types";
import { RuleCard } from "./RuleCard";
import { AccordionRoot } from "../Accordion";
import { cn } from "../../../lib/utils";

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-30">✨</div>
      <h3 className="text-lg font-medium text-foreground/80 mb-2">
        No issues found
      </h3>
      <p className="text-sm text-muted-foreground/60 max-w-xs">
        Great job! Your code looks clean.
      </p>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface RuleCardListProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function RuleCardList({ className }: RuleCardListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store selectors
  const ruleCards = useComposedStore(selectRuleCards);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore(
    (s) => s.inspector.expandedFilePath
  );
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);
  const severityFilter = useComposedStore(
    (s) => s.inspector.healthPulseSeverityFilter
  );

  // Available rules for metadata
  const allAvailableRules = useComposedStore(
    (s) => (s.plugins?.eslint as ESLintPluginSlice | undefined)?.availableRules
  );

  // Store actions
  const expandRule = useComposedStore((s) => s.expandRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);

  // Build rule metadata lookup
  const availableRulesMap = useMemo(() => {
    const map = new Map<string, AvailableRule>();
    for (const rule of allAvailableRules ?? []) {
      map.set(rule.id, rule);
    }
    return map;
  }, [allAvailableRules]);

  // Filter rule cards by severity if active
  const filteredCards = severityFilter
    ? ruleCards.filter((card) => card.severityCounts[severityFilter] > 0)
    : ruleCards;

  // Handle expand via Accordion's onValueChange
  const handleValueChange = useCallback(
    (value: string) => {
      expandRule(value);
    },
    [expandRule]
  );

  // Auto-expand rule containing selected issue (e.g., from heatmap click or jumpToRule)
  useEffect(() => {
    if (!selectedIssueId) return;

    for (const card of ruleCards) {
      for (const file of card.files) {
        const hasIssue = file.issues.some(
          (issue) => issue.id === selectedIssueId
        );
        if (hasIssue) {
          if (expandedRuleId !== card.ruleId) {
            expandRule(card.ruleId);
          }
          if (expandedFilePath !== file.filePath) {
            expandFileInRule(file.filePath);
          }
          return;
        }
      }
    }
  }, [
    selectedIssueId,
    ruleCards,
    expandedRuleId,
    expandedFilePath,
    expandRule,
    expandFileInRule,
  ]);

  if (ruleCards.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn("flex-1 p-2 overflow-auto", className)}
    >
      <div className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground/60">
        Rules
      </div>
      <AccordionRoot
        type="single"
        collapsible
        value={expandedRuleId ?? ""}
        onValueChange={handleValueChange}
      >
        {filteredCards.map((card, index) => (
          <RuleCard
            key={card.ruleId}
            card={card}
            isExpanded={expandedRuleId === card.ruleId}
            expandedFilePath={
              expandedRuleId === card.ruleId ? expandedFilePath : null
            }
            selectedIssueId={selectedIssueId}
            showFullSource={showFullSource}
            ruleMeta={availableRulesMap.get(card.ruleId)}
            index={index}
            onExpand={handleValueChange}
          />
        ))}
      </AccordionRoot>
    </div>
  );
}
