# Plugin UI Schema Architecture

This document describes how analysis plugins (vision, semantic) define their UI needs via plain TypeScript configuration, without any React code. The `uilint-react` package interprets these schemas and renders the appropriate components.

## Core Principle

**Analysis packages export declarative schemas. React package renders them.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  uilint-vision / uilint-semantic                                   │
│  (No React - Pure TypeScript)                                       │
│                                                                     │
│  Exports:                                                           │
│  - Types (VisionIssue, etc.)                                       │
│  - Analysis logic (VisionAnalyzer, DuplicateFinder)                │
│  - Plugin config (commands, panels, rules, state shape)            │
│  - Action handlers (plain functions)                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ imports
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  uilint-react                                                       │
│  (React Implementation)                                             │
│                                                                     │
│  Provides:                                                          │
│  - Component registry (CodeViewer, DiffViewer, Badge, etc.)        │
│  - Schema interpreter (renders panel configs)                      │
│  - Plugin host (state management, services)                        │
│  - Shell UI (inspector, toolbar, command palette)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Panel Configuration Schema

Analysis packages define inspector panels using a declarative schema:

```typescript
// packages/uilint-core/src/plugin/panel-schema.ts

/**
 * Base panel definition
 */
export interface PanelDefinition {
  /** Unique panel ID */
  id: string;
  /** Panel title (static or dynamic) */
  title: string | { binding: string };
  /** Priority for ordering (higher = earlier) */
  priority?: number;
  /** Panel layout */
  layout: PanelLayout;
  /** Loading state configuration */
  loading?: LoadingConfig;
  /** Empty state configuration */
  empty?: EmptyStateConfig;
}

/**
 * Panel layout - array of sections rendered vertically
 */
export type PanelLayout = PanelSection[];

/**
 * Individual section within a panel
 */
export type PanelSection =
  | HeaderSection
  | CodeViewerSection
  | CodeComparisonSection
  | BadgeSection
  | TextSection
  | ActionsSection
  | DividerSection
  | ConditionalSection;
```

### 1.1 Section Types

```typescript
/**
 * Header with icon and text
 */
interface HeaderSection {
  type: "header";
  icon?: IconName;
  text: string | { binding: string };
  subtitle?: string | { binding: string };
  sticky?: boolean;
}

/**
 * Code viewer with syntax highlighting
 */
interface CodeViewerSection {
  type: "code-viewer";
  /** Section label */
  label?: string;
  /** Icon for the section */
  icon?: IconName;
  /** Data binding for code content */
  code: { binding: string } | { fetch: FetchConfig };
  /** Data binding for location info */
  location?: { binding: string };
  /** Starting line number */
  startLine?: number | { binding: string };
  /** Lines to highlight */
  highlightLines?: { binding: string };
  /** Enable diff-style highlighting */
  diffHighlighting?: boolean;
  /** Max height before scrolling */
  maxHeight?: number;
  /** Click handler action */
  onNavigate?: ActionReference;
}

/**
 * Side-by-side or stacked code comparison
 */
interface CodeComparisonSection {
  type: "code-comparison";
  /** Layout mode */
  mode: "stacked" | "side-by-side";
  /** Source code panel */
  source: {
    label: string;
    icon?: IconName;
    code: { binding: string } | { fetch: FetchConfig };
    location?: { binding: string };
  };
  /** Target code panel */
  target: {
    label: string;
    icon?: IconName;
    code: { binding: string } | { fetch: FetchConfig };
    location?: { binding: string };
  };
  /** Compute diff highlighting between source and target */
  computeDiff?: boolean;
  /** Max height for each panel */
  maxHeight?: number;
}

/**
 * Badge/pill showing a value
 */
interface BadgeSection {
  type: "badge";
  /** Badge variant determines styling */
  variant: "similarity" | "severity" | "status" | "category";
  /** Value to display */
  value: { binding: string };
  /** Optional label */
  label?: string;
  /** Center the badge */
  centered?: boolean;
}

/**
 * Plain text content
 */
interface TextSection {
  type: "text";
  content: string | { binding: string };
  variant?: "body" | "caption" | "muted" | "error";
}

/**
 * Action buttons
 */
interface ActionsSection {
  type: "actions";
  /** Layout direction */
  direction?: "row" | "column";
  /** Actions to render */
  actions: ActionButton[];
}

/**
 * Visual divider
 */
interface DividerSection {
  type: "divider";
  spacing?: "small" | "medium" | "large";
}

/**
 * Conditional rendering
 */
interface ConditionalSection {
  type: "conditional";
  /** Condition expression */
  condition: { binding: string } | { expression: string };
  /** Sections to render when true */
  then: PanelSection[];
  /** Sections to render when false */
  else?: PanelSection[];
}
```

