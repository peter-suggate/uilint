/**
 * OptionField - Ink components for editing rule option fields
 *
 * Renders appropriate input UI based on field type:
 * - boolean: Toggle checkbox
 * - number: Text input with number validation
 * - text: Text input
 * - select: Single-select list
 * - multiselect: Multi-select list
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { OptionFieldSchema } from "uilint-eslint";

export interface OptionFieldProps {
  field: OptionFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  isActive: boolean;
}

/**
 * Boolean field - toggle with space
 */
function BooleanField({
  field,
  value,
  onChange,
  isActive,
}: OptionFieldProps): React.ReactElement {
  const checked = Boolean(value);

  useInput(
    (input) => {
      if (isActive && input === " ") {
        onChange(!checked);
      }
    },
    { isActive }
  );

  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
      </Text>
      <Text color={checked ? "green" : "gray"}>
        {checked ? "[✓]" : "[ ]"}
      </Text>
      <Text> {field.label}</Text>
      {field.description && (
        <Text dimColor> - {field.description}</Text>
      )}
    </Box>
  );
}

/**
 * Number field - text input with validation
 */
function NumberField({
  field,
  value,
  onChange,
  isActive,
}: OptionFieldProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(String(value ?? field.defaultValue ?? ""));
  const [error, setError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.backspace || key.delete) {
        const newValue = inputValue.slice(0, -1);
        setInputValue(newValue);
        const num = Number(newValue);
        if (!isNaN(num) && newValue !== "") {
          onChange(num);
          setError(null);
        } else if (newValue === "") {
          setError(null);
        } else {
          setError("Enter a valid number");
        }
      } else if (/^[0-9.-]$/.test(input)) {
        const newValue = inputValue + input;
        setInputValue(newValue);
        const num = Number(newValue);
        if (!isNaN(num)) {
          onChange(num);
          setError(null);
        } else {
          setError("Enter a valid number");
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? "cyan" : undefined}>
          {isActive ? "› " : "  "}
        </Text>
        <Text>{field.label}: </Text>
        <Text color={isActive ? "cyan" : undefined} underline={isActive}>
          {inputValue || field.placeholder || ""}
        </Text>
        {field.description && (
          <Text dimColor> ({field.description})</Text>
        )}
      </Box>
      {error && (
        <Box paddingLeft={4}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Text field - simple text input
 */
function TextField({
  field,
  value,
  onChange,
  isActive,
}: OptionFieldProps): React.ReactElement {
  // Handle array values by joining with commas
  const displayValue = Array.isArray(value)
    ? value.join(", ")
    : String(value ?? field.defaultValue ?? "");
  const [inputValue, setInputValue] = useState(displayValue);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.backspace || key.delete) {
        const newValue = inputValue.slice(0, -1);
        setInputValue(newValue);
        onChange(newValue);
      } else if (input && !key.ctrl && !key.meta) {
        const newValue = inputValue + input;
        setInputValue(newValue);
        onChange(newValue);
      }
    },
    { isActive }
  );

  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
      </Text>
      <Text>{field.label}: </Text>
      <Text color={isActive ? "cyan" : undefined} underline={isActive}>
        {inputValue || field.placeholder || "(empty)"}
      </Text>
      {field.description && (
        <Text dimColor> ({field.description})</Text>
      )}
    </Box>
  );
}

/**
 * Select field - single selection from options
 */
function SelectField({
  field,
  value,
  onChange,
  isActive,
}: OptionFieldProps): React.ReactElement {
  const options = field.options ?? [];
  const currentIndex = options.findIndex(
    (opt) => String(opt.value) === String(value)
  );
  const [selectedIndex, setSelectedIndex] = useState(
    currentIndex >= 0 ? currentIndex : 0
  );

  useInput(
    (input, key) => {
      if (!isActive || options.length === 0) return;

      if (key.upArrow) {
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
        setSelectedIndex(newIndex);
        onChange(options[newIndex]!.value);
      } else if (key.downArrow) {
        const newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
        setSelectedIndex(newIndex);
        onChange(options[newIndex]!.value);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? "cyan" : undefined}>
          {isActive ? "› " : "  "}
        </Text>
        <Text>{field.label}</Text>
        {field.description && (
          <Text dimColor> - {field.description}</Text>
        )}
      </Box>
      {isActive && (
        <Box flexDirection="column" paddingLeft={4}>
          {options.map((opt, i) => (
            <Box key={String(opt.value)}>
              <Text color={i === selectedIndex ? "cyan" : undefined}>
                {i === selectedIndex ? "◉ " : "○ "}
                {opt.label}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {!isActive && options[selectedIndex] && (
        <Box paddingLeft={4}>
          <Text dimColor>Selected: {options[selectedIndex]!.label}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Multiselect field - multiple selections from options
 */
function MultiselectField({
  field,
  value,
  onChange,
  isActive,
}: OptionFieldProps): React.ReactElement {
  const options = field.options ?? [];
  const selectedValues = new Set(
    Array.isArray(value) ? value.map(String) : []
  );
  const [cursor, setCursor] = useState(0);

  useInput(
    (input, key) => {
      if (!isActive || options.length === 0) return;

      if (key.upArrow) {
        setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (key.downArrow) {
        setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (input === " ") {
        const opt = options[cursor]!;
        const newSelected = new Set(selectedValues);
        if (newSelected.has(String(opt.value))) {
          newSelected.delete(String(opt.value));
        } else {
          newSelected.add(String(opt.value));
        }
        onChange(Array.from(newSelected));
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? "cyan" : undefined}>
          {isActive ? "› " : "  "}
        </Text>
        <Text>{field.label}</Text>
        {field.description && (
          <Text dimColor> - {field.description}</Text>
        )}
      </Box>
      {isActive && (
        <Box flexDirection="column" paddingLeft={4}>
          {options.map((opt, i) => {
            const isSelected = selectedValues.has(String(opt.value));
            const isCursor = i === cursor;
            return (
              <Box key={String(opt.value)}>
                <Text color={isCursor ? "cyan" : undefined}>
                  {isCursor ? "› " : "  "}
                </Text>
                <Text color={isSelected ? "green" : undefined}>
                  {isSelected ? "[✓]" : "[ ]"}
                </Text>
                <Text color={isCursor ? "cyan" : undefined}>
                  {" "}{opt.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
      {!isActive && (
        <Box paddingLeft={4}>
          <Text dimColor>
            Selected: {Array.from(selectedValues).length > 0
              ? Array.from(selectedValues).join(", ")
              : "(none)"}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Main OptionField component - renders the appropriate field type
 */
export function OptionField(props: OptionFieldProps): React.ReactElement {
  const { field } = props;

  switch (field.type) {
    case "boolean":
      return <BooleanField {...props} />;
    case "number":
      return <NumberField {...props} />;
    case "text":
      return <TextField {...props} />;
    case "select":
      return <SelectField {...props} />;
    case "multiselect":
      return <MultiselectField {...props} />;
    default:
      return (
        <Box>
          <Text dimColor>Unknown field type: {field.type}</Text>
        </Box>
      );
  }
}

/**
 * Converts field value to the expected type for rule options.
 * Handles comma-separated text → array conversion for array-typed defaults.
 */
export function convertFieldValue(
  value: unknown,
  field: OptionFieldSchema,
  defaultValue: unknown
): unknown {
  // If defaultValue is an array but field type is text, parse comma-separated
  if (Array.isArray(defaultValue) && field.type === "text" && typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}
