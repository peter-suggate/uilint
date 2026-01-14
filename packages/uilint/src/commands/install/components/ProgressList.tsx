/**
 * ProgressList component - displays installation progress with spinners
 */

import React from "react";
import { Box, Text, Static } from "ink";
import { Spinner } from "./Spinner.js";
import type { ProgressEvent } from "../installers/types.js";

export interface Task {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  message: string;
  detail?: string;
  error?: string;
}

export interface ProgressListProps {
  tasks: Task[];
}

function CompletedTask({ task }: { task: Task }): React.ReactElement {
  return (
    <Box>
      <Text color="green">✓ </Text>
      <Text>{task.message}</Text>
    </Box>
  );
}

function RunningTask({ task }: { task: Task }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Spinner />
        <Text> {task.message}</Text>
      </Box>
      {task.detail && (
        <Box paddingLeft={2}>
          <Text dimColor>└─ {task.detail}</Text>
        </Box>
      )}
    </Box>
  );
}

function ErrorTask({ task }: { task: Task }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="red">✗ </Text>
        <Text color="red">{task.message}</Text>
      </Box>
      {task.error && (
        <Box paddingLeft={2}>
          <Text color="red" dimColor>
            └─ {task.error}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function PendingTask({ task }: { task: Task }): React.ReactElement {
  return (
    <Box>
      <Text dimColor>○ {task.message}</Text>
    </Box>
  );
}

export function ProgressList({ tasks }: ProgressListProps): React.ReactElement {
  const completedTasks = tasks.filter((t) => t.status === "complete");
  const runningTasks = tasks.filter((t) => t.status === "running");
  const errorTasks = tasks.filter((t) => t.status === "error");
  const pendingTasks = tasks.filter((t) => t.status === "pending");

  return (
    <Box flexDirection="column">
      {/* Use Static for completed tasks so they don't re-render */}
      {completedTasks.length > 0 && (
        <Static items={completedTasks}>
          {(task) => <CompletedTask key={task.id} task={task} />}
        </Static>
      )}

      {/* Show running tasks with spinner */}
      {runningTasks.map((task) => (
        <RunningTask key={task.id} task={task} />
      ))}

      {/* Show errors */}
      {errorTasks.map((task) => (
        <ErrorTask key={task.id} task={task} />
      ))}

      {/* Show pending tasks (dimmed) */}
      {pendingTasks.map((task) => (
        <PendingTask key={task.id} task={task} />
      ))}
    </Box>
  );
}

/**
 * Convert progress events to task list
 */
export function progressEventsToTasks(events: ProgressEvent[]): Task[] {
  const tasks: Task[] = [];
  let taskIdCounter = 0;

  for (const event of events) {
    if (event.type === "start") {
      tasks.push({
        id: `task-${taskIdCounter++}`,
        status: "running",
        message: event.message,
        detail: event.detail,
      });
    } else if (event.type === "progress") {
      // Find the last running task and update it
      const lastRunning = tasks.reverse().find((t) => t.status === "running");
      tasks.reverse();

      if (lastRunning) {
        lastRunning.message = event.message;
        lastRunning.detail = event.detail;
      } else {
        // No running task, create a new one
        tasks.push({
          id: `task-${taskIdCounter++}`,
          status: "running",
          message: event.message,
          detail: event.detail,
        });
      }
    } else if (event.type === "complete") {
      // Mark the last running task as complete
      const lastRunning = tasks.reverse().find((t) => t.status === "running");
      tasks.reverse();

      if (lastRunning) {
        lastRunning.status = "complete";
        lastRunning.detail = undefined; // Clear detail on completion
      }
    } else if (event.type === "error") {
      // Mark the last running task as error
      const lastRunning = tasks.reverse().find((t) => t.status === "running");
      tasks.reverse();

      if (lastRunning) {
        lastRunning.status = "error";
        lastRunning.error = event.error;
      } else {
        // No running task, create error task
        tasks.push({
          id: `task-${taskIdCounter++}`,
          status: "error",
          message: event.message,
          error: event.error,
        });
      }
    }
  }

  return tasks;
}
