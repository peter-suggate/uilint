/**
 * ServeDashboard - main Ink component for the WebSocket server CLI dashboard
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, useInput, useApp } from "ink";
import {
  ServerHeader,
  WorkspaceInfo,
  StatsBar,
  BackgroundTasks,
  ActivityLog,
  HelpBar,
} from "./components/index.js";
import type { DashboardState } from "./types.js";
import { getDashboardStore } from "./store.js";

export interface ServeDashboardProps {
  /** Callback when user requests to quit */
  onQuit?: () => void;
  /** Callback when user requests to rebuild index */
  onRebuildIndex?: () => void;
}

export function ServeDashboard({
  onQuit,
  onRebuildIndex,
}: ServeDashboardProps): React.ReactElement {
  const { exit } = useApp();
  const store = getDashboardStore();

  // Subscribe to store updates
  const [state, setState] = useState<DashboardState>(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });
    return unsubscribe;
  }, [store]);

  // Handle keyboard input
  useInput(
    useCallback(
      (input, key) => {
        if (input === "q" || (key.ctrl && input === "c")) {
          onQuit?.();
          exit();
        } else if (input === "c") {
          store.clearActivities();
        } else if (input === "v") {
          store.toggleVerbose();
        } else if (input === "r") {
          onRebuildIndex?.();
        }
      },
      [exit, onQuit, onRebuildIndex, store]
    )
  );

  return (
    <Box flexDirection="column" width="100%">
      <ServerHeader port={state.port} isRunning={state.isRunning} />

      <WorkspaceInfo
        workspaceRoot={state.workspace?.workspaceRoot ?? null}
        appRoot={state.workspace?.appRoot ?? null}
      />

      <StatsBar
        connectedClients={state.stats.connectedClients}
        subscriptions={state.stats.subscriptions}
        cacheEntries={state.stats.cacheEntries}
        startTime={state.stats.startTime}
      />

      <BackgroundTasks tasks={state.backgroundTasks} />

      <ActivityLog
        activities={state.activities}
        maxVisible={15}
        verbose={state.verbose}
      />

      <HelpBar verbose={state.verbose} />
    </Box>
  );
}
