/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { DiffCodeViewer } from "./DiffCodeViewer";
import type { DiffLine } from "./diff-utils";

afterEach(cleanup);

const sampleLines: DiffLine[] = [
  { type: "common", content: "const a = 1;", lineNumber: 1 },
  { type: "removed", content: "const b = 2;", lineNumber: 2 },
  { type: "common", content: "return a;", lineNumber: 3 },
];

describe("DiffCodeViewer", () => {
  it("renders all lines with correct content", () => {
    render(<DiffCodeViewer lines={sampleLines} label="Test Code" />);

    expect(screen.getByText("const a = 1;")).toBeTruthy();
    expect(screen.getByText("const b = 2;")).toBeTruthy();
    expect(screen.getByText("return a;")).toBeTruthy();
  });

  it("renders the label in the header", () => {
    render(<DiffCodeViewer lines={sampleLines} label="Source Code" />);

    expect(screen.getByText("Source Code")).toBeTruthy();
  });

  it("renders line numbers", () => {
    render(<DiffCodeViewer lines={sampleLines} label="Test" />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders empty state gracefully", () => {
    const { container } = render(
      <DiffCodeViewer lines={[]} label="Empty" />
    );
    expect(container.querySelector(".overflow-auto")).toBeTruthy();
  });
});
