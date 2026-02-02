/**
 * Tests for RuleOptionsForm component
 *
 * RuleOptionsForm renders a form based on optionSchema and handles
 * immediate option changes via WebSocket.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { RuleOptionsForm } from "./RuleOptionsForm";
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

describe("RuleOptionsForm", () => {
  afterEach(() => {
    cleanup();
  });

  const multiFieldSchema: RuleOptionSchema = {
    fields: [
      {
        key: "maxDepth",
        label: "Max Depth",
        type: "number",
        defaultValue: 2,
        description: "Maximum depth",
      },
      {
        key: "enabled",
        label: "Enabled",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "preferred",
        label: "Preferred",
        type: "select",
        defaultValue: "shadcn",
        options: [
          { value: "shadcn", label: "shadcn/ui" },
          { value: "mui", label: "MUI" },
        ],
      },
    ],
  };

  describe("Rendering", () => {
    it("renders all fields from schema", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      expect(screen.getByText("Max Depth")).toBeTruthy();
      expect(screen.getByText("Enabled")).toBeTruthy();
      expect(screen.getByText("Preferred")).toBeTruthy();
    });

    it("renders 'No additional options' for empty schema", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={{ fields: [] }}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      expect(screen.getByText("No additional options for this rule")).toBeTruthy();
    });

    it("renders Options header", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      expect(screen.getByText("Options")).toBeTruthy();
    });
  });

  describe("Value Display", () => {
    it("displays current option values", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 5, preferred: "mui" }}
          defaultOptions={{ maxDepth: 2, preferred: "shadcn" }}
          onOptionChange={onOptionChange}
        />
      );

      // Number field should show 5
      const numberInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(numberInput.value).toBe("5");

      // Select should show MUI
      expect(screen.getByText("MUI")).toBeTruthy();
    });

    it("falls back to default values when current is undefined", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{ maxDepth: 3 }}
          onOptionChange={onOptionChange}
        />
      );

      // Should use schema default since neither current nor defaultOptions has value
      const numberInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(numberInput.value).toBe("2"); // Schema default
    });
  });

  describe("Change Handling", () => {
    it("calls onOptionChange immediately when field changes", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 2 }}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      const numberInput = screen.getByRole("textbox");
      fireEvent.change(numberInput, { target: { value: "10" } });

      expect(onOptionChange).toHaveBeenCalledWith("maxDepth", 10);
    });

    it("calls onOptionChange for each field type", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
        />
      );

      // Change boolean
      fireEvent.click(screen.getByText("Off"));
      expect(onOptionChange).toHaveBeenCalledWith("enabled", false);

      // Change select - open and select
      fireEvent.click(screen.getByText("shadcn/ui"));
      fireEvent.click(screen.getByText("MUI"));
      expect(onOptionChange).toHaveBeenCalledWith("preferred", "mui");
    });
  });

  describe("Reset Functionality", () => {
    it("shows reset button when values differ from defaults", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 5 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
          onReset={onReset}
        />
      );

      expect(screen.getByText("Reset to defaults")).toBeTruthy();
    });

    it("hides reset button when values match defaults", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 2, enabled: true, preferred: "shadcn" }}
          defaultOptions={{ maxDepth: 2, enabled: true, preferred: "shadcn" }}
          onOptionChange={onOptionChange}
          onReset={onReset}
        />
      );

      expect(screen.queryByText("Reset to defaults")).toBeNull();
    });

    it("calls onReset when reset button is clicked", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 5 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
          onReset={onReset}
        />
      );

      fireEvent.click(screen.getByText("Reset to defaults"));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("Loading State", () => {
    it("shows updating overlay when isUpdating is true", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
          isUpdating
        />
      );

      expect(screen.getByText("Updating...")).toBeTruthy();
    });

    it("disables fields when updating", () => {
      const onOptionChange = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{}}
          defaultOptions={{}}
          onOptionChange={onOptionChange}
          isUpdating
        />
      );

      const numberInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(numberInput.disabled).toBe(true);
    });

    it("disables reset button when updating", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={multiFieldSchema}
          currentOptions={{ maxDepth: 5 }}
          defaultOptions={{ maxDepth: 2 }}
          onOptionChange={onOptionChange}
          onReset={onReset}
          isUpdating
        />
      );

      const resetButton = screen.getByText("Reset to defaults") as HTMLButtonElement;
      expect(resetButton.disabled).toBe(true);
    });
  });

  describe("Array comparison for changes", () => {
    const arraySchema: RuleOptionSchema = {
      fields: [
        {
          key: "items",
          label: "Items",
          type: "array",
          defaultValue: ["a", "b"],
        },
      ],
    };

    it("detects changes in array values", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={arraySchema}
          currentOptions={{ items: ["a", "b", "c"] }}
          defaultOptions={{ items: ["a", "b"] }}
          onOptionChange={onOptionChange}
          onReset={onReset}
        />
      );

      // Should show reset because arrays differ
      expect(screen.getByText("Reset to defaults")).toBeTruthy();
    });

    it("detects no changes when arrays match", () => {
      const onOptionChange = vi.fn();
      const onReset = vi.fn();
      render(
        <RuleOptionsForm
          ruleId="test-rule"
          optionSchema={arraySchema}
          currentOptions={{ items: ["a", "b"] }}
          defaultOptions={{ items: ["a", "b"] }}
          onOptionChange={onOptionChange}
          onReset={onReset}
        />
      );

      // Should not show reset because arrays match
      expect(screen.queryByText("Reset to defaults")).toBeNull();
    });
  });
});
