/**
 * Tests for treemap inspector standalone store
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useTreemapStore } from "./treemap-inspector-store";

describe("TreemapInspectorStore", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useTreemapStore.setState({
      containerWidth: 0,
      containerHeight: 400,
      isTransitioning: false,
      transitionDirection: null,
      previousZoomedRuleId: null,
      fileItemsByRule: new Map(),
    });
  });

  // ==========================================================================
  // Container dimensions
  // ==========================================================================

  describe("container dimensions", () => {
    it("has default dimensions", () => {
      const state = useTreemapStore.getState();
      expect(state.containerWidth).toBe(0);
      expect(state.containerHeight).toBe(400);
    });

    it("updates container size", () => {
      useTreemapStore.getState().setContainerSize(800, 600);
      const state = useTreemapStore.getState();
      expect(state.containerWidth).toBe(800);
      expect(state.containerHeight).toBe(600);
    });
  });

  // ==========================================================================
  // Animation state
  // ==========================================================================

  describe("animation state", () => {
    it("starts with no transition", () => {
      const state = useTreemapStore.getState();
      expect(state.isTransitioning).toBe(false);
      expect(state.transitionDirection).toBeNull();
      expect(state.previousZoomedRuleId).toBeNull();
    });

    it("starts a zoom-in transition", () => {
      useTreemapStore.getState().startTransition("zoom-in");
      const state = useTreemapStore.getState();
      expect(state.isTransitioning).toBe(true);
      expect(state.transitionDirection).toBe("zoom-in");
      expect(state.previousZoomedRuleId).toBeNull();
    });

    it("starts a zoom-out transition with previous rule ID", () => {
      useTreemapStore.getState().startTransition("zoom-out", "rule-a");
      const state = useTreemapStore.getState();
      expect(state.isTransitioning).toBe(true);
      expect(state.transitionDirection).toBe("zoom-out");
      expect(state.previousZoomedRuleId).toBe("rule-a");
    });

    it("ends a transition and clears all animation state", () => {
      useTreemapStore.getState().startTransition("zoom-in");
      useTreemapStore.getState().endTransition();
      const state = useTreemapStore.getState();
      expect(state.isTransitioning).toBe(false);
      expect(state.transitionDirection).toBeNull();
      expect(state.previousZoomedRuleId).toBeNull();
    });

    it("clears previousZoomedRuleId on endTransition", () => {
      useTreemapStore.getState().startTransition("zoom-out", "rule-b");
      expect(useTreemapStore.getState().previousZoomedRuleId).toBe("rule-b");
      useTreemapStore.getState().endTransition();
      expect(useTreemapStore.getState().previousZoomedRuleId).toBeNull();
    });
  });

  // ==========================================================================
  // File items for ghost cells
  // ==========================================================================

  describe("fileItemsByRule", () => {
    it("starts with empty map", () => {
      const state = useTreemapStore.getState();
      expect(state.fileItemsByRule.size).toBe(0);
    });

    it("sets file items map", () => {
      const map = new Map([
        ["rule-a", [{ id: "file-1", label: "file1.ts", count: 5 }]],
        ["rule-b", [{ id: "file-2", label: "file2.ts", count: 3 }]],
      ]);
      useTreemapStore.getState().setFileItemsByRule(map);
      const state = useTreemapStore.getState();
      expect(state.fileItemsByRule.size).toBe(2);
      expect(state.fileItemsByRule.get("rule-a")).toHaveLength(1);
      expect(state.fileItemsByRule.get("rule-b")?.[0].label).toBe("file2.ts");
    });

    it("replaces existing map", () => {
      const map1 = new Map([["rule-a", [{ id: "f1", label: "a", count: 1 }]]]);
      const map2 = new Map([["rule-b", [{ id: "f2", label: "b", count: 2 }]]]);
      useTreemapStore.getState().setFileItemsByRule(map1);
      expect(useTreemapStore.getState().fileItemsByRule.has("rule-a")).toBe(true);
      useTreemapStore.getState().setFileItemsByRule(map2);
      expect(useTreemapStore.getState().fileItemsByRule.has("rule-a")).toBe(false);
      expect(useTreemapStore.getState().fileItemsByRule.has("rule-b")).toBe(true);
    });
  });
});
