# Plugin Consolidation Implementation Plan

## Overview

Consolidate vision and semantic analysis into self-contained packages that register themselves with the core system. No React code in analysis packages. Behavioral tests throughout.

---

## Phase 1: Core Plugin Infrastructure

### 1.1 Plugin Types in uilint-core

**Files to create:**
- `packages/uilint-core/src/plugin/types.ts` - All plugin interfaces
- `packages/uilint-core/src/plugin/registry.ts` - Plugin registry singleton
- `packages/uilint-core/src/plugin/context.ts` - PluginContext interface
- `packages/uilint-core/src/plugin/index.ts` - Public exports

**Types to define:**
- `PluginDefinition<TState>` - Main plugin contract
- `StateDefinition<TState>` - State shape, initial state, computed, persistence
- `ActionHandler<TState>` - Plain function signature
- `ActionHandlers<TState>` - Map of action type to handler
- `MessageHandler<TState>` - WebSocket message handler
- `PluginContext<TState>` - Services provided to actions
- `PanelDefinition` - Declarative panel layout
- `PanelSection` - Union of all section types
- `CommandDefinition` - Command palette entry
- `ToolbarGroupDefinition` - Toolbar button group
- `RuleDefinition` - ESLint rule metadata
- `DataBinding` - `{ binding: string }` type
- `ActionReference` - `{ type: string, payload?, payloadBindings? }`
- `IconName` - String union of available icons

**Registry API:**
```typescript
pluginRegistry.register(plugin: PluginDefinition)
pluginRegistry.get(id: string): PluginDefinition | undefined
pluginRegistry.getAll(): PluginDefinition[]
pluginRegistry.has(id: string): boolean
pluginRegistry.unregister(id: string): void
```

### 1.2 Behavioral Tests for Core Plugin Infrastructure

**Test file:** `packages/uilint-core/src/plugin/__tests__/registry.test.ts`

```typescript
describe("PluginRegistry", () => {
  describe("registration", () => {
    it("registers a plugin and retrieves it by id")
    it("returns all registered plugins")
    it("returns undefined for unregistered plugin id")
    it("allows unregistering a plugin")
    it("prevents duplicate registration of same id")
    it("maintains registration order")
  });
});
```

**Test file:** `packages/uilint-core/src/plugin/__tests__/types.test.ts`

```typescript
describe("Plugin type validation", () => {
  it("accepts a valid minimal plugin definition")
  it("accepts a plugin with all optional fields")
  it("plugin with state definition initializes correctly")
  it("computed values derive from state")
});
```

---

## Phase 2: Create uilint-vision Package

### 2.1 Package Setup

**Create package structure:**
```
packages/uilint-vision/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── node.ts
    ├── types.ts
    ├── constants.ts
    ├── analyzer/
    ├── browser/
    ├── plugin/
    └── utils/
```

**package.json dependencies:**
```json
{
  "peerDependencies": {
    "uilint-core": "workspace:*"
  },
  "dependencies": {
    "html-to-image": "^1.11.13"
  },
  "optionalDependencies": {
    "ollama": "^0.6.3"
  }
}
```

### 2.2 Move Types

**From:** `packages/uilint-core/src/scanner/vision-analyzer.ts`
**From:** `packages/uilint-react/src/plugins/vision/types.ts`
**To:** `packages/uilint-vision/src/types.ts`

Types to consolidate:
- `VisionIssue`
- `VisionIssueCategory`
- `VisionIssueSeverity`
- `ElementManifest`
- `ScreenshotCapture`
- `CaptureRegion`
- `CaptureMode`
- `VisionAnalysisResult`
- `VisionAutoScanSettings`
- `VisionStage`
- `VisionErrorInfo`
- WebSocket message types

### 2.3 Move Analyzer (Node.js)

**From:** `packages/uilint-core/src/scanner/vision-analyzer.ts`
**To:** `packages/uilint-vision/src/analyzer/vision-analyzer.ts`

