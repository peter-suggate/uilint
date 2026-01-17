/**
 * Task components - individual task status displays
 */

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";

export interface TaskProps {
  label: string;
  detail?: string;
}

/**
 * Displays a pending task (not yet started)
 */
export function PendingTask({ label, detail }: TaskProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={1}>
          <Text dimColor>○</Text>
        </Box>
        <Text dimColor>{label}</Text>
      </Box>
      {detail && (
        <Box marginLeft={3}>
          <Text dimColor>{detail}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Displays a currently running task with spinner
 */
export function RunningTask({ label, detail }: TaskProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={1}>
          <Spinner type="dots" />
        </Box>
        <Text color="cyan">{label}</Text>
      </Box>
      {detail && (
        <Box marginLeft={3}>
          <Text dimColor>{detail}</Text>
        </Box>
      )}
    </Box>
  );
}

export interface CompletedTaskProps extends TaskProps {
  /** Error message if task failed */
  error?: string;
  /** Whether task succeeded (true) or failed (false) */
  success?: boolean;
}

/**
 * Displays a completed task (success or failure)
 */
export function CompletedTask({
  label,
  detail,
  error,
  success = true,
}: CompletedTaskProps) {
  const icon = success ? "✓" : "✗";
  const color = success ? "green" : "red";

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={1}>
          <Text color={color}>{icon}</Text>
        </Box>
        <Text color={color}>{label}</Text>
      </Box>
      {detail && (
        <Box marginLeft={3}>
          <Text dimColor>{detail}</Text>
        </Box>
      )}
      {error && !success && (
        <Box marginLeft={3}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
