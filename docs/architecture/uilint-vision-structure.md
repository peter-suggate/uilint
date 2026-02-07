# uilint-vision Package Structure

This document shows the complete structure for a consolidated `uilint-vision` package that contains ALL vision-related code except React components.

## Package Structure

```
packages/uilint-vision/
├── package.json
├── tsconfig.json
├── tsup.config.ts
│
├── src/
│   ├── index.ts                    # Browser-safe exports
│   ├── node.ts                     # Node.js exports (includes analyzer)
│   │
│   ├── types.ts                    # All vision types
│   │
│   ├── analyzer/                   # Node.js only (server-side)
│   │   ├── index.ts
│   │   ├── vision-analyzer.ts      # Core analyzer (Ollama integration)
│   │   ├── prompts.ts              # Prompt building
│   │   ├── runner.ts               # CLI runner utilities
│   │   └── report.ts               # Markdown report generation
│   │
│   ├── browser/                    # Browser-only (imported by uilint-react)
│   │   ├── index.ts
│   │   ├── capture.ts              # Screenshot capture logic
│   │   ├── manifest.ts             # Element manifest collection
│   │   └── region-selector.ts      # Region selection logic (no React)
│   │
│   ├── plugin/                     # Plugin definition (no React)
│   │   ├── index.ts                # Main plugin export
│   │   ├── state.ts                # State shape + initial state
│   │   ├── actions.ts              # Action handlers
│   │   ├── commands.ts             # Command definitions
│   │   ├── toolbar.ts              # Toolbar definitions
│   │   ├── panels.ts               # Panel definitions (declarative)
│   │   ├── rules.ts                # Rule definitions
│   │   └── messages.ts             # WebSocket message handlers
│   │
│   └── utils/                      # Shared utilities
│       ├── index.ts
│       ├── issue-matcher.ts        # Match issues to manifest elements
│       └── data-loc.ts             # data-loc parsing utilities
│
└── __tests__/
    ├── analyzer.test.ts
    ├── manifest.test.ts
    └── plugin.test.ts
```

## File Contents

### package.json

```json
{
  "name": "uilint-vision",
  "version": "0.2.0",
  "description": "Vision-based UI consistency analysis for UILint",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js"
    },
    "./browser": {
      "types": "./dist/browser/index.d.ts",
      "import": "./dist/browser/index.js"
    },
    "./plugin": {
      "types": "./dist/plugin/index.d.ts",
      "import": "./dist/plugin/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "html-to-image": "^1.11.13"
  },
  "peerDependencies": {
    "uilint-core": "workspace:*"
  },
  "optionalDependencies": {
    "ollama": "^0.6.3"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsup": "^8.0.0",
    "vitest": "^2.0.0"
  }
}
```

### src/index.ts (Browser-safe exports)

```typescript
/**
 * uilint-vision - Browser-safe exports
 *
 * This entry point is safe to import in browser contexts.
 * Does NOT include the VisionAnalyzer (which requires Ollama/Node.js).
 */

// Types
export * from "./types";

// Plugin definition (declarative, no React)
export { visionPlugin } from "./plugin";
export type { VisionState } from "./plugin/state";

// Browser utilities
export { collectElementManifest } from "./browser/manifest";
export { captureScreenshot, captureRegion } from "./browser/capture";

// Shared utilities
export { matchIssuesToManifest } from "./utils/issue-matcher";
export { parseDataLoc, formatDataLoc } from "./utils/data-loc";

// Constants
export { VISION_DEFAULT_MODEL, VISION_ISSUE_CATEGORIES } from "./constants";
```

### src/node.ts (Node.js exports)

```typescript
/**
 * uilint-vision/node - Node.js exports
 *
 * Includes VisionAnalyzer which requires Ollama.
 * Import this for server-side analysis.
 */

// Re-export everything from browser-safe entry
export * from "./index";

// Node.js only exports
export {
  VisionAnalyzer,
  getVisionAnalyzer,
  type VisionAnalyzerOptions,
} from "./analyzer/vision-analyzer";

export {
  runVisionAnalysis,
  type RunVisionOptions,
} from "./analyzer/runner";

export {
  buildVisionPrompt,
  buildStyleGuideContext,
} from "./analyzer/prompts";

export {
  writeVisionMarkdownReport,
} from "./analyzer/report";
```

### src/types.ts

