/**
 * Core UI State Slice
 *
 * Contains ONLY core UI state that doesn't belong to any plugin.
 * Uses Zustand's StateCreator pattern for composable slices.
 */

import type { StateCreator } from "zustand";
import type { PluginServices } from "../plugin-system/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Position of the floating icon in pixel coordinates.
 */
export interface FloatingIconPosition {
  x: number;
  y: number;
}

/**
 * Filter chip for the command palette search.
 * Allows filtering by rule, issue, loc (source location), file, capture, or plugin.
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
  /** Active filters (shown as chips) */
  filters: CommandPaletteFilter[];
}

/**
 * Inspector sidebar state.
 */
export interface InspectorState {
  /** Whether the inspector is open */
  open: boolean;
  /** Which plugin panel is currently shown (null if none) */
  panelId: string | null;
  /** Data passed to the panel */
  data: Record<string, unknown> | null;
  /** Whether inspector is docked (participates in layout) or floating */
  docked: boolean;
  /** Width when docked (resizable) */
  width: number;
  /** Position when floating */
  floatingPosition: { x: number; y: number } | null;
  /** Size when floating */
  floatingSize: { width: number; height: number } | null;
}

// ============================================================================
// Slice Interface
// ============================================================================

/**
 * Core UI state slice interface.
 * Contains state and actions for core UI functionality.
 */
export interface CoreSlice {
  // ============ Floating Icon ============
  /** Floating icon position (null = default top-center) */
  floatingIconPosition: FloatingIconPosition | null;
  /** Set floating icon position and persist to localStorage */
  setFloatingIconPosition: (position: FloatingIconPosition) => void;

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
  /** Add a filter to the command palette */
  addFilter: (filter: CommandPaletteFilter) => void;
  /** Remove a filter at the specified index */
  removeFilter: (index: number) => void;
  /** Clear all command palette filters */
  clearFilters: () => void;

  // ============ Inspector ============
  /** Inspector sidebar state */
  inspector: InspectorState;
  /** Open the inspector with a specific panel */
  openInspector: (panelId: string, data?: Record<string, unknown>) => void;
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

  // ============ Connection (delegated from websocket service) ============
  /** Whether connected to the WebSocket server */
  wsConnected: boolean;
  /** WebSocket server URL */
  wsUrl: string;
}

// ============================================================================
// localStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  floatingIconPosition: "uilint:floatingIconPosition",
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
    console.warn(`[UILint] Failed to load ${key} from localStorage:`, e);
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
    console.warn(`[UILint] Failed to save ${key} to localStorage:`, e);
  }
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_COMMAND_PALETTE_STATE: CommandPaletteState = {
  open: false,
  query: "",
  selectedIndex: 0,
  filters: [],
};

const DEFAULT_INSPECTOR_WIDTH = 400;
const _DEFAULT_WS_URL = "ws://localhost:9234";

/**
 * Load initial inspector state from localStorage.
 */
function loadInitialInspectorState(): InspectorState {
  return {
    open: false,
    panelId: null,
    data: null,
    docked: getStorageValue(STORAGE_KEYS.inspectorDocked, true),
    width: getStorageValue(STORAGE_KEYS.inspectorWidth, DEFAULT_INSPECTOR_WIDTH),
    floatingPosition: getStorageValue(STORAGE_KEYS.inspectorFloatingPosition, null),
    floatingSize: getStorageValue(STORAGE_KEYS.inspectorFloatingSize, null),
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
  // ============ Floating Icon ============
  floatingIconPosition: getStorageValue<FloatingIconPosition | null>(
    STORAGE_KEYS.floatingIconPosition,
    null
  ),

  setFloatingIconPosition: (position) => {
    setStorageValue(STORAGE_KEYS.floatingIconPosition, position);
    set({ floatingIconPosition: position });
  },

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
    set({
      commandPalette: {
        ...DEFAULT_COMMAND_PALETTE_STATE,
        open: false,
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

  addFilter: (filter) => {
    const current = get().commandPalette;
    set({
      commandPalette: {
        ...current,
        filters: [...current.filters, filter],
        selectedIndex: 0,
      },
    });
  },

  removeFilter: (index) => {
    const current = get().commandPalette;
    set({
      commandPalette: {
        ...current,
        filters: current.filters.filter((_, i) => i !== index),
        selectedIndex: 0,
      },
    });
  },

  clearFilters: () => {
    set({
      commandPalette: {
        ...get().commandPalette,
        filters: [],
        selectedIndex: 0,
      },
    });
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

  closeInspector: () => {
    set({
      inspector: {
        ...get().inspector,
        open: false,
        panelId: null,
        data: null,
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
      },
    });
  },

  setInspectorWidth: (width) => {
    setStorageValue(STORAGE_KEYS.inspectorWidth, width);
    set({
      inspector: {
        ...get().inspector,
        width,
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
    setStorageValue(STORAGE_KEYS.inspectorFloatingSize, size);
    set({
      inspector: {
        ...get().inspector,
        floatingSize: size,
      },
    });
  },

  // ============ Connection (delegated from websocket service) ============
  wsConnected: services.websocket.isConnected,
  wsUrl: services.websocket.url,
});
