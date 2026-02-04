/**
 * Core UI State Slice
 *
 * Contains ONLY core UI state that doesn't belong to any plugin.
 * Uses Zustand's StateCreator pattern for composable slices.
 */

import type { StateCreator } from "zustand";
import { devWarn } from "uilint-core";
import type {
  PluginServices,
  TileItem,
  ExpandedTile,
  ExpansionPath,
  ExpansionLevel,
} from "../plugin-system/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Breakpoints for responsive design.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

/**
 * Mobile/viewport detection state.
 */
export interface MobileState {
  /** Viewport width < 768px */
  isMobile: boolean;
  /** Viewport width >= 768px and < 1024px */
  isTablet: boolean;
  /** Device has touch capability */
  isTouchDevice: boolean;
  /** Viewport width < 640px */
  isSmallScreen: boolean;
}

/**
 * Connection status for onboarding UI.
 * Tracks the connection state and provides details for user feedback.
 */
export interface ConnectionStatus {
  /** Operating mode: websocket (live) or static (manifest-based) */
  mode: "websocket" | "static";
  /** Current reconnection attempt number (websocket mode) */
  reconnectAttempts: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: number;
  /** Whether max reconnect attempts have been exhausted */
  reconnectExhausted: boolean;
  /** Error message if connection/manifest failed */
  error: string | null;
}

/**
 * Filter chip for the command palette search.
 * @deprecated Use TileFilter from plugin-system/types instead
 */
export interface CommandPaletteFilter {
  type: "rule" | "issue" | "loc" | "file" | "capture" | "plugin";
  value: string;
  label: string;
}

/**
 * Command palette state.
 */
export interface CommandPaletteState {
  /** Whether the command palette is open */
  open: boolean;
  /** Current search query */
  query: string;
  /** Currently selected index for keyboard navigation */
  selectedIndex: number;
  /**
   * Expansion path for the expandable tile UI.
   * Stack of expanded tiles representing the current drill-down state.
   * Empty array = root view (no expansion).
   */
  expansionPath: ExpansionPath;
}

/**
 * Inspector sidebar state.
 */
export interface InspectorState {
  /** Whether the inspector is open */
  open: boolean;
  /** Which plugin panel is currently shown (null if none) - DEPRECATED: use unified view */
  panelId: string | null;
  /** Data passed to the panel - DEPRECATED: use unified view */
  data: Record<string, unknown> | null;
  /** Whether inspector is docked (participates in layout) or floating */
  docked: boolean;
  /** Width when docked (resizable) */
  width: number;
  /** Position when floating */
  floatingPosition: { x: number; y: number } | null;
  /** Size when floating */
  floatingSize: { width: number; height: number } | null;
  /** Computed available width for tile grid layout (derived from width/floatingSize) */
  layoutAvailableWidth: number;
  /** File paths that are expanded in the issues list */
  expandedFiles: string[];
  /** Expanded rule ID (level 0) */
  expandedRuleId: string | null;
  /** Expanded file path within the rule (level 1) */
  expandedFilePath: string | null;
  /** Currently selected issue ID (for heatmap highlight sync) */
  selectedIssueId: string | null;
  /** Whether the rule config section is expanded */
  ruleConfigExpanded: boolean;
  /** Whether to show full source view (false = show issue summary view) */
  showFullSource: boolean;
}

/**
 * Heat map filter state for focusing on related elements.
 * Used when inspecting issues that reference multiple locations (e.g., duplicates).
 */
export interface HeatmapFilterState {
  /**
   * Filter mode:
   * - "all": Show all elements with issues (default)
   * - "related-only": Only show elements in highlightedLocs
   */
  mode: "all" | "related-only";
  /**
   * dataLoc values to highlight when mode is "related-only".
   * Empty array = show all elements.
   */
  highlightedLocs: string[];
  /**
   * Optional label describing the filter (e.g., "Duplicate Pair")
   */
  filterLabel: string | null;
}

// ============================================================================
// Slice Interface
// ============================================================================

/**
 * Core UI state slice interface.
 * Contains state and actions for core UI functionality.
 */
export interface CoreSlice {
  // ============ Alt Key Mode ============
  /** Whether the Alt key is currently held */
  altKeyHeld: boolean;
  /** Set Alt key held state */
  setAltKeyHeld: (held: boolean) => void;

