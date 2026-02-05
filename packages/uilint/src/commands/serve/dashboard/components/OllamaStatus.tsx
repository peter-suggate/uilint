/**
 * OllamaStatus component - displays Ollama connection status
 */

import React from "react";
import { Box, Text } from "ink";
import type { OllamaStatusState } from "../types.js";

export interface OllamaStatusProps {
  status: OllamaStatusState;
  model?: string;
}

const statusConfig: Record<
  OllamaStatusState,
  { icon: string; color: string; label: string }
> = {
  checking: { icon: "\u25CB", color: "gray", label: "checking" },
  connected: { icon: "\u25CF", color: "green", label: "connected" },
  offline: { icon: "\u25CF", color: "red", label: "offline" },
  error: { icon: "\u25CF", color: "red", label: "error" },
};

export function OllamaStatus({
  status,
  model,
}: OllamaStatusProps): React.ReactElement {
  const config = statusConfig[status];

  return (
    <Box gap={1}>
      <Text dimColor>Ollama:</Text>
      <Text color={config.color}>{config.icon}</Text>
      <Text color={config.color}>{config.label}</Text>
      {model && status === "connected" && (
        <Text dimColor>({model})</Text>
      )}
    </Box>
  );
}
