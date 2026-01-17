/**
 * Tests for ProgressList component
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  ProgressList,
  type Task,
} from "../../../src/commands/install/components/ProgressList.js";

// Helper to create mock tasks
function createTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    label: "Test Task",
    status: "pending",
    ...overrides,
  };
}

describe("ProgressList", () => {
  it("should render title", () => {
    const tasks: Task[] = [];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Progress");
  });

  it("should render custom title", () => {
    const tasks: Task[] = [];
    const { lastFrame } = render(
      <ProgressList title="Installation Progress" tasks={tasks} />
    );

    expect(lastFrame()).toContain("Installation Progress");
  });

  it("should render pending task with empty circle", () => {
    const tasks: Task[] = [createTask({ label: "Pending Task", status: "pending" })];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("○");
    expect(lastFrame()).toContain("Pending Task");
  });

  it("should render running task with spinner", () => {
    const tasks: Task[] = [createTask({ label: "Running Task", status: "running" })];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Running Task");
    // Note: Spinner rendering is dynamic, so we just check the label is there
  });

  it("should render completed task with checkmark", () => {
    const tasks: Task[] = [
      createTask({ label: "Completed Task", status: "completed" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("✓");
    expect(lastFrame()).toContain("Completed Task");
  });

  it("should render failed task with X mark", () => {
    const tasks: Task[] = [createTask({ label: "Failed Task", status: "failed" })];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("✗");
    expect(lastFrame()).toContain("Failed Task");
  });

  it("should show error message for failed task", () => {
    const tasks: Task[] = [
      createTask({
        label: "Failed Task",
        status: "failed",
        error: "Something went wrong",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Error: Something went wrong");
  });

  it("should show detail text when provided", () => {
    const tasks: Task[] = [
      createTask({
        label: "Task with detail",
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
      createTask({ id: "1", label: "Task 1", status: "completed" }),
      createTask({ id: "2", label: "Task 2", status: "running" }),
      createTask({ id: "3", label: "Task 3", status: "pending" }),
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

    expect(lastFrame()).toContain("Progress");
  });

  it("should handle task with both detail and error", () => {
    const tasks: Task[] = [
      createTask({
        label: "Complex Task",
        status: "failed",
        detail: "Step 1 of 3",
        error: "Network timeout",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("Complex Task");
    expect(lastFrame()).toContain("Step 1 of 3");
    expect(lastFrame()).toContain("Error: Network timeout");
  });

  it("should not show error for non-failed tasks", () => {
    const tasks: Task[] = [
      createTask({
        label: "Completed Task",
        status: "completed",
        error: "This should not be shown",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).not.toContain("This should not be shown");
  });

  it("should handle long task labels", () => {
    const tasks: Task[] = [
      createTask({
        label: "This is a very long task label that might wrap in the terminal",
        status: "running",
      }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    expect(lastFrame()).toContain("This is a very long task label");
  });

  it("should maintain task order", () => {
    const tasks: Task[] = [
      createTask({ id: "3", label: "Third", status: "completed" }),
      createTask({ id: "1", label: "First", status: "completed" }),
      createTask({ id: "2", label: "Second", status: "completed" }),
    ];
    const { lastFrame } = render(<ProgressList tasks={tasks} />);

    const output = lastFrame() || "";
    const thirdIndex = output.indexOf("Third");
    const firstIndex = output.indexOf("First");
    const secondIndex = output.indexOf("Second");

    expect(thirdIndex).toBeLessThan(firstIndex);
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});
