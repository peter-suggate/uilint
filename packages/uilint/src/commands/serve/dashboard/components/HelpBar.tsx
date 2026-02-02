/**
 * HelpBar component - displays keyboard shortcuts
 */

import React from "react";
import { Box, Text } from "ink";

export interface HelpBarProps {
  verbose: boolean;
}

export function HelpBar({ verbose }: HelpBarProps): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} gap={2}>
      <Box>
        <Text bold color="cyan">
          q
        </Text>
        <Text dimColor> quit</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          c
        </Text>
        <Text dimColor> clear log</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          v
        </Text>
        <Text dimColor> verbose {verbose ? "(on)" : "(off)"}</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          r
        </Text>
        <Text dimColor> rebuild index</Text>
      </Box>
    </Box>
  );
}
