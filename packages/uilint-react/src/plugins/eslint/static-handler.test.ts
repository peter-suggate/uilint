/**
 * Static Mode Handler Tests
 *
 * Tests for the manifest-based static mode that enables UILint
 * to work in production deployments without a WebSocket server.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { processManifest, configureStaticMode, isStaticMode, clearStaticMode, getSourceSnippet } from "./static-handler";
import type { PluginServices } from "../../core/plugin-system/types";
import type { ESLintPluginSlice } from "./slice";
import type { LintManifest } from "../../core/services/manifest-types";

/**
 * Creates a mock PluginServices with tracking for state mutations.
 */
function createMockServices(initialState: Partial<ESLintPluginSlice> = {}) {
  const state: ESLintPluginSlice = {
    issues: new Map(),
    scannedDataLocs: new Set(),
    scanStatus: "idle",
    availableRules: [],
    disabledRules: new Set(),
    workspaceRoot: null,
    requestedFiles: new Set(),
    ruleConfigs: new Map(),
    ruleConfigUpdating: new Map(),
    workspaceCapabilities: null,
    ...initialState,
  } as ESLintPluginSlice;

  const setStateCalls: Array<Partial<ESLintPluginSlice>> = [];

  const services: PluginServices = {
    websocket: {
      isConnected: false,
      url: "",
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      on: vi.fn(() => () => {}),
      onConnectionChange: vi.fn(() => () => {}),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => () => {}),
      onElementsRemoved: vi.fn(() => () => {}),
    },
    getState: vi.fn(() => state),
    setState: vi.fn((partial: Partial<ESLintPluginSlice>) => {
      setStateCalls.push(partial);
      Object.assign(state, partial);
    }),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };

  return { services, state, setStateCalls };
}

/**
 * Creates a sample manifest for testing
 */
function createSampleManifest(overrides: Partial<LintManifest> = {}): LintManifest {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    workspaceRoot: "/home/user/project",
    appRoot: "/home/user/project",
    files: [
      {
        filePath: "src/components/Button.tsx",
        issues: [
          {
            line: 10,
            column: 5,
            message: "Color #ff0000 not in design tokens",
            ruleId: "uilint/color-consistency",
            dataLoc: "src/components/Button.tsx:10:5",
          },
          {
            line: 25,
            column: 3,
            message: "Padding 13px not on 4px scale",
            ruleId: "uilint/spacing-scale",
            dataLoc: "src/components/Button.tsx:25:3",
          },
        ],
        snippets: {
          "src/components/Button.tsx:10:5": {
            lines: [
              "  return (",
              '    <button style={{ color: "#ff0000" }}>',
              "      Click me",
              "    </button>",
              "  );",
            ],
            startLine: 8,
            endLine: 12,
          },
        },
      },
      {
        filePath: "src/components/Input.tsx",
        issues: [
          {
            line: 15,
            column: 8,
            message: "Font size 15px not on 4px scale",
            ruleId: "uilint/spacing-scale",
            dataLoc: "src/components/Input.tsx:15:8",
          },
        ],
      },
    ],
    rules: [
      {
        id: "color-consistency",
        name: "Color Consistency",
        description: "Ensure colors are from design tokens",
        category: "static",
        defaultSeverity: "warn",
        currentSeverity: "error",
      },
      {
        id: "spacing-scale",
        name: "Spacing Scale",
        description: "Ensure spacing values are on the scale",
        category: "static",
        defaultSeverity: "warn",
        currentSeverity: "warn",
      },
    ],
    summary: {
      filesScanned: 10,
      filesWithIssues: 2,
      totalIssues: 3,
      bySeverity: {
        error: 1,
        warn: 2,
      },
    },
    ...overrides,
  };
}

