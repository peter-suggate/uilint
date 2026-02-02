/**
 * BackgroundTasks component - displays background task progress
 */

import React from "react";
import { Box, Text } from "ink";
import type { BackgroundTask } from "../types.js";

export interface BackgroundTasksProps {
  tasks: Map<string, BackgroundTask>;
}

function ProgressBar({
  progress,
  width = 20,
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

function TaskRow({ task }: { task: BackgroundTask }): React.ReactElement {
  const statusIcon = {
    idle: "\u25CB", // hollow circle
    running: "\u25CF", // filled circle
    complete: "\u2713", // checkmark
    error: "\u2717", // x mark
  }[task.status];

  const statusColor = {
    idle: "gray",
    running: "cyan",
    complete: "green",
    error: "red",
  }[task.status] as "gray" | "cyan" | "green" | "red";

  return (
    <Box>
      <Text color={statusColor}>{statusIcon} </Text>
      <Text>{task.name}: </Text>
      {task.status === "running" && task.progress !== undefined ? (
        <Box gap={1}>
          <ProgressBar progress={task.progress} width={15} />
          <Text dimColor>
            {task.progress.toFixed(0)}%
            {task.current !== undefined && task.total !== undefined
              ? ` (${task.current}/${task.total})`
              : ""}
          </Text>
        </Box>
      ) : task.status === "complete" ? (
        <Text color="green">Complete</Text>
      ) : task.status === "error" ? (
        <Text color="red">{task.error || "Failed"}</Text>
      ) : (
        <Text dimColor>{task.message || "Idle"}</Text>
      )}
    </Box>
  );
}

export function BackgroundTasks({
  tasks,
}: BackgroundTasksProps): React.ReactElement | null {
  const taskArray = Array.from(tasks.values());

  if (taskArray.length === 0) {
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
        Background Tasks
      </Text>
      {taskArray.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </Box>
  );
}
