import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { profile } from "../../src/commands/profile.js";

function makeTempProfileDir(): string {
  const dir = join(
    tmpdir(),
    `uilint-profile-command-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("profile command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("prints a readable summary from latest.json", async () => {
    const dir = makeTempProfileDir();
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "latest.json"),
      JSON.stringify({
        version: 1,
        generatedAt: "2026-05-17T00:00:00.000Z",
        durationMs: 42,
        cwd: "/repo",
        nodeVersion: "v20.19.0",
        fileCount: 2,
        enabledRuleCount: 1,
        rules: [
          {
            ruleId: "prefer-tailwind",
            files: 2,
            reports: 1,
            setupMs: 1,
            listenerMs: 9,
            totalMs: 10,
            listenerCalls: 3,
            avgFileMs: 5,
            p95FileMs: 8,
            p99FileMs: 8,
            maxFileMs: 8,
            listeners: [],
          },
        ],
        outliers: [
          {
            ruleId: "prefer-tailwind",
            filePath: "src/App.tsx",
            totalMs: 8,
            setupMs: 1,
            listenerMs: 7,
            listenerCalls: 2,
            reports: 1,
          },
        ],
      })
    );

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await profile({ profileDir: dir, limit: 5 });

    const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("UILint Rule Profile");
    expect(output).toContain("prefer-tailwind");
    expect(output).toContain("src/App.tsx");
  });

  it("prints raw JSON when requested", async () => {
    const dir = makeTempProfileDir();
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "latest.json"),
      JSON.stringify({
        version: 1,
        generatedAt: "2026-05-17T00:00:00.000Z",
        durationMs: 1,
        cwd: "/repo",
        nodeVersion: "v20.19.0",
        fileCount: 0,
        enabledRuleCount: 0,
        rules: [],
        outliers: [],
      })
    );

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await profile({ profileDir: dir, json: true });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      version: 1,
      cwd: "/repo",
    });
  });
});
