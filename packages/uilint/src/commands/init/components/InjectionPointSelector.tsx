/**
 * InjectionPointSelector - Select where to inject the UI devtools component
 *
 * Shows a list of possible injection points (client boundaries) and lets
 * the user select one. Only one can be selected (single-select).
 */

import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { InjectionPoint } from "../installers/next-overlay.js";

export interface InjectionPointSelectorProps {
  /** Available injection points */
  points: InjectionPoint[];
  /** Callback when user selects a point */
  onSubmit: (point: InjectionPoint) => void;
  /** Callback to go back */
  onBack?: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
}

export function InjectionPointSelector({
  points,
  onSubmit,
  onBack,
  onCancel,
}: InjectionPointSelectorProps): React.ReactElement {
  const { exit } = useApp();

  // Find the recommended point to pre-select, or default to first
  const recommendedIndex = points.findIndex((p) => p.recommended);
  const [cursor, setCursor] = useState(recommendedIndex >= 0 ? recommendedIndex : 0);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : points.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < points.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const selected = points[cursor];
      if (selected) {
        onSubmit(selected);
      }
    } else if (input === "b" || key.leftArrow) {
      onBack?.();
    } else if (input === "q" || key.escape) {
      onCancel?.();
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Where should the devtools component be injected?</Text>
      </Box>

      {points.map((point, index) => {
        const isCursor = index === cursor;

        return (
          <Box key={point.id} paddingLeft={1}>
            {/* Cursor indicator */}
            <Text color={isCursor ? "cyan" : undefined}>
              {isCursor ? "› " : "  "}
            </Text>

            {/* Radio button */}
            <Box width={2}>
              <Text color={isCursor ? "cyan" : undefined}>
                {isCursor ? "◉" : "○"}
              </Text>
            </Box>

            {/* Label */}
            <Box>
              <Text color={isCursor ? "cyan" : undefined}>
                {point.label}
              </Text>
              {point.hint && (
                <Text dimColor> ({point.hint})</Text>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Footer with keyboard hints */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text color="cyan">↑↓</Text> navigate{"  "}
          <Text color="cyan">enter</Text> select{"  "}
          <Text color="cyan">b</Text> back{"  "}
          <Text color="cyan">q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}
