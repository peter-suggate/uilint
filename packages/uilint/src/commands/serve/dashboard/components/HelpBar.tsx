/**
 * HelpBar component - displays keyboard shortcuts
 */

import React from "react";
import { Box, Text } from "ink";
import type { ActivityCategory } from "../types.js";

export interface HelpBarProps {
  verbose: boolean;
  activeFilter?: ActivityCategory;
}

const filterLabels: Record<ActivityCategory, string> = {
  all: "all",
  errors: "errors",
  vision: "vision",
  semantic: "semantic",
  lint: "lint",
  system: "system",
};

export function HelpBar({ verbose, activeFilter = "all" }: HelpBarProps): React.ReactElement {
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
          f
        </Text>
        <Text dimColor> filter ({filterLabels[activeFilter]})</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          r
        </Text>
        <Text dimColor> rebuild index</Text>
      </Box>
      <Box>
        <Text bold color="cyan">
          {"\u2191\u2193"}
        </Text>
        <Text dimColor> scroll</Text>
      </Box>
    </Box>
  );
}