### 1.2 Action Definitions

```typescript
/**
 * Button in an actions section
 */
interface ActionButton {
  /** Button ID */
  id: string;
  /** Button label (can be dynamic based on state) */
  label: string | { binding: string } | {
    condition: { binding: string };
    true: string;
    false: string;
  };
  /** Icon */
  icon?: IconName;
  /** Button variant */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Action to execute on click */
  action: ActionReference;
  /** Disabled state */
  disabled?: { binding: string };
  /** Visibility */
  visible?: { binding: string };
}

/**
 * Reference to an action handler
 */
interface ActionReference {
  /** Action type (resolved by plugin's action handlers) */
  type: string;
  /** Static payload to pass */
  payload?: Record<string, unknown>;
  /** Dynamic payload from bindings */
  payloadBindings?: Record<string, string>;
}
```

### 1.3 Data Fetching

```typescript
/**
 * Fetch configuration for dynamic data
 */
interface FetchConfig {
  /** Type of fetch */
  type: "source-code" | "file-content" | "websocket";
  /** Parameters */
  params: {
    filePath?: { binding: string };
    line?: { binding: string };
    contextAbove?: number;
    contextBelow?: number;
  };
}

/**
 * Loading state configuration
 */
interface LoadingConfig {
  /** Condition that indicates loading */
  when: { binding: string };
  /** Message to show */
  message?: string;
  /** Sub-message */
  submessage?: string;
}

/**
 * Empty state configuration
 */
interface EmptyStateConfig {
  /** Condition that indicates empty */
  when: { binding: string };
  /** Message to show */
  message: string;
  /** Sub-message */
  submessage?: string;
  /** Icon */
  icon?: IconName;
}
```

### 1.4 Icon Names (String Identifiers)

```typescript
/**
 * Available icon names (rendered by uilint-react)
 */
type IconName =
  // Navigation & UI
  | "target" | "link" | "external-link" | "chevron-right" | "chevron-down"
  | "x" | "check" | "alert-triangle" | "info" | "help-circle"
  // Analysis
  | "eye" | "camera" | "crop" | "scan" | "search" | "filter"
  // Code
  | "code" | "file" | "folder" | "git-branch" | "copy" | "clipboard"
  // Actions
  | "play" | "pause" | "refresh" | "trash" | "edit" | "settings"
  // Status
  | "loading" | "error" | "success" | "warning";
```

---

## 2. Example: Duplicates Panel Configuration

```typescript
// packages/uilint-semantic/src/plugin/panels.ts

import type { PanelDefinition } from "uilint-core/plugin";

export const duplicatesPanelDefinition: PanelDefinition = {
  id: "duplicates",
  title: "Duplicate Code",
  priority: 10,

  loading: {
    when: { binding: "isLoading" },
    message: "Loading code comparison...",
    submessage: "Fetching source files...",
  },

  empty: {
    when: { binding: "noData" },
    message: "No duplicate information available.",
  },

  layout: [
    // Sticky similarity header
    {
      type: "badge",
      variant: "similarity",
      value: { binding: "similarity" },
      centered: true,
    },

    // Source code section
    {
      type: "code-viewer",
      label: "This Code",
      icon: "target",
      code: {
        fetch: {
          type: "source-code",
          params: {
            filePath: { binding: "sourceLocation.filePath" },
            line: { binding: "sourceLocation.startLine" },
            contextAbove: 15,
            contextBelow: 15,
          }
        }
      },
      location: { binding: "sourceLocation" },
      diffHighlighting: true,
      maxHeight: 250,
      onNavigate: { type: "navigate-to-source" },
    },

    // Target code section
    {
      type: "code-viewer",
      label: "Similar Code",
      icon: "link",
      code: {
        fetch: {
          type: "source-code",
          params: {
            filePath: { binding: "targetLocation.filePath" },
            line: { binding: "targetLocation.startLine" },
            contextAbove: 15,
            contextBelow: 15,
          }
        }
      },
      location: { binding: "targetLocation" },
      diffHighlighting: true,
      maxHeight: 250,
      onNavigate: { type: "navigate-to-target" },
    },

    // Divider before actions
    { type: "divider", spacing: "medium" },

    // Action buttons
    {
      type: "actions",
      direction: "row",
      actions: [
        {
          id: "toggle-heatmap",
          label: {
            condition: { binding: "heatmapFilterActive" },
            true: "Clear Heatmap Filter",
            false: "Focus in Heatmap",
          },
          variant: "primary",
          action: {
            type: "toggle-heatmap-filter",
            payloadBindings: {
              sourceDataLoc: "sourceDataLoc",
              targetDataLoc: "targetDataLoc",
            },
          },
        },
      ],
    },
  ],
};
```

