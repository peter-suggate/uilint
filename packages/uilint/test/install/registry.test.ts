/**
 * Tests for installer registry system
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  installerRegistry,
  registerInstaller,
  getApplicableInstallers,
  getInstaller,
  getAllInstallers,
} from "../../src/commands/install/installers/registry.js";
import type {
  Installer,
  InstallerContext,
  InstallerResult,
  ProgressEvent,
  InstallTarget,
  InstalledStatus,
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
    category: "other",
    priority: 0,
    isApplicable: () => true,
    getTargets: () => [],
    isAlreadyInstalled: async () => ({ installed: false }),
    async *execute(_context: InstallerContext): AsyncGenerator<ProgressEvent, InstallerResult> {
      yield { type: "start", message: "Starting" };
      return {
        success: true,
        actions: [],
        dependencies: [],
      };
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
    installerRegistry.clear();
  });

  describe("register", () => {
    it("should register an installer", () => {
      const installer = createMockInstaller("test-installer");
      installerRegistry.register(installer);

      expect(installerRegistry.get("test-installer")).toBe(installer);
    });

    it("should throw error when registering duplicate ID", () => {
      const installer1 = createMockInstaller("test-installer");
      const installer2 = createMockInstaller("test-installer");

      installerRegistry.register(installer1);

      expect(() => installerRegistry.register(installer2)).toThrow(
        'Installer with id "test-installer" is already registered'
      );
    });

    it("should register multiple installers with different IDs", () => {
      const installer1 = createMockInstaller("installer-1");
      const installer2 = createMockInstaller("installer-2");

      installerRegistry.register(installer1);
      installerRegistry.register(installer2);

      expect(installerRegistry.size).toBe(2);
    });
  });

  describe("unregister", () => {
    it("should remove an installer", () => {
      const installer = createMockInstaller("test-installer");
      installerRegistry.register(installer);

      installerRegistry.unregister("test-installer");

      expect(installerRegistry.get("test-installer")).toBeUndefined();
    });

    it("should not throw when unregistering non-existent installer", () => {
      expect(() => installerRegistry.unregister("non-existent")).not.toThrow();
    });
  });

  describe("get", () => {
    it("should return installer by ID", () => {
      const installer = createMockInstaller("test-installer");
      installerRegistry.register(installer);

      expect(installerRegistry.get("test-installer")).toBe(installer);
    });

    it("should return undefined for non-existent installer", () => {
      expect(installerRegistry.get("non-existent")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return empty array when no installers registered", () => {
      expect(installerRegistry.getAll()).toEqual([]);
    });

    it("should return all registered installers", () => {
      const installer1 = createMockInstaller("installer-1");
      const installer2 = createMockInstaller("installer-2");

      installerRegistry.register(installer1);
      installerRegistry.register(installer2);

      const all = installerRegistry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(installer1);
      expect(all).toContain(installer2);
    });
  });

  describe("getApplicable", () => {
    it("should return only applicable installers", () => {
      const applicableInstaller = createMockInstaller("applicable", {
        isApplicable: () => true,
      });
      const notApplicableInstaller = createMockInstaller("not-applicable", {
        isApplicable: () => false,
      });

      installerRegistry.register(applicableInstaller);
      installerRegistry.register(notApplicableInstaller);

      const applicable = installerRegistry.getApplicable(mockState);
      expect(applicable).toHaveLength(1);
      expect(applicable[0]).toBe(applicableInstaller);
    });

    it("should sort by priority descending", () => {
      const lowPriority = createMockInstaller("low", { priority: 1 });
      const highPriority = createMockInstaller("high", { priority: 10 });
      const mediumPriority = createMockInstaller("medium", { priority: 5 });

      installerRegistry.register(lowPriority);
      installerRegistry.register(highPriority);
      installerRegistry.register(mediumPriority);

      const applicable = installerRegistry.getApplicable(mockState);
      expect(applicable).toEqual([highPriority, mediumPriority, lowPriority]);
    });

    it("should sort by name when priorities are equal", () => {
      const installerC = createMockInstaller("c", { name: "C Installer" });
      const installerA = createMockInstaller("a", { name: "A Installer" });
      const installerB = createMockInstaller("b", { name: "B Installer" });

      installerRegistry.register(installerC);
      installerRegistry.register(installerA);
      installerRegistry.register(installerB);

      const applicable = installerRegistry.getApplicable(mockState);
      expect(applicable.map((i) => i.name)).toEqual([
        "A Installer",
        "B Installer",
        "C Installer",
      ]);
    });
  });

  describe("getByCategory", () => {
    it("should return installers in specified category", () => {
      const frameworkInstaller = createMockInstaller("framework", {
        category: "framework",
      });
      const toolingInstaller = createMockInstaller("tooling", {
        category: "tooling",
      });
      const agentInstaller = createMockInstaller("agent", {
        category: "agent",
      });

      installerRegistry.register(frameworkInstaller);
      installerRegistry.register(toolingInstaller);
      installerRegistry.register(agentInstaller);

      const frameworks = installerRegistry.getByCategory("framework");
      expect(frameworks).toEqual([frameworkInstaller]);

      const tooling = installerRegistry.getByCategory("tooling");
      expect(tooling).toEqual([toolingInstaller]);
    });

    it("should return empty array for category with no installers", () => {
      const toolingInstaller = createMockInstaller("tooling", {
        category: "tooling",
      });
      installerRegistry.register(toolingInstaller);

      expect(installerRegistry.getByCategory("framework")).toEqual([]);
    });
  });

  describe("getAllTargets", () => {
    it("should return targets for applicable installers", () => {
      const target1: InstallTarget = {
        id: "target-1",
        displayName: "Target 1",
      };
      const target2: InstallTarget = {
        id: "target-2",
        displayName: "Target 2",
      };

      const installer1 = createMockInstaller("installer-1", {
        getTargets: () => [target1],
      });
      const installer2 = createMockInstaller("installer-2", {
        getTargets: () => [target2],
      });

      installerRegistry.register(installer1);
      installerRegistry.register(installer2);

      const targetsMap = installerRegistry.getAllTargets(mockState);

      expect(targetsMap.size).toBe(2);
      expect(targetsMap.get("installer-1")).toEqual([target1]);
      expect(targetsMap.get("installer-2")).toEqual([target2]);
    });

    it("should not include installers with no targets", () => {
      const installer1 = createMockInstaller("installer-1", {
        getTargets: () => [],
      });
      const installer2 = createMockInstaller("installer-2", {
        getTargets: () => [{ id: "target", displayName: "Target" }],
      });

      installerRegistry.register(installer1);
      installerRegistry.register(installer2);

      const targetsMap = installerRegistry.getAllTargets(mockState);

      expect(targetsMap.size).toBe(1);
      expect(targetsMap.has("installer-1")).toBe(false);
      expect(targetsMap.has("installer-2")).toBe(true);
    });

    it("should not include non-applicable installers", () => {
      const applicableInstaller = createMockInstaller("applicable", {
        isApplicable: () => true,
        getTargets: () => [{ id: "target", displayName: "Target" }],
      });
      const notApplicableInstaller = createMockInstaller("not-applicable", {
        isApplicable: () => false,
        getTargets: () => [{ id: "target", displayName: "Target" }],
      });

      installerRegistry.register(applicableInstaller);
      installerRegistry.register(notApplicableInstaller);

      const targetsMap = installerRegistry.getAllTargets(mockState);

      expect(targetsMap.size).toBe(1);
      expect(targetsMap.has("applicable")).toBe(true);
      expect(targetsMap.has("not-applicable")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all installers", () => {
      installerRegistry.register(createMockInstaller("installer-1"));
      installerRegistry.register(createMockInstaller("installer-2"));

      expect(installerRegistry.size).toBe(2);

      installerRegistry.clear();

      expect(installerRegistry.size).toBe(0);
      expect(installerRegistry.getAll()).toEqual([]);
    });
  });

  describe("size", () => {
    it("should return 0 when empty", () => {
      expect(installerRegistry.size).toBe(0);
    });

    it("should return correct count", () => {
      installerRegistry.register(createMockInstaller("installer-1"));
      expect(installerRegistry.size).toBe(1);

      installerRegistry.register(createMockInstaller("installer-2"));
      expect(installerRegistry.size).toBe(2);
    });
  });

  describe("helper functions", () => {
    it("registerInstaller should register via singleton", () => {
      const installer = createMockInstaller("test");
      registerInstaller(installer);

      expect(installerRegistry.get("test")).toBe(installer);
    });

    it("getApplicableInstallers should use singleton", () => {
      const installer = createMockInstaller("test", {
        isApplicable: () => true,
      });
      installerRegistry.register(installer);

      const applicable = getApplicableInstallers(mockState);
      expect(applicable).toContain(installer);
    });

    it("getInstaller should use singleton", () => {
      const installer = createMockInstaller("test");
      installerRegistry.register(installer);

      expect(getInstaller("test")).toBe(installer);
    });

    it("getAllInstallers should use singleton", () => {
      const installer = createMockInstaller("test");
      installerRegistry.register(installer);

      expect(getAllInstallers()).toContain(installer);
    });
  });
});
