/**
 * Tests for installer registry system
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerInstaller,
  getAllInstallers,
  getInstallerById,
  clearInstallers,
} from "../../src/commands/install/installers/registry.js";
import type {
  Installer,
  InstallerConfig,
  ProgressEvent,
  InstallTarget,
} from "../../src/commands/install/installers/types.js";
import type { ProjectState } from "../../src/commands/install/types.js";

// Mock installer factory
function createMockInstaller(
  id: string,
  overrides?: Partial<Installer>
): Installer {
  return {
    id,
    name: `Mock ${id}`,
    description: `Description for ${id}`,
    isApplicable: () => true,
    getTargets: () => [],
    plan: () => ({ actions: [], dependencies: [] }),
    async *execute(): AsyncGenerator<ProgressEvent> {
      yield { type: "start", message: "Starting" };
      yield { type: "complete", message: "Done" };
    },
    ...overrides,
  };
}

// Mock project state
const mockState: ProjectState = {
  projectPath: "/test",
  workspaceRoot: "/test",
  packageManager: "npm",
  cursorDir: { exists: false, path: "/test/.cursor" },
  styleguide: { exists: false, path: "/test/.uilint/styleguide.md" },
  commands: { genstyleguide: false },
  nextApps: [],
  viteApps: [],
  packages: [],
};

describe("InstallerRegistry", () => {
  beforeEach(() => {
    // Clear registry before each test
    clearInstallers();
  });

  describe("registerInstaller", () => {
    it("should register an installer", () => {
      const installer = createMockInstaller("test-installer");
      registerInstaller(installer);

      expect(getInstallerById("test-installer")).toBe(installer);
    });

    it("should not register duplicate IDs", () => {
      const installer1 = createMockInstaller("test-installer");
      const installer2 = createMockInstaller("test-installer");

      registerInstaller(installer1);
      registerInstaller(installer2);

      // Should only have one installer
      expect(getAllInstallers().length).toBe(1);
      expect(getInstallerById("test-installer")).toBe(installer1);
    });

    it("should register multiple installers with different IDs", () => {
      const installer1 = createMockInstaller("installer-1");
      const installer2 = createMockInstaller("installer-2");

      registerInstaller(installer1);
      registerInstaller(installer2);

      expect(getAllInstallers().length).toBe(2);
    });
  });

  describe("getInstallerById", () => {
    it("should return installer by ID", () => {
      const installer = createMockInstaller("test-installer");
      registerInstaller(installer);

      expect(getInstallerById("test-installer")).toBe(installer);
    });

    it("should return undefined for non-existent installer", () => {
      expect(getInstallerById("non-existent")).toBeUndefined();
    });
  });

  describe("getAllInstallers", () => {
    it("should return empty array when no installers registered", () => {
      expect(getAllInstallers()).toEqual([]);
    });

    it("should return all registered installers", () => {
      const installer1 = createMockInstaller("installer-1");
      const installer2 = createMockInstaller("installer-2");

      registerInstaller(installer1);
      registerInstaller(installer2);

      const all = getAllInstallers();
      expect(all).toHaveLength(2);
      expect(all).toContain(installer1);
      expect(all).toContain(installer2);
    });
  });

  describe("clearInstallers", () => {
    it("should remove all installers", () => {
      registerInstaller(createMockInstaller("installer-1"));
      registerInstaller(createMockInstaller("installer-2"));

      expect(getAllInstallers().length).toBe(2);

      clearInstallers();

      expect(getAllInstallers().length).toBe(0);
      expect(getAllInstallers()).toEqual([]);
    });
  });
});
