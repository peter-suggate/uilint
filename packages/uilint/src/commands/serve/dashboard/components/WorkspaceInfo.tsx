/**
 * WorkspaceInfo component - displays workspace and app root paths
 */

import React from "react";
import { Box, Text } from "ink";

export interface WorkspaceInfoProps {
  workspaceRoot: string | null;
  appRoot: string | null;
}

function truncatePath(path: string, maxLen: number = 60): string {
  if (path.length <= maxLen) return path;
  return "..." + path.slice(-(maxLen - 3));
}

export function WorkspaceInfo({
  workspaceRoot,
  appRoot,
}: WorkspaceInfoProps): React.ReactElement {
  if (!workspaceRoot && !appRoot) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Initializing...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text dimColor>Workspace: </Text>
        <Text>{truncatePath(workspaceRoot || "")}</Text>
      </Box>
      {appRoot && appRoot !== workspaceRoot && (
        <Box>
          <Text dimColor>App Root:  </Text>
          <Text>{truncatePath(appRoot)}</Text>
        </Box>
      )}
    </Box>
  );
}