  // ============ Selection ============
  /** Currently selected element ID */
  selectedElementId: string | null;
  /** Currently hovered element ID (for overlay highlighting) */
  hoveredElementId: string | null;
  /** Set selected element ID */
  setSelectedElementId: (id: string | null) => void;
  /** Set hovered element ID */
  setHoveredElementId: (id: string | null) => void;

  // ============ Command Palette ============
  /** Command palette state */
  commandPalette: CommandPaletteState;
  /** Open the command palette */
  openCommandPalette: () => void;
  /** Close the command palette */
  closeCommandPalette: () => void;
  /** Set the command palette search query */
  setCommandPaletteQuery: (query: string) => void;
  /** Set the selected index for keyboard navigation */
  setCommandPaletteSelectedIndex: (index: number) => void;

  // ============ Tile Expansion ============
  /**
   * Expand a tile, showing its children inside it.
   * Pushes the tile onto the expansion path stack.
   * @param tile The tile item to expand
   * @param children The children to show inside the expanded tile
   * @param siblings Other tiles at the same level (for collapsed strip)
   * @param providerId The provider that owns this tile
   */
  expandTile: (
    tile: TileItem,
    children: TileItem[],
    siblings: TileItem[],
    providerId: string
  ) => void;
  /**
   * Collapse the most recently expanded tile.
   * Pops from the expansion path stack.
   */
  collapseTile: () => void;
  /**
   * Collapse to a specific level in the expansion path.
   * @param level The level to collapse to (0 = root)
   */
  collapseToLevel: (level: ExpansionLevel) => void;
  /**
   * Collapse all expanded tiles, returning to root view.
   */
  collapseAll: () => void;
  /**
   * Get the current expansion level.
   * @returns The current depth (0 = root, 1 = first expansion, etc.)
   */
  getCurrentExpansionLevel: () => ExpansionLevel;

  // ============ Inspector ============
  /** Inspector sidebar state */
  inspector: InspectorState;
  /** Open the inspector with a specific panel - DEPRECATED: use openInspectorPanel */
  openInspector: (panelId: string, data?: Record<string, unknown>) => void;
  /** Open the inspector (unified view) */
  openInspectorPanel: () => void;
  /** Close the inspector */
  closeInspector: () => void;
  /** Toggle between docked and floating mode */
  toggleInspectorDocked: () => void;
  /** Set inspector width (docked mode) */
  setInspectorWidth: (width: number) => void;
  /** Set inspector position (floating mode) */
  setInspectorFloatingPosition: (position: { x: number; y: number }) => void;
  /** Set inspector size (floating mode) */
  setInspectorFloatingSize: (size: { width: number; height: number }) => void;
  /** Toggle a file's expanded state in the issues list */
  toggleFileExpanded: (filePath: string) => void;
  /** Expand a specific file in the issues list */
  expandFile: (filePath: string) => void;
  /** Collapse a specific file in the issues list */
  collapseFile: (filePath: string) => void;
  /** Expand a rule tile (level 0) */
  expandRule: (ruleId: string) => void;
  /** Collapse the expanded rule */
  collapseRule: () => void;
  /** Expand a file within the expanded rule (level 1) */
  expandFileInRule: (filePath: string) => void;
  /** Collapse the expanded file, keeping rule expanded */
  collapseFileInRule: () => void;
  /** Collapse all (both rule and file) */
  collapseAllInspector: () => void;
  /** Select an issue (for heatmap highlight sync) */
  selectIssue: (issueId: string | null) => void;
  /** Toggle the rule config section */
  toggleRuleConfig: () => void;
  /** Show the full source view */
  showFullSourceView: () => void;
  /** Show the issue summary view (hide full source) */
  showIssueSummaryView: () => void;

  // ============ Connection (delegated from websocket service) ============
  /** Whether connected to the WebSocket server */
  wsConnected: boolean;
  /** WebSocket server URL */
  wsUrl: string;
  /** Detailed connection status for onboarding UI */
  connectionStatus: ConnectionStatus;
  /** Update connection status (called by DevTool/websocket handlers) */
  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  /** Retry the connection (websocket mode only) */
  retryConnection: () => void;

  // ============ Heatmap Filtering ============
  /** Heat map filter state for focusing on related elements */
  heatmapFilter: HeatmapFilterState;
  /**
   * Set heatmap filter to highlight specific elements
   * @param locs dataLoc values to highlight
   * @param label Optional label describing the filter
   */
  setHeatmapFilter: (locs: string[], label?: string) => void;
  /** Clear heatmap filter (show all elements) */
  clearHeatmapFilter: () => void;

