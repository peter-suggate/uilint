/**
 * Tests for DuplicatesInspectorPanel component
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DuplicatesInspectorPanel, getDuplicatesPanelTitle } from "./DuplicatesInspectorPanel";

// Mock the hooks and store
vi.mock("../../../core/store", () => ({
  useComposedStore: () => ({
    setHeatmapFilter: vi.fn(),
    clearHeatmapFilter: vi.fn(),
    heatmapFilter: { mode: null, highlightedLocs: [] },
  }),
}));

vi.mock("../../../ui/hooks/useSourceCode", () => ({
  useSourceCode: () => ({
    sourceCode: null,
    context: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./useDiffHighlights", () => ({
  useDiffHighlights: () => ({
    sourceLines: [],
    targetLines: [],
    computed: false,
  }),
}));

describe("DuplicatesInspectorPanel", () => {
  it("renders without crashing when no data", () => {
    const { container } = render(
      <DuplicatesInspectorPanel data={undefined} />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("renders with issue data", () => {
    const mockData = {
      issue: {
        id: "dup-1",
        ruleId: "uilint/no-semantic-duplicates",
        message: "This component 'Button' is 85% similar to 'OtherButton' at path/file.tsx:42. Consider consolidating.",
        severity: "warning",
        line: 10,
        column: 1,
        dataLoc: "Component.tsx:10:1",
        filePath: "src/Component.tsx",
      },
    };

    const { container } = render(
      <DuplicatesInspectorPanel data={mockData} />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("getDuplicatesPanelTitle", () => {
  it("returns expected title", () => {
    const title = getDuplicatesPanelTitle();
    expect(title).toBe("Duplicate Code");
  });
});
