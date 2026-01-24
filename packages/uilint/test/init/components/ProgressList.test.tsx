/**
 * Tests for ProgressList component
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  ProgressList,
  type Task,
} from "../../../src/commands/init/components/ProgressList.js";

// Helper to create mock tasks
function createTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    message: "Test Task",
    status: "pending",
    ...overrides,
  };
}

describe("ProgressList", () => {
  it("should render pending task with empty circle", () => {
    const tasks: Task[] = [
      createTask({ message: "Pending Task", status: "pending" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("○");
    expect(lastFrame()).toContain("Pending Task");
  });

  it("should render running task with spinner", () => {
    const tasks: Task[] = [
      createTask({ message: "Running Task", status: "running" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Running Task");
    // Note: Spinner rendering is dynamic, so we just check the message is there
  });

  it("should render completed task with checkmark", () => {
    const tasks: Task[] = [
      createTask({ message: "Completed Task", status: "complete" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("✓");
    expect(lastFrame()).toContain("Completed Task");
  });

  it("should render error task with X mark", () => {
    const tasks: Task[] = [
      createTask({ message: "Error Task", status: "error" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("✗");
    expect(lastFrame()).toContain("Error Task");
  });

  it("should show error message for error task", () => {
    const tasks: Task[] = [
      createTask({
        message: "Error Task",
        status: "error",
        error: "Something went wrong",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Something went wrong");
  });

  it("should show detail text when provided", () => {
    const tasks: Task[] = [
      createTask({
        message: "Task with detail",
        status: "running",
        detail: "Processing files...",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Task with detail");
    expect(lastFrame()).toContain("Processing files...");
  });

  it("should render multiple tasks", () => {
    const tasks: Task[] = [
      createTask({ id: "1", message: "Task 1", status: "complete" }),
      createTask({ id: "2", message: "Task 2", status: "running" }),
      createTask({ id: "3", message: "Task 3", status: "pending" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Task 1");
    expect(lastFrame()).toContain("Task 2");
    expect(lastFrame()).toContain("Task 3");
    expect(lastFrame()).toContain("✓"); // For completed
    expect(lastFrame()).toContain("○"); // For pending
  });

  it("should render empty list without errors", () => {
    const tasks: Task[] = [];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    // Should not throw, output should be minimal
    expect(lastFrame()).toBeDefined();
  });

  it("should handle task with both detail and error", () => {
    const tasks: Task[] = [
      createTask({
        message: "Complex Task",
        status: "error",
        detail: "Step 1 of 3",
        error: "Network timeout",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Complex Task");
    // Error tasks show error, not detail
    expect(lastFrame()).toContain("Network timeout");
  });

  it("should handle long task messages", () => {
    const tasks: Task[] = [
      createTask({
        message: "This is a very long task message that might wrap in the terminal",
        status: "running",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("This is a very long task message");
  });

  it("should maintain task order by status (complete, running, error, pending)", () => {
    const tasks: Task[] = [
      createTask({ id: "1", message: "Pending", status: "pending" }),
      createTask({ id: "2", message: "Complete", status: "complete" }),
      createTask({ id: "3", message: "Running", status: "running" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    const output = lastFrame() || "";
    const completeIndex = output.indexOf("Complete");
    const runningIndex = output.indexOf("Running");
    const pendingIndex = output.indexOf("Pending");

    // Completed should be first, then running, then pending
    expect(completeIndex).toBeLessThan(runningIndex);
    expect(runningIndex).toBeLessThan(pendingIndex);
  });
});