  // ============ Mobile/Viewport Detection ============
  /** Mobile detection state */
  mobile: MobileState;
  /** Update mobile state (called by subscriptions) */
  setMobileState: (state: MobileState) => void;
}

// ============================================================================
// localStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  inspectorDocked: "uilint:inspectorDocked",
  inspectorWidth: "uilint:inspectorWidth",
  inspectorFloatingPosition: "uilint:inspectorFloatingPosition",
  inspectorFloatingSize: "uilint:inspectorFloatingSize",
} as const;

// ============================================================================
// SSR-Safe Storage Helpers
// ============================================================================

/**
 * Check if we're in a browser environment.
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Safely get a value from localStorage with SSR support.
 */
function getStorageValue<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch (e) {
    devWarn(`[UILint] Failed to load ${key} from localStorage:`, e);
    return defaultValue;
  }
}

/**
 * Safely set a value in localStorage with SSR support.
 */
function setStorageValue<T>(key: string, value: T): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    devWarn(`[UILint] Failed to save ${key} to localStorage:`, e);
  }
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_COMMAND_PALETTE_STATE: CommandPaletteState = {
  open: false,
  query: "",
  selectedIndex: 0,
  expansionPath: [],
};

const DEFAULT_HEATMAP_FILTER_STATE: HeatmapFilterState = {
  mode: "all",
  highlightedLocs: [],
  filterLabel: null,
};

const DEFAULT_INSPECTOR_WIDTH = 400;
const DEFAULT_FLOATING_WIDTH = 450;
const LAYOUT_PADDING = 32; // Padding subtracted from sidebar width for layout
const _DEFAULT_WS_URL = "ws://localhost:9234";

/**
 * Compute the available width for tile grid layout.
 * Subtracts padding from the raw sidebar width.
 */
function computeLayoutAvailableWidth(
  docked: boolean,
  width: number,
  floatingSize: { width: number; height: number } | null
): number {
  const rawWidth = docked ? width : (floatingSize?.width ?? DEFAULT_FLOATING_WIDTH);
  return Math.max(0, rawWidth - LAYOUT_PADDING);
}

const DEFAULT_MOBILE_STATE: MobileState = {
  isMobile: false,
  isTablet: false,
  isTouchDevice: false,
  isSmallScreen: false,
};

const DEFAULT_CONNECTION_STATUS: ConnectionStatus = {
  mode: "websocket",
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectExhausted: false,
  error: null,
};

/**
 * Load initial inspector state from localStorage.
 */
function loadInitialInspectorState(): InspectorState {
  const docked = getStorageValue(STORAGE_KEYS.inspectorDocked, true);
  const width = getStorageValue(STORAGE_KEYS.inspectorWidth, DEFAULT_INSPECTOR_WIDTH);
  const floatingSize = getStorageValue<{ width: number; height: number } | null>(
    STORAGE_KEYS.inspectorFloatingSize,
    null
  );

  return {
    open: false,
    panelId: null,
    data: null,
    docked,
    width,
    floatingPosition: getStorageValue(STORAGE_KEYS.inspectorFloatingPosition, null),
    floatingSize,
    layoutAvailableWidth: computeLayoutAvailableWidth(docked, width, floatingSize),
    expandedFiles: [],
    expandedRuleId: null,
    expandedFilePath: null,
    selectedIssueId: null,
    ruleConfigExpanded: false,
    showFullSource: false,
  };
}

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Create the core UI state slice.
 *
 * @param services - Plugin services for accessing WebSocket and storage
 * @returns StateCreator for the core slice
 */
