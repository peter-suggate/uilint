/**
 * PluginStatusPanel - persistent at-a-glance view of Ollama plugin states.
 *
 * Shows each plugin's lifecycle status, model, and progress in the CLI dashboard.
 */

import React from "react";
import { Box, Text } from "ink";
import type { PluginState, PluginLifecycle } from "../types.js";

export interface PluginStatusPanelProps {
  plugins: Map<string, PluginState>;
}

const statusDisplay: Record<
  PluginLifecycle,
  { icon: string; color: string; label: string }
> = {
  idle: { icon: "\u25CB", color: "gray", label: "Idle" },
  "waiting-for-ollama": { icon: "\u25CC", color: "yellow", label: "Queued" },
  "using-ollama": { icon: "\u25CF", color: "cyan", label: "Using Ollama" },
  processing: { icon: "\u25CF", color: "blue", label: "Processing" },
  complete: { icon: "\u2713", color: "green", label: "Complete" },
  error: { icon: "\u2717", color: "red", label: "Error" },
};

function ProgressBar({
  progress,
  width = 12,
}: {
  progress: number;
  width?: number;
}): React.ReactElement {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return (
    <Text>
      <Text color="cyan">{"\u2588".repeat(filled)}</Text>
      <Text dimColor>{"\u2591".repeat(empty)}</Text>
    </Text>
  );
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

function PluginRow({
  plugin,
}: {
  plugin: PluginState;
}): React.ReactElement {
  const display = statusDisplay[plugin.status];

  return (
    <Box>
      {/* Status icon */}
      <Text color={display.color}>{display.icon} </Text>

      {/* Plugin name — fixed width */}
      <Box width={13}>
        <Text bold={plugin.status !== "idle"}>{plugin.name}</Text>
      </Box>

      {/* Status label */}
      <Box width={16}>
        <Text color={display.color}>{display.label}</Text>
      </Box>

      {/* Model */}
      <Text dimColor>({plugin.model})</Text>

      {/* Progress bar for active states */}
      {(plugin.status === "waiting-for-ollama" ||
        plugin.status === "using-ollama" ||
        plugin.status === "processing") &&
        plugin.progress !== undefined && (
          <Box marginLeft={1} gap={1}>
            <ProgressBar progress={plugin.progress} />
            <Text dimColor>
              {plugin.progress.toFixed(0)}%
              {plugin.current !== undefined && plugin.total !== undefined
                ? ` (${plugin.current}/${plugin.total})`
                : ""}
            </Text>
          </Box>
        )}

      {/* Message */}
      {plugin.message && plugin.status !== "idle" && (
        <Text dimColor>{"  "}{truncate(plugin.message, 40)}</Text>
      )}

      {/* Error */}
      {plugin.status === "error" && plugin.error && (
        <Text color="red">{"  "}{truncate(plugin.error, 40)}</Text>
      )}
    </Box>
  );
}

export function PluginStatusPanel({
  plugins,
}: PluginStatusPanelProps): React.ReactElement | null {
  const pluginArray = Array.from(plugins.values());

  if (pluginArray.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      <Text bold dimColor>
        Plugins
      </Text>
      {pluginArray.map((plugin) => (
        <PluginRow key={plugin.id} plugin={plugin} />
      ))}
    </Box>
  );
}
