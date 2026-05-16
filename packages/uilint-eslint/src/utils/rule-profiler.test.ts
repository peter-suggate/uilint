import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "./create-rule.js";
import {
  buildRuleProfileSession,
  flushRuleProfiler,
  getRuleProfilerOptions,
  recordRuleListener,
  recordRuleReport,
  recordRuleSetup,
  resetRuleProfilerForTests,
  shouldProfileRule,
} from "./rule-profiler.js";

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe("rule profiler", () => {
  afterEach(() => {
    restoreEnv();
    resetRuleProfilerForTests(() => 0n);
  });

  it("is enabled by default and respects opt-out env values", () => {
    delete process.env.UILINT_PROFILE;
    expect(getRuleProfilerOptions().enabled).toBe(true);

    process.env.UILINT_PROFILE = "0";
    expect(getRuleProfilerOptions().enabled).toBe(false);

    process.env.UILINT_PROFILE = "false";
    expect(getRuleProfilerOptions().enabled).toBe(false);
  });

  it("excludes LLM, vision, and duplicate rules", () => {
    delete process.env.UILINT_PROFILE;

    expect(shouldProfileRule("prefer-tailwind")).toBe(true);
    expect(shouldProfileRule("semantic")).toBe(false);
    expect(shouldProfileRule("semantic-vision")).toBe(false);
    expect(shouldProfileRule("no-duplicates")).toBe(false);
  });

  it("aggregates rule totals, percentiles, reports, listeners, and outliers", () => {
    process.env.UILINT_PROFILE_OUTLIERS = "1";
    process.env.UILINT_PROFILE_MIN_MS = "0";
    resetRuleProfilerForTests(() => 100_000_000n);

    recordRuleSetup("prefer-tailwind", "/repo/src/a.tsx", 1_000_000n);
    recordRuleListener("prefer-tailwind", "/repo/src/a.tsx", "Program", 2_000_000n);
    recordRuleReport("prefer-tailwind", "/repo/src/a.tsx");

    recordRuleSetup("prefer-tailwind", "/repo/src/b.tsx", 5_000_000n);
    recordRuleListener(
      "prefer-tailwind",
      "/repo/src/b.tsx",
      "JSXOpeningElement",
      10_000_000n
    );

    const session = buildRuleProfileSession();
    const rule = session.rules[0];

    expect(rule.ruleId).toBe("prefer-tailwind");
    expect(rule.files).toBe(2);
    expect(rule.reports).toBe(1);
    expect(rule.totalMs).toBe(18);
    expect(rule.avgFileMs).toBe(9);
    expect(rule.p95FileMs).toBe(15);
    expect(rule.p99FileMs).toBe(15);
    expect(rule.listenerCalls).toBe(2);
    expect(rule.listeners[0]).toMatchObject({
      selector: "JSXOpeningElement",
      totalMs: 10,
      calls: 1,
    });
    expect(session.outliers).toHaveLength(1);
    expect(session.outliers[0]).toMatchObject({
      ruleId: "prefer-tailwind",
      totalMs: 15,
    });
  });

  it("writes latest.json and sessions.jsonl on flush", () => {
    const dir = mkdtempSync(join(tmpdir(), "uilint-profile-"));
    process.env.UILINT_PROFILE_DIR = dir;
    process.env.UILINT_PROFILE_MIN_MS = "0";

    try {
      resetRuleProfilerForTests(() => 0n);
      recordRuleSetup("consistent-dark-mode", "src/a.tsx", 2_000_000n);

      const session = flushRuleProfiler();
      expect(session?.rules[0].ruleId).toBe("consistent-dark-mode");

      const latest = JSON.parse(
        readFileSync(join(dir, "latest.json"), "utf-8")
      ) as { rules: Array<{ ruleId: string }> };
      const sessions = readFileSync(join(dir, "sessions.jsonl"), "utf-8");

      expect(latest.rules[0].ruleId).toBe("consistent-dark-mode");
      expect(sessions).toContain("consistent-dark-mode");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wraps createRule listeners and preserves reporting behavior", () => {
    process.env.UILINT_PROFILE_MIN_MS = "0";
    resetRuleProfilerForTests(() => 0n);

    const rule = createRule<[], "issue">({
      name: "profile-test-rule",
      meta: {
        type: "problem",
        docs: { description: "test" },
        messages: { issue: "Issue" },
        schema: [],
      },
      defaultOptions: [],
      create(context) {
        return {
          Program(node) {
            context.report({ node, messageId: "issue" });
          },
        };
      },
    });

    let reports = 0;
    const context = {
      filename: join(process.cwd(), "src/example.ts"),
      report() {
        reports++;
      },
    } as unknown as Readonly<TSESLint.RuleContext<"issue", []>>;

    const listener = rule.create(context);
    listener.Program?.({ type: "Program" } as Parameters<
      NonNullable<typeof listener.Program>
    >[0]);

    const session = buildRuleProfileSession();
    const profiledRule = session.rules.find(
      (entry) => entry.ruleId === "profile-test-rule"
    );

    expect(reports).toBe(1);
    expect(profiledRule?.files).toBe(1);
    expect(profiledRule?.reports).toBe(1);
    expect(profiledRule?.listenerCalls).toBe(1);
  });
});
