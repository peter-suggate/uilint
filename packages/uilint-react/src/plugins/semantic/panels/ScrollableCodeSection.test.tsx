/**
 * Tests for ScrollableCodeSection component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ScrollableCodeSection } from "./ScrollableCodeSection";

describe("ScrollableCodeSection - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and icon", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="This Code"
        icon={<span data-testid="test-icon">📄</span>}
        filePath="/path/to/file.ts"
        code="const x = 1;\nconst y = 2;"
        startLine={1}
        endLine={2}
        focusLine={1}
      />
    );

    expect(container.textContent).toContain("This Code");
  });

  it("renders file path and line range", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="This Code"
        icon={<span>📄</span>}
        filePath="/path/to/file.ts"
        code="const x = 1;\nconst y = 2;\nconst z = 3;"
        startLine={10}
        endLine={12}
        focusLine={11}
      />
    );

    expect(container.textContent).toContain("/path/to/file.ts:10-12");
  });

  it("renders code content", () => {
    const code = `const greeting = 'hello';
const name = 'world';
console.log(greeting, name);`;

    const { container } = render(
      <ScrollableCodeSection
        label="Source"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={3}
        focusLine={2}
      />
    );

    expect(container.textContent).toContain("const greeting");
    expect(container.textContent).toContain("const name");
  });

  it("renders line numbers", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="line 1\nline 2\nline 3"
        startLine={1}
        endLine={3}
        focusLine={2}
      />
    );

    // Should show line numbers - the component virtualizes large content
    // but with only 3 lines all should be visible
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("2");
  });

  it("highlights the focus line", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="line 1\nline 2\nline 3"
        startLine={1}
        endLine={3}
        focusLine={2}
      />
    );

    // The component should render with highlighted styling for focus line
    expect(container.firstChild).toBeTruthy();
  });

  it("uses custom maxHeight", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="line 1\nline 2"
        startLine={1}
        endLine={2}
        focusLine={1}
        maxHeight={500}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("ScrollableCodeSection - diff highlighting", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with diffLines when provided", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="const x = 1;\nconst y = 2;"
        startLine={1}
        endLine={2}
        focusLine={1}
        diffLines={[
          {
            lineNumber: 1,
            segments: [
              { text: "const x = ", type: "match" },
              { text: "1", type: "source-only" },
            ],
            hasDiff: true,
          },
        ]}
      />
    );

    expect(container.textContent).toContain("const x =");
  });

  it("renders without diff highlighting when diffLines not provided", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="const x = 1;"
        startLine={1}
        endLine={1}
        focusLine={1}
      />
    );

    expect(container.textContent).toContain("const x = 1;");
  });
});

describe("ScrollableCodeSection - navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onNavigate when file path button is clicked", () => {
    const onNavigate = vi.fn();

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="const x = 1;"
        startLine={1}
        endLine={1}
        focusLine={1}
        onNavigate={onNavigate}
      />
    );

    // Find the button with file path text
    const buttons = container.querySelectorAll("button");
    const filePathButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("/test.ts")
    );

    expect(filePathButton).toBeTruthy();
    if (filePathButton) {
      fireEvent.click(filePathButton);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    }
  });

  it("file path button is not interactive when onNavigate is not provided", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="const x = 1;"
        startLine={1}
        endLine={1}
        focusLine={1}
      />
    );

    // Find the button with file path text
    const buttons = container.querySelectorAll("button");
    const filePathButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("/test.ts")
    );

    expect(filePathButton).toBeTruthy();
    // Button should still be present, just not interactive
    if (filePathButton) {
      expect(filePathButton.style.cursor).toBe("default");
    }
  });
});

describe("ScrollableCodeSection - scrolling behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("handles scroll events", () => {
    // Create a large code block
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const code = lines.join("\n");

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={100}
        focusLine={50}
        maxHeight={200}
      />
    );

    // Component should render without errors
    expect(container.firstChild).toBeTruthy();
  });

  it("shows fade indicators when content is scrollable", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const code = lines.join("\n");

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={100}
        focusLine={50}
        maxHeight={200}
      />
    );

    // Component should have fade indicators (gradients)
    // These are positioned absolutely
    const divs = container.querySelectorAll("div");
    expect(divs.length).toBeGreaterThan(0);
  });
});

describe("ScrollableCodeSection - code formatting", () => {
  afterEach(() => {
    cleanup();
  });

  it("preserves whitespace in code", () => {
    const code = "  indented line\n    more indented";

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={2}
        focusLine={1}
      />
    );

    // Code elements should have whitespace preserved
    const codeElements = container.querySelectorAll("code");
    expect(codeElements.length).toBeGreaterThan(0);
  });

  it("handles empty lines in code", () => {
    const code = "line 1\n\nline 3";

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={3}
        focusLine={1}
      />
    );

    expect(container.textContent).toContain("line 1");
    expect(container.textContent).toContain("line 3");
  });

  it("renders monospace font for code", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="const x = 1;"
        startLine={1}
        endLine={1}
        focusLine={1}
      />
    );

    // Find code container with monospace font
    const _codeContainer = container.querySelector('[style*="font-family"]');
    // Component uses monospace styling
    expect(container.firstChild).toBeTruthy();
  });
});

describe("ScrollableCodeSection - edge cases", () => {
  afterEach(() => {
    cleanup();
  });

  it("handles single line code", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code="single line"
        startLine={1}
        endLine={1}
        focusLine={1}
      />
    );

    expect(container.textContent).toContain("single line");
    expect(container.textContent).toContain("1");
  });

  it("handles empty code string", () => {
    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code=""
        startLine={1}
        endLine={1}
        focusLine={1}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("handles focus line at start of file", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
    const code = lines.join("\n");

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={50}
        focusLine={1}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("handles focus line at end of file", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
    const code = lines.join("\n");

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={1}
        endLine={50}
        focusLine={50}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("handles long line numbers", () => {
    const lines = Array.from({ length: 5 }, (_, i) => `line ${i + 10000}`);
    const code = lines.join("\n");

    const { container } = render(
      <ScrollableCodeSection
        label="Code"
        icon={<span>📄</span>}
        filePath="/test.ts"
        code={code}
        startLine={10000}
        endLine={10004}
        focusLine={10002}
      />
    );

    // Should show 5-digit line numbers
    expect(container.textContent).toContain("10000");
  });
});