---

## 3. Example: Vision Issue Panel Configuration

```typescript
// packages/uilint-vision/src/plugin/panels.ts

import type { PanelDefinition } from "uilint-core/plugin";

export const visionIssuePanelDefinition: PanelDefinition = {
  id: "vision-issue",
  title: { binding: "issue.category" },
  priority: 10,

  layout: [
    // Issue header with severity
    {
      type: "header",
      icon: "eye",
      text: { binding: "issue.message" },
      sticky: true,
    },

    // Severity and category badges
    {
      type: "actions",
      direction: "row",
      actions: [], // Just for layout - using badges inline
    },

    // Element info
    {
      type: "conditional",
      condition: { binding: "issue.elementText" },
      then: [
        {
          type: "text",
          content: { binding: "issue.elementText" },
          variant: "caption",
        },
      ],
    },

    // Screenshot thumbnail
    {
      type: "conditional",
      condition: { binding: "capture.dataUrl" },
      then: [
        {
          type: "image",
          src: { binding: "capture.dataUrl" },
          alt: "Screenshot",
          maxHeight: 200,
          highlightRegion: { binding: "issue.elementRect" },
        },
      ],
    },

    { type: "divider" },

    // Actions
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "show-in-heatmap",
          label: "Show in Heatmap",
          icon: "filter",
          action: {
            type: "focus-heatmap",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
        },
        {
          id: "open-in-editor",
          label: "Open in Editor",
          icon: "external-link",
          action: {
            type: "open-editor",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
        },
      ],
    },
  ],
};

export const screenshotGalleryPanelDefinition: PanelDefinition = {
  id: "vision-gallery",
  title: "Screenshots",
  priority: 5,

  empty: {
    when: { binding: "screenshots.length === 0" },
    message: "No screenshots captured yet.",
    submessage: "Use the capture button to take a screenshot.",
    icon: "camera",
  },

  layout: [
    {
      type: "list",
      items: { binding: "screenshots" },
      itemLayout: [
        {
          type: "card",
          thumbnail: { binding: "item.dataUrl" },
          title: { binding: "item.route" },
          subtitle: { binding: "item.timestamp | formatDate" },
          badge: {
            variant: "status",
            value: { binding: "item.issues.length" },
            label: "issues",
          },
          onClick: {
            type: "select-capture",
            payloadBindings: { captureId: "item.id" },
          },
        },
      ],
    },
  ],
};
```

---

## 4. State Shape Definition

Plugins define their state shape as plain TypeScript interfaces:

```typescript
// packages/uilint-vision/src/plugin/state.ts

import type { StateDefinition, ActionDefinition } from "uilint-core/plugin";

/**
 * Vision plugin state shape
 */
export interface VisionState {
  // Availability
  visionAvailable: boolean;
  visionModel: string | null;

  // Analysis state
  visionAnalyzing: boolean;
  visionProgressPhase: string | null;

  // Capture state
  captureMode: "full" | "region";
  regionSelectionActive: boolean;
  selectedRegion: { x: number; y: number; width: number; height: number } | null;

  // Results
  screenshotHistory: Map<string, ScreenshotCapture>;
  visionIssuesCache: Map<string, VisionIssue[]>;

  // Error state
  lastError: VisionErrorInfo | null;

  // Settings
  autoScanSettings: VisionAutoScanSettings;
}

/**
 * Initial state
 */
export const visionInitialState: VisionState = {
  visionAvailable: false,
  visionModel: null,
  visionAnalyzing: false,
  visionProgressPhase: null,
  captureMode: "full",
  regionSelectionActive: false,
  selectedRegion: null,
  screenshotHistory: new Map(),
  visionIssuesCache: new Map(),
  lastError: null,
  autoScanSettings: { onRouteChange: false, onInitialLoad: false },
};

/**
 * State definition for the plugin system
 */
export const visionStateDefinition: StateDefinition<VisionState> = {
  initialState: visionInitialState,

  // Computed values (derived from state)
  computed: {
    hasScreenshots: (state) => state.screenshotHistory.size > 0,
    totalIssues: (state) => {
      let count = 0;
      for (const issues of state.visionIssuesCache.values()) {
        count += issues.length;
      }
      return count;
    },
  },

  // Persistence configuration
  persist: {
    key: "uilint-vision",
    include: ["autoScanSettings"],
  },
};
```

