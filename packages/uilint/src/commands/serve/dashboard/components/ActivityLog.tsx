/**
 * ActivityLog component - displays recent server activity
 *
 * Supports filtering by category (errors, vision, semantic, lint)
 * and auto-expanding error details.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ActivityEntry, ActivityType, ActivityCategory } from "../types.js";

export interface ActivityLogProps {
  activities: ActivityEntry[];
  maxVisible?: number;
  verbose?: boolean;
  scrollOffset?: number;
  activeFilter?: ActivityCategory;
}

const filterLabels: Record<ActivityCategory, string> = {
  all: "All",
  errors: "Errors",
  vision: "Vision",
  semantic: "Semantic",
  lint: "Lint",
  system: "System",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Strip ANSI escape sequences from a string */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
}

/** Truncate a string to maxLen, appending "…" if truncated */
function truncate(str: string, maxLen: number): string {
  const clean = stripAnsi(str).replace(/\n/g, " ");
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + "…";
}

type InkColor =
  | "black" | "red" | "green" | "yellow" | "blue"
  | "magenta" | "cyan" | "white" | "gray" | "grey";

function getTypeDisplay(type: ActivityType): { label: string; color: InkColor } {
  const displays: Record<ActivityType, { label: string; color: InkColor }> = {
    "lint:file": { label: "lint", color: "blue" },
    "lint:element": { label: "lint", color: "blue" },
    "lint:done": { label: "lint", color: "green" },
    subscribe: { label: "sub", color: "cyan" },
    "cache:invalidate": { label: "cache", color: "yellow" },
    "vision:analyze": { label: "vision", color: "magenta" },
    "vision:done": { label: "vision", color: "green" },
    "vision:check": { label: "vision", color: "magenta" },
    "semantic:analyze": { label: "semant", color: "blue" },
    "semantic:done": { label: "semant", color: "green" },
    "semantic:error": { label: "semant", color: "red" },
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

// Max width for message/detail lines (leaves room for time + type label + padding)
const MAX_MSG_WIDTH = 120;
const MAX_DETAIL_WIDTH = 100;

function ActivityRow({
  entry,
  verbose,
}: {
  entry: ActivityEntry;
  verbose?: boolean;
}): React.ReactElement {
  const { label, color } = getTypeDisplay(entry.type);

  // Always show detail for errors, otherwise respect verbose mode
  const showDetail = (verbose || entry.isError) && entry.detail;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{formatTime(entry.timestamp)} </Text>
        <Text color={color} bold>
          {label.padEnd(7)}
        </Text>
        <Text color={entry.isError ? "red" : entry.isWarning ? "yellow" : undefined}>
          {truncate(entry.message, MAX_MSG_WIDTH)}
        </Text>
      </Box>
      {showDetail && (
        <Box paddingLeft={16}>
          <Text dimColor>{truncate(entry.detail!, MAX_DETAIL_WIDTH)}</Text>
        </Box>
      )}
    </Box>
  );
}

export function ActivityLog({
  activities,
  maxVisible = 15,
  verbose = false,
  scrollOffset = 0,
  activeFilter = "all",
}: ActivityLogProps): React.ReactElement {
  // Apply category filter
  const filtered =
    activeFilter !== "all"
      ? activities.filter((a) => a.category === activeFilter)
      : activities;

  const total = filtered.length;
  const start = Math.min(scrollOffset, Math.max(0, total - 1));
  const end = Math.min(start + maxVisible, total);
  const visibleActivities = filtered.slice(start, end);

  const isScrolled = start > 0;
  const hasMoreBelow = end < total;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="space-between">
        <Box gap={1}>
          <Text bold dimColor>
            Activity
          </Text>
          {activeFilter !== "all" && (
            <Text color="yellow">[{filterLabels[activeFilter]}]</Text>
          )}
        </Box>
        <Box gap={1}>
          {isScrolled && (
            <Text color="cyan">{"\u2191"}</Text>
          )}
          {total > maxVisible && (
            <Text dimColor>
              {start + 1}-{end} of {total}
            </Text>
          )}
          {hasMoreBelow && (
            <Text color="cyan">{"\u2193"}</Text>
          )}
        </Box>
      </Box>
      {visibleActivities.length === 0 ? (
        <Text dimColor>
          {activeFilter !== "all"
            ? `No ${filterLabels[activeFilter].toLowerCase()} activity yet...`
            : "No activity yet..."}
        </Text>
      ) : (
        visibleActivities.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} verbose={verbose} />
        ))
      )}
    </Box>
  );
}
