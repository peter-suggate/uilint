/**
 * Tests for HierarchyProvider and useHierarchy hook
 *
 * Covers:
 * - Uncontrolled mode: expand, collapse, collapseToLevel, collapseAll
 * - Controlled mode: delegates to callbacks
 * - useHierarchy throws when used outside provider
 * - MAX_EXPANSION_DEPTH behavior
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { HierarchyProvider, useHierarchy } from "./HierarchyProvider";
import type { HierarchyNode } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

type TestData = { value: string };

function makeNode(
  id: string,
  label?: string,
  children?: HierarchyNode<TestData>[]
): HierarchyNode<TestData> {
  return {
    id,
    label: label ?? id,
    data: { value: id },
    children,
  };
}

/**
 * Wrapper factory for renderHook that provides HierarchyProvider in
 * uncontrolled mode.
 */
function uncontrolledWrapper({ children }: { children: React.ReactNode }) {
  return <HierarchyProvider>{children}</HierarchyProvider>;
}

afterEach(() => {
  cleanup();
});

// ============================================================================
// useHierarchy outside provider
// ============================================================================

describe("useHierarchy outside provider", () => {
  it("throws an error when used without HierarchyProvider", () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useHierarchy<TestData>());
    }).toThrow(
      "useHierarchy must be used within a HierarchyProvider"
    );

    spy.mockRestore();
  });
});

// ============================================================================
// Uncontrolled Mode
// ============================================================================

describe("HierarchyProvider - uncontrolled mode", () => {
  it("starts with empty expansion path", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.currentLevel).toBe(0);
    expect(result.current.expandedNodeId).toBeNull();
  });

  it("expand adds a node to the expansion path", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const node = makeNode("node-1", "Node 1");

    act(() => {
      result.current.expand(node);
    });

    expect(result.current.expansionPath).toHaveLength(1);
    expect(result.current.expansionPath[0].id).toBe("node-1");
    expect(result.current.currentLevel).toBe(1);
    expect(result.current.expandedNodeId).toBe("node-1");
  });

  it("expand adds a second level of depth", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const node1 = makeNode("node-1");
    const node2 = makeNode("node-2");

    act(() => {
      result.current.expand(node1);
    });
    act(() => {
      result.current.expand(node2);
    });

    expect(result.current.expansionPath).toHaveLength(2);
    expect(result.current.currentLevel).toBe(2);
    expect(result.current.expandedNodeId).toBe("node-2");
  });

  it("expand at max depth replaces the last node instead of adding", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const node1 = makeNode("node-1");
    const node2 = makeNode("node-2");
    const node3 = makeNode("node-3");

    // Expand to depth 2 (MAX_EXPANSION_DEPTH)
    act(() => {
      result.current.expand(node1);
    });
    act(() => {
      result.current.expand(node2);
    });

    expect(result.current.expansionPath).toHaveLength(2);

    // Expanding again at max depth should replace node-2 with node-3
    act(() => {
      result.current.expand(node3);
    });

    expect(result.current.expansionPath).toHaveLength(2);
    expect(result.current.expansionPath[0].id).toBe("node-1");
    expect(result.current.expansionPath[1].id).toBe("node-3");
    expect(result.current.expandedNodeId).toBe("node-3");
  });

  it("collapse removes the last node from the expansion path", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const node1 = makeNode("node-1");
    const node2 = makeNode("node-2");

    act(() => {
      result.current.expand(node1);
    });
    act(() => {
      result.current.expand(node2);
    });

    expect(result.current.currentLevel).toBe(2);

    act(() => {
      result.current.collapse();
    });

    expect(result.current.expansionPath).toHaveLength(1);
    expect(result.current.expandedNodeId).toBe("node-1");
    expect(result.current.currentLevel).toBe(1);
  });

  it("collapse from single expansion returns to empty", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    act(() => {
      result.current.expand(makeNode("node-1"));
    });

    expect(result.current.currentLevel).toBe(1);

    act(() => {
      result.current.collapse();
    });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.expandedNodeId).toBeNull();
    expect(result.current.currentLevel).toBe(0);
  });

  it("collapse on empty path results in empty path", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    act(() => {
      result.current.collapse();
    });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.currentLevel).toBe(0);
  });
});

// ============================================================================
// collapseAll and collapseToLevel
// ============================================================================

