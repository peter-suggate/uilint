import type { Plugin } from "./types";

/**
 * Plugin manifest for dynamic loading
 */
export interface PluginManifest {
  id: string;
  name: string;
  /** Dynamic import function */
  load: () => Promise<{ default: Plugin }>;
  /** Whether plugin is enabled */
  enabled: boolean;
}

/**
 * Built-in plugin manifests
 */
export const BUILT_IN_PLUGINS: PluginManifest[] = [
  {
    id: "eslint",
    name: "ESLint Analysis",
    load: () => import("../../plugins/eslint"),
    enabled: true,
  },
  {
    id: "vision",
    name: "Vision Analysis",
    load: () => import("../../plugins/vision"),
    enabled: true,
  },
  {
    id: "semantic",
    name: "Semantic Analysis",
    load: () => import("../../plugins/semantic"),
    enabled: true,
  },
];

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
    console.error(`Failed to load plugin "${manifest.id}":`, error);
    return null;
  }
}

/**
 * Load multiple plugins from manifests
 * @param manifests - Array of plugin manifests to load
 * @param onProgress - Optional callback for progress updates
 * @returns Array of loaded plugins sorted by dependencies
 */
export async function loadPlugins(
  manifests: PluginManifest[] = BUILT_IN_PLUGINS,
  onProgress?: (loaded: number, total: number, pluginId: string) => void
): Promise<Plugin[]> {
  // Filter to only enabled plugins
  const enabledManifests = manifests.filter((m) => m.enabled);
  const total = enabledManifests.length;

  // Load all plugins in parallel
  const loadPromises = enabledManifests.map(async (manifest, index) => {
    const plugin = await loadPlugin(manifest);

    if (onProgress) {
      onProgress(index + 1, total, manifest.id);
    }

    return plugin;
  });

  const results = await Promise.all(loadPromises);

  // Filter out null results and validate plugins
  const loadedPlugins = results.filter((plugin): plugin is Plugin => {
    if (!plugin) {
      return false;
    }

    if (!plugin.meta?.id) {
      console.warn("Plugin missing meta.id, skipping:", plugin);
      return false;
    }

    return true;
  });

  // Sort by dependencies
  return sortByDependencies(loadedPlugins);
}

/**
 * Topological sort of plugins based on dependencies
 * @param plugins - Array of plugins to sort
 * @returns Sorted array with dependencies loaded first
 */
function sortByDependencies(plugins: Plugin[]): Plugin[] {
  const pluginMap = new Map<string, Plugin>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: Plugin[] = [];

  // Build plugin lookup map
  for (const plugin of plugins) {
    pluginMap.set(plugin.meta.id, plugin);
  }

  function visit(pluginId: string): void {
    // Already processed
    if (visited.has(pluginId)) {
      return;
    }

    // Circular dependency detection
    if (visiting.has(pluginId)) {
      console.warn(
        `Circular dependency detected involving plugin "${pluginId}". ` +
          "Dependency order may not be correct."
      );
      return;
    }

    const plugin = pluginMap.get(pluginId);
    if (!plugin) {
      return;
    }

    visiting.add(pluginId);

    // Visit dependencies first
    const dependencies = plugin.meta.dependencies ?? [];
    for (const depId of dependencies) {
      visit(depId);
    }

    visiting.delete(pluginId);
    visited.add(pluginId);
    sorted.push(plugin);
  }

  // Visit all plugins
  for (const plugin of plugins) {
    visit(plugin.meta.id);
  }

  return sorted;
}

/**
 * Get a plugin manifest by ID
 * @param id - The plugin ID to find
 * @returns The plugin manifest or undefined if not found
 */
export function getPluginManifest(id: string): PluginManifest | undefined {
  return BUILT_IN_PLUGINS.find((manifest) => manifest.id === id);
}
