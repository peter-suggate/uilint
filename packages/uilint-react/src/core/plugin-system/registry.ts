/**
 * Plugin Registry
 *
 * Manages plugin registration and lifecycle for the UILint plugin system.
 * Handles dependency resolution, initialization order, and aggregation of
 * plugin contributions (commands, analyzers, inspector panels, etc.).
 */

import type {
  Plugin,
  PluginServices,
  Command,
  Analyzer,
  InspectorPanel,
  RuleUIContribution,
  RuleMeta,
} from "./types";

/**
 * Wrapper for a registered plugin with initialization state
 */
interface RegisteredPlugin {
  plugin: Plugin;
  initialized: boolean;
}

/**
 * Topologically sort plugins by their dependencies.
 * Ensures plugins are initialized after their dependencies.
 *
 * @param plugins - Array of plugins to sort
 * @returns Sorted array with dependencies before dependents
 * @throws Error if circular dependency is detected
 */
export function sortByDependencies(plugins: Plugin[]): Plugin[] {
  const pluginMap = new Map<string, Plugin>();
  for (const plugin of plugins) {
    pluginMap.set(plugin.id, plugin);
  }

  const sorted: Plugin[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  function visit(plugin: Plugin): void {
    const id = plugin.id;

    // Already processed
    if (visited.has(id)) {
      return;
    }

    // Cycle detection
    if (visiting.has(id)) {
      throw new Error(
        `[PluginRegistry] Circular dependency detected involving plugin: ${id}`
      );
    }

    visiting.add(id);

    // Visit dependencies first
    const deps = plugin.dependencies || [];
    for (const depId of deps) {
      const depPlugin = pluginMap.get(depId);
      if (depPlugin) {
        visit(depPlugin);
      }
      // Note: Missing dependencies are handled during registration validation
    }

    visiting.delete(id);
    visited.add(id);
    sorted.push(plugin);
  }

  for (const plugin of plugins) {
    visit(plugin);
  }

  return sorted;
}

/**
 * Plugin Registry
 *
 * Central registry for managing UILint plugins. Handles:
 * - Plugin registration with dependency validation
 * - Ordered initialization based on dependencies
 * - Aggregation of plugin contributions
 * - Lifecycle management (dispose)
 */
export class PluginRegistry {
  private plugins: Map<string, RegisteredPlugin> = new Map();
  private services: PluginServices | null = null;

  /**
   * Register a plugin with the registry.
   *
   * @param plugin - The plugin to register
   * @throws Warning if plugin with same ID already registered
   * @throws Warning if plugin dependencies are not registered
   */
  register(plugin: Plugin): void {
    console.log(`[PluginRegistry] Registering plugin: ${plugin.id}`);

    // Check for duplicate
    if (this.plugins.has(plugin.id)) {
      console.warn(
        `[PluginRegistry] Plugin "${plugin.id}" is already registered. Skipping duplicate registration.`
      );
      return;
    }

    // Check dependencies
    const deps = plugin.dependencies || [];
    const missingDeps: string[] = [];
    for (const depId of deps) {
      if (!this.plugins.has(depId)) {
        missingDeps.push(depId);
      }
    }

    if (missingDeps.length > 0) {
      console.warn(
        `[PluginRegistry] Plugin "${plugin.id}" has unregistered dependencies: ${missingDeps.join(", ")}. ` +
          `These plugins should be registered first for proper initialization order.`
      );
    }

    // Register the plugin
    this.plugins.set(plugin.id, {
      plugin,
      initialized: false,
    });

    console.log(
      `[PluginRegistry] Plugin "${plugin.id}" registered successfully`
    );
  }

  /**
   * Initialize all registered plugins in dependency order.
   *
   * @param services - Plugin services to pass to each plugin's initialize method
   */
  async initializeAll(services: PluginServices): Promise<void> {
    console.log("[PluginRegistry] Initializing all plugins...");
    this.services = services;

    // Get all plugins and sort by dependencies
    const allPlugins = Array.from(this.plugins.values()).map((rp) => rp.plugin);
    const sortedPlugins = sortByDependencies(allPlugins);

    console.log(
      `[PluginRegistry] Initialization order: ${sortedPlugins.map((p) => p.id).join(" -> ")}`
    );

    // Initialize in order
    for (const plugin of sortedPlugins) {
      const registered = this.plugins.get(plugin.id);
      if (!registered) continue;

      if (registered.initialized) {
        console.log(
          `[PluginRegistry] Plugin "${plugin.id}" already initialized, skipping`
        );
        continue;
      }

      try {
        console.log(`[PluginRegistry] Initializing plugin: ${plugin.id}`);

        if (plugin.initialize) {
          await plugin.initialize(services);
        }

        registered.initialized = true;
        console.log(
          `[PluginRegistry] Plugin "${plugin.id}" initialized successfully`
        );
      } catch (error) {
        console.error(
          `[PluginRegistry] Failed to initialize plugin "${plugin.id}":`,
          error
        );
        // Continue with other plugins even if one fails
      }
    }

    console.log("[PluginRegistry] All plugins initialized");
  }

  /**
   * Get all registered plugins.
   *
   * @returns Array of all registered plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((rp) => rp.plugin);
  }

  /**
   * Get a specific plugin by ID.
   *
   * @param id - The plugin ID to look up
   * @returns The plugin if found, undefined otherwise
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  /**
   * Aggregate all commands from all registered plugins.
   *
   * @returns Array of all commands from all plugins
   */
  getAllCommands(): Command[] {
    const commands: Command[] = [];

    for (const { plugin } of this.plugins.values()) {
      if (plugin.commands) {
        commands.push(...plugin.commands);
      }
    }

    return commands;
  }

  /**
   * Aggregate all analyzers from all registered plugins.
   *
   * @returns Array of all analyzers from all plugins
   */
  getAllAnalyzers(): Analyzer[] {
    const analyzers: Analyzer[] = [];

    for (const { plugin } of this.plugins.values()) {
      if (plugin.analyzers) {
        analyzers.push(...plugin.analyzers);
      }
    }

    return analyzers;
  }

  /**
   * Aggregate all inspector panels from all registered plugins.
   * Panels are sorted by priority (higher priority first).
   *
   * @returns Array of all inspector panels, sorted by priority
   */
  getAllInspectorPanels(): InspectorPanel[] {
    const panels: InspectorPanel[] = [];

    for (const { plugin } of this.plugins.values()) {
      if (plugin.inspectorPanels) {
        panels.push(...plugin.inspectorPanels);
      }
    }

    // Sort by priority (higher priority first, default to 0)
    return panels.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Resolve which plugin handles a specific rule.
   *
   * First checks for plugins that explicitly claim the rule via ruleContributions,
   * then falls back to matching by rule category.
   *
   * @param ruleId - The rule ID to look up
   * @param ruleMeta - The rule metadata
   * @returns The plugin that handles this rule, or a default core plugin
   */
  getPluginForRule(ruleId: string, ruleMeta: RuleMeta): Plugin {
    // First, check if any plugin explicitly contributes to this rule
    for (const { plugin } of this.plugins.values()) {
      if (plugin.ruleContributions) {
        const contribution = plugin.ruleContributions.find(
          (rc) => rc.ruleId === ruleId
        );
        if (contribution) {
          return plugin;
        }
      }
    }

    // Fall back to matching by category or prefix
    // e.g., "uilint/semantic" might be handled by a semantic-analysis plugin
    for (const { plugin } of this.plugins.values()) {
      // Check if plugin ID matches rule prefix
      if (ruleId.startsWith(`${plugin.id}/`)) {
        return plugin;
      }

      // Check if plugin handles this rule category
      if (
        ruleMeta.category &&
        plugin.ruleCategories &&
        plugin.ruleCategories.includes(ruleMeta.category)
      ) {
        return plugin;
      }
    }

    // Return a default "core" plugin if no specific match
    // First try to find a core plugin
    const corePlugin = this.plugins.get("core")?.plugin;
    if (corePlugin) {
      return corePlugin;
    }

    // Return the first registered plugin as ultimate fallback
    const firstPlugin = this.plugins.values().next().value;
    if (firstPlugin) {
      return firstPlugin.plugin;
    }

    // If no plugins at all, return a minimal plugin object
    return {
      id: "default",
      name: "Default",
      version: "1.0.0",
    };
  }

  /**
   * Get custom UI contribution for a specific rule.
   *
   * @param ruleId - The rule ID to look up
   * @returns The rule UI contribution if found, undefined otherwise
   */
  getRuleContribution(ruleId: string): RuleUIContribution | undefined {
    for (const { plugin } of this.plugins.values()) {
      if (plugin.ruleContributions) {
        const contribution = plugin.ruleContributions.find(
          (rc) => rc.ruleId === ruleId
        );
        if (contribution) {
          return contribution;
        }
      }
    }

    return undefined;
  }

  /**
   * Dispose all plugins and clean up resources.
   * Calls dispose on each plugin in reverse initialization order.
   */
  disposeAll(): void {
    console.log("[PluginRegistry] Disposing all plugins...");

    // Get all plugins and sort by dependencies (reverse order for disposal)
    const allPlugins = Array.from(this.plugins.values()).map((rp) => rp.plugin);
    const sortedPlugins = sortByDependencies(allPlugins).reverse();

    for (const plugin of sortedPlugins) {
      const registered = this.plugins.get(plugin.id);
      if (!registered || !registered.initialized) continue;

      try {
        console.log(`[PluginRegistry] Disposing plugin: ${plugin.id}`);

        if (plugin.dispose && this.services) {
          plugin.dispose(this.services);
        }

        registered.initialized = false;
        console.log(
          `[PluginRegistry] Plugin "${plugin.id}" disposed successfully`
        );
      } catch (error) {
        console.error(
          `[PluginRegistry] Failed to dispose plugin "${plugin.id}":`,
          error
        );
      }
    }

    // Clear services reference
    this.services = null;

    console.log("[PluginRegistry] All plugins disposed");
  }

  /**
   * Check if a plugin is registered.
   *
   * @param id - The plugin ID to check
   * @returns true if the plugin is registered
   */
  isRegistered(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Check if a plugin is initialized.
   *
   * @param id - The plugin ID to check
   * @returns true if the plugin is initialized, false otherwise
   */
  isInitialized(id: string): boolean {
    return this.plugins.get(id)?.initialized ?? false;
  }

  /**
   * Get the current plugin services (available after initializeAll).
   *
   * @returns The plugin services, or null if not yet initialized
   */
  getServices(): PluginServices | null {
    return this.services;
  }

  /**
   * Clear all registered plugins.
   * Useful for testing or resetting the registry.
   */
  clear(): void {
    console.log("[PluginRegistry] Clearing all plugins");
    this.disposeAll();
    this.plugins.clear();
  }
}

/**
 * Factory function to create a new PluginRegistry instance.
 * Use this in tests to get isolated registry instances.
 *
 * @returns A new PluginRegistry instance
 */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}

/**
 * Singleton instance of the plugin registry.
 * Use this for global plugin management.
 */
export const pluginRegistry = createPluginRegistry();
