import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PLUGINS,
  getPluginManifest,
  type PluginManifest,
} from "./loader";

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
        load: () => Promise.resolve({ default: {} as any }),
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
        load: () => Promise.resolve({ default: {} as any }),
        enabled: false,
      };

      expect(disabledManifest.enabled).toBe(false);
    });
  });
});
