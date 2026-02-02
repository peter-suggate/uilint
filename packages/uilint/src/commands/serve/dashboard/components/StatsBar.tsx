/**
 * StatsBar component - displays server statistics
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

export interface StatsBarProps {
  connectedClients: number;
  subscriptions: number;
  cacheEntries: number;
  startTime: Date;
}

function formatUptime(startTime: Date): string {
  const diff = Date.now() - startTime.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function StatsBar({
  connectedClients,
  subscriptions,
  cacheEntries,
  startTime,
}: StatsBarProps): React.ReactElement {
  const [, setTick] = useState(0);

  // Update uptime display every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <Box>
          <Text dimColor>Clients: </Text>
          <Text bold color={connectedClients > 0 ? "green" : "gray"}>
            {connectedClients}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Subs: </Text>
          <Text>{subscriptions}</Text>
        </Box>
      </Box>
      <Box gap={2}>
        <Box>
          <Text dimColor>Cache: </Text>
          <Text>{cacheEntries}</Text>
        </Box>
        <Box>
          <Text dimColor>Uptime: </Text>
          <Text>{formatUptime(startTime)}</Text>
        </Box>
      </Box>
    </Box>
  );
}
