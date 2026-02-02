/**
 * ServerHeader component - displays server status and URL
 */

import React from "react";
import { Box, Text } from "ink";

export interface ServerHeaderProps {
  port: number;
  isRunning: boolean;
}

export function ServerHeader({
  port,
  isRunning,
}: ServerHeaderProps): React.ReactElement {
  const url = `ws://localhost:${port}`;
  const statusColor = isRunning ? "green" : "red";
  const statusIcon = isRunning ? "\u25CF" : "\u25CB"; // Filled/hollow circle

  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        UILint Server
      </Text>
      <Box>
        <Text dimColor>{url}</Text>
        <Text> </Text>
        <Text color={statusColor}>{statusIcon}</Text>
      </Box>
    </Box>
  );
}
