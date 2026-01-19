import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import {
  aggregateCoverage,
  type IstanbulCoverage,
} from "./coverage-aggregator";
import { clearDependencyCache } from "./dependency-graph";

const FIXTURES_DIR = join(__dirname, "__fixtures__/coverage-aggregator");

// Create test fixtures
beforeAll(() => {
  mkdirSync(join(FIXTURES_DIR, "project/src"), { recursive: true });

  // Component file (core) - imports hook and utils
  writeFileSync(
    join(FIXTURES_DIR, "project/src/Component.tsx"),
    `
import { useData } from "./useData";
import { formatValue } from "./utils";

export function Component() {
  const data = useData();
  return <div>{formatValue(data)}</div>;
}
`
  );

  // Hook file (core) - imports api
  writeFileSync(
    join(FIXTURES_DIR, "project/src/useData.ts"),
    `
import { fetchData } from "./api";

export function useData() {
  return fetchData();
}
`
  );

  // API file (core - via .api pattern or just function exports)
  writeFileSync(
    join(FIXTURES_DIR, "project/src/api.ts"),
    `
export function fetchData() {
  return { value: 42 };
}
`
  );

  // Utils file (utility)
  writeFileSync(
    join(FIXTURES_DIR, "project/src/utils.ts"),
    `
export function formatValue(data: any): string {
  return String(data.value);
}
`
  );

  // Config file (constant)
  writeFileSync(
    join(FIXTURES_DIR, "project/src/config.ts"),
    `
export const API_URL = "https://api.example.com";
export const TIMEOUT = 5000;
`
  );

  // Types file (type)
  writeFileSync(
    join(FIXTURES_DIR, "project/src/types.ts"),
    `
export type DataType = {
  value: number;
};

export interface Config {
  url: string;
}
`
  );

  // Standalone component (no dependencies)
  writeFileSync(
    join(FIXTURES_DIR, "project/src/Standalone.tsx"),
    `
export function Standalone() {
  return <div>Hello</div>;
}
`
  );

  // Component that imports types
  writeFileSync(
    join(FIXTURES_DIR, "project/src/TypedComponent.tsx"),
    `
import type { DataType } from "./types";

export function TypedComponent({ data }: { data: DataType }) {
  return <div>{data.value}</div>;
}
`
  );

  // Well-tested component
  writeFileSync(
    join(FIXTURES_DIR, "project/src/WellTested.tsx"),
    `
import { formatValue } from "./utils";

export function WellTested() {
  return <div>{formatValue({ value: 1 })}</div>;
}
`
  );
});

afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

// Mock coverage data
function createMockCoverage(): IstanbulCoverage {
  const projectRoot = join(FIXTURES_DIR, "project");

  return {
    // Component.tsx - 100% coverage (4/4 statements)
    [`${projectRoot}/src/Component.tsx`]: {
      path: `${projectRoot}/src/Component.tsx`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
        "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 20 } },
        "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 10, "1": 10, "2": 10, "3": 10 },
      f: {},
      b: {},
    },
    // useData.ts (hook) - 50% coverage (2/4 statements)
    [`${projectRoot}/src/useData.ts`]: {
      path: `${projectRoot}/src/useData.ts`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
        "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 20 } },
        "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 5, "1": 5, "2": 0, "3": 0 },
      f: {},
      b: {},
    },
    // api.ts - 0% coverage (0/4 statements)
    [`${projectRoot}/src/api.ts`]: {
      path: `${projectRoot}/src/api.ts`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
        "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 20 } },
        "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 0, "1": 0, "2": 0, "3": 0 },
      f: {},
      b: {},
    },
    // utils.ts - 100% coverage (2/2 statements)
    [`${projectRoot}/src/utils.ts`]: {
      path: `${projectRoot}/src/utils.ts`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 8, "1": 8 },
      f: {},
      b: {},
    },
    // config.ts - 0% coverage (2/2 statements)
    [`${projectRoot}/src/config.ts`]: {
      path: `${projectRoot}/src/config.ts`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 0, "1": 0 },
      f: {},
      b: {},
    },
    // types.ts - type file, no statements
    [`${projectRoot}/src/types.ts`]: {
      path: `${projectRoot}/src/types.ts`,
      statementMap: {},
      fnMap: {},
      branchMap: {},
      s: {},
      f: {},
      b: {},
    },
    // Standalone.tsx - 100% coverage (2/2 statements)
    [`${projectRoot}/src/Standalone.tsx`]: {
      path: `${projectRoot}/src/Standalone.tsx`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 5, "1": 5 },
      f: {},
      b: {},
    },
    // TypedComponent.tsx - 100% coverage (2/2 statements)
    [`${projectRoot}/src/TypedComponent.tsx`]: {
      path: `${projectRoot}/src/TypedComponent.tsx`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 3, "1": 3 },
      f: {},
      b: {},
    },
    // WellTested.tsx - 100% coverage
    [`${projectRoot}/src/WellTested.tsx`]: {
      path: `${projectRoot}/src/WellTested.tsx`,
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 10, "1": 10 },
      f: {},
      b: {},
    },
  };
}

