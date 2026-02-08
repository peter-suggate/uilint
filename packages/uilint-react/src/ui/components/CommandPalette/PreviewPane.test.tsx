/**
 * Tests for PreviewPane
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { createElement } from "react";
import { render, cleanup } from "@testing-library/react";
import { PreviewPane } from "./PreviewPane";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { SearchItem } from "../../../core/plugin-system/types";

// Mock the plugin registry
vi.mock("../../../core/plugin-system/registry", () => ({
  pluginRegistry: {
    getPreviewPanel: vi.fn(),
  },
}));

function makeSearchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return {
    id: "rule:test/rule",
    section: "rules",
    label: "Test Rule",
    searchFields: { label: "Test Rule" },
    ...overrides,
  };
}

describe("PreviewPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when no item selected", () => {
    const { getByText } = render(
      <PreviewPane selectedItem={null} isFocused={false} />
    );

    expect(getByText("Select an item to preview")).toBeTruthy();
  });

  it("renders plugin preview element when item is selected", () => {
    const item = makeSearchItem();
    vi.mocked(pluginRegistry.getPreviewPanel).mockReturnValue({
      element: createElement("div", { "data-testid": "preview-content" }, "Rule preview content"),
    });

    const { getByTestId } = render(
      <PreviewPane selectedItem={item} isFocused={false} />
    );

    expect(getByTestId("preview-content").textContent).toBe("Rule preview content");
  });

  it("shows empty state when plugin returns null preview", () => {
    const item = makeSearchItem();
    vi.mocked(pluginRegistry.getPreviewPanel).mockReturnValue(null);

    const { getByText } = render(
      <PreviewPane selectedItem={item} isFocused={false} />
    );

    expect(getByText("Select an item to preview")).toBeTruthy();
  });

  it("calls getPreviewPanel with the selected item", () => {
    const item = makeSearchItem({ id: "file:src/App.tsx" });
    vi.mocked(pluginRegistry.getPreviewPanel).mockReturnValue(null);

    render(
      <PreviewPane selectedItem={item} isFocused={false} />
    );

    expect(pluginRegistry.getPreviewPanel).toHaveBeenCalledWith(item);
  });
});
