import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("uilint-core/node", async () => {
  const actual = await vi.importActual<any>("uilint-core/node");

  class MockVisionAnalyzer {
    analyzeScreenshot = vi.fn(async () => {
      return {
        issues: [
          {
            elementText: "Submit",
            message: "Mock issue",
            category: "spacing",
            severity: "warning",
          },
        ],
        analysisTime: 7,
        rawResponse: '{"issues":[{"elementText":"Submit"}]}',
      };
    });

    constructor(_options: any) {}
  }

  return {
    ...actual,
    ensureOllamaReady: vi.fn(async () => {}),
    VisionAnalyzer: MockVisionAnalyzer,
  };
});

function tmpDir(prefix = "uilint-vision-run-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function createMinimalManifest() {
  return [
    {
      id: "el-1",
      text: "Submit",
      dataLoc: "app/page.tsx:1:1",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      tagName: "button",
      role: "button",
      instanceCount: 1,
    },
  ];
}

describe("vision-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolveVisionStyleGuide finds .uilint/styleguide.md under projectPath", async () => {
    const dir = tmpDir();
    mkdirSync(join(dir, ".uilint"), { recursive: true });
    const stylePath = join(dir, ".uilint", "styleguide.md");
    writeFileSync(stylePath, "# Styleguide\n", "utf-8");

    const mod = await import("../../src/utils/vision-run.js");
    const resolved = await mod.resolveVisionStyleGuide({
      projectPath: dir,
    });

    expect(resolved.styleguideLocation).toBe(stylePath);
    expect(resolved.styleGuide).toContain("# Styleguide");
  });

  it("runVisionAnalysis calls ensureOllamaReady only once per (baseUrl, model) within the process", async () => {
    vi.resetModules();
    const mod = await import("../../src/utils/vision-run.js");
    const core = await import("uilint-core/node");

    const manifest = createMinimalManifest();

    await mod.runVisionAnalysis({
      imageBase64: "dGVzdA==",
      manifest,
      projectPath: "/tmp",
      baseUrl: "http://localhost:11434",
      model: "qwen3-vl:8b-instruct",
    });
    await mod.runVisionAnalysis({
      imageBase64: "dGVzdA==",
      manifest,
      projectPath: "/tmp",
      baseUrl: "http://localhost:11434",
      model: "qwen3-vl:8b-instruct",
    });

    expect((core as any).ensureOllamaReady).toHaveBeenCalledTimes(1);
  });

  it("runVisionAnalysis writes debug dumps and omits base64 by default", async () => {
    vi.resetModules();
    const mod = await import("../../src/utils/vision-run.js");

    const outDir = tmpDir();
    const res = await mod.runVisionAnalysis({
      imageBase64: "ZGF0YQ==",
      manifest: createMinimalManifest(),
      projectPath: "/tmp",
      debugDump: outDir,
      baseUrl: "http://localhost:11434",
      model: "qwen3-vl:8b-instruct",
    });

    expect(res.issues.length).toBeGreaterThan(0);

    // Find the dump file and assert it does not contain the raw base64.
    const files = await import("fs").then((fs) =>
      (fs as any).readdirSync(outDir).filter((f: string) => f.endsWith(".json"))
    );
    expect(files.length).toBeGreaterThan(0);

    const dumpPath = join(outDir, files[0]);
    const dump = JSON.parse(readFileSync(dumpPath, "utf-8"));
    expect(dump.inputs.imageBase64).toContain("omitted");
  });
});