describe("aggregateCoverage", () => {
  const projectRoot = join(FIXTURES_DIR, "project");

  beforeAll(() => {
    clearDependencyCache();
  });

  describe("weighted calculation", () => {
    it("weights core files at 1.0", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // Find the hook file in analyzed files
      const hookFile = result.filesAnalyzed.find((f) =>
        f.filePath.includes("useData.ts")
      );
      expect(hookFile).toBeDefined();
      expect(hookFile!.category).toBe("core");
      expect(hookFile!.weight).toBe(1.0);
    });

    it("weights utility files at 0.5", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      const utilFile = result.filesAnalyzed.find((f) =>
        f.filePath.includes("utils.ts")
      );
      expect(utilFile).toBeDefined();
      expect(utilFile!.category).toBe("utility");
      expect(utilFile!.weight).toBe(0.5);
    });

    it("calculates correct aggregate with mixed weights", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // Component.tsx: 4 stmts @ 100% = 4 covered, weight 1.0 -> 4 weighted covered / 4 weighted total
      // useData.ts: 4 stmts @ 50% = 2 covered, weight 1.0 -> 2 weighted covered / 4 weighted total
      // api.ts: 4 stmts @ 0% = 0 covered, weight 0.5 (utility) -> 0 weighted covered / 2 weighted total
      // utils.ts: 2 stmts @ 100% = 2 covered, weight 0.5 -> 1 weighted covered / 1 weighted total

      // Total weighted covered: 4 + 2 + 0 + 1 = 7
      // Total weighted statements: 4 + 4 + 2 + 1 = 11
      // Aggregate: 7/11 * 100 = 63.64%

      expect(result.aggregateCoverage).toBeGreaterThan(50);
      expect(result.aggregateCoverage).toBeLessThan(80);
    });

    it("excludes type files (weight 0)", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/TypedComponent.tsx"),
        projectRoot,
        coverage
      );

      // TypedComponent imports types.ts, but types.ts should be weighted at 0
      const typeFile = result.filesAnalyzed.find((f) =>
        f.filePath.includes("types.ts")
      );

      // Type file should be analyzed but with weight 0
      expect(typeFile).toBeDefined();
      expect(typeFile!.weight).toBe(0);
    });
  });

  describe("output structure", () => {
    it("returns component-only coverage separately", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // Component.tsx has 100% coverage
      expect(result.componentCoverage).toBe(100);
    });

    it("lists all analyzed files with their coverage", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      expect(result.filesAnalyzed.length).toBeGreaterThan(0);
      expect(result.filesAnalyzed[0]).toHaveProperty("filePath");
      expect(result.filesAnalyzed[0]).toHaveProperty("percentage");
      expect(result.filesAnalyzed[0]).toHaveProperty("category");
      expect(result.filesAnalyzed[0]).toHaveProperty("weight");
    });

    it("identifies uncovered files (0%)", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // api.ts has 0% coverage
      expect(result.uncoveredFiles.some((f) => f.includes("api.ts"))).toBe(
        true
      );
    });

    it("identifies lowest coverage file", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // useData.ts has 50% (lowest non-zero)
      expect(result.lowestCoverageFile).toBeDefined();
      expect(result.lowestCoverageFile!.path).toContain("useData.ts");
      expect(result.lowestCoverageFile!.percentage).toBe(50);
    });

    it("returns totalFiles count", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      // Component + useData + api + utils = 4 files
      expect(result.totalFiles).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("handles missing coverage data gracefully", () => {
      // Empty coverage data
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        {}
      );

      expect(result.aggregateCoverage).toBe(0);
      expect(result.componentCoverage).toBe(0);
    });

    it("handles component with no dependencies", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Standalone.tsx"),
        projectRoot,
        coverage
      );

      // Only the component itself
      expect(result.totalFiles).toBe(1);
      expect(result.aggregateCoverage).toBe(result.componentCoverage);
      expect(result.aggregateCoverage).toBe(100);
    });

    it("handles component that only imports types", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/TypedComponent.tsx"),
        projectRoot,
        coverage
      );

      // Should still have valid aggregate (type file is excluded from calculation)
      expect(result.aggregateCoverage).toBe(100); // Only TypedComponent counts
    });
  });

  describe("path normalization", () => {
    it("finds coverage with absolute paths", () => {
      const coverage = createMockCoverage();
      const result = aggregateCoverage(
        join(projectRoot, "src/Component.tsx"),
        projectRoot,
        coverage
      );

      expect(result.componentCoverage).toBe(100);
    });

    it("handles coverage data with different path formats", () => {
      // Coverage with relative paths
      const coverage: IstanbulCoverage = {
        "/src/Standalone.tsx": {
          path: "/src/Standalone.tsx",
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5 },
          f: {},
          b: {},
        },
      };

      const result = aggregateCoverage(
        join(projectRoot, "src/Standalone.tsx"),
        projectRoot,
        coverage
      );

      // Should still find the coverage data
      expect(result.componentCoverage).toBe(100);
    });
  });
});
