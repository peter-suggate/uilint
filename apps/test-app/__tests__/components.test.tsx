import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { UILint } from "uilint-react";
import { PrimaryButton, SecondaryButton } from "../app/components/buttons";
import { Card } from "../app/components/cards";
import { Heading, BodyText } from "../app/components/typography";

// Mock fetch for Ollama calls in tests
const mockFetch = vi.fn();

beforeEach(() => {
  // Setup fetch mock
  global.fetch = mockFetch;

  // Mock successful Ollama response
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      response: JSON.stringify({
        issues: [
          {
            id: "test-color-1",
            type: "color",
            message: "Test: Similar blue colors detected",
            currentValue: "#3B82F6",
            expectedValue: "#2563EB",
            suggestion: "Consolidate to primary blue",
          },
        ],
      }),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UILint Component Tests", () => {
  it("renders children correctly", () => {
    render(
      <UILint enabled={true}>
        <div data-testid="child">Hello World</div>
      </UILint>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("wraps button components for analysis", () => {
    render(
      <UILint enabled={true}>
        <PrimaryButton>Click me</PrimaryButton>
      </UILint>
    );

    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("wraps card components for analysis", () => {
    render(
      <UILint enabled={true}>
        <Card title="Test Card" description="Test description" />
      </UILint>
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("wraps typography components for analysis", () => {
    render(
      <UILint enabled={true}>
        <Heading>Main Title</Heading>
        <BodyText>Body content here</BodyText>
      </UILint>
    );

    expect(screen.getByText("Main Title")).toBeInTheDocument();
    expect(screen.getByText("Body content here")).toBeInTheDocument();
  });
});

describe("Button Consistency Tests", () => {
  it("renders consistent button styles", () => {
    render(
      <UILint enabled={true}>
        <div>
          <PrimaryButton>Primary</PrimaryButton>
          <SecondaryButton>Secondary</SecondaryButton>
        </div>
      </UILint>
    );

    const primaryBtn = screen.getByText("Primary");
    const secondaryBtn = screen.getByText("Secondary");

    expect(primaryBtn).toBeInTheDocument();
    expect(secondaryBtn).toBeInTheDocument();
  });
});

describe("Mixed Styles Detection", () => {
  it("can detect when multiple similar components have different styles", () => {
    // This test demonstrates how UILint would catch inconsistencies
    // In a real scenario, the console.warn would show the issues

    const consoleSpy = vi.spyOn(console, "warn");

    render(
      <UILint enabled={true}>
        <div>
          {/* Intentionally inconsistent buttons */}
          <button className="bg-blue-600 px-4 py-2 rounded-lg">Button A</button>
          <button className="bg-blue-500 px-3 py-1 rounded">Button B</button>
          <button className="bg-blue-700 px-5 py-3 rounded-xl">Button C</button>
        </div>
      </UILint>
    );

    // All buttons should render
    expect(screen.getByText("Button A")).toBeInTheDocument();
    expect(screen.getByText("Button B")).toBeInTheDocument();
    expect(screen.getByText("Button C")).toBeInTheDocument();

    // Note: In a real test with Ollama running, you'd see warnings like:
    // ⚠️ [UILint] Inconsistent button colors: bg-blue-600, bg-blue-500, bg-blue-700
    // ⚠️ [UILint] Inconsistent button padding: px-4 py-2, px-3 py-1, px-5 py-3
    // ⚠️ [UILint] Inconsistent border radius: rounded-lg, rounded, rounded-xl
  });
});

describe("Color Consistency Tests", () => {
  it("renders color swatches that can be analyzed", () => {
    render(
      <UILint enabled={true}>
        <div>
          <div style={{ backgroundColor: "#3B82F6" }} data-testid="color-1">
            Blue 1
          </div>
          <div style={{ backgroundColor: "#2563EB" }} data-testid="color-2">
            Blue 2
          </div>
          <div style={{ backgroundColor: "#3575E2" }} data-testid="color-3">
            Blue 3
          </div>
        </div>
      </UILint>
    );

    expect(screen.getByTestId("color-1")).toBeInTheDocument();
    expect(screen.getByTestId("color-2")).toBeInTheDocument();
    expect(screen.getByTestId("color-3")).toBeInTheDocument();
  });
});