describe("processManifest", () => {
  it("populates issues from manifest grouped by dataLoc", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    // Should have 3 unique dataLocs
    expect(state.issues.size).toBe(3);
    expect(state.issues.has("src/components/Button.tsx:10:5")).toBe(true);
    expect(state.issues.has("src/components/Button.tsx:25:3")).toBe(true);
    expect(state.issues.has("src/components/Input.tsx:15:8")).toBe(true);
  });

  it("converts manifest issues to unified Issue format", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    const buttonIssues = state.issues.get("src/components/Button.tsx:10:5");
    expect(buttonIssues).toHaveLength(1);

    const issue = buttonIssues![0];
    expect(issue.id).toContain("eslint");
    expect(issue.message).toBe("Color #ff0000 not in design tokens");
    expect(issue.ruleId).toBe("uilint/color-consistency");
    expect(issue.pluginId).toBe("eslint");
    expect(issue.line).toBe(10);
    expect(issue.column).toBe(5);
  });

  it("sets severity based on rule metadata", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    // color-consistency has currentSeverity: "error"
    const colorIssue = state.issues.get("src/components/Button.tsx:10:5")?.[0];
    expect(colorIssue?.severity).toBe("error");

    // spacing-scale has currentSeverity: "warn"
    const spacingIssue = state.issues.get("src/components/Button.tsx:25:3")?.[0];
    expect(spacingIssue?.severity).toBe("warning");
  });

  it("populates availableRules from manifest", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    expect(state.availableRules).toHaveLength(2);
    expect(state.availableRules.map((r) => r.id)).toContain("color-consistency");
    expect(state.availableRules.map((r) => r.id)).toContain("spacing-scale");
  });

  it("populates ruleConfigs from manifest", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    expect(state.ruleConfigs.size).toBe(2);
    expect(state.ruleConfigs.get("color-consistency")?.severity).toBe("error");
    expect(state.ruleConfigs.get("spacing-scale")?.severity).toBe("warn");
  });

  it("sets workspaceRoot from manifest", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest({
      workspaceRoot: "/custom/workspace",
    });

    processManifest(services, manifest);

    expect(state.workspaceRoot).toBe("/custom/workspace");
  });

  it("sets scanStatus to complete after processing", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    expect(state.scanStatus).toBe("complete");
  });

  it("batches all state updates into a single setState call", () => {
    const { services, setStateCalls } = createMockServices();
    const manifest = createSampleManifest();

    processManifest(services, manifest);

    // Should only call setState once for efficiency
    expect(setStateCalls).toHaveLength(1);
  });

  it("handles empty manifest gracefully", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest({
      files: [],
      rules: [],
      summary: {
        filesScanned: 0,
        filesWithIssues: 0,
        totalIssues: 0,
        bySeverity: { error: 0, warn: 0 },
      },
    });

    processManifest(services, manifest);

    expect(state.issues.size).toBe(0);
    expect(state.availableRules).toHaveLength(0);
    expect(state.scanStatus).toBe("complete");
  });

  it("handles multiple issues at the same dataLoc", () => {
    const { services, state } = createMockServices();
    const manifest = createSampleManifest({
      files: [
        {
          filePath: "src/Button.tsx",
          issues: [
            {
              line: 10,
              column: 5,
              message: "Issue 1",
              ruleId: "rule-1",
              dataLoc: "src/Button.tsx:10:5",
            },
            {
              line: 10,
              column: 5,
              message: "Issue 2",
              ruleId: "rule-2",
              dataLoc: "src/Button.tsx:10:5",
            },
          ],
        },
      ],
    });

    processManifest(services, manifest);

    // Both issues should be grouped under the same dataLoc
    const issues = state.issues.get("src/Button.tsx:10:5");
    expect(issues).toHaveLength(2);
    expect(issues?.map((i) => i.message)).toContain("Issue 1");
    expect(issues?.map((i) => i.message)).toContain("Issue 2");
  });
});

describe("getSourceSnippet", () => {
  it("returns snippet for valid dataLoc", () => {
    const manifest = createSampleManifest();

    const snippet = getSourceSnippet(manifest, "src/components/Button.tsx:10:5");

    expect(snippet).not.toBeNull();
    expect(snippet?.lines).toHaveLength(5);
    expect(snippet?.startLine).toBe(8);
    expect(snippet?.endLine).toBe(12);
  });

  it("returns null for dataLoc without snippet", () => {
    const manifest = createSampleManifest();

    const snippet = getSourceSnippet(manifest, "src/components/Input.tsx:15:8");

    expect(snippet).toBeNull();
  });

  it("returns null for unknown dataLoc", () => {
    const manifest = createSampleManifest();

    const snippet = getSourceSnippet(manifest, "unknown/file.tsx:1:1");

    expect(snippet).toBeNull();
  });
});

describe("configureStaticMode / isStaticMode / clearStaticMode", () => {
  beforeEach(() => {
    clearStaticMode();
  });

  it("configures static mode with manifest URL", () => {
    expect(isStaticMode()).toBe(false);

    configureStaticMode("/.uilint/manifest.json");

    expect(isStaticMode()).toBe(true);
  });

  it("clears static mode", () => {
    configureStaticMode("/.uilint/manifest.json");
    expect(isStaticMode()).toBe(true);

    clearStaticMode();

    expect(isStaticMode()).toBe(false);
  });
});
