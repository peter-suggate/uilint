import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import {
  buildDependencyGraph,
  invalidateDependencyCache,
  clearDependencyCache,
  getDependencyCacheStats,
} from "./dependency-graph";

const FIXTURES_DIR = join(__dirname, "__fixtures__/dep-graph");

describe("buildDependencyGraph", () => {
  beforeEach(() => {
    clearDependencyCache();
  });

  describe("simple dependencies", () => {
    it("traces direct imports", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "simple/component.tsx"),
        FIXTURES_DIR
      );

      // component.tsx imports hook.ts and utils.ts
      expect(graph.allDependencies.size).toBeGreaterThanOrEqual(2);

      const depPaths = Array.from(graph.allDependencies);
      expect(depPaths.some((p) => p.includes("hook.ts"))).toBe(true);
      expect(depPaths.some((p) => p.includes("utils.ts"))).toBe(true);
    });

    it("traces transitive dependencies", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "simple/component.tsx"),
        FIXTURES_DIR
      );

      // component -> hook -> api (transitive)
      const depPaths = Array.from(graph.allDependencies);
      expect(depPaths.some((p) => p.includes("api.ts"))).toBe(true);
    });

    it("returns all dependencies in allDependencies set", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "simple/component.tsx"),
        FIXTURES_DIR
      );

      // Should have: hook.ts, utils.ts, api.ts (3 deps)
      expect(graph.allDependencies.size).toBe(3);
    });

    it("sets the root correctly", () => {
      const entryFile = join(FIXTURES_DIR, "simple/component.tsx");
      const graph = buildDependencyGraph(entryFile, FIXTURES_DIR);

      expect(graph.root).toBe(entryFile);
    });
  });

  describe("circular dependencies", () => {
    it("handles circular imports without infinite loop", () => {
      // This should not hang or throw
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "circular/a.ts"),
        FIXTURES_DIR
      );

      // Should have b.ts as dependency
      const depPaths = Array.from(graph.allDependencies);
      expect(depPaths.some((p) => p.includes("b.ts"))).toBe(true);

      // a.ts imports b.ts, and b.ts imports a.ts (circular)
      // Since a.ts is the root (marked visited first), when b.ts tries to import a.ts,
      // a.ts is already visited and won't be added as a dependency
      // So only b.ts is in the dependencies
      expect(graph.allDependencies.size).toBe(1);
    });

    it("handles circular starting from other file", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "circular/b.ts"),
        FIXTURES_DIR
      );

      const depPaths = Array.from(graph.allDependencies);
      expect(depPaths.some((p) => p.includes("a.ts"))).toBe(true);
      // Similarly, when starting from b.ts, only a.ts is added as dependency
      expect(graph.allDependencies.size).toBe(1);
    });
  });

  describe("external dependencies", () => {
    it("excludes node_modules imports", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "external/component.tsx"),
        FIXTURES_DIR
      );

      // Should not include 'react' or any node_modules
      for (const dep of graph.allDependencies) {
        expect(dep).not.toContain("node_modules");
        expect(dep).not.toContain("react");
      }
    });

    it("includes local imports alongside external", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "external/component.tsx"),
        FIXTURES_DIR
      );

      // Should include local.ts
      const depPaths = Array.from(graph.allDependencies);
      expect(depPaths.some((p) => p.includes("local.ts"))).toBe(true);
    });

    it("does not include lodash from local.ts", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "external/component.tsx"),
        FIXTURES_DIR
      );

      // lodash should be excluded
      for (const dep of graph.allDependencies) {
        expect(dep).not.toContain("lodash");
      }
    });
  });

  describe("re-exports", () => {
    it("follows re-exports through index file", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "re-exports/consumer.tsx"),
        FIXTURES_DIR
      );

      const depPaths = Array.from(graph.allDependencies);

      // consumer -> index (direct)
      expect(depPaths.some((p) => p.includes("index.ts"))).toBe(true);

      // index -> button (transitive via re-export)
      expect(depPaths.some((p) => p.includes("button.tsx"))).toBe(true);
    });
  });

  describe("caching", () => {
    it("caches results for repeated calls", () => {
      const file = join(FIXTURES_DIR, "simple/component.tsx");

      const graph1 = buildDependencyGraph(file, FIXTURES_DIR);
      const graph2 = buildDependencyGraph(file, FIXTURES_DIR);

      // Same reference = cached
      expect(graph1).toBe(graph2);
    });

    it("returns same content for cached results", () => {
      const file = join(FIXTURES_DIR, "simple/component.tsx");

      const graph1 = buildDependencyGraph(file, FIXTURES_DIR);
      const graph2 = buildDependencyGraph(file, FIXTURES_DIR);

      expect(graph1.allDependencies.size).toBe(graph2.allDependencies.size);
      expect(graph1.root).toBe(graph2.root);
    });

    it("invalidates cache when requested", () => {
      const file = join(FIXTURES_DIR, "simple/component.tsx");

      const graph1 = buildDependencyGraph(file, FIXTURES_DIR);
      invalidateDependencyCache(file);
      const graph2 = buildDependencyGraph(file, FIXTURES_DIR);

      // Different reference after invalidation
      expect(graph1).not.toBe(graph2);
    });

    it("clears all cache when requested", () => {
      const file1 = join(FIXTURES_DIR, "simple/component.tsx");
      const file2 = join(FIXTURES_DIR, "circular/a.ts");

      buildDependencyGraph(file1, FIXTURES_DIR);
      buildDependencyGraph(file2, FIXTURES_DIR);

      expect(getDependencyCacheStats().size).toBe(2);

      clearDependencyCache();

      expect(getDependencyCacheStats().size).toBe(0);
    });

    it("invalidates dependent graphs when a dependency changes", () => {
      const componentFile = join(FIXTURES_DIR, "simple/component.tsx");
      const hookFile = join(FIXTURES_DIR, "simple/hook.ts");

      // Build graph for component (which depends on hook)
      const graph1 = buildDependencyGraph(componentFile, FIXTURES_DIR);

      // Invalidate hook file (simulating a change)
      invalidateDependencyCache(hookFile);

      // Component graph should be invalidated too
      const graph2 = buildDependencyGraph(componentFile, FIXTURES_DIR);
      expect(graph1).not.toBe(graph2);
    });
  });

  describe("edge cases", () => {
    it("handles non-existent files gracefully", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "does-not-exist.tsx"),
        FIXTURES_DIR
      );

      // Should return empty dependencies, not throw
      expect(graph.allDependencies.size).toBe(0);
    });

    it("handles files with no imports", () => {
      const graph = buildDependencyGraph(
        join(FIXTURES_DIR, "simple/utils.ts"),
        FIXTURES_DIR
      );

      // utils.ts has no imports
      expect(graph.allDependencies.size).toBe(0);
    });
  });
});

describe("getDependencyCacheStats", () => {
  beforeEach(() => {
    clearDependencyCache();
  });

  it("returns empty stats initially", () => {
    const stats = getDependencyCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.entries).toHaveLength(0);
  });

  it("returns correct stats after building graphs", () => {
    const file1 = join(FIXTURES_DIR, "simple/component.tsx");
    const file2 = join(FIXTURES_DIR, "circular/a.ts");

    buildDependencyGraph(file1, FIXTURES_DIR);
    buildDependencyGraph(file2, FIXTURES_DIR);

    const stats = getDependencyCacheStats();
    expect(stats.size).toBe(2);
    expect(stats.entries).toContain(file1);
    expect(stats.entries).toContain(file2);
  });
});
