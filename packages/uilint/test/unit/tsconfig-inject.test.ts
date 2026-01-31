/**
 * Unit tests for tsconfig-inject utility
 *
 * Tests the injectTsconfigExclusion function which modifies tsconfig.json
 * to add .uilint exclusions and uilint-react/devtools types.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { injectTsconfigExclusion } from "../../src/utils/tsconfig-inject.js";

describe("injectTsconfigExclusion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `uilint-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeTsconfig(content: object): void {
    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify(content, null, 2) + "\n",
      "utf-8"
    );
  }

  function readTsconfig(): object {
    return JSON.parse(readFileSync(join(tempDir, "tsconfig.json"), "utf-8"));
  }

  // ===========================================================================
  // Basic exclusion tests
  // ===========================================================================

  describe("exclude array handling", () => {
    it("adds .uilint to existing exclude array", () => {
      writeTsconfig({
        compilerOptions: { target: "ES2022" },
        exclude: ["node_modules"],
      });

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(true);
      expect(result.tsconfigPath).toBe(join(tempDir, "tsconfig.json"));

      const tsconfig = readTsconfig() as { exclude: string[] };
      expect(tsconfig.exclude).toContain("node_modules");
      expect(tsconfig.exclude).toContain(".uilint");
    });

    it("creates exclude array if missing", () => {
      writeTsconfig({
        compilerOptions: { target: "ES2022" },
      });

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as { exclude: string[] };
      expect(tsconfig.exclude).toEqual([".uilint"]);
    });

    it("skips if .uilint already in exclude (idempotent)", () => {
      writeTsconfig({
        compilerOptions: { target: "ES2022" },
        exclude: ["node_modules", ".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(false);
      expect(result.tsconfigPath).toBe(join(tempDir, "tsconfig.json"));
    });

    it("returns modified=false if no tsconfig.json exists", () => {
      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(false);
      expect(result.tsconfigPath).toBeUndefined();
    });
  });

  // ===========================================================================
  // Devtools types tests
  // ===========================================================================

  describe("devtools types handling", () => {
    it("adds types array with devtools when types is missing", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          strict: true,
        },
        exclude: [".uilint"], // Already has exclude so we can isolate the types test
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
      };
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("adds devtools to existing types array", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          types: ["node", "jest"],
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
      };
      expect(tsconfig.compilerOptions.types).toContain("node");
      expect(tsconfig.compilerOptions.types).toContain("jest");
      expect(tsconfig.compilerOptions.types).toContain("uilint-react/devtools");
    });

    it("skips if devtools already in types (idempotent)", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          types: ["node", "uilint-react/devtools"],
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(false);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
      };
      // Should not have duplicate
      const devtoolsCount = tsconfig.compilerOptions.types.filter(
        (t) => t === "uilint-react/devtools"
      ).length;
      expect(devtoolsCount).toBe(1);
    });

    it("creates compilerOptions if missing when adding devtools types", () => {
      writeTsconfig({
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
      };
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("does not add devtools types when flag is false", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: false });

      expect(result.modified).toBe(false);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types?: string[] };
      };
      expect(tsconfig.compilerOptions.types).toBeUndefined();
    });

    it("does not add devtools types when flag is not provided", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(false);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types?: string[] };
      };
      expect(tsconfig.compilerOptions.types).toBeUndefined();
    });
  });

  // ===========================================================================
  // Combined operations
  // ===========================================================================

  describe("combined operations", () => {
    it("adds both exclude and types in one operation", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          strict: true,
        },
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
        exclude: string[];
      };
      expect(tsconfig.exclude).toEqual([".uilint"]);
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("adds only types when exclude already exists", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
        },
        exclude: ["node_modules", ".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
        exclude: string[];
      };
      // Exclude should not have duplicates
      expect(tsconfig.exclude).toEqual(["node_modules", ".uilint"]);
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("adds only exclude when types already has devtools", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          types: ["uilint-react/devtools"],
        },
        exclude: ["node_modules"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
        exclude: string[];
      };
      expect(tsconfig.exclude).toContain(".uilint");
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("returns modified=false when both already present", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          types: ["uilint-react/devtools"],
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(false);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("edge cases", () => {
    it("handles empty types array", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          types: [],
        },
        exclude: [".uilint"],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { types: string[] };
      };
      expect(tsconfig.compilerOptions.types).toEqual(["uilint-react/devtools"]);
    });

    it("handles empty exclude array", () => {
      writeTsconfig({
        compilerOptions: { target: "ES2022" },
        exclude: [],
      });

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as { exclude: string[] };
      expect(tsconfig.exclude).toEqual([".uilint"]);
    });

    it("preserves other tsconfig fields", () => {
      writeTsconfig({
        compilerOptions: {
          target: "ES2022",
          strict: true,
          jsx: "react-jsx",
        },
        include: ["src/**/*"],
        references: [{ path: "./tsconfig.node.json" }],
      });

      const result = injectTsconfigExclusion(tempDir, { addDevtoolsTypes: true });

      expect(result.modified).toBe(true);

      const tsconfig = readTsconfig() as {
        compilerOptions: { target: string; strict: boolean; jsx: string };
        include: string[];
        references: { path: string }[];
        exclude: string[];
      };
      expect(tsconfig.compilerOptions.target).toBe("ES2022");
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.jsx).toBe("react-jsx");
      expect(tsconfig.include).toEqual(["src/**/*"]);
      expect(tsconfig.references).toEqual([{ path: "./tsconfig.node.json" }]);
    });

    it("returns error for invalid JSON", () => {
      writeFileSync(
        join(tempDir, "tsconfig.json"),
        "{ invalid json }",
        "utf-8"
      );

      const result = injectTsconfigExclusion(tempDir);

      expect(result.modified).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