export const createCoreSlice = (
  services: PluginServices
): StateCreator<CoreSlice> => (set, get) => ({
  // ============ Alt Key Mode ============
  altKeyHeld: false,

  setAltKeyHeld: (held) => {
    set({ altKeyHeld: held });
  },

  // ============ Selection ============
  selectedElementId: null,
  hoveredElementId: null,

  setSelectedElementId: (id) => {
    set({ selectedElementId: id });
  },

  setHoveredElementId: (id) => {
    set({ hoveredElementId: id });
  },

  // ============ Command Palette ============
  commandPalette: { ...DEFAULT_COMMAND_PALETTE_STATE },

  openCommandPalette: () => {
    set({
      commandPalette: {
        ...get().commandPalette,
        open: true,
        query: "",
        selectedIndex: 0,
      },
    });
  },

  closeCommandPalette: () => {
    const current = get().commandPalette;
    set({
      commandPalette: {
        ...current,
        open: false,
        query: "",
        selectedIndex: 0,
      },
    });
  },

  setCommandPaletteQuery: (query) => {
    set({
      commandPalette: {
        ...get().commandPalette,
        query,
        selectedIndex: 0,
      },
    });
  },

  setCommandPaletteSelectedIndex: (index) => {
    set({
      commandPalette: {
        ...get().commandPalette,
        selectedIndex: index,
      },
    });
  },

  // ============ Tile Expansion ============
  expandTile: (tile, children, siblings, providerId) => {
    const current = get().commandPalette;
    const currentLevel = current.expansionPath.length as ExpansionLevel;

    // Cap at level 2 (rules -> files -> issues)
    if (currentLevel >= 2) {
      devWarn("[UILint] Cannot expand beyond level 2");
      return;
    }

    const expandedTile: ExpandedTile = {
      item: tile,
      providerId,
      level: currentLevel,
      children,
      siblings: siblings.filter((s) => s.id !== tile.id), // Exclude the expanded tile from siblings
    };

    set({
      commandPalette: {
        ...current,
        expansionPath: [...current.expansionPath, expandedTile],
        selectedIndex: 0, // Reset selection when expanding
        query: "", // Clear search when expanding
      },
    });
  },

  collapseTile: () => {
    const current = get().commandPalette;
    if (current.expansionPath.length === 0) return;

    set({
      commandPalette: {
        ...current,
        expansionPath: current.expansionPath.slice(0, -1),
        selectedIndex: 0,
        query: "",
      },
    });
  },

  collapseToLevel: (level) => {
    const current = get().commandPalette;
    if (level < 0 || level > 2) return;

    set({
      commandPalette: {
        ...current,
        expansionPath: current.expansionPath.slice(0, level),
        selectedIndex: 0,
        query: "",
      },
    });
  },

  collapseAll: () => {
    const current = get().commandPalette;
    if (current.expansionPath.length === 0) return;

    set({
      commandPalette: {
        ...current,
        expansionPath: [],
        selectedIndex: 0,
        query: "",
      },
    });
  },

  getCurrentExpansionLevel: () => {
    return get().commandPalette.expansionPath.length as ExpansionLevel;
  },

  // ============ Inspector ============
  inspector: loadInitialInspectorState(),

  openInspector: (panelId, data) => {
    set({
      inspector: {
        ...get().inspector,
        open: true,
        panelId,
        data: data ?? null,
      },
    });
  },

  openInspectorPanel: () => {
    set({
      inspector: {
        ...get().inspector,
        open: true,
      },
    });
  },

  closeInspector: () => {
    set({
      inspector: {
        ...get().inspector,
        open: false,
        panelId: null,
        data: null,
        selectedIssueId: null,
      },
    });
  },

  toggleInspectorDocked: () => {
    const current = get().inspector;
    const newDocked = !current.docked;
    setStorageValue(STORAGE_KEYS.inspectorDocked, newDocked);
    set({
      inspector: {
        ...current,
        docked: newDocked,
        layoutAvailableWidth: computeLayoutAvailableWidth(
          newDocked,
          current.width,
          current.floatingSize
        ),
      },
    });
  },

  setInspectorWidth: (width) => {
    const current = get().inspector;
    setStorageValue(STORAGE_KEYS.inspectorWidth, width);
    set({
      inspector: {
        ...current,
        width,
        layoutAvailableWidth: computeLayoutAvailableWidth(
          current.docked,
          width,
          current.floatingSize
        ),
      },
    });
  },

  setInspectorFloatingPosition: (position) => {
    setStorageValue(STORAGE_KEYS.inspectorFloatingPosition, position);
    set({
      inspector: {
        ...get().inspector,
        floatingPosition: position,
      },
    });
  },

  setInspectorFloatingSize: (size) => {
    const current = get().inspector;
    setStorageValue(STORAGE_KEYS.inspectorFloatingSize, size);
    set({
      inspector: {
        ...current,
        floatingSize: size,
        layoutAvailableWidth: computeLayoutAvailableWidth(
          current.docked,
          current.width,
          size
        ),
      },
    });
  },

  toggleFileExpanded: (filePath) => {
    const current = get().inspector;
    const isExpanded = current.expandedFiles.includes(filePath);
    set({
      inspector: {
        ...current,
        expandedFiles: isExpanded
          ? current.expandedFiles.filter((f) => f !== filePath)
          : [...current.expandedFiles, filePath],
      },
    });
  },

  expandFile: (filePath) => {
    const current = get().inspector;
    if (current.expandedFiles.includes(filePath)) return;
    set({
      inspector: {
        ...current,
        expandedFiles: [...current.expandedFiles, filePath],
      },
    });
  },

  collapseFile: (filePath) => {
    const current = get().inspector;
    set({
      inspector: {
        ...current,
        expandedFiles: current.expandedFiles.filter((f) => f !== filePath),
      },
    });
  },

  expandRule: (ruleId) => {
    const current = get().inspector;
    // Toggle: clicking the same rule collapses it
    if (current.expandedRuleId === ruleId) {
      set({
        inspector: {
          ...current,
          expandedRuleId: null,
          expandedFilePath: null,
        },
      });
    } else {
      set({
        inspector: {
          ...current,
          expandedRuleId: ruleId,
          expandedFilePath: null,
        },
      });
    }
  },

  collapseRule: () => {
    set({
      inspector: {
        ...get().inspector,
        expandedRuleId: null,
        expandedFilePath: null,
        showFullSource: false,
        selectedIssueId: null, // Clear selection to prevent auto-expand effect from re-expanding
      },
    });
  },

  expandFileInRule: (filePath) => {
    set({
      inspector: {
        ...get().inspector,
        expandedFilePath: filePath,
      },
    });
  },

  collapseFileInRule: () => {
    set({
      inspector: {
        ...get().inspector,
        expandedFilePath: null,
        showFullSource: false,
        selectedIssueId: null, // Clear selection to prevent auto-expand effect from re-expanding
      },
    });
  },

  collapseAllInspector: () => {
    set({
      inspector: {
        ...get().inspector,
        expandedRuleId: null,
        expandedFilePath: null,
        showFullSource: false,
        selectedIssueId: null, // Clear selection to prevent auto-expand effect from re-expanding
      },
    });
  },

  selectIssue: (issueId) => {
    set({
      inspector: {
        ...get().inspector,
        selectedIssueId: issueId,
      },
    });
  },

  toggleRuleConfig: () => {
    const current = get().inspector;
    set({
      inspector: {
        ...current,
        ruleConfigExpanded: !current.ruleConfigExpanded,
      },
    });
  },

  showFullSourceView: () => {
    set({
      inspector: {
        ...get().inspector,
        showFullSource: true,
      },
    });
  },

  showIssueSummaryView: () => {
    set({
      inspector: {
        ...get().inspector,
        showFullSource: false,
      },
    });
  },

  // ============ Connection (delegated from websocket service) ============
  wsConnected: services.websocket.isConnected,
  wsUrl: services.websocket.url,
  connectionStatus: { ...DEFAULT_CONNECTION_STATUS },

  setConnectionStatus: (status) => {
    const current = get().connectionStatus;
    set({
      connectionStatus: {
        ...current,
        ...status,
      },
    });
  },

  retryConnection: () => {
    const { connectionStatus } = get();
    if (connectionStatus.mode === "websocket") {
      // Reset reconnect state and trigger reconnection
      set({
        connectionStatus: {
          ...connectionStatus,
          reconnectAttempts: 0,
          reconnectExhausted: false,
          error: null,
        },
      });
      // Trigger websocket reconnection
      services.websocket.connect();
    }
  },

  // ============ Heatmap Filtering ============
  heatmapFilter: { ...DEFAULT_HEATMAP_FILTER_STATE },

  setHeatmapFilter: (locs, label) => {
    set({
      heatmapFilter: {
        mode: locs.length > 0 ? "related-only" : "all",
        highlightedLocs: locs,
        filterLabel: label ?? null,
      },
    });
  },

  clearHeatmapFilter: () => {
    set({
      heatmapFilter: { ...DEFAULT_HEATMAP_FILTER_STATE },
    });
  },

  // ============ Mobile/Viewport Detection ============
  mobile: { ...DEFAULT_MOBILE_STATE },

  setMobileState: (mobileState) => {
    set({ mobile: mobileState });
  },
});
