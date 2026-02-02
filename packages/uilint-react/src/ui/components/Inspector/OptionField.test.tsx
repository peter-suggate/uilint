/**
 * Tests for OptionField component
 *
 * OptionField renders dynamic form fields based on OptionFieldSchema type.
 * Tests cover all field types: text, number, boolean, select, multiselect, array.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { OptionField } from "./OptionField";
import type { OptionFieldSchema } from "../../../plugins/eslint/types";

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

describe("OptionField", () => {
  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // Text Field Tests
  // =========================================================================

  describe("TextField", () => {
    const textSchema: OptionFieldSchema = {
      key: "testText",
      label: "Test Text",
      type: "text",
      defaultValue: "default",
      placeholder: "Enter text",
      description: "A test text field",
    };

    it("renders text input with label", () => {
      const onChange = vi.fn();
      render(<OptionField schema={textSchema} value="" onChange={onChange} />);

      expect(screen.getByText("Test Text")).toBeTruthy();
      expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
    });

    it("displays current value", () => {
      const onChange = vi.fn();
      render(<OptionField schema={textSchema} value="hello" onChange={onChange} />);

      const input = screen.getByPlaceholderText("Enter text") as HTMLInputElement;
      expect(input.value).toBe("hello");
    });

    it("calls onChange with key and value on input", () => {
      const onChange = vi.fn();
      render(<OptionField schema={textSchema} value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText("Enter text");
      fireEvent.change(input, { target: { value: "new value" } });

      expect(onChange).toHaveBeenCalledWith("testText", "new value");
    });

    it("renders description", () => {
      const onChange = vi.fn();
      render(<OptionField schema={textSchema} value="" onChange={onChange} />);

      expect(screen.getByText("A test text field")).toBeTruthy();
    });

    it("disables input when disabled prop is true", () => {
      const onChange = vi.fn();
      render(<OptionField schema={textSchema} value="" onChange={onChange} disabled />);

      const input = screen.getByPlaceholderText("Enter text") as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  // =========================================================================
  // Number Field Tests
  // =========================================================================

  describe("NumberField", () => {
    const numberSchema: OptionFieldSchema = {
      key: "maxDepth",
      label: "Max Depth",
      type: "number",
      defaultValue: 2,
      description: "Maximum depth allowed",
    };

    it("renders number input with label", () => {
      const onChange = vi.fn();
      render(<OptionField schema={numberSchema} value={2} onChange={onChange} />);

      expect(screen.getByText("Max Depth")).toBeTruthy();
    });

    it("displays current value", () => {
      const onChange = vi.fn();
      render(<OptionField schema={numberSchema} value={5} onChange={onChange} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("5");
    });

    it("calls onChange with parsed number value", () => {
      const onChange = vi.fn();
      render(<OptionField schema={numberSchema} value={2} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "10" } });

      expect(onChange).toHaveBeenCalledWith("maxDepth", 10);
    });

    it("does not call onChange for invalid number input", () => {
      const onChange = vi.fn();
      render(<OptionField schema={numberSchema} value={2} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "abc" } });

      // Should not call onChange for invalid input
      expect(onChange).not.toHaveBeenCalled();
    });

    it("resets to default on blur when empty", () => {
      const onChange = vi.fn();
      render(<OptionField schema={numberSchema} value={2} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith("maxDepth", 2);
    });
  });

  // =========================================================================
  // Boolean Field Tests
  // =========================================================================

  describe("BooleanField", () => {
    const booleanSchema: OptionFieldSchema = {
      key: "enabled",
      label: "Enable Feature",
      type: "boolean",
      defaultValue: false,
      description: "Toggle the feature on or off",
    };

    it("renders toggle buttons with label", () => {
      const onChange = vi.fn();
      render(<OptionField schema={booleanSchema} value={false} onChange={onChange} />);

      expect(screen.getByText("Enable Feature")).toBeTruthy();
      expect(screen.getByText("Off")).toBeTruthy();
      expect(screen.getByText("On")).toBeTruthy();
    });

    it("calls onChange with true when On is clicked", () => {
      const onChange = vi.fn();
      render(<OptionField schema={booleanSchema} value={false} onChange={onChange} />);

      fireEvent.click(screen.getByText("On"));
      expect(onChange).toHaveBeenCalledWith("enabled", true);
    });

    it("calls onChange with false when Off is clicked", () => {
      const onChange = vi.fn();
      render(<OptionField schema={booleanSchema} value={true} onChange={onChange} />);

      fireEvent.click(screen.getByText("Off"));
      expect(onChange).toHaveBeenCalledWith("enabled", false);
    });

    it("does not call onChange when disabled", () => {
      const onChange = vi.fn();
      render(<OptionField schema={booleanSchema} value={false} onChange={onChange} disabled />);

      fireEvent.click(screen.getByText("On"));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Select Field Tests
  // =========================================================================

  describe("SelectField", () => {
    const selectSchema: OptionFieldSchema = {
      key: "preferred",
      label: "Preferred Library",
      type: "select",
      defaultValue: "shadcn",
      options: [
        { value: "shadcn", label: "shadcn/ui" },
        { value: "mui", label: "MUI" },
        { value: "chakra", label: "Chakra UI" },
      ],
      description: "Select your preferred library",
    };

    it("renders select with label", () => {
      const onChange = vi.fn();
      render(<OptionField schema={selectSchema} value="shadcn" onChange={onChange} />);

      expect(screen.getByText("Preferred Library")).toBeTruthy();
    });

    it("displays selected option label", () => {
      const onChange = vi.fn();
      render(<OptionField schema={selectSchema} value="shadcn" onChange={onChange} />);

      expect(screen.getByText("shadcn/ui")).toBeTruthy();
    });

    it("opens dropdown on click and shows options", () => {
      const onChange = vi.fn();
      render(<OptionField schema={selectSchema} value="shadcn" onChange={onChange} />);

      // Click to open dropdown
      fireEvent.click(screen.getByText("shadcn/ui"));

      // Check all options are visible
      expect(screen.getByText("MUI")).toBeTruthy();
      expect(screen.getByText("Chakra UI")).toBeTruthy();
    });

    it("calls onChange when option is selected", () => {
      const onChange = vi.fn();
      render(<OptionField schema={selectSchema} value="shadcn" onChange={onChange} />);

      // Open dropdown
      fireEvent.click(screen.getByText("shadcn/ui"));

      // Select different option
      fireEvent.click(screen.getByText("MUI"));

      expect(onChange).toHaveBeenCalledWith("preferred", "mui");
    });

    it("does not open dropdown when disabled", () => {
      const onChange = vi.fn();
      render(<OptionField schema={selectSchema} value="shadcn" onChange={onChange} disabled />);

      // Try to open dropdown
      fireEvent.click(screen.getByText("shadcn/ui"));

      // MUI option should not be visible
      expect(screen.queryByText("MUI")).toBeNull();
    });
  });

  // =========================================================================
  // Multiselect Field Tests
  // =========================================================================

  describe("MultiselectField", () => {
    const multiselectSchema: OptionFieldSchema = {
      key: "libraries",
      label: "Libraries to Detect",
      type: "multiselect",
      defaultValue: ["shadcn", "mui"],
      options: [
        { value: "shadcn", label: "shadcn/ui" },
        { value: "mui", label: "MUI" },
        { value: "chakra", label: "Chakra UI" },
        { value: "antd", label: "Ant Design" },
      ],
      description: "Select libraries to detect",
    };

    it("renders all options as toggleable buttons", () => {
      const onChange = vi.fn();
      render(
        <OptionField schema={multiselectSchema} value={["shadcn"]} onChange={onChange} />
      );

      expect(screen.getByText("shadcn/ui")).toBeTruthy();
      expect(screen.getByText("MUI")).toBeTruthy();
      expect(screen.getByText("Chakra UI")).toBeTruthy();
      expect(screen.getByText("Ant Design")).toBeTruthy();
    });

    it("adds value when unselected option is clicked", () => {
      const onChange = vi.fn();
      render(
        <OptionField schema={multiselectSchema} value={["shadcn"]} onChange={onChange} />
      );

      fireEvent.click(screen.getByText("MUI"));

      expect(onChange).toHaveBeenCalledWith("libraries", ["shadcn", "mui"]);
    });

    it("removes value when selected option is clicked", () => {
      const onChange = vi.fn();
      render(
        <OptionField schema={multiselectSchema} value={["shadcn", "mui"]} onChange={onChange} />
      );

      fireEvent.click(screen.getByText("MUI"));

      expect(onChange).toHaveBeenCalledWith("libraries", ["shadcn"]);
    });

    it("does not change when disabled", () => {
      const onChange = vi.fn();
      render(
        <OptionField
          schema={multiselectSchema}
          value={["shadcn"]}
          onChange={onChange}
          disabled
        />
      );

      fireEvent.click(screen.getByText("MUI"));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Array Field Tests
  // =========================================================================

  describe("ArrayField", () => {
    const arraySchema: OptionFieldSchema = {
      key: "ignoredProps",
      label: "Ignored Props",
      type: "array",
      defaultValue: ["className", "style"],
      placeholder: "prop1, prop2, prop3",
      description: "Comma-separated list of props to ignore",
    };

    it("renders array as comma-separated text", () => {
      const onChange = vi.fn();
      render(
        <OptionField
          schema={arraySchema}
          value={["className", "style", "children"]}
          onChange={onChange}
        />
      );

      const input = screen.getByPlaceholderText("prop1, prop2, prop3") as HTMLInputElement;
      expect(input.value).toBe("className, style, children");
    });

    it("parses comma-separated input into array", () => {
      const onChange = vi.fn();
      render(<OptionField schema={arraySchema} value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText("prop1, prop2, prop3");
      fireEvent.change(input, { target: { value: "a, b, c" } });

      expect(onChange).toHaveBeenCalledWith("ignoredProps", ["a", "b", "c"]);
    });

    it("trims whitespace from values", () => {
      const onChange = vi.fn();
      render(<OptionField schema={arraySchema} value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText("prop1, prop2, prop3");
      fireEvent.change(input, { target: { value: "  a  ,  b  ,  c  " } });

      expect(onChange).toHaveBeenCalledWith("ignoredProps", ["a", "b", "c"]);
    });

    it("filters empty strings from result", () => {
      const onChange = vi.fn();
      render(<OptionField schema={arraySchema} value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText("prop1, prop2, prop3");
      fireEvent.change(input, { target: { value: "a, , b, , c" } });

      expect(onChange).toHaveBeenCalledWith("ignoredProps", ["a", "b", "c"]);
    });
  });

  // =========================================================================
  // General Tests
  // =========================================================================

  describe("General", () => {
    it("applies custom className", () => {
      const schema: OptionFieldSchema = {
        key: "test",
        label: "Test",
        type: "text",
        defaultValue: "",
      };
      const onChange = vi.fn();

      const { container } = render(
        <OptionField schema={schema} value="" onChange={onChange} className="custom-class" />
      );

      const firstChild = container.firstChild as HTMLElement;
      expect(firstChild.className).toContain("custom-class");
    });

    it("renders without description when not provided", () => {
      const schema: OptionFieldSchema = {
        key: "test",
        label: "Test",
        type: "text",
        defaultValue: "",
      };
      const onChange = vi.fn();

      const { container } = render(
        <OptionField schema={schema} value="" onChange={onChange} />
      );

      // Should only have label and input, no description paragraph
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(0);
    });

    it("falls back to text input for unknown type", () => {
      const schema: OptionFieldSchema = {
        key: "test",
        label: "Test",
        type: "unknown" as "text", // Force unknown type
        defaultValue: "",
      };
      const onChange = vi.fn();

      render(<OptionField schema={schema} value="" onChange={onChange} />);

      // Should render a text input as fallback
      const input = screen.getByRole("textbox");
      expect(input).toBeTruthy();
    });
  });
});