```typescript
/**
 * Vision Plugin Types
 * All types for vision-based UI consistency analysis.
 */

/**
 * Vision issue categories
 */
export type VisionIssueCategory =
  | "spacing"
  | "alignment"
  | "color"
  | "typography"
  | "layout"
  | "contrast"
  | "visual-hierarchy"
  | "other";

/**
 * Issue severity levels
 */
export type VisionIssueSeverity = "error" | "warning" | "info";

/**
 * Vision analysis issue from the LLM
 */
export interface VisionIssue {
  /** Text of the element this issue refers to */
  elementText: string;
  /** Issue description */
  message: string;
  /** Issue category */
  category: VisionIssueCategory;
  /** Severity level */
  severity: VisionIssueSeverity;
  /** Matched dataLoc from manifest (filled in after text matching) */
  dataLoc?: string;
  /** Matched element ID (filled in after text matching) */
  elementId?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Element manifest entry for vision analysis
 */
export interface ElementManifest {
  /** Unique ID (data-loc if present, otherwise generated) */
  id: string;
  /** Visible text content (truncated to 100 chars) */
  text: string;
  /** data-loc value: "path:line:column" */
  dataLoc: string;
  /** Bounding rectangle */
  rect: { x: number; y: number; width: number; height: number };
  /** HTML tag name */
  tagName: string;
  /** Inferred semantic role (button, heading, link, etc.) */
  role?: string;
  /** Total instances with same dataLoc (if deduplicated) */
  instanceCount?: number;
}

/**
 * Screenshot capture entry
 */
export interface ScreenshotCapture {
  /** Unique ID for this capture */
  id: string;
  /** Route where the capture was taken */
  route: string;
  /** Base64 data URL of the screenshot */
  dataUrl?: string;
  /** Filename for persisted screenshots */
  filename?: string;
  /** Unix timestamp when captured */
  timestamp: number;
  /** Type of capture */
  type: "full" | "region";
  /** Region bounds if type is 'region' */
  region?: CaptureRegion;
  /** Whether this is persisted to disk */
  persisted?: boolean;
  /** Vision issues for this capture */
  issues?: VisionIssue[];
}

/**
 * Region bounds for partial capture
 */
export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Capture mode
 */
export type CaptureMode = "full" | "region";

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  /** Route/path that was analyzed */
  route: string;
  /** Timestamp of capture */
  timestamp: number;
  /** Screenshot as base64 data URL */
  screenshotDataUrl?: string;
  /** Element manifest */
  manifest: ElementManifest[];
  /** Issues found by vision analysis */
  issues: VisionIssue[];
  /** Analysis duration in ms */
  analysisTime: number;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Auto-scan settings
 */
export interface VisionAutoScanSettings {
  /** Auto-capture on route change */
  onRouteChange: boolean;
  /** Auto-capture on initial page load */
  onInitialLoad: boolean;
}

/**
 * Vision pipeline stage (for error tracking)
 */
export type VisionStage = "capture" | "manifest" | "ws" | "vision";

/**
 * Vision error information
 */
export interface VisionErrorInfo {
  stage: VisionStage;
  message: string;
  route: string;
  timestamp: number;
}

// WebSocket message types

export interface VisionAnalyzeMessage {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot: string;
  manifest: ElementManifest[];
  requestId?: string;
}

export interface VisionResultMessage {
  type: "vision:result";
  route: string;
  issues: VisionIssue[];
  analysisTime: number;
  error?: string;
  requestId?: string;
}

export interface VisionProgressMessage {
  type: "vision:progress";
  route: string;
  phase: string;
  requestId?: string;
}

export interface VisionStatusMessage {
  type: "vision:status";
  available: boolean;
  model?: string;
  requestId?: string;
}
```

### src/plugin/state.ts

```typescript
/**
 * Vision Plugin State
 */

import type { StateDefinition } from "uilint-core/plugin";
import type {
  ScreenshotCapture,
  VisionIssue,
  VisionAutoScanSettings,
  VisionErrorInfo,
  CaptureMode,
  CaptureRegion,
} from "../types";

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
  captureMode: CaptureMode;
  regionSelectionActive: boolean;
  selectedRegion: CaptureRegion | null;

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
  autoScanSettings: {
    onRouteChange: false,
    onInitialLoad: false,
  },
};

/**
 * State definition for plugin system
 */
export const visionStateDefinition: StateDefinition<VisionState> = {
  initialState: visionInitialState,

  computed: {
    hasScreenshots: (state) => state.screenshotHistory.size > 0,
    totalIssues: (state) => {
      let count = 0;
      for (const issues of state.visionIssuesCache.values()) {
        count += issues.length;
      }
      return count;
    },
    isCapturing: (state) =>
      state.visionAnalyzing && state.visionProgressPhase === "capture",
  },

  persist: {
    key: "uilint-vision",
    include: ["autoScanSettings"],
  },
};
```

### src/plugin/panels.ts

```typescript
/**
 * Vision Plugin Panel Definitions
 * Declarative UI configuration - NO REACT
 */

import type { PanelDefinition } from "uilint-core/plugin";

/**
 * Vision issue inspector panel
 */
export const visionIssuePanelDefinition: PanelDefinition = {
  id: "vision-issue",
  title: { binding: "issue.category" },
  priority: 10,

  empty: {
    when: { expression: "!issue" },
    message: "No vision issue selected.",
    icon: "eye",
  },

  layout: [
    // Header with message
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
      actions: [],
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

    // Screenshot thumbnail with highlighted region
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

    { type: "divider", spacing: "medium" },

    // Actions
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "show-in-heatmap",
          label: "Focus in Heatmap",
          icon: "filter",
          variant: "secondary",
          action: {
            type: "focus-heatmap",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
          visible: { binding: "issue.dataLoc" },
        },
        {
          id: "open-in-editor",
          label: "Open in Editor",
          icon: "external-link",
          variant: "ghost",
          action: {
            type: "open-editor",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
          visible: { binding: "issue.dataLoc" },
        },
      ],
    },
  ],
};

/**
 * Screenshot gallery panel
 */
export const screenshotGalleryPanelDefinition: PanelDefinition = {
  id: "vision-gallery",
  title: "Screenshots",
  priority: 5,

  empty: {
    when: { expression: "screenshots.length === 0" },
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

/**
 * All vision panel definitions
 */
export const visionPanelDefinitions: PanelDefinition[] = [
  visionIssuePanelDefinition,
  screenshotGalleryPanelDefinition,
];
```

