/**
 * RuleSelector - ESLint rule configuration UI
 *
 * Shows a list of available ESLint rules with:
 * - Toggle to enable/disable each rule
 * - Severity selection (error/warn)
 * - Rule documentation on hover/select
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { ruleRegistry, getRulesByCategory } from "uilint-eslint";
import type { RuleMeta } from "uilint-eslint";

export interface ConfiguredRule {
  rule: RuleMeta;
  severity: "error" | "warn" | "off";
  options?: unknown[];
}

export interface RuleSelectorProps {
  onSubmit: (configuredRules: ConfiguredRule[]) => void;
  onBack?: () => void;
  onCancel?: () => void;
}

type ViewMode = "list" | "docs";

function SeverityBadge({ severity }: { severity: "error" | "warn" | "off" }): React.ReactElement {
  if (severity === "error") {
    return <Text color="red">error</Text>;
  }
  if (severity === "warn") {
    return <Text color="yellow">warn</Text>;
  }
  return <Text dimColor>off</Text>;
}

function CategoryHeader({ name, icon }: { name: string; icon: string }): React.ReactElement {
  return (
    <Box marginTop={1} marginBottom={0}>
      <Text bold color="white">
        {icon} {name}
      </Text>
    </Box>
  );
}

export function RuleSelector({
  onSubmit,
  onBack,
  onCancel,
}: RuleSelectorProps): React.ReactElement {
  const { exit } = useApp();

  const staticRules = useMemo(() => getRulesByCategory("static"), []);
  const semanticRules = useMemo(() => getRulesByCategory("semantic"), []);
  const allRules = useMemo(() => [...staticRules, ...semanticRules], [staticRules, semanticRules]);

  const [cursor, setCursor] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Track enabled state and severity for each rule
  const [ruleStates, setRuleStates] = useState<Map<string, { enabled: boolean; severity: "error" | "warn" }>>(
    () => {
      const map = new Map();
      // Default: all static rules enabled with their default severity
      for (const rule of staticRules) {
        map.set(rule.id, {
          enabled: true,
          severity: rule.defaultSeverity === "off" ? "warn" : rule.defaultSeverity
        });
      }
      // Semantic rules disabled by default (require Ollama)
      for (const rule of semanticRules) {
        map.set(rule.id, {
          enabled: false,
          severity: rule.defaultSeverity === "off" ? "warn" : rule.defaultSeverity
        });
      }
      return map;
    }
  );

  const currentRule = allRules[cursor];
  const currentState = currentRule ? ruleStates.get(currentRule.id) : undefined;

  const toggleRule = () => {
    if (!currentRule) return;
    setRuleStates((prev) => {
      const next = new Map(prev);
      const current = next.get(currentRule.id)!;
      next.set(currentRule.id, { ...current, enabled: !current.enabled });
      return next;
    });
  };

  const cycleSeverity = () => {
    if (!currentRule) return;
    setRuleStates((prev) => {
      const next = new Map(prev);
      const current = next.get(currentRule.id)!;
      const newSeverity = current.severity === "error" ? "warn" : "error";
      next.set(currentRule.id, { ...current, severity: newSeverity });
      return next;
    });
  };

  const handleSubmit = () => {
    const configuredRules: ConfiguredRule[] = [];
    for (const rule of allRules) {
      const state = ruleStates.get(rule.id);
      if (state?.enabled) {
        configuredRules.push({
          rule,
          severity: state.severity,
          options: rule.defaultOptions,
        });
      }
    }
    onSubmit(configuredRules);
  };

  useInput((input, key) => {
    if (viewMode === "docs") {
      // In docs view, any key returns to list
      if (key.escape || key.return || input === "d" || input === "q") {
        setViewMode("list");
      }
      return;
    }

    // List view controls
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : allRules.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < allRules.length - 1 ? prev + 1 : 0));
    } else if (input === " ") {
      toggleRule();
    } else if (input === "s") {
      cycleSeverity();
    } else if (input === "d") {
      setViewMode("docs");
    } else if (key.return) {
      handleSubmit();
    } else if (key.escape || input === "q") {
      onCancel?.();
      exit();
    } else if ((input === "b" || key.leftArrow) && onBack) {
      onBack();
    } else if (input === "a") {
      // Enable all
      setRuleStates((prev) => {
        const next = new Map(prev);
        for (const rule of allRules) {
          const current = next.get(rule.id)!;
          next.set(rule.id, { ...current, enabled: true });
        }
        return next;
      });
    } else if (input === "n") {
      // Disable all
      setRuleStates((prev) => {
        const next = new Map(prev);
        for (const rule of allRules) {
          const current = next.get(rule.id)!;
          next.set(rule.id, { ...current, enabled: false });
        }
        return next;
      });
    }
  });

  // Show documentation view
  if (viewMode === "docs" && currentRule) {
    const docLines = currentRule.docs.trim().split("\n").slice(0, 20);
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">{currentRule.name}</Text>
          <Text dimColor> - {currentRule.description}</Text>
        </Box>

        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          {docLines.map((line, i) => (
            <Text key={i} dimColor={line.startsWith("#")}>
              {line}
            </Text>
          ))}
          {currentRule.docs.split("\n").length > 20 && (
            <Text dimColor>... (truncated)</Text>
          )}
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Press any key to return to list
          </Text>
        </Box>
      </Box>
    );
  }

  // Count enabled rules
  const enabledCount = Array.from(ruleStates.values()).filter((s) => s.enabled).length;
  const errorCount = Array.from(ruleStates.entries()).filter(
    ([id, s]) => s.enabled && s.severity === "error"
  ).length;
  const warnCount = enabledCount - errorCount;

  // Build flat list with category markers
  let globalIndex = 0;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Configure ESLint Rules</Text>
      </Box>

      {/* Static rules */}
      <CategoryHeader name="Static Rules" icon="📋" />
      <Text dimColor>  Pattern-based, fast analysis</Text>

      {staticRules.map((rule) => {
        const itemIndex = globalIndex++;
        const isCursor = itemIndex === cursor;
        const state = ruleStates.get(rule.id)!;

        return (
          <Box key={rule.id} paddingLeft={2}>
            <Text color={isCursor ? "cyan" : undefined}>
              {isCursor ? "› " : "  "}
            </Text>
            <Box width={3}>
              <Text color={state.enabled ? "green" : undefined} dimColor={!state.enabled}>
                {state.enabled ? "✓" : "○"}
              </Text>
            </Box>
            <Box width={30}>
              <Text
                color={isCursor ? "cyan" : undefined}
                dimColor={!state.enabled}
                bold={isCursor}
              >
                {rule.name}
              </Text>
            </Box>
            <Box width={8}>
              {state.enabled ? (
                <SeverityBadge severity={state.severity} />
              ) : (
                <Text dimColor>-</Text>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Semantic rules */}
      <CategoryHeader name="Semantic Rules" icon="🧠" />
      <Text dimColor>  LLM-powered analysis (requires Ollama)</Text>

      {semanticRules.map((rule) => {
        const itemIndex = globalIndex++;
        const isCursor = itemIndex === cursor;
        const state = ruleStates.get(rule.id)!;

        return (
          <Box key={rule.id} paddingLeft={2}>
            <Text color={isCursor ? "cyan" : undefined}>
              {isCursor ? "› " : "  "}
            </Text>
            <Box width={3}>
              <Text color={state.enabled ? "green" : undefined} dimColor={!state.enabled}>
                {state.enabled ? "✓" : "○"}
              </Text>
            </Box>
            <Box width={30}>
              <Text
                color={isCursor ? "cyan" : undefined}
                dimColor={!state.enabled}
                bold={isCursor}
              >
                {rule.name}
              </Text>
            </Box>
            <Box width={8}>
              {state.enabled ? (
                <SeverityBadge severity={state.severity} />
              ) : (
                <Text dimColor>-</Text>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Current rule description */}
      {currentRule && (
        <Box marginTop={1} paddingX={2}>
          <Text dimColor>{currentRule.description}</Text>
        </Box>
      )}

      {/* Footer with keyboard hints */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text color="cyan">↑↓</Text> navigate{"  "}
          <Text color="cyan">space</Text> toggle{"  "}
          <Text color="cyan">s</Text> severity{"  "}
          <Text color="cyan">d</Text> docs{"  "}
          <Text color="cyan">a</Text> all{"  "}
          <Text color="cyan">n</Text> none{"  "}
          <Text color="cyan">enter</Text> confirm
        </Text>
      </Box>

      {/* Summary */}
      <Box marginTop={1}>
        <Text>
          <Text color="cyan">{enabledCount}</Text>
          <Text dimColor> rules enabled (</Text>
          <Text color="red">{errorCount}</Text>
          <Text dimColor> errors, </Text>
          <Text color="yellow">{warnCount}</Text>
          <Text dimColor> warnings)</Text>
        </Text>
      </Box>
    </Box>
  );
}
