import { describe, it, expect, vi } from "vitest";
import { eslintCommands } from "./commands";
import type { PluginServices } from "../../core/plugin-system/types";

function makeServices(stateOverrides: Record<string, unknown> = {}): PluginServices {
  const state = {
    wsConnected: true,
    plugins: {
      eslint: {
        scanStatus: "idle" as const,
        startScanning: vi.fn(),
        stopScanning: vi.fn(),
        clearIssues: vi.fn(),
        issues: new Map(),
        ...stateOverrides,
      },
    },
    ...(stateOverrides._root ?? {}),
  };

  return {
    getState: () => state as never,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    websocket: {
      send: vi.fn(),
      on: vi.fn(() => vi.fn()),
      onConnectionChange: vi.fn(() => vi.fn()),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => vi.fn()),
      onElementsRemoved: vi.fn(() => vi.fn()),
      getElements: vi.fn(() => new Map()),
      setHideNodeModules: vi.fn(),
    },
    openInspector: vi.fn(),
    closeInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

function findCommand(id: string) {
  return eslintCommands.find((c) => c.id === id)!;
}

describe("eslintCommands", () => {
  it("exports 5 commands", () => {
    expect(eslintCommands).toHaveLength(5);
  });

  it("all commands have required fields", () => {
    for (const cmd of eslintCommands) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.title).toBeTruthy();
      expect(cmd.keywords.length).toBeGreaterThan(0);
      expect(typeof cmd.execute).toBe("function");
    }
  });
});

describe("toggle-scan command", () => {
  const cmd = findCommand("eslint:toggle-scan");

  it("starts scanning when status is idle", () => {
    const services = makeServices({ scanStatus: "idle" });
    cmd.execute(services);

    const state = services.getState() as { plugins: { eslint: { startScanning: ReturnType<typeof vi.fn> } } };
    expect(state.plugins.eslint.startScanning).toHaveBeenCalled();
  });

  it("stops scanning when status is scanning", () => {
    const services = makeServices({ scanStatus: "scanning" });
    cmd.execute(services);

    const state = services.getState() as { plugins: { eslint: { stopScanning: ReturnType<typeof vi.fn> } } };
    expect(state.plugins.eslint.stopScanning).toHaveBeenCalled();
  });

  it("closes command palette after execution", () => {
    const services = makeServices();
    cmd.execute(services);

    expect(services.closeCommandPalette).toHaveBeenCalled();
  });

  it("handles missing eslint plugin gracefully", () => {
    const state = { plugins: {} };
    const services: PluginServices = {
      ...makeServices(),
      getState: () => state as never,
    };

    // Should not throw
    cmd.execute(services);
  });

  it("isAvailable returns true when wsConnected", () => {
    expect(cmd.isAvailable!({ wsConnected: true })).toBe(true);
  });

  it("isAvailable returns false when not wsConnected", () => {
    expect(cmd.isAvailable!({ wsConnected: false })).toBe(false);
  });
});

describe("open-fixes command", () => {
  const cmd = findCommand("eslint:open-fixes");

  it("opens inspector with 'fixes' panel", () => {
    const services = makeServices();
    cmd.execute(services);

    expect(services.openInspector).toHaveBeenCalledWith("fixes", {});
  });

  it("closes command palette after execution", () => {
    const services = makeServices();
    cmd.execute(services);

    expect(services.closeCommandPalette).toHaveBeenCalled();
  });

  it("isAvailable returns true when scanning and has issues", () => {
    const issues = new Map([["loc1", [{ ruleId: "r1" }]]]);
    const state = {
      plugins: { eslint: { scanStatus: "scanning", issues } },
    };
    expect(cmd.isAvailable!(state)).toBe(true);
  });

  it("isAvailable returns false when not scanning", () => {
    const state = {
      plugins: { eslint: { scanStatus: "idle", issues: new Map() } },
    };
    expect(cmd.isAvailable!(state)).toBe(false);
  });

  it("isAvailable returns false when no issues", () => {
    const state = {
      plugins: { eslint: { scanStatus: "scanning", issues: new Map() } },
    };
    expect(cmd.isAvailable!(state)).toBe(false);
  });
});

describe("start-scan command", () => {
  const cmd = findCommand("eslint:start-scan");

  it("starts scanning when not already scanning", () => {
    const services = makeServices({ scanStatus: "idle" });
    cmd.execute(services);

    const state = services.getState() as { plugins: { eslint: { startScanning: ReturnType<typeof vi.fn> } } };
    expect(state.plugins.eslint.startScanning).toHaveBeenCalled();
  });

  it("does not start scanning when already scanning", () => {
    const services = makeServices({ scanStatus: "scanning" });
    cmd.execute(services);

    const state = services.getState() as { plugins: { eslint: { startScanning: ReturnType<typeof vi.fn> } } };
    expect(state.plugins.eslint.startScanning).not.toHaveBeenCalled();
  });

  it("isAvailable returns true when connected and not scanning", () => {
    const state = {
      wsConnected: true,
      plugins: { eslint: { scanStatus: "idle" } },
    };
    expect(cmd.isAvailable!(state)).toBe(true);
  });

  it("isAvailable returns false when already scanning", () => {
    const state = {
      wsConnected: true,
      plugins: { eslint: { scanStatus: "scanning" } },
    };
    expect(cmd.isAvailable!(state)).toBe(false);
  });
});

describe("stop-scan command", () => {
  const cmd = findCommand("eslint:stop-scan");

  it("stops scanning", () => {
    const services = makeServices();
    cmd.execute(services);

    const state = services.getState() as { plugins: { eslint: { stopScanning: ReturnType<typeof vi.fn> } } };
    expect(state.plugins.eslint.stopScanning).toHaveBeenCalled();
  });

  it("isAvailable returns true when scanning", () => {
    const state = {
      plugins: { eslint: { scanStatus: "scanning" } },
    };
    expect(cmd.isAvailable!(state)).toBe(true);
  });

  it("isAvailable returns false when not scanning", () => {
    const state = {
      plugins: { eslint: { scanStatus: "idle" } },
    };
    expect(cmd.isAvailable!(state)).toBe(false);
  });
});

describe("clear-rescan command", () => {
  const cmd = findCommand("eslint:clear-rescan");

  it("clears issues and starts scanning", () => {
    const services = makeServices();
    cmd.execute(services);

    const state = services.getState() as {
      plugins: {
        eslint: {
          clearIssues: ReturnType<typeof vi.fn>;
          startScanning: ReturnType<typeof vi.fn>;
        };
      };
    };
    expect(state.plugins.eslint.clearIssues).toHaveBeenCalled();
    expect(state.plugins.eslint.startScanning).toHaveBeenCalled();
  });

  it("isAvailable returns true when wsConnected", () => {
    expect(cmd.isAvailable!({ wsConnected: true })).toBe(true);
  });
});
