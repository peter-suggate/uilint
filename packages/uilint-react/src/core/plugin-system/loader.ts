import { devWarn, devError, devLog, pluginRegistry as corePluginRegistry } from "uilint-core";
import type { Plugin } from "./types";
import { sortByDependencies } from "./registry";
import { adaptPlugin } from "./adapter";

/**
 * Plugin manifest for dynamic loading
 *
 * Note: The load function returns Plugin without a type parameter because
 * dynamic imports load plugins with various slice types. The registry
 * handles type-safe access to plugin-specific state.
 */
export interface PluginManifest {
  id: string;
  name: string;
  /** Dynamic import function - returns a module with a default Plugin export */
  load: () => Promise<{ default: Plugin }>;
  /** Whether plugin is enabled */
  enabled: boolean;
}

/**
 * Local plugin manifests (plugins that stay in uilint-react)
 * These are plugins too tightly coupled to React to be externalized.
 */
export const LOCAL_PLUGINS: PluginManifest[] = [
  {
    id: "eslint",
    name: "ESLint Analysis",
    load: () => import("../../plugins/eslint"),
    enabled: true,
  },
];

/**
 * External plugin imports (side-effect imports that register with pluginRegistry)
 * These are dynamically imported to trigger auto-registration with uilint-core's registry.
 */
const EXTERNAL_PLUGIN_IMPORTS = [
  () => import("uilint-vision/plugin"),
  () => import("uilint-semantic/plugin"),
];

/**
 * @deprecated Use LOCAL_PLUGINS instead. This is kept for backward compatibility.
 */
export const BUILT_IN_PLUGINS: PluginManifest[] = LOCAL_PLUGINS;

/**
 * Load a single plugin from its manifest
 * @param manifest - The plugin manifest to load
 * @returns The loaded plugin or null on failure
 */
export async function loadPlugin(
  manifest: PluginManifest
): Promise<Plugin | null> {
  try {
    const module = await manifest.load();
    return module.default;
  } catch (error) {
    devError(`Failed to load plugin "${manifest.id}":`, error);
    return null;
  }
}

/**
 * Load external plugins from the uilint-core plugin registry.
 * These are imported via side-effect imports which auto-register with the registry.
 */
async function loadExternalPlugins(): Promise<Plugin[]> {
  // Import all external plugins (this triggers their auto-registration)
  const importPromises = EXTERNAL_PLUGIN_IMPORTS.map(async (importFn) => {
    try {
      await importFn();
    } catch (error) {
      // External plugins may not be installed - this is fine
      devWarn("Failed to import external plugin:", error);
    }
  });

  await Promise.all(importPromises);

  // Get all registered plugins from the core registry
  const registeredPlugins = corePluginRegistry.getAll();
  devLog(`[Loader] Found ${registeredPlugins.length} plugins in core registry`);

  // Adapt each declarative plugin to the imperative interface
  const adaptedPlugins: Plugin[] = [];
  for (const plugin of registeredPlugins) {
    try {
      const adapted = adaptPlugin(plugin);
      adaptedPlugins.push(adapted);
      devLog(`[Loader] Adapted plugin: ${plugin.id}`);
    } catch (error) {
      devError(`[Loader] Failed to adapt plugin "${plugin.id}":`, error);
    }
  }

  return adaptedPlugins;
}

/**
 * Load multiple plugins from manifests
 * @param manifests - Array of plugin manifests to load (defaults to LOCAL_PLUGINS)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of loaded plugins sorted by dependencies
 */
export async function loadPlugins(
  manifests: PluginManifest[] = LOCAL_PLUGINS,
  onProgress?: (loaded: number, total: number, pluginId: string) => void
): Promise<Plugin[]> {
  const allPlugins: Plugin[] = [];

  // Load external plugins first (from uilint-core registry)
  const externalPlugins = await loadExternalPlugins();
  allPlugins.push(...externalPlugins);

  // Filter to only enabled local plugins
  const enabledManifests = manifests.filter((m) => m.enabled);
  const total = enabledManifests.length + externalPlugins.length;

  // Load local plugins in parallel
  const loadPromises = enabledManifests.map(async (manifest, index) => {
    const plugin = await loadPlugin(manifest);

    if (onProgress) {
      onProgress(externalPlugins.length + index + 1, total, manifest.id);
    }

    return plugin;
  });

  const results = await Promise.all(loadPromises);

  // Filter out null results and validate plugins
  const loadedLocalPlugins = results.filter((plugin): plugin is Plugin => {
    if (!plugin) {
      return false;
    }

    if (!plugin.id) {
      devWarn("Plugin missing id, skipping:", plugin);
      return false;
    }

    return true;
  });

  allPlugins.push(...loadedLocalPlugins);

  // Sort by dependencies
  return sortByDependencies(allPlugins);
}

/**
 * Get a plugin manifest by ID
 * @param id - The plugin ID to find
 * @returns The plugin manifest or undefined if not found
 */
export function getPluginManifest(id: string): PluginManifest | undefined {
  return LOCAL_PLUGINS.find((manifest) => manifest.id === id);
}