---

## 5. Action Handlers

Plugins define action handlers as plain functions:

```typescript
// packages/uilint-vision/src/plugin/actions.ts

import type { ActionHandlers, PluginContext } from "uilint-core/plugin";
import type { VisionState } from "./state";

/**
 * Action handlers for the vision plugin
 *
 * These are plain functions - no React.
 * The context provides access to state, websocket, etc.
 */
export const visionActionHandlers: ActionHandlers<VisionState> = {
  /**
   * Set vision availability status
   */
  "set-vision-available": (ctx, payload: { available: boolean; model?: string }) => {
    ctx.setState({
      visionAvailable: payload.available,
      visionModel: payload.model ?? null,
    });
  },

  /**
   * Trigger full page capture and analysis
   */
  "capture-full-page": async (ctx) => {
    ctx.setState({
      captureMode: "full",
      regionSelectionActive: false,
      selectedRegion: null,
    });
    await ctx.dispatch("trigger-vision-analysis");
  },

  /**
   * Enter region selection mode
   */
  "enter-region-selection": (ctx) => {
    ctx.setState({
      captureMode: "region",
      regionSelectionActive: true,
      selectedRegion: null,
    });
  },

  /**
   * Trigger vision analysis
   * This is called from the browser context
   */
  "trigger-vision-analysis": async (ctx) => {
    const state = ctx.getState();

    if (!state.visionAvailable) {
      ctx.setState({
        lastError: {
          stage: "vision",
          message: "Vision analysis not available. Check Ollama connection.",
          route: ctx.getCurrentRoute(),
          timestamp: Date.now(),
        },
      });
      return;
    }

    ctx.setState({ visionAnalyzing: true, visionProgressPhase: "capture" });

    try {
      // Request capture from browser context
      // This will be handled by uilint-react's browser integration
      const result = await ctx.requestBrowserAction("capture-screenshot", {
        mode: state.captureMode,
        region: state.selectedRegion,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to capture screenshot");
      }

      ctx.setState({ visionProgressPhase: "manifest" });

      // Request manifest collection
      const manifest = await ctx.requestBrowserAction("collect-manifest", {
        region: state.selectedRegion,
      });

      ctx.setState({ visionProgressPhase: "analyzing" });

      // Send to server for analysis
      ctx.websocket.send({
        type: "vision:analyze",
        route: ctx.getCurrentRoute(),
        timestamp: Date.now(),
        screenshot: result.dataUrl,
        manifest: manifest.elements,
      });

    } catch (error) {
      ctx.setState({
        visionAnalyzing: false,
        visionProgressPhase: null,
        lastError: {
          stage: "capture",
          message: error instanceof Error ? error.message : "Unknown error",
          route: ctx.getCurrentRoute(),
          timestamp: Date.now(),
        },
      });
    }
  },

  /**
   * Handle vision analysis result from server
   */
  "handle-vision-result": (ctx, payload: { route: string; issues: VisionIssue[]; error?: string }) => {
    if (payload.error) {
      ctx.setState({
        visionAnalyzing: false,
        visionProgressPhase: null,
        lastError: {
          stage: "vision",
          message: payload.error,
          route: payload.route,
          timestamp: Date.now(),
        },
      });
      return;
    }

    const state = ctx.getState();
    const newCache = new Map(state.visionIssuesCache);
    newCache.set(payload.route, payload.issues);

    ctx.setState({
      visionAnalyzing: false,
      visionProgressPhase: null,
      visionIssuesCache: newCache,
      lastError: null,
    });
  },

  /**
   * Clear all screenshots
   */
  "clear-screenshots": (ctx) => {
    ctx.setState({
      screenshotHistory: new Map(),
      visionIssuesCache: new Map(),
    });
  },

  /**
   * Navigate to source location
   */
  "navigate-to-source": (ctx, payload: { dataLoc: string }) => {
    ctx.openInEditor(payload.dataLoc);
  },

  /**
   * Focus element in heatmap
   */
  "focus-heatmap": (ctx, payload: { dataLoc: string }) => {
    ctx.setHeatmapFilter([payload.dataLoc], "Vision Issue");
  },
};
```

