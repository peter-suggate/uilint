/**
 * ActivityLog component - displays recent server activity
 */

import React from "react";
import { Box, Text } from "ink";
import type { ActivityEntry, ActivityType } from "../types.js";

export interface ActivityLogProps {
  activities: ActivityEntry[];
  maxVisible?: number;
  verbose?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTypeDisplay(type: ActivityType): { label: string; color: string } {
  const displays: Record<ActivityType, { label: string; color: string }> = {
    "lint:file": { label: "lint", color: "blue" },
    "lint:element": { label: "lint", color: "blue" },
    "lint:done": { label: "lint", color: "green" },
    subscribe: { label: "sub", color: "cyan" },
    "cache:invalidate": { label: "cache", color: "yellow" },
    "vision:analyze": { label: "vision", color: "magenta" },
    "vision:done": { label: "vision", color: "green" },
    "vision:check": { label: "vision", color: "magenta" },
    "config:set": { label: "config", color: "yellow" },
    "rule:config:set": { label: "rule", color: "yellow" },
    "screenshot:save": { label: "screen", color: "cyan" },
    "screenshot:saved": { label: "screen", color: "green" },
    "coverage:request": { label: "cov", color: "blue" },
    "coverage:result": { label: "cov", color: "green" },
    "file:changed": { label: "change", color: "yellow" },
    "client:connect": { label: "client", color: "green" },
    "client:disconnect": { label: "client", color: "red" },
    error: { label: "error", color: "red" },
    warning: { label: "warn", color: "yellow" },
    info: { label: "info", color: "gray" },
  };

  return displays[type] || { label: type, color: "gray" };
}

function ActivityRow({
  entry,
  verbose,
}: {
  entry: ActivityEntry;
  verbose?: boolean;
}): React.ReactElement {
  const { label, color } = getTypeDisplay(entry.type);

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{formatTime(entry.timestamp)} </Text>
        <Text color={color as any} bold>
          {label.padEnd(7)}
        </Text>
        <Text color={entry.isError ? "red" : entry.isWarning ? "yellow" : undefined}>
          {entry.message}
        </Text>
      </Box>
      {verbose && entry.detail && (
        <Box paddingLeft={16}>
          <Text dimColor>{entry.detail}</Text>
        </Box>
      )}
    </Box>
  );
}

export function ActivityLog({
  activities,
  maxVisible = 15,
  verbose = false,
}: ActivityLogProps): React.ReactElement {
  const visibleActivities = activities.slice(0, maxVisible);
  const hasMore = activities.length > maxVisible;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="space-between">
        <Text bold dimColor>
          Activity
        </Text>
        {hasMore && (
          <Text dimColor>
            +{activities.length - maxVisible} more
          </Text>
        )}
      </Box>
      {visibleActivities.length === 0 ? (
        <Text dimColor>No activity yet...</Text>
      ) : (
        visibleActivities.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} verbose={verbose} />
        ))
      )}
    </Box>
  );
}
