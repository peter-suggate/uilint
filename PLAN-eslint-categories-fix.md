# Plan: Fix ESLint Categories in Command Bar Sidebar

## Problem Statement

ESLint rules and plugins are not showing categories in the command bar sidebar, despite having both static and dynamic registration mechanisms in place.

## Root Cause

There are **two competing initialization functions**:

1. `PluginRegistry.initializeAll()` in `registry.ts` - Has category registration but is **never called in production**
2. `initializePlugins()` in `composed-store.ts` - Is used in production but **missing category registration**

This led to confusion and the category providers never being registered.

## Solution: Single Initialization Path

**Consolidate to one clear function:** `initializePlugins()` in `composed-store.ts`

### Changes

1. **`composed-store.ts`**: Add category registration to `initializePlugins()`
   - Import `categoryRegistry`
   - Initialize it with services
   - Register category providers from each plugin
   - Call `loadByPriority()` after initialization

2. **`registry.ts`**: Remove `initializeAll()`
   - It's only used in tests, never in production
   - Causes confusion about which function to use
   - Keep `PluginRegistry` as a simple registry (register, get, list)

3. **Tests**: Update `registry.test.ts`
   - Remove tests for `initializeAll()`
   - Move relevant test logic (dependency sorting, error handling) to test utility functions or `initializePlugins()`

### Architecture After Fix

```
DevTool.tsx
  ├── pluginRegistry.register(eslintPlugin)     // Just adds to registry
  ├── pluginRegistry.register(visionPlugin)
  ├── pluginRegistry.register(fixPromptPlugin)
  └── initializePlugins({ websocket, domObserver })  // Single init function
        │
        ├── createComposedStore()                    // Creates Zustand store
        ├── sortByDependencies(plugins)              // Dependency order
        ├── categoryRegistry.initialize(services)    // NEW: Init categories
        │
        └── for each plugin:
              ├── createSlice()                      // Create state slice
              ├── initialize()                       // Run plugin init
              └── categoryRegistry.registerFromPlugin()  // NEW: Register categories
        │
        └── categoryRegistry.loadByPriority()        // NEW: Load counts
```

### Naming Convention

- `pluginRegistry.register(plugin)` - Add plugin to registry (no init)
- `initializePlugins(options)` - Initialize all registered plugins (creates slices, registers categories, etc.)
- `categoryRegistry` - Manages command bar categories (internal, not called directly by app code)

## Files to Modify

| File | Change |
|------|--------|
| `packages/uilint-react/src/core/store/composed-store.ts` | Add category registration |
| `packages/uilint-react/src/core/plugin-system/registry.ts` | Remove `initializeAll()` |
| `packages/uilint-react/src/core/plugin-system/registry.test.ts` | Remove/update tests |

## Implementation

### Step 1: Update `composed-store.ts`

```typescript
import { categoryRegistry } from "../plugin-system/category-registry";

export async function initializePlugins(options?: ComposedStoreOptions): Promise<void> {
  const store = createComposedStore(options);

  if (!pluginServicesInstance) {
    throw new Error("[ComposedStore] Plugin services not initialized");
  }

  const registry = options?.registry ?? pluginRegistry;
  const plugins = registry.getPlugins();

  // Sort by dependencies
  const sortedPlugins = sortByDependencies(plugins);

  // Initialize category registry
  categoryRegistry.initialize(pluginServicesInstance);

  // Create slices for all plugins
  for (const plugin of sortedPlugins) {
    if (plugin.createSlice && plugin.id) {
      // ... existing slice creation code ...
    }
  }

  // Initialize plugins and register categories
  for (const plugin of sortedPlugins) {
    if (plugin.id) {
      const scopedServices = createScopedServicesForPlugin(
        plugin.id,
        pluginServicesInstance,
        store
      );

      // Initialize plugin
      if (plugin.initialize) {
        try {
          plugin.initialize(scopedServices);
        } catch (error) {
          console.error(`[initializePlugins] Failed to init ${plugin.id}:`, error);
        }
      }

      // Register category providers
      if (plugin.categoryProviders) {
        categoryRegistry.registerFromPlugin(plugin);
      }
    }
  }

  // Load category counts by priority
  categoryRegistry.loadByPriority();

  console.log(`[initializePlugins] Initialized ${plugins.length} plugins`);
}
```

### Step 2: Remove `initializeAll()` from `registry.ts`

Delete the `initializeAll()` method entirely. The `PluginRegistry` class becomes a simple registry with:
- `register(plugin)`
- `getPlugin(id)`
- `getPlugins()`
- `getAllCommands()`
- `getAllCategoryProviders()`
- etc.

### Step 3: Update Tests

Move initialization-related tests to test `initializePlugins()` instead, or keep them as unit tests for `sortByDependencies()`.