**From:** `packages/uilint/src/utils/vision-run.ts`
**To:** `packages/uilint-vision/src/analyzer/runner.ts`

### 2.4 Move Browser Utilities

**From:** `packages/uilint-react/src/scanner/vision-capture.ts`
**To:** `packages/uilint-vision/src/browser/capture.ts`

Note: Extract DOM-specific code, keep it framework-agnostic (uses DOM APIs, not React)

### 2.5 Create Plugin Definition

**Files:**
- `packages/uilint-vision/src/plugin/state.ts` - VisionState interface + initial state
- `packages/uilint-vision/src/plugin/actions.ts` - Action handlers
- `packages/uilint-vision/src/plugin/commands.ts` - Command definitions
- `packages/uilint-vision/src/plugin/toolbar.ts` - Toolbar definitions
- `packages/uilint-vision/src/plugin/panels.ts` - Panel definitions (declarative)
- `packages/uilint-vision/src/plugin/rules.ts` - semantic-vision rule definition
- `packages/uilint-vision/src/plugin/messages.ts` - WebSocket message handlers
- `packages/uilint-vision/src/plugin/index.ts` - Main plugin export + auto-registration

### 2.6 Update Exports

**src/index.ts (browser-safe):**
- Types
- Plugin definition
- Browser utilities
- Constants
- Auto-registers with pluginRegistry

**src/node.ts (Node.js):**
- Re-exports index.ts
- VisionAnalyzer
- Runner utilities

### 2.7 Behavioral Tests for uilint-vision

**Test file:** `packages/uilint-vision/src/__tests__/plugin.test.ts`

```typescript
describe("Vision Plugin", () => {
  describe("registration", () => {
    it("auto-registers with pluginRegistry on import")
    it("can be explicitly registered")
    it("has required plugin metadata (id, name, version)")
  });

  describe("state management", () => {
    it("initializes with visionAvailable: false")
    it("tracks analyzing state during capture")
    it("stores screenshot history")
    it("caches vision issues by route")
    it("persists autoScanSettings")
  });

  describe("actions", () => {
    it("capture-full-page sets captureMode to full")
    it("enter-region-selection activates region selection")
    it("handle-vision-result updates issues cache")
    it("clear-screenshots empties history and cache")
  });

  describe("commands", () => {
    it("provides capture full page command")
    it("provides capture region command")
    it("commands are unavailable when vision not available")
  });

  describe("issue aggregation", () => {
    it("aggregates issues from cache into PluginIssue format")
    it("maps issues by dataLoc")
    it("returns empty map when no issues")
  });
});
```

**Test file:** `packages/uilint-vision/src/__tests__/analyzer.test.ts`

```typescript
describe("VisionAnalyzer", () => {
  // These tests use real Ollama if available, skip otherwise

  describe("availability check", () => {
    it("reports available when Ollama is running with vision model")
    it("reports unavailable when Ollama is not running")
  });

  describe("analysis", () => {
    it("analyzes screenshot and returns issues")
    it("matches issues to manifest elements by text")
    it("handles empty manifest gracefully")
    it("returns error for invalid screenshot data")
  });
});
```

**Test file:** `packages/uilint-vision/src/__tests__/browser.test.ts`

```typescript
describe("Browser utilities", () => {
  // Uses jsdom for DOM testing

  describe("collectElementManifest", () => {
    it("collects elements with data-loc attributes")
    it("extracts visible text content")
    it("computes bounding rectangles")
    it("infers semantic roles from tag names")
    it("skips script, style, and hidden elements")
    it("deduplicates elements by data-loc")
  });

  describe("captureScreenshot", () => {
    it("captures full page as base64 data URL")
    it("captures specified region")
    it("handles capture errors gracefully")
  });
});
```

---

## Phase 3: Create uilint-semantic Package

### 3.1 Rename/Refactor uilint-duplicates

**Option A:** Rename `uilint-duplicates` to `uilint-semantic`
**Option B:** Keep `uilint-duplicates` for detection, create `uilint-semantic` as plugin wrapper

