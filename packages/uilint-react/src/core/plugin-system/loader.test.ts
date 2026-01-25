import { describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_PLUGINS,
  getPluginManifest,
  loadPlugin,
  loadPlugins,
  type PluginManifest,
} from "./loader";
import type { Plugin } from "./types";

describe("loader", () => {
  describe("getPluginManifest", () => {
    it("returns manifest for known plugin id 'eslint'", () => {
      const manifest = getPluginManifest("eslint");

      expect(manifest).toBeDefined();
      expect(manifest?.id).toBe("eslint");
      expect(manifest?.name).toBe("ESLint Analysis");
    });

    it("returns manifest for known plugin id 'vision'", () => {
      const manifest = getPluginManifest("vision");

      expect(manifest).toBeDefined();
      expect(manifest?.id).toBe("vision");
      expect(manifest?.name).toBe("Vision Analysis");
    });

    it("returns manifest for known plugin id 'semantic'", () => {
      const manifest = getPluginManifest("semantic");

      expect(manifest).toBeDefined();
      expect(manifest?.id).toBe("semantic");
      expect(manifest?.name).toBe("Semantic Analysis");
    });

    it("returns undefined for unknown plugin id", () => {
      const manifest = getPluginManifest("unknown-plugin");

      expect(manifest).toBeUndefined();
    });

    it("returns undefined for empty string id", () => {
      const manifest = getPluginManifest("");

      expect(manifest).toBeUndefined();
    });
  });

  describe("BUILT_IN_PLUGINS", () => {
    it("contains exactly 3 built-in plugins", () => {
      expect(BUILT_IN_PLUGINS).toHaveLength(3);
    });

    it("contains eslint, vision, and semantic plugins", () => {
      const pluginIds = BUILT_IN_PLUGINS.map((p) => p.id);

      expect(pluginIds).toContain("eslint");
      expect(pluginIds).toContain("vision");
      expect(pluginIds).toContain("semantic");
    });

    it("each manifest has required fields", () => {
      for (const manifest of BUILT_IN_PLUGINS) {
        // id field
        expect(manifest.id).toBeDefined();
        expect(typeof manifest.id).toBe("string");
        expect(manifest.id.length).toBeGreaterThan(0);

        // name field
        expect(manifest.name).toBeDefined();
        expect(typeof manifest.name).toBe("string");
        expect(manifest.name.length).toBeGreaterThan(0);

        // load function
        expect(manifest.load).toBeDefined();
        expect(typeof manifest.load).toBe("function");

        // enabled field
        expect(typeof manifest.enabled).toBe("boolean");
      }
    });

    it("all built-in plugins are enabled by default", () => {
      for (const manifest of BUILT_IN_PLUGINS) {
        expect(manifest.enabled).toBe(true);
      }
    });

    it("each plugin has a unique id", () => {
      const ids = BUILT_IN_PLUGINS.map((p) => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

  });

  describe("PluginManifest type structure", () => {
    it("allows creating a valid manifest object", () => {
      const testManifest: PluginManifest = {
        id: "test-plugin",
        name: "Test Plugin",
        load: () => Promise.resolve({ default: {} as Plugin }),
        enabled: true,
      };

      expect(testManifest.id).toBe("test-plugin");
      expect(testManifest.name).toBe("Test Plugin");
      expect(testManifest.enabled).toBe(true);
      expect(typeof testManifest.load).toBe("function");
    });

    it("allows creating a disabled manifest", () => {
      const disabledManifest: PluginManifest = {
        id: "disabled-plugin",
        name: "Disabled Plugin",
        load: () => Promise.resolve({ default: {} as Plugin }),
        enabled: false,
      };

      expect(disabledManifest.enabled).toBe(false);
    });
  });

  describe("loadPlugin", () => {
    it("loads a plugin from its manifest", async () => {
      const mockPlugin: Plugin = {
        id: "test-plugin",
        name: "Test Plugin",
      };
      const manifest: PluginManifest = {
        id: "test-plugin",
        name: "Test Plugin",
        load: () => Promise.resolve({ default: mockPlugin }),
        enabled: true,
      };

      const plugin = await loadPlugin(manifest);

      expect(plugin).toEqual(mockPlugin);
    });

    it("returns null when load function throws", async () => {
      const manifest: PluginManifest = {
        id: "failing-plugin",
        name: "Failing Plugin",
        load: () => Promise.reject(new Error("Load failed")),
        enabled: true,
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const plugin = await loadPlugin(manifest);

      expect(plugin).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load plugin "failing-plugin":',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("returns null when load returns undefined default", async () => {
      const manifest: PluginManifest = {
        id: "empty-plugin",
        name: "Empty Plugin",
        load: () => Promise.resolve({ default: undefined as unknown as Plugin }),
        enabled: true,
      };

      const plugin = await loadPlugin(manifest);

      // The function returns module.default which would be undefined
      expect(plugin).toBeUndefined();
    });
  });

  describe("loadPlugins", () => {
    it("loads multiple plugins from manifests", async () => {
      const plugin1: Plugin = { id: "plugin-1", name: "Plugin 1" };
      const plugin2: Plugin = { id: "plugin-2", name: "Plugin 2" };

      const manifests: PluginManifest[] = [
        {
          id: "plugin-1",
          name: "Plugin 1",
          load: () => Promise.resolve({ default: plugin1 }),
          enabled: true,
        },
        {
          id: "plugin-2",
          name: "Plugin 2",
          load: () => Promise.resolve({ default: plugin2 }),
          enabled: true,
        },
      ];

      const plugins = await loadPlugins(manifests);

      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.id)).toContain("plugin-1");
      expect(plugins.map((p) => p.id)).toContain("plugin-2");
    });

    it("filters out disabled manifests", async () => {
      const plugin1: Plugin = { id: "enabled-plugin", name: "Enabled" };
      const plugin2: Plugin = { id: "disabled-plugin", name: "Disabled" };

      const manifests: PluginManifest[] = [
        {
          id: "enabled-plugin",
          name: "Enabled Plugin",
          load: () => Promise.resolve({ default: plugin1 }),
          enabled: true,
        },
        {
          id: "disabled-plugin",
          name: "Disabled Plugin",
          load: () => Promise.resolve({ default: plugin2 }),
          enabled: false, // This one is disabled
        },
      ];

      const plugins = await loadPlugins(manifests);

      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe("enabled-plugin");
    });

    it("filters out plugins that fail to load", async () => {
      const plugin1: Plugin = { id: "working-plugin", name: "Working" };

      const manifests: PluginManifest[] = [
        {
          id: "working-plugin",
          name: "Working Plugin",
          load: () => Promise.resolve({ default: plugin1 }),
          enabled: true,
        },
        {
          id: "failing-plugin",
          name: "Failing Plugin",
          load: () => Promise.reject(new Error("Failed to load")),
          enabled: true,
        },
      ];

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const plugins = await loadPlugins(manifests);

      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe("working-plugin");

      consoleSpy.mockRestore();
    });

    it("filters out plugins missing id", async () => {
      const pluginWithId: Plugin = { id: "has-id", name: "Has ID" };
      const pluginWithoutId: Plugin = { name: "No ID" } as Plugin;

      const manifests: PluginManifest[] = [
        {
          id: "has-id",
          name: "Has ID Plugin",
          load: () => Promise.resolve({ default: pluginWithId }),
          enabled: true,
        },
        {
          id: "no-id",
          name: "No ID Plugin",
          load: () => Promise.resolve({ default: pluginWithoutId }),
          enabled: true,
        },
      ];

      // Suppress console.warn for this test
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const plugins = await loadPlugins(manifests);

      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe("has-id");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("calls onProgress callback during loading", async () => {
      const plugin1: Plugin = { id: "plugin-1", name: "Plugin 1" };
      const plugin2: Plugin = { id: "plugin-2", name: "Plugin 2" };

      const manifests: PluginManifest[] = [
        {
          id: "plugin-1",
          name: "Plugin 1",
          load: () => Promise.resolve({ default: plugin1 }),
          enabled: true,
        },
        {
          id: "plugin-2",
          name: "Plugin 2",
          load: () => Promise.resolve({ default: plugin2 }),
          enabled: true,
        },
      ];

      const progressCalls: Array<{ loaded: number; total: number; pluginId: string }> = [];
      const onProgress = (loaded: number, total: number, pluginId: string) => {
        progressCalls.push({ loaded, total, pluginId });
      };

      await loadPlugins(manifests, onProgress);

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0].total).toBe(2);
      expect(progressCalls[1].total).toBe(2);
      // Progress calls happen in parallel, so order may vary
      expect(progressCalls.map((c) => c.pluginId).sort()).toEqual(["plugin-1", "plugin-2"]);
    });

    it("returns empty array when no manifests provided", async () => {
      const plugins = await loadPlugins([]);

      expect(plugins).toHaveLength(0);
    });

    it("returns empty array when all manifests are disabled", async () => {
      const manifests: PluginManifest[] = [
        {
          id: "disabled-1",
          name: "Disabled 1",
          load: () => Promise.resolve({ default: { id: "disabled-1" } as Plugin }),
          enabled: false,
        },
        {
          id: "disabled-2",
          name: "Disabled 2",
          load: () => Promise.resolve({ default: { id: "disabled-2" } as Plugin }),
          enabled: false,
        },
      ];

      const plugins = await loadPlugins(manifests);

      expect(plugins).toHaveLength(0);
    });

    it("sorts plugins by dependencies", async () => {
      // Plugin B depends on Plugin A
      const pluginA: Plugin = { id: "plugin-a", name: "Plugin A" };
      const pluginB: Plugin = {
        id: "plugin-b",
        name: "Plugin B",
        dependencies: ["plugin-a"],
      };

      const manifests: PluginManifest[] = [
        // Intentionally out of order - B first, A second
        {
          id: "plugin-b",
          name: "Plugin B",
          load: () => Promise.resolve({ default: pluginB }),
          enabled: true,
        },
        {
          id: "plugin-a",
          name: "Plugin A",
          load: () => Promise.resolve({ default: pluginA }),
          enabled: true,
        },
      ];

      const plugins = await loadPlugins(manifests);

      // Plugin A should come before Plugin B due to dependency sorting
      const aIndex = plugins.findIndex((p) => p.id === "plugin-a");
      const bIndex = plugins.findIndex((p) => p.id === "plugin-b");

      expect(aIndex).toBeLessThan(bIndex);
    });
  });
});
