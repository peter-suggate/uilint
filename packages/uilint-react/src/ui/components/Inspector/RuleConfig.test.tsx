/**
 * Tests for RuleConfig component
 *
 * RuleConfig is the main configuration panel that combines:
 * - Severity selector (off/warn/error)
 * - Dynamic rule options form based on optionSchema
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { RuleConfig } from "./RuleConfig";
import type { RuleOptionSchema } from "../../../plugins/eslint/types";

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          const filtered: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(props)) {
            if (
              ![
                "initial",
                "animate",
                "exit",
                "transition",
                "whileHover",
                "whileTap",
                "layout",
                "variants",
              ].includes(key)
            ) {
              filtered[key] = val;
            }
          }
          return React.createElement(prop, { ...filtered, ref });
        });
      },
    }
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

describe("RuleConfig", () => {
  afterEach(() => {
    cleanup();
  });

  const sampleSchema: RuleOptionSchema = {
    fields: [
      {
        key: "maxDepth",
        label: "Maximum Depth",
        type: "number",
        defaultValue: 2,
        description: "Maximum drilling depth before warning",
      },
      {
        key: "ignoredProps",
        label: "Ignored Props",
        type: "array",
        defaultValue: ["className", "style"],
        placeholder: "prop1, prop2",
      },
    ],
  };

  describe("Severity Selector", () => {
    it("renders severity buttons", () => {
      const onSeverityChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
        />
      );

      expect(screen.getByText("Off")).toBeTruthy();
      expect(screen.getByText("Warn")).toBeTruthy();
      expect(screen.getByText("Error")).toBeTruthy();
    });

    it("highlights current severity", () => {
      const onSeverityChange = vi.fn();
      const { container } = render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="error"
          onSeverityChange={onSeverityChange}
        />
      );

      // Error button should have the selected styling
      const errorButton = screen.getByText("Error").closest("button");
      expect(errorButton?.className).toContain("bg-foreground");
    });

    it("calls onSeverityChange when severity button is clicked", () => {
      const onSeverityChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
        />
      );

      fireEvent.click(screen.getByText("Off"));
      expect(onSeverityChange).toHaveBeenCalledWith("off");

      fireEvent.click(screen.getByText("Error"));
      expect(onSeverityChange).toHaveBeenCalledWith("error");
    });
  });

  describe("Options Form Integration", () => {
    it("renders options form when schema is provided", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      expect(screen.getByText("Maximum Depth")).toBeTruthy();
      expect(screen.getByText("Ignored Props")).toBeTruthy();
    });

    it("shows 'No additional options' when schema is empty", () => {
      const onSeverityChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={{ fields: [] }}
        />
      );

      expect(screen.getByText("No additional options for this rule")).toBeTruthy();
    });

    it("shows 'No additional options' when schema is not provided", () => {
      const onSeverityChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
        />
      );

      expect(screen.getByText("No additional options for this rule")).toBeTruthy();
    });

    it("calls onOptionChange when option field changes", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{ maxDepth: 2 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
        />
      );

      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "5" } });

      expect(onOptionChange).toHaveBeenCalledWith("maxDepth", 5);
    });

    it("displays current option values", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{ maxDepth: 10, ignoredProps: ["a", "b", "c"] }}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      // Check number value
      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      expect(inputs[0].value).toBe("10"); // maxDepth
      expect(inputs[1].value).toBe("a, b, c"); // ignoredProps
    });
  });

  describe("Reset Functionality", () => {
    it("calls onResetOptions when reset is triggered", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      const onResetOptions = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{ maxDepth: 10 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
          onResetOptions={onResetOptions}
        />
      );

      fireEvent.click(screen.getByText("Reset to defaults"));
      expect(onResetOptions).toHaveBeenCalledTimes(1);
    });
  });

  describe("Updating State", () => {
    it("passes isUpdating to options form", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
          isUpdating
        />
      );

      expect(screen.getByText("Updating...")).toBeTruthy();
    });

    it("disables fields when updating", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
          isUpdating
        />
      );

      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      inputs.forEach((input) => {
        expect(input.disabled).toBe(true);
      });
    });
  });

  describe("Complete Configuration Flow", () => {
    it("allows configuring both severity and options", () => {
      const onSeverityChange = vi.fn();
      const onOptionChange = vi.fn();
      render(
        <RuleConfig
          ruleId="uilint/no-prop-drilling-depth"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          optionSchema={sampleSchema}
          currentOptions={{ maxDepth: 2 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
        />
      );

      // Change severity
      fireEvent.click(screen.getByText("Error"));
      expect(onSeverityChange).toHaveBeenCalledWith("error");

      // Change option (first textbox is maxDepth)
      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      fireEvent.change(inputs[0], { target: { value: "5" } });
      expect(onOptionChange).toHaveBeenCalledWith("maxDepth", 5);
    });
  });

  describe("Styling and Layout", () => {
    it("applies custom className", () => {
      const onSeverityChange = vi.fn();
      const { container } = render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
          className="custom-class"
        />
      );

      const firstChild = container.firstChild as HTMLElement;
      expect(firstChild.className).toContain("custom-class");
    });

    it("renders severity label", () => {
      const onSeverityChange = vi.fn();
      render(
        <RuleConfig
          ruleId="test-rule"
          currentSeverity="warn"
          onSeverityChange={onSeverityChange}
        />
      );

      expect(screen.getByText("Severity")).toBeTruthy();
    });
  });
});