Recommend Option A - rename and add plugin infrastructure.

### 3.2 Package Structure

```
packages/uilint-semantic/
├── package.json
├── src/
    ├── index.ts
    ├── node.ts
    ├── types.ts
    ├── detection/        # Existing duplicate detection
    ├── embeddings/       # Existing embeddings
    ├── index/            # Existing vector store
    ├── plugin/           # NEW: Plugin definition
    │   ├── state.ts
    │   ├── actions.ts
    │   ├── commands.ts
    │   ├── panels.ts
    │   ├── rules.ts
    │   ├── messages.ts
    │   └── index.ts
    └── utils/
```

### 3.3 Create Plugin Definition

**State:**
- `indexStatus`: "idle" | "indexing" | "ready" | "error"
- `indexProgress`: { current: number, total: number }
- `indexStats`: { totalChunks, added, modified, deleted, duration }
- `lastIndexError`: string | null

**Actions:**
- `start-indexing` - Begin index build
- `handle-indexing-progress` - Update progress
- `handle-indexing-complete` - Update stats
- `handle-indexing-error` - Set error state

**Panels:**
- Duplicates inspector panel (code comparison)

**Rules:**
- `no-semantic-duplicates` rule definition

### 3.4 Behavioral Tests for uilint-semantic

**Test file:** `packages/uilint-semantic/src/__tests__/plugin.test.ts`

```typescript
describe("Semantic Plugin", () => {
  describe("registration", () => {
    it("auto-registers with pluginRegistry on import")
    it("has required plugin metadata")
  });

  describe("state management", () => {
    it("initializes with indexStatus: idle")
    it("tracks indexing progress")
    it("stores index statistics after completion")
  });

  describe("actions", () => {
    it("start-indexing sets status to indexing")
    it("handle-indexing-progress updates progress")
    it("handle-indexing-complete sets status to ready")
    it("handle-indexing-error sets status to error")
  });

  describe("panels", () => {
    it("provides duplicates panel definition")
    it("panel has code comparison sections")
  });
});
```

**Test file:** `packages/uilint-semantic/src/__tests__/detection.test.ts`

```typescript
describe("Duplicate Detection", () => {
  describe("finding duplicates", () => {
    it("finds exact duplicate functions")
    it("finds semantically similar components")
    it("scores based on semantic and structural similarity")
    it("respects confidence threshold")
    it("filters by chunk kind (component, hook, function)")
  });

  describe("indexing", () => {
    it("indexes TypeScript files")
    it("extracts components, hooks, and functions")
    it("generates embeddings for chunks")
    it("supports incremental updates")
  });
});
```

---

## Phase 4: Schema Renderer in uilint-react

### 4.1 Create Schema Renderer Components

**Files:**
- `packages/uilint-react/src/core/schema-renderer/PanelRenderer.tsx`
- `packages/uilint-react/src/core/schema-renderer/SectionRenderer.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/HeaderSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/CodeViewerSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/CodeComparisonSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/BadgeSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/TextSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/ActionsSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/ConditionalSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/ListSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/sections/ImageSection.tsx`
- `packages/uilint-react/src/core/schema-renderer/binding-resolver.ts`
- `packages/uilint-react/src/core/schema-renderer/icon-registry.ts`

### 4.2 Update Plugin Loader

**File:** `packages/uilint-react/src/core/plugin-system/loader.ts`

Changes:
- Read plugins from `pluginRegistry.getAll()` instead of hardcoded imports
- Remove direct imports of vision/semantic plugins
- Create state slices from plugin.state definitions
- Wire actions from plugin.actions
- Wire message handlers from plugin.messageHandlers
- Register panels via PanelRenderer

### 4.3 Update Inspector to Use Schema Renderer

**File:** `packages/uilint-react/src/ui/components/Inspector/InspectorContent.tsx`

Changes:
- Look up panel definition by id
- Pass to PanelRenderer instead of hardcoded components
- Remove direct imports of vision/semantic panel components

