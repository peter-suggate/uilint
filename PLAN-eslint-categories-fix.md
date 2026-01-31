# Plan: Fix ESLint Categories in Command Bar Sidebar

## Problem Statement

ESLint rules and plugins are not showing categories in the command bar sidebar, despite having both static and dynamic registration mechanisms in place.

## Investigation Findings

### Root Cause

The `initializePlugins()` function in `composed-store.ts` **bypasses the category registration flow**. While:

1. `PluginRegistry.initializeAll()` (in `registry.ts:153-212`) correctly:
   - Initializes the category registry with services
   - Registers category providers via `categoryRegistry.registerFromPlugin(plugin)`
   - Calls `categoryRegistry.loadByPriority()` to load counts

2. `initializePlugins()` in `composed-store.ts:518-599` calls `plugin.initialize()` **directly** without going through `pluginRegistry.initializeAll()`, which means:
   - Category providers defined in plugins (e.g., `eslintPlugin.categoryProviders`) are **never registered** with the `CategoryRegistry`
   - `categoryRegistry.initialize(services)` is never called
   - `categoryRegistry.loadByPriority()` is never called

### Code Flow Analysis

**Current (broken) flow:**
```
DevTool.tsx:146-150
  pluginRegistry.register(eslintPlugin)     // Registers plugin
  pluginRegistry.register(visionPlugin)
  pluginRegistry.register(fixPromptPlugin)
  initializePlugins({ websocket, domObserver })  // <- Problem is here

composed-store.ts:518-599
  for plugin in plugins:
    plugin.createSlice(scopedServices)       // Creates state slices
  for plugin in plugins:
    plugin.initialize(scopedServices)        // Calls init, but...
                                             // ❌ MISSING: categoryRegistry.registerFromPlugin(plugin)
                                             // ❌ MISSING: categoryRegistry.initialize(services)
                                             // ❌ MISSING: categoryRegistry.loadByPriority()
```

**Expected flow (in registry.ts:153-212):**
```
pluginRegistry.initializeAll(services):
  categoryRegistry.initialize(services)       // ✅ Initialize with services
  for plugin in sortedPlugins:
    plugin.initialize(services)
    if plugin.categoryProviders:
      categoryRegistry.registerFromPlugin(plugin)  // ✅ Register categories
  categoryRegistry.loadByPriority()           // ✅ Load counts
```

### Architecture Overview

There's a **two-layer category system** causing confusion:

1. **uilint-eslint package** (`category-registry.ts`):
   - Simple static metadata for rule categories ("static" vs "semantic")
   - Just an array of `CategoryMeta` objects
   - Not used by the command bar

2. **uilint-react package** (`core/plugin-system/category-registry.ts`):
   - Sophisticated `CategoryRegistry` class for command palette
   - Supports lazy loading, caching, dynamic sub-categories
   - This is what the sidebar uses, and it's **not receiving any providers**

### Verification

The ESLint plugin correctly defines category providers at `plugins/eslint/index.ts:593-735`:
- `eslint:commands` - ESLint commands
- `eslint:dynamic-rules` - Dynamic rules with issues

But these are never registered because `categoryRegistry.registerFromPlugin()` is never called.

## Proposed Solution

### Option A: Minimal Fix (Recommended)

Add the missing category registration calls to `initializePlugins()` in `composed-store.ts`.

**Changes:**
1. Import `categoryRegistry` into `composed-store.ts`
2. Call `categoryRegistry.initialize(pluginServicesInstance)` before plugin init loop
3. Call `categoryRegistry.registerFromPlugin(plugin)` for each plugin with category providers
4. Call `categoryRegistry.loadByPriority()` after all plugins initialized

**Pros:**
- Minimal code change
- Preserves existing plugin initialization flow
- Low risk of breaking other functionality

**Cons:**
- Duplicates some logic from `PluginRegistry.initializeAll()`
- Two places now handle plugin initialization

### Option B: Use PluginRegistry.initializeAll()

Replace the custom initialization in `composed-store.ts` with a call to `pluginRegistry.initializeAll()`.

**Challenges:**
- `PluginRegistry.initializeAll()` doesn't know about the composed store's scoped services
- Would require significant refactoring of how scoped services are created
- Risk of breaking existing slice registration

### Option C: Consolidate Registration (Future Refactor)

Long-term, consider consolidating:
1. Move slice creation logic from `composed-store.ts` into `PluginRegistry`
2. Have a single `initializeAll()` that handles both slices and categories
3. Remove duplicate initialization code

## Implementation Plan

### Phase 1: Fix Category Registration (Immediate)

1. **Modify `composed-store.ts`:**
   ```typescript
   import { categoryRegistry } from "../plugin-system/category-registry";

   export async function initializePlugins(options?: ComposedStoreOptions): Promise<void> {
     // ... existing store creation code ...

     // Initialize category registry with services
     categoryRegistry.initialize(pluginServicesInstance);

     // ... existing slice creation loop ...

     // After plugin initialization loop, register category providers
     for (const plugin of plugins) {
       if (plugin.categoryProviders && plugin.id) {
         categoryRegistry.registerFromPlugin(plugin);
       }
     }

     // Load category counts by priority
     categoryRegistry.loadByPriority();

     // ... rest of existing code ...
   }
   ```

2. **Add test coverage** for category registration in `composed-store.ts` or a new test file

### Phase 2: Add Tests

1. Create `category-registry.test.ts` in `uilint-react/src/core/plugin-system/`
2. Test cases:
   - Category providers are registered from plugins
   - `getCategoryTree()` returns expected structure
   - Dynamic providers expand correctly
   - Items can be loaded from providers

### Phase 3: Simplify (Optional Future Work)

1. Consider removing the `categoryRegistry` array from `uilint-eslint` (it's confusing and unused by the command bar)
2. Document the category system architecture
3. Consider consolidating `PluginRegistry.initializeAll()` with `initializePlugins()`

## Files to Modify

| File | Change |
|------|--------|
| `packages/uilint-react/src/core/store/composed-store.ts` | Add category registration calls |
| `packages/uilint-react/src/core/plugin-system/category-registry.test.ts` | New test file |
| `packages/uilint-react/src/core/plugin-system/registry.ts` | (Optional) Add comment noting dual registration paths |

## Testing Strategy

1. **Unit Tests:**
   - Verify `categoryRegistry.registerFromPlugin()` is called for each plugin
   - Verify `getCategoryTree()` returns plugins' categories

2. **Integration Tests:**
   - Open command palette and verify categories appear in sidebar
   - Verify ESLint commands category shows commands
   - Verify dynamic rules category generates sub-categories

3. **Manual Testing:**
   - Preview site: Open command bar, check sidebar shows "ESLint" category
   - Verify clicking categories loads their items

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing plugin init | Tests exist for plugin initialization; run full test suite |
| Category loading performance | Existing priority-based loading handles this |
| Memory leaks from duplicate registration | `registerProvider()` checks for duplicates |

## Success Criteria

1. ESLint categories appear in command bar sidebar
2. All existing tests pass
3. New tests cover category registration
4. Categories load items when clicked