### src/plugin/index.ts (Main plugin export)

```typescript
/**
 * Vision Plugin Definition
 * Complete plugin export - NO REACT
 */

import type { PluginDefinition, PluginIssue } from "uilint-core/plugin";
import { visionStateDefinition, type VisionState } from "./state";
import { visionActionHandlers } from "./actions";
import { visionCommands } from "./commands";
import { visionToolbarGroups } from "./toolbar";
import { visionPanelDefinitions } from "./panels";
import { visionRuleDefinitions } from "./rules";
import { visionMessageHandlers } from "./messages";

/**
 * Vision plugin definition
 *
 * This is the main export from uilint-vision.
 * Contains everything needed for the vision feature EXCEPT React components.
 * uilint-react imports this and renders the appropriate UI.
 */
export const visionPlugin: PluginDefinition<VisionState> = {
  // Metadata
  id: "vision",
  name: "Vision Analysis",
  version: "1.0.0",
  description: "AI-powered visual UI consistency checking",
  icon: "eye",

  // State management
  state: visionStateDefinition,
  actions: visionActionHandlers,

  // UI contributions (declarative - no React)
  commands: visionCommands,
  toolbarGroups: visionToolbarGroups,
  panels: visionPanelDefinitions,

  // Rules
  rules: visionRuleDefinitions,
  handlesRuleCategories: ["vision"],

  // WebSocket
  messageHandlers: visionMessageHandlers,

  // Issue aggregation
  getIssues: (state: VisionState) => {
    const issues = new Map<string, PluginIssue[]>();

    for (const [route, visionIssues] of state.visionIssuesCache) {
      for (const issue of visionIssues) {
        if (issue.dataLoc) {
          const existing = issues.get(issue.dataLoc) || [];
          issues.set(issue.dataLoc, [
            ...existing,
            {
              id: `vision:${route}:${issue.elementText}:${Date.now()}`,
              message: issue.message,
              severity: issue.severity,
              ruleId: "semantic-vision",
              category: issue.category,
              data: { route, elementText: issue.elementText },
            },
          ]);
        }
      }
    }

    return { pluginId: "vision", issues };
  },

  // Browser actions this plugin needs
  browserActions: ["capture-screenshot", "collect-manifest"],

  // Lifecycle
  onLoad: (ctx) => {
    // Check vision availability on load
    if (ctx.websocket.isConnected) {
      ctx.websocket.send({ type: "vision:check" });
    }
  },
};

export default visionPlugin;
```

## How uilint-react Consumes This

```typescript
// packages/uilint-react/src/core/plugin-loader.ts

import { visionPlugin } from "uilint-vision/plugin";
import { semanticPlugin } from "uilint-semantic/plugin";
import { PanelRenderer } from "./schema-renderer/PanelRenderer";
import { CommandRunner } from "./schema-renderer/CommandRunner";

// Load plugins
const plugins = [visionPlugin, semanticPlugin];

for (const plugin of plugins) {
  // Register state
  registerPluginState(plugin.id, plugin.state);

  // Register action handlers
  registerActionHandlers(plugin.id, plugin.actions);

  // Register WebSocket handlers
  if (plugin.messageHandlers) {
    for (const [type, handler] of Object.entries(plugin.messageHandlers)) {
      websocket.on(type, (msg) => handler(getPluginContext(plugin.id), msg));
    }
  }

  // Register commands (rendered by CommandPalette)
  if (plugin.commands) {
    registerCommands(plugin.id, plugin.commands);
  }

  // Register panels (rendered by Inspector)
  if (plugin.panels) {
    for (const panel of plugin.panels) {
      registerPanel(panel.id, (data) => (
        <PanelRenderer
          definition={panel}
          data={data}
          pluginContext={getPluginContext(plugin.id)}
        />
      ));
    }
  }

  // Register toolbar groups
  if (plugin.toolbarGroups) {
    registerToolbarGroups(plugin.id, plugin.toolbarGroups);
  }
}
```

## Key Points

1. **No React imports** - The entire `uilint-vision` package has zero React dependencies
2. **Declarative UI** - Panels, commands, toolbar are all defined as data structures
3. **Framework agnostic** - Could theoretically render to Vue, Svelte, or any other framework
4. **Testable** - Plugin logic can be unit tested without React
5. **Type safe** - Full TypeScript support for all configurations
6. **Browser actions** - Capture logic is in `browser/` but uses DOM APIs, not React