---

## 6. Command Definitions

```typescript
// packages/uilint-vision/src/plugin/commands.ts

import type { CommandDefinition } from "uilint-core/plugin";

export const visionCommands: CommandDefinition[] = [
  {
    id: "vision:capture-full-page",
    title: "Capture Full Page",
    keywords: ["vision", "screenshot", "capture", "full", "page", "analyze"],
    category: "Vision",
    subtitle: "Capture and analyze the entire visible page",
    icon: "camera",
    shortcut: "Cmd+Shift+C",
    action: { type: "capture-full-page" },
    isAvailable: { binding: "visionAvailable" },
  },
  {
    id: "vision:capture-region",
    title: "Capture Region",
    keywords: ["vision", "screenshot", "capture", "region", "area", "select"],
    category: "Vision",
    subtitle: "Select a region of the page to capture and analyze",
    icon: "crop",
    shortcut: "Cmd+Shift+R",
    action: { type: "enter-region-selection" },
    isAvailable: { binding: "visionAvailable" },
  },
  {
    id: "vision:clear-screenshots",
    title: "Clear Screenshots",
    keywords: ["vision", "clear", "delete", "screenshots", "history"],
    category: "Vision",
    subtitle: "Clear all captured screenshots",
    icon: "trash",
    action: { type: "clear-screenshots" },
    isAvailable: { expression: "screenshotHistory.size > 0" },
  },
];
```

---

## 7. Toolbar Definitions

```typescript
// packages/uilint-vision/src/plugin/toolbar.ts

import type { ToolbarGroupDefinition } from "uilint-core/plugin";

export const visionToolbarGroup: ToolbarGroupDefinition = {
  id: "vision:capture",
  icon: "camera",
  tooltip: "Vision Capture",
  priority: 100,
  isVisible: { binding: "visionAvailable" },

  actions: [
    {
      id: "vision:capture-full",
      icon: "camera",
      tooltip: "Capture Full Page (⌘⇧C)",
      action: { type: "capture-full-page" },
    },
    {
      id: "vision:capture-region",
      icon: "crop",
      tooltip: "Capture Region (⌘⇧R)",
      action: { type: "enter-region-selection" },
    },
  ],
};
```

---

## 8. WebSocket Message Handlers

```typescript
// packages/uilint-vision/src/plugin/messages.ts

import type { MessageHandlers } from "uilint-core/plugin";
import type { VisionState } from "./state";

export const visionMessageHandlers: MessageHandlers<VisionState> = {
  "vision:status": (ctx, message: { available: boolean; model?: string }) => {
    ctx.dispatch("set-vision-available", {
      available: message.available,
      model: message.model,
    });
  },

  "vision:progress": (ctx, message: { phase: string }) => {
    ctx.setState({ visionProgressPhase: message.phase });
  },

  "vision:result": (ctx, message: { route: string; issues: unknown[]; error?: string }) => {
    ctx.dispatch("handle-vision-result", message);
  },
};
```

---

## 9. Complete Plugin Export