describe("HierarchyProvider - collapseAll and collapseToLevel", () => {
  it("collapseAll resets expansion path to empty", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    act(() => {
      result.current.expand(makeNode("a"));
    });
    act(() => {
      result.current.expand(makeNode("b"));
    });

    expect(result.current.currentLevel).toBe(2);

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.currentLevel).toBe(0);
    expect(result.current.expandedNodeId).toBeNull();
  });

  it("collapseToLevel(1) keeps only the first expanded node", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const nodeA = makeNode("a");
    const nodeB = makeNode("b");

    act(() => {
      result.current.expand(nodeA);
    });
    act(() => {
      result.current.expand(nodeB);
    });

    expect(result.current.currentLevel).toBe(2);

    act(() => {
      result.current.collapseToLevel(1);
    });

    expect(result.current.expansionPath).toHaveLength(1);
    expect(result.current.expandedNodeId).toBe("a");
    expect(result.current.currentLevel).toBe(1);
  });

  it("collapseToLevel(0) is equivalent to collapseAll", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    act(() => {
      result.current.expand(makeNode("x"));
    });

    act(() => {
      result.current.collapseToLevel(0);
    });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.currentLevel).toBe(0);
  });

  it("collapseToLevel with level >= current depth is a no-op", () => {
    const { result } = renderHook(() => useHierarchy<TestData>(), {
      wrapper: uncontrolledWrapper,
    });

    const nodeA = makeNode("a");

    act(() => {
      result.current.expand(nodeA);
    });

    act(() => {
      result.current.collapseToLevel(5);
    });

    // Should remain unchanged since slicing beyond array length is safe
    expect(result.current.expansionPath).toHaveLength(1);
    expect(result.current.expandedNodeId).toBe("a");
  });
});

// ============================================================================
// Controlled Mode
// ============================================================================

describe("HierarchyProvider - controlled mode", () => {
  it("uses the provided expansionPath", () => {
    const path = [makeNode("ctrl-1")];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData> expansionPath={path}>
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    expect(result.current.expansionPath).toHaveLength(1);
    expect(result.current.expandedNodeId).toBe("ctrl-1");
    expect(result.current.currentLevel).toBe(1);
  });

  it("calls onExpand callback when expand is invoked", () => {
    const onExpand = vi.fn();
    const path: HierarchyNode<TestData>[] = [];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData>
        expansionPath={path}
        onExpand={onExpand}
      >
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });
    const node = makeNode("new-node");

    act(() => {
      result.current.expand(node);
    });

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand).toHaveBeenCalledWith(node);
  });

  it("calls onCollapse callback when collapse is invoked", () => {
    const onCollapse = vi.fn();
    const path = [makeNode("ctrl-1")];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData>
        expansionPath={path}
        onCollapse={onCollapse}
      >
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    act(() => {
      result.current.collapse();
    });

    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("calls onCollapseToLevel when collapseToLevel is invoked", () => {
    const onCollapseToLevel = vi.fn();
    const path = [makeNode("ctrl-1"), makeNode("ctrl-2")];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData>
        expansionPath={path}
        onCollapseToLevel={onCollapseToLevel}
      >
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    act(() => {
      result.current.collapseToLevel(1);
    });

    expect(onCollapseToLevel).toHaveBeenCalledTimes(1);
    expect(onCollapseToLevel).toHaveBeenCalledWith(1);
  });

  it("falls back to onCollapse when onCollapseToLevel is not provided", () => {
    const onCollapse = vi.fn();
    const path = [makeNode("ctrl-1"), makeNode("ctrl-2")];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData>
        expansionPath={path}
        onCollapse={onCollapse}
      >
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    act(() => {
      result.current.collapseToLevel(1);
    });

    // Falls back to calling onCollapse once
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("collapseAll in controlled mode calls onCollapseToLevel(0)", () => {
    const onCollapseToLevel = vi.fn();
    const path = [makeNode("ctrl-1")];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData>
        expansionPath={path}
        onCollapseToLevel={onCollapseToLevel}
      >
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    act(() => {
      result.current.collapseAll();
    });

    expect(onCollapseToLevel).toHaveBeenCalledWith(0);
  });

  it("reports empty expansion path and null expandedNodeId when controlled path is empty", () => {
    const path: HierarchyNode<TestData>[] = [];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <HierarchyProvider<TestData> expansionPath={path}>
        {children}
      </HierarchyProvider>
    );

    const { result } = renderHook(() => useHierarchy<TestData>(), { wrapper });

    expect(result.current.expansionPath).toEqual([]);
    expect(result.current.expandedNodeId).toBeNull();
    expect(result.current.currentLevel).toBe(0);
  });
});
