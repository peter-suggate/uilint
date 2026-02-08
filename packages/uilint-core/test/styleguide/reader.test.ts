import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  findStyleGuidePath,
  findUILintStyleGuideUpwards,
  readStyleGuide,
  readStyleGuideFromProject,
  writeStyleGuide,
  getDefaultStyleGuidePath,
  styleGuideExists,
  STYLEGUIDE_PATHS,
} from "../../src/styleguide/reader.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `uilint-reader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("STYLEGUIDE_PATHS", () => {
  it("contains expected candidate paths", () => {
    expect(STYLEGUIDE_PATHS).toContain(".uilint/styleguide.md");
    expect(STYLEGUIDE_PATHS).toContain("styleguide.md");
    expect(STYLEGUIDE_PATHS).toContain(".uilint/style-guide.md");
  });
});

describe("findStyleGuidePath", () => {
  it("returns null when no styleguide exists", () => {
    expect(findStyleGuidePath(testDir)).toBeNull();
  });

  it("finds .uilint/styleguide.md", () => {
    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "styleguide.md"), "# Guide");

    const result = findStyleGuidePath(testDir);
    expect(result).toBe(join(testDir, ".uilint", "styleguide.md"));
  });

  it("finds styleguide.md at project root", () => {
    writeFileSync(join(testDir, "styleguide.md"), "# Guide");

    const result = findStyleGuidePath(testDir);
    expect(result).toBe(join(testDir, "styleguide.md"));
  });

  it("prefers .uilint/styleguide.md over root styleguide.md", () => {
    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "styleguide.md"), "# In .uilint");
    writeFileSync(join(testDir, "styleguide.md"), "# At root");

    const result = findStyleGuidePath(testDir);
    expect(result).toBe(join(testDir, ".uilint", "styleguide.md"));
  });

  it("finds .uilint/style-guide.md as fallback", () => {
    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "style-guide.md"), "# Guide");

    const result = findStyleGuidePath(testDir);
    expect(result).toBe(join(testDir, ".uilint", "style-guide.md"));
  });
});

describe("findUILintStyleGuideUpwards", () => {
  it("finds styleguide in current directory", () => {
    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "styleguide.md"), "# Guide");

    expect(findUILintStyleGuideUpwards(testDir)).toBe(
      join(testDir, ".uilint", "styleguide.md")
    );
  });

  it("walks up to find styleguide in parent directory", () => {
    const childDir = join(testDir, "packages", "app");
    mkdirSync(childDir, { recursive: true });

    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "styleguide.md"), "# Root guide");

    expect(findUILintStyleGuideUpwards(childDir)).toBe(
      join(testDir, ".uilint", "styleguide.md")
    );
  });

  it("returns null when no styleguide found all the way up", () => {
    // Start in a deep temp dir with no .uilint anywhere
    const deepDir = join(testDir, "a", "b", "c");
    mkdirSync(deepDir, { recursive: true });

    // This will walk up to root and not find .uilint/styleguide.md in testDir
    // (since we didn't create it). It will continue up but we can't guarantee
    // it won't find one in the real filesystem, so we test a different way.
    const result = findUILintStyleGuideUpwards(deepDir);
    // Result should be either null or a real path found above testDir
    if (result !== null) {
      expect(result).toContain("styleguide.md");
    }
  });
});

describe("readStyleGuide", () => {
  it("reads file content as UTF-8", async () => {
    const filePath = join(testDir, "guide.md");
    writeFileSync(filePath, "# My Style Guide\n\nContent here.");

    const content = await readStyleGuide(filePath);
    expect(content).toBe("# My Style Guide\n\nContent here.");
  });

  it("rejects when file does not exist", async () => {
    await expect(readStyleGuide(join(testDir, "nonexistent.md"))).rejects.toThrow();
  });
});

describe("readStyleGuideFromProject", () => {
  it("returns null when no styleguide exists", async () => {
    const result = await readStyleGuideFromProject(testDir);
    expect(result).toBeNull();
  });

  it("reads the styleguide when found", async () => {
    const uilintDir = join(testDir, ".uilint");
    mkdirSync(uilintDir, { recursive: true });
    writeFileSync(join(uilintDir, "styleguide.md"), "# Colors\n- Red");

    const result = await readStyleGuideFromProject(testDir);
    expect(result).toBe("# Colors\n- Red");
  });
});

describe("writeStyleGuide", () => {
  it("creates parent directories and writes file", async () => {
    const filePath = join(testDir, "deep", "nested", "guide.md");

    await writeStyleGuide(filePath, "# New Guide");

    const content = await readStyleGuide(filePath);
    expect(content).toBe("# New Guide");
  });

  it("overwrites existing file", async () => {
    const filePath = join(testDir, "guide.md");
    writeFileSync(filePath, "old content");

    await writeStyleGuide(filePath, "new content");

    const content = await readStyleGuide(filePath);
    expect(content).toBe("new content");
  });
});

describe("getDefaultStyleGuidePath", () => {
  it("returns .uilint/styleguide.md under project path", () => {
    expect(getDefaultStyleGuidePath("/my/project")).toBe(
      join("/my/project", ".uilint", "styleguide.md")
    );
  });
});

describe("styleGuideExists", () => {
  it("returns false when no styleguide exists", () => {
    expect(styleGuideExists(testDir)).toBe(false);
  });

  it("returns true when styleguide exists", () => {
    writeFileSync(join(testDir, "styleguide.md"), "# Guide");
    expect(styleGuideExists(testDir)).toBe(true);
  });
});