```typescript
// packages/uilint-vision/src/plugin/index.ts

import type { PluginDefinition } from "uilint-core/plugin";
import { visionStateDefinition, type VisionState } from "./state";
import { visionActionHandlers } from "./actions";
import { visionCommands } from "./commands";
import { visionToolbarGroup } from "./toolbar";
import { visionMessageHandlers } from "./messages";
import { visionIssuePanelDefinition, screenshotGalleryPanelDefinition } from "./panels";
import { semanticVisionRuleDefinition } from "./rules";

export const visionPluginDefinition: PluginDefinition<VisionState> = {
  // Metadata
  id: "vision",
  name: "Vision Analysis",
  version: "1.0.0",
  description: "AI-powered visual UI consistency checking",
  icon: "eye",

  // State management
  state: visionStateDefinition,
  actions: visionActionHandlers,

  // UI contributions (declarative)
  commands: visionCommands,
  toolbarGroups: [visionToolbarGroup],
  panels: [visionIssuePanelDefinition, screenshotGalleryPanelDefinition],

  // Rule handling
  rules: [semanticVisionRuleDefinition],
  handlesRuleCategories: ["vision"],

  // WebSocket integration
  messageHandlers: visionMessageHandlers,

  // Issue aggregation (plain function)
  getIssues: (state) => {
    const issues = new Map<string, PluginIssue[]>();
    for (const [route, visionIssues] of state.visionIssuesCache) {
      for (const issue of visionIssues) {
        if (issue.dataLoc) {
          const existing = issues.get(issue.dataLoc) || [];
          issues.set(issue.dataLoc, [...existing, {
            id: `vision:${route}:${issue.elementText}`,
            message: issue.message,
            severity: issue.severity,
            ruleId: "semantic-vision",
            category: issue.category,
          }]);
        }
      }
    }
    return { pluginId: "vision", issues };
  },

  // Browser actions this plugin needs
  browserActions: ["capture-screenshot", "collect-manifest"],
};
```

---

## 10. How uilint-react Interprets the Schema

```typescript
// packages/uilint-react/src/core/schema-renderer/PanelRenderer.tsx

import type { PanelDefinition, PanelSection } from "uilint-core/plugin";
import { CodeViewer } from "./components/CodeViewer";
import { CodeComparison } from "./components/CodeComparison";
import { Badge } from "./components/Badge";
import { ActionBar } from "./components/ActionBar";
// ... etc

const SECTION_COMPONENTS: Record<string, ComponentType<SectionProps>> = {
  "header": HeaderSection,
  "code-viewer": CodeViewerSection,
  "code-comparison": CodeComparisonSection,
  "badge": BadgeSection,
  "text": TextSection,
  "actions": ActionsSection,
  "divider": DividerSection,
  "conditional": ConditionalSection,
  "list": ListSection,
  "card": CardSection,
  "image": ImageSection,
};

export function PanelRenderer({
  definition,
  data,
  pluginContext
}: {
  definition: PanelDefinition;
  data: Record<string, unknown>;
  pluginContext: PluginContext;
}) {
  // Resolve bindings to actual values
  const resolveBinding = useCallback((binding: string) => {
    return get(data, binding);
  }, [data]);

  // Check loading state
  if (definition.loading && resolveBinding(definition.loading.when.binding)) {
    return <LoadingState config={definition.loading} />;
  }

  // Check empty state
  if (definition.empty && resolveBinding(definition.empty.when.binding)) {
    return <EmptyState config={definition.empty} />;
  }

  // Render sections
  return (
    <div className="panel-container">
      {definition.layout.map((section, index) => (
        <SectionRenderer
          key={index}
          section={section}
          data={data}
          resolveBinding={resolveBinding}
          pluginContext={pluginContext}
        />
      ))}
    </div>
  );
}

function SectionRenderer({ section, data, resolveBinding, pluginContext }: SectionRendererProps) {
  const Component = SECTION_COMPONENTS[section.type];

  if (!Component) {
    console.warn(`Unknown section type: ${section.type}`);
    return null;
  }

  return (
    <Component
      config={section}
      data={data}
      resolveBinding={resolveBinding}
      pluginContext={pluginContext}
    />
  );
}
```

---

## 11. Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **No React in analysis packages** | Vision and semantic packages are pure TypeScript |
| **Framework agnostic** | Could create Vue/Svelte renderers for the same schemas |
| **Testable** | Panel schemas can be validated without React |
| **Type safe** | Full TypeScript support for schema definitions |
| **Declarative** | UI is described, not implemented |
| **Extensible** | Add new section types in uilint-react as needed |
| **Consistent** | All panels follow same patterns |

---

## 12. Migration Strategy

1. **Phase 1**: Create plugin schema types in `uilint-core/src/plugin/`
2. **Phase 2**: Build schema renderer in `uilint-react`
3. **Phase 3**: Convert vision plugin to schema-based
4. **Phase 4**: Convert semantic plugin to schema-based
5. **Phase 5**: Move all vision code to `uilint-vision` package
6. **Phase 6**: Move all semantic code to `uilint-semantic` package
