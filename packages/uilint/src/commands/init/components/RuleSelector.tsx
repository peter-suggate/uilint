/**
 * RuleSelector - ESLint rule configuration UI
 *
 * Shows a list of available ESLint rules with:
 * - Toggle to enable/disable each rule
 * - Severity selection (error/warn)
 * - Rule documentation on hover/select
 * - Option configuration for rules with configurable options
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { getRulesByCategory, getCategoryMeta } from "uilint-eslint";
import type { RuleMeta } from "uilint-eslint";
import { OptionField, convertFieldValue } from "./OptionField.js";

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

type ViewMode = "list" | "docs" | "confirm-options" | "edit-options";

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
      // Use rule metadata for default enablement
      for (const rule of allRules) {
        const categoryMeta = getCategoryMeta(rule.category);
        const enabled = rule.defaultEnabled ?? categoryMeta?.defaultEnabled ?? false;
        map.set(rule.id, {
          enabled,
          severity: rule.defaultSeverity === "off" ? "warn" : rule.defaultSeverity
        });
      }
      return map;
    }
  );

  // Track custom options for rules (only populated when user configures them)
  const [customOptions, setCustomOptions] = useState<Map<string, Record<string, unknown>>>(new Map());

  // For option editing: which rule and which field cursor
  const [editingRuleIndex, setEditingRuleIndex] = useState(0);
  const [editingFieldCursor, setEditingFieldCursor] = useState(0);

  // For confirm-options view: cursor position (0 = Yes, 1 = No)
  const [confirmCursor, setConfirmCursor] = useState(1); // Default to "No"

  const currentRule = allRules[cursor];

  // Get enabled rules that have configurable options
  const enabledRulesWithOptions = useMemo(() => {
    return allRules.filter((rule) => {
      const state = ruleStates.get(rule.id);
      return state?.enabled && rule.optionSchema && rule.optionSchema.fields.length > 0;
    });
  }, [allRules, ruleStates]);

  // Current rule being edited in edit-options mode
  const currentEditingRule = enabledRulesWithOptions[editingRuleIndex];
  const currentEditingFields = currentEditingRule?.optionSchema?.fields ?? [];

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

  // Final submit - build configured rules with options
  const finalSubmit = () => {
    const configuredRules: ConfiguredRule[] = [];
    for (const rule of allRules) {
      const state = ruleStates.get(rule.id);
      if (state?.enabled) {
        const custom = customOptions.get(rule.id);
        const baseOptions = rule.defaultOptions?.[0] ?? {};
        configuredRules.push({
          rule,
          severity: state.severity,
          options: custom ? [{ ...baseOptions, ...custom }] : rule.defaultOptions,
        });
      }
    }
    onSubmit(configuredRules);
  };

  // Transition from list to confirm/submit
  const handleListSubmit = () => {
    if (enabledRulesWithOptions.length > 0) {
      // Show confirm dialog
      setViewMode("confirm-options");
      setConfirmCursor(1); // Default to "No"
    } else {
      // No rules with options, submit directly
      finalSubmit();
    }
  };

  // Handle confirm-options selection
  const handleConfirmSelection = () => {
    if (confirmCursor === 0) {
      // Yes - configure options
      setEditingRuleIndex(0);
      setEditingFieldCursor(0);
      // Initialize custom options with defaults for the first rule
      if (enabledRulesWithOptions[0]) {
        initializeRuleOptions(enabledRulesWithOptions[0]);
      }
      setViewMode("edit-options");
    } else {
      // No - use defaults
      finalSubmit();
    }
  };

  // Initialize custom options for a rule with its defaults
  const initializeRuleOptions = (rule: RuleMeta) => {
    if (!customOptions.has(rule.id) && rule.optionSchema) {
      const baseOptions = rule.defaultOptions?.[0] ?? {};
      const initial: Record<string, unknown> = {};
      for (const field of rule.optionSchema.fields) {
        initial[field.key] = (baseOptions as Record<string, unknown>)[field.key] ?? field.defaultValue;
      }
      setCustomOptions((prev) => {
        const next = new Map(prev);
        next.set(rule.id, initial);
        return next;
      });
    }
  };

  // Update a field value for current editing rule
  const updateFieldValue = (fieldKey: string, value: unknown) => {
    if (!currentEditingRule) return;
    setCustomOptions((prev) => {
      const next = new Map(prev);
      const current = next.get(currentEditingRule.id) ?? {};
      next.set(currentEditingRule.id, { ...current, [fieldKey]: value });
      return next;
    });
  };

  // Move to next rule in edit-options mode
  const nextEditingRule = () => {
    if (editingRuleIndex < enabledRulesWithOptions.length - 1) {
      const nextIndex = editingRuleIndex + 1;
      setEditingRuleIndex(nextIndex);
      setEditingFieldCursor(0);
      // Initialize options for next rule
      if (enabledRulesWithOptions[nextIndex]) {
        initializeRuleOptions(enabledRulesWithOptions[nextIndex]!);
      }
    } else {
      // Done with all rules
      finalSubmit();
    }
  };

  // Skip current rule (use defaults) and move to next
  const skipCurrentRule = () => {
    // Remove any custom options for this rule (use defaults)
    if (currentEditingRule) {
      setCustomOptions((prev) => {
        const next = new Map(prev);
        next.delete(currentEditingRule.id);
        return next;
      });
    }
    nextEditingRule();
  };

  useInput((input, key) => {
    // Docs view
    if (viewMode === "docs") {
      if (key.escape || key.return || input === "d" || input === "q") {
        setViewMode("list");
      }
      return;
    }

    // Confirm options view
    if (viewMode === "confirm-options") {
      if (key.upArrow || key.downArrow) {
        setConfirmCursor((prev) => (prev === 0 ? 1 : 0));
      } else if (key.return || input === " ") {
        handleConfirmSelection();
      } else if (key.escape || input === "q") {
        setViewMode("list");
      }
      return;
    }

    // Edit options view
    if (viewMode === "edit-options") {
      if (key.upArrow) {
        setEditingFieldCursor((prev) =>
          prev > 0 ? prev - 1 : currentEditingFields.length - 1
        );
      } else if (key.downArrow) {
        setEditingFieldCursor((prev) =>
          prev < currentEditingFields.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        // Confirm this rule's options and move to next
        nextEditingRule();
      } else if (key.escape) {
        // Skip this rule (use defaults)
        skipCurrentRule();
      } else if (input === "q") {
        // Cancel and go back to list
        setViewMode("list");
      }
      // Note: Individual field inputs are handled by OptionField component
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
      handleListSubmit();
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

  // Show confirm options view
  if (viewMode === "confirm-options") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Configure Rule Options</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>
            <Text color="cyan">{enabledRulesWithOptions.length}</Text>
            <Text> selected rules have configurable options. Would you like to customize them?</Text>
          </Text>
        </Box>

        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text color={confirmCursor === 0 ? "cyan" : undefined}>
              {confirmCursor === 0 ? "› " : "  "}
            </Text>
            <Text color={confirmCursor === 0 ? "cyan" : undefined} bold={confirmCursor === 0}>
              Yes
            </Text>
            <Text dimColor> - Configure each rule's options</Text>
          </Box>
          <Box>
            <Text color={confirmCursor === 1 ? "cyan" : undefined}>
              {confirmCursor === 1 ? "› " : "  "}
            </Text>
            <Text color={confirmCursor === 1 ? "cyan" : undefined} bold={confirmCursor === 1}>
              No
            </Text>
            <Text dimColor> - Use defaults for all rules</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Rules with options:{" "}
            {enabledRulesWithOptions.map((r) => r.name).join(", ")}
          </Text>
        </Box>

        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            <Text color="cyan">↑↓</Text> select{"  "}
            <Text color="cyan">enter</Text> confirm{"  "}
            <Text color="cyan">esc</Text> back
          </Text>
        </Box>
      </Box>
    );
  }

  // Show edit options view
  if (viewMode === "edit-options" && currentEditingRule) {
    const ruleOptions = customOptions.get(currentEditingRule.id) ?? {};
    const baseOptions = currentEditingRule.defaultOptions?.[0] ?? {};

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {currentEditingRule.icon ?? "⚙️"} {currentEditingRule.name}
          </Text>
          <Text dimColor> ({editingRuleIndex + 1}/{enabledRulesWithOptions.length})</Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>{currentEditingRule.description}</Text>
        </Box>

        <Box flexDirection="column">
          {currentEditingFields.map((field, i) => {
            const currentValue = ruleOptions[field.key] ??
              (baseOptions as Record<string, unknown>)[field.key] ??
              field.defaultValue;
            const defaultValue = (baseOptions as Record<string, unknown>)[field.key] ?? field.defaultValue;

            return (
              <OptionField
                key={field.key}
                field={field}
                value={currentValue}
                onChange={(newValue) => {
                  const converted = convertFieldValue(newValue, field, defaultValue);
                  updateFieldValue(field.key, converted);
                }}
                isActive={i === editingFieldCursor}
              />
            );
          })}
        </Box>

        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            <Text color="cyan">↑↓</Text> navigate{"  "}
            <Text color="cyan">space</Text> toggle{"  "}
            <Text color="cyan">enter</Text> next rule{"  "}
            <Text color="cyan">esc</Text> skip (use defaults)
          </Text>
        </Box>
      </Box>
    );
  }

  // Count enabled rules
  const enabledCount = Array.from(ruleStates.values()).filter((s) => s.enabled).length;
  const errorCount = Array.from(ruleStates.entries()).filter(
    ([, s]) => s.enabled && s.severity === "error"
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
      {(() => {
        const cat = getCategoryMeta("static");
        return cat ? (
          <>
            <CategoryHeader name={cat.name} icon={cat.icon} />
            <Text dimColor>  {cat.description}</Text>
          </>
        ) : null;
      })()}

      {staticRules.map((rule) => {
        const itemIndex = globalIndex++;
        const isCursor = itemIndex === cursor;
        const state = ruleStates.get(rule.id)!;
        const hasOptions = rule.optionSchema && rule.optionSchema.fields.length > 0;

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
            {hasOptions && state.enabled && (
              <Text dimColor> ⚙</Text>
            )}
          </Box>
        );
      })}

      {/* Semantic rules */}
      {(() => {
        const cat = getCategoryMeta("semantic");
        return cat ? (
          <>
            <CategoryHeader name={cat.name} icon={cat.icon} />
            <Text dimColor>  {cat.description}</Text>
          </>
        ) : null;
      })()}

      {semanticRules.map((rule) => {
        const itemIndex = globalIndex++;
        const isCursor = itemIndex === cursor;
        const state = ruleStates.get(rule.id)!;
        const hasOptions = rule.optionSchema && rule.optionSchema.fields.length > 0;

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
            {hasOptions && state.enabled && (
              <Text dimColor> ⚙</Text>
            )}
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
          {enabledRulesWithOptions.length > 0 && (
            <Text dimColor>, {enabledRulesWithOptions.length} with options ⚙</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}