### 4.4 Register Browser Actions

**File:** `packages/uilint-react/src/core/browser-actions/registry.ts`

Create browser action registry for plugins to request browser-side operations:
- `capture-screenshot` - Uses html-to-image
- `collect-manifest` - Uses DOM traversal

### 4.5 Behavioral Tests for Schema Renderer

**Test file:** `packages/uilint-react/src/core/schema-renderer/__tests__/PanelRenderer.test.tsx`

```typescript
describe("PanelRenderer", () => {
  describe("rendering", () => {
    it("renders header section with text")
    it("renders header section with bound text")
    it("renders code viewer with syntax highlighting")
    it("renders badge with correct variant styling")
    it("renders action buttons")
    it("renders conditional section when condition is true")
    it("hides conditional section when condition is false")
    it("renders list of items")
  });

  describe("data binding", () => {
    it("resolves simple binding paths")
    it("resolves nested binding paths")
    it("handles missing data gracefully")
    it("updates when data changes")
  });

  describe("actions", () => {
    it("dispatches action on button click")
    it("passes payload bindings to action")
    it("disables button when disabled binding is true")
    it("hides button when visible binding is false")
  });

  describe("loading and empty states", () => {
    it("shows loading state when loading.when is true")
    it("shows empty state when empty.when is true")
    it("shows content when neither loading nor empty")
  });
});
```

---

## Phase 5: Update uilint CLI

### 5.1 Update serve Command

**File:** `packages/uilint/src/commands/serve.ts`

Changes:
- Import from `uilint-core` registry, not direct plugin imports
- Load plugins based on config/CLI flags
- Dynamic import of enabled plugins
- Wire server-side handlers from plugins

### 5.2 Update vision Command

**File:** `packages/uilint/src/commands/vision.ts`

Changes:
- Import VisionAnalyzer from `uilint-vision/node`
- Remove duplicate code

### 5.3 Update duplicates Commands

**Files:** `packages/uilint/src/commands/duplicates/*.ts`

Changes:
- Import from `uilint-semantic/node`
- Update paths

### 5.4 Behavioral Tests for CLI

**Test file:** `packages/uilint/src/__tests__/serve.test.ts`

```typescript
describe("serve command", () => {
  describe("plugin loading", () => {
    it("loads plugins specified in config")
    it("handles missing optional plugins gracefully")
    it("wires WebSocket handlers from plugins")
  });

  describe("vision analysis", () => {
    it("handles vision:analyze message")
    it("returns vision:result with issues")
    it("handles analysis errors gracefully")
  });

  describe("semantic indexing", () => {
    it("handles duplicates:index message")
    it("sends progress updates during indexing")
    it("sends completion message with stats")
  });
});
```

---

## Phase 6: Migration and Cleanup

### 6.1 Update Imports Throughout Codebase

Search and replace imports:
- `uilint-core/scanner/vision-analyzer` → `uilint-vision/node`
- `uilint-react/plugins/vision/types` → `uilint-vision`
- `uilint-react/plugins/semantic/types` → `uilint-semantic`
- `uilint-duplicates` → `uilint-semantic`

### 6.2 Remove Old Files

After migration, delete:
- `packages/uilint-core/src/scanner/vision-analyzer.ts`
- `packages/uilint-react/src/plugins/vision/` (entire directory)
- `packages/uilint-react/src/plugins/semantic/` (entire directory)
- `packages/uilint-react/src/scanner/vision-capture.ts`

### 6.3 Update Re-exports for Backward Compatibility

**File:** `packages/uilint-core/src/node.ts`

Add deprecation re-exports:
```typescript
/** @deprecated Import from 'uilint-vision/node' instead */
export { VisionAnalyzer } from "uilint-vision/node";
```

### 6.4 Update Package Dependencies

Remove from uilint-react dependencies:
- No direct dependencies on uilint-vision or uilint-semantic

Add to uilint-react peerDependencies (optional):
```json
{
  "peerDependenciesMeta": {
    "uilint-vision": { "optional": true },
    "uilint-semantic": { "optional": true }
  }
}
```

