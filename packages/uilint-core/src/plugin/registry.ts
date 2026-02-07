/**
 * Plugin Registry
 *
 * Global registry for plugins to register themselves with.
 * Plugins call pluginRegistry.register() on import (side effect)
 * or explicitly via direct call.
 *
 * The host (uilint-react, CLI) reads from this registry to
 * discover and initialize plugins.
 */

import type { PluginWithHandlers } from "./context.js";

/**
 * Error thrown when plugin registration fails.
 */
export class PluginRegistrationError extends Error {
  constructor(
    message: string,
    public readonly pluginId?: string
  ) {
    super(message);
    this.name = "PluginRegistrationError";
  }
}

/**
 * Event types for registry changes.
 */
export type PluginRegistryEvent =
  | { type: "registered"; plugin: PluginWithHandlers }
  | { type: "unregistered"; pluginId: string };

/**
 * Listener for registry events.
 */
export type PluginRegistryListener = (event: PluginRegistryEvent) => void;

/**
 * Plugin Registry
 *
 * Singleton registry for plugin registration and discovery.
 */
export class PluginRegistry {
  private plugins = new Map<string, PluginWithHandlers>();
  private registrationOrder: string[] = [];
  private listeners = new Set<PluginRegistryListener>();

  /**
   * Register a plugin.
   *
   * @param plugin - Plugin definition with handlers
   * @throws PluginRegistrationError if plugin with same ID already registered
   */
  register<TState>(plugin: PluginWithHandlers<TState>): void {
    // Validate required fields
    if (!plugin.id) {
      throw new PluginRegistrationError("Plugin must have an id");
    }
    if (!plugin.name) {
      throw new PluginRegistrationError(
        `Plugin "${plugin.id}" must have a name`,
        plugin.id
      );
    }
    if (!plugin.version) {
      throw new PluginRegistrationError(
        `Plugin "${plugin.id}" must have a version`,
        plugin.id
      );
    }
    if (!plugin.state) {
      throw new PluginRegistrationError(
        `Plugin "${plugin.id}" must have a state definition`,
        plugin.id
      );
    }

    // Check for duplicate registration
    if (this.plugins.has(plugin.id)) {
      throw new PluginRegistrationError(
        `Plugin "${plugin.id}" is already registered`,
        plugin.id
      );
    }

    // Register the plugin
    this.plugins.set(plugin.id, plugin as PluginWithHandlers);
    this.registrationOrder.push(plugin.id);

    // Notify listeners
    this.notifyListeners({ type: "registered", plugin: plugin as PluginWithHandlers });
  }

  /**
   * Unregister a plugin.
   *
   * @param id - Plugin ID to unregister
   * @returns true if plugin was unregistered, false if not found
   */
  unregister(id: string): boolean {
    if (!this.plugins.has(id)) {
      return false;
    }

    this.plugins.delete(id);
    this.registrationOrder = this.registrationOrder.filter((pid) => pid !== id);

    // Notify listeners
    this.notifyListeners({ type: "unregistered", pluginId: id });

    return true;
  }

  /**
   * Get a plugin by ID.
   *
   * @param id - Plugin ID
   * @returns Plugin definition or undefined if not found
   */
  get<TState = unknown>(id: string): PluginWithHandlers<TState> | undefined {
    return this.plugins.get(id) as PluginWithHandlers<TState> | undefined;
  }

  /**
   * Check if a plugin is registered.
   *
   * @param id - Plugin ID
   * @returns true if registered
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get all registered plugins in registration order.
   *
   * @returns Array of plugin definitions
   */
  getAll(): PluginWithHandlers[] {
    return this.registrationOrder.map((id) => this.plugins.get(id)!);
  }

  /**
   * Get all plugin IDs in registration order.
   *
   * @returns Array of plugin IDs
   */
  getIds(): string[] {
    return [...this.registrationOrder];
  }

  /**
   * Get count of registered plugins.
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Subscribe to registry changes.
   *
   * @param listener - Callback for registry events
   * @returns Unsubscribe function
   */
  subscribe(listener: PluginRegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear all registered plugins.
   * Useful for testing.
   */
  clear(): void {
    const ids = [...this.registrationOrder];
    for (const id of ids) {
      this.unregister(id);
    }
  }

  /**
   * Get plugins sorted by dependencies.
   *
   * Plugins are sorted so that dependencies come before dependents.
   * Throws if there are circular dependencies.
   *
   * @returns Sorted array of plugins
   * @throws Error if circular dependency detected
   */
  getSortedByDependencies(): PluginWithHandlers[] {
    const sorted: PluginWithHandlers[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving plugin "${id}"`);
      }

      const plugin = this.plugins.get(id);
      if (!plugin) return;

      visiting.add(id);

      // Visit dependencies first
      for (const depId of plugin.dependencies || []) {
        if (!this.plugins.has(depId)) {
          throw new Error(
            `Plugin "${id}" depends on "${depId}" which is not registered`
          );
        }
        visit(depId);
      }

      visiting.delete(id);
      visited.add(id);
      sorted.push(plugin);
    };

    // Visit all plugins
    for (const id of this.registrationOrder) {
      visit(id);
    }

    return sorted;
  }

  /**
   * Notify all listeners of an event.
   */
  private notifyListeners(event: PluginRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Plugin registry listener error:", error);
      }
    }
  }
}

/**
 * Global plugin registry singleton.
 *
 * Plugins import this and call register() to add themselves:
 *
 * ```typescript
 * import { pluginRegistry } from "uilint-core";
 * import { myPlugin } from "./plugin";
 *
 * pluginRegistry.register(myPlugin);
 * ```
 */
export const pluginRegistry = new PluginRegistry();
