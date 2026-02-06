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
  OllamaStatus,
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
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });
    return unsubscribe;
  }, [store]);

  // Clamp scrollOffset when activities change
  useEffect(() => {
    setScrollOffset((prev) => {
      const maxOffset = Math.max(0, state.activities.length - 15);
      return Math.min(prev, maxOffset);
    });
  }, [state.activities.length]);

  // Check Ollama status periodically
  useEffect(() => {
    const checkOllamaStatus = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/tags", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = (await response.json()) as { models?: Array<{ name?: string }> };
          const models = data.models || [];
          // Get the first model name as the "active" model indicator
          const modelName = models.length > 0 ? models[0].name : undefined;
          store.setOllamaStatus({
            status: "connected",
            model: modelName,
            lastChecked: new Date(),
          });
        } else {
          store.setOllamaStatus({
            status: "error",
            lastChecked: new Date(),
          });
        }
      } catch {
        store.setOllamaStatus({
          status: "offline",
          lastChecked: new Date(),
        });
      }
    };

    // Initial check
    checkOllamaStatus();

    // Check every 30 seconds
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
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
          setScrollOffset(0);
        } else if (input === "v") {
          store.toggleVerbose();
        } else if (input === "f") {
          store.cycleFilter();
          setScrollOffset(0);
        } else if (input === "r") {
          onRebuildIndex?.();
        } else if (key.downArrow || input === "j") {
          setScrollOffset((prev) => {
            const maxOffset = Math.max(0, state.activities.length - 15);
            return Math.min(maxOffset, prev + 1);
          });
        } else if (key.upArrow || input === "k") {
          setScrollOffset((prev) => Math.max(0, prev - 1));
        }
      },
      [exit, onQuit, onRebuildIndex, store, state.activities.length]
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
        ollamaStatus={state.ollamaStatus.status}
        ollamaModel={state.ollamaStatus.model}
      />

      <BackgroundTasks tasks={state.backgroundTasks} />

      <ActivityLog
        activities={state.activities}
        maxVisible={15}
        verbose={state.verbose}
        scrollOffset={scrollOffset}
        activeFilter={state.activeFilter}
      />

      <HelpBar verbose={state.verbose} activeFilter={state.activeFilter} />
    </Box>
  );
}