---

## Phase 7: Integration Tests

### 7.1 End-to-End Plugin Tests

**Test file:** `packages/uilint-react/src/__tests__/integration/plugin-integration.test.ts`

```typescript
describe("Plugin Integration", () => {
  describe("vision plugin", () => {
    it("loads and initializes when imported")
    it("shows capture commands in command palette")
    it("shows toolbar when vision is available")
    it("captures screenshot and sends to server")
    it("displays issues in heatmap after analysis")
    it("opens vision issue panel on issue click")
  });

  describe("semantic plugin", () => {
    it("loads and initializes when imported")
    it("shows rebuild index command")
    it("displays indexing progress in UI")
    it("opens duplicates panel on duplicate issue click")
    it("shows code comparison in panel")
  });

  describe("multiple plugins", () => {
    it("loads multiple plugins without conflict")
    it("each plugin maintains separate state")
    it("commands from all plugins appear in palette")
    it("issues from all plugins appear in heatmap")
  });
});
```

### 7.2 Schema Renderer Integration Tests

**Test file:** `packages/uilint-react/src/__tests__/integration/schema-renderer.test.ts`

```typescript
describe("Schema Renderer Integration", () => {
  it("renders vision issue panel from definition")
  it("renders duplicates panel from definition")
  it("handles dynamic data updates")
  it("executes actions and updates state")
  it("fetches code content for code viewer")
});
```

---

## Phase 8: Documentation

### 8.1 Update Existing Docs

- Update README.md with new package structure
- Update CONTRIBUTING.md with plugin development guide

### 8.2 Create Plugin Development Guide

**File:** `docs/plugin-development.md`

Contents:
- Plugin definition structure
- State management patterns
- Panel definition guide
- Command and toolbar definitions
- Testing plugins
- Publishing plugins

---

## Task Summary

### Phase 1: Core Plugin Infrastructure (5 tasks)
- [ ] Create plugin types in uilint-core
- [ ] Create plugin registry
- [ ] Create PluginContext interface
- [ ] Export from uilint-core
- [ ] Write behavioral tests for registry

### Phase 2: uilint-vision Package (10 tasks)
- [ ] Create package structure and config
- [ ] Consolidate types from core and react
- [ ] Move VisionAnalyzer to analyzer/
- [ ] Move runner utilities to analyzer/
- [ ] Move browser capture to browser/
- [ ] Create plugin state definition
- [ ] Create plugin actions
- [ ] Create plugin commands, toolbar, panels
- [ ] Create plugin rules and messages
- [ ] Write behavioral tests

### Phase 3: uilint-semantic Package (8 tasks)
- [ ] Rename/restructure uilint-duplicates
- [ ] Add plugin directory structure
- [ ] Create plugin state definition
- [ ] Create plugin actions
- [ ] Create plugin commands and panels
- [ ] Create plugin rules and messages
- [ ] Update exports
- [ ] Write behavioral tests

### Phase 4: Schema Renderer (8 tasks)
- [ ] Create PanelRenderer component
- [ ] Create section components (8 types)
- [ ] Create binding resolver
- [ ] Create icon registry
- [ ] Update plugin loader to use registry
- [ ] Update Inspector to use schema renderer
- [ ] Create browser action registry
- [ ] Write behavioral tests

### Phase 5: CLI Updates (4 tasks)
- [ ] Update serve command
- [ ] Update vision command
- [ ] Update duplicates commands
- [ ] Write behavioral tests

### Phase 6: Migration (4 tasks)
- [ ] Update imports throughout codebase
- [ ] Remove old files
- [ ] Add deprecation re-exports
- [ ] Update package dependencies

### Phase 7: Integration Tests (2 tasks)
- [ ] Write plugin integration tests
- [ ] Write schema renderer integration tests

### Phase 8: Documentation (2 tasks)
- [ ] Update existing docs
- [ ] Create plugin development guide

**Total: 43 tasks**
