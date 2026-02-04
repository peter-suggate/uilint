/**
 * Tests for ExpandableContainer component
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ExpandableContainer } from "./ExpandableContainer";
import type { HierarchyNode } from "./types";

const mockNode: HierarchyNode<{ value: number }> = {
  id: "root",
  label: "Root Node",
  count: 10,
  data: { value: 42 },
  children: [
    { id: "child-1", label: "Child 1", count: 5, data: { value: 1 }, children: [] },
  ],
};

describe("ExpandableContainer", () => {
  it("renders collapsed state", () => {
    const { container } = render(
      <ExpandableContainer
        node={mockNode}
        isExpanded={false}
        siblings={[]}
        onExpand={() => {}}
        onCollapse={() => {}}
        onChildClick={() => {}}
        onSiblingClick={() => {}}
        renderTile={(node) => <div data-testid="tile">{node.label}</div>}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("renders expanded state", () => {
    const { container } = render(
      <ExpandableContainer
        node={mockNode}
        isExpanded={true}
        siblings={[]}
        onExpand={() => {}}
        onCollapse={() => {}}
        onChildClick={() => {}}
        onSiblingClick={() => {}}
        renderTile={(node) => <div>{node.label}</div>}
      />
    );

    // Should render something in expanded state
    expect(container.firstChild).toBeTruthy();
  });
});
