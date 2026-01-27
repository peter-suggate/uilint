/**
 * FloatingIcon - Draggable glassmorphic command bar trigger
 * macOS Spotlight-inspired design with keyboard shortcut hint
 *
 * Two-row layout:
 * - Top row: grip handle + search area + toolbar action buttons
 * - Bottom row: subtle hint text (fades after first interaction)
 */
import React, { useRef, useCallback, useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../core/store";
import { pluginRegistry } from "../../core/plugin-system/registry";
import { getPluginServices } from "../../core/store/composed-store";
import { SearchIcon } from "../icons";
import { IconButton, getGlassStyles } from "./primitives";
import type { ToolbarAction } from "../../core/plugin-system/types";

interface Position {
  x: number;
  y: number;
}

/** Local UI state for the floating icon */
interface FloatingIconState {
  isDragging: boolean;
  isHovered: boolean;
  dragOffset: Position;
  hasInteracted: boolean;
}

type FloatingIconAction =
  | { type: "START_DRAG"; offset: Position }
  | { type: "STOP_DRAG" }
  | { type: "SET_HOVERED"; hovered: boolean }
  | { type: "SET_INTERACTED" };

const initialState: FloatingIconState = {
  isDragging: false,
  isHovered: false,
  dragOffset: { x: 0, y: 0 },
  hasInteracted: false,
};

function floatingIconReducer(
  state: FloatingIconState,
  action: FloatingIconAction
): FloatingIconState {
  switch (action.type) {
    case "START_DRAG":
      return { ...state, isDragging: true, dragOffset: action.offset };
    case "STOP_DRAG":
      return { ...state, isDragging: false };
    case "SET_HOVERED":
      return { ...state, isHovered: action.hovered };
    case "SET_INTERACTED":
      return { ...state, hasInteracted: true };
    default:
      return state;
  }
}

const PILL_WIDTH = 220;
const PILL_HEIGHT = 36;
const HINT_ROW_HEIGHT = 18;

/**
 * Build base glass styles for pill segments using CSS variables
 * Uses the getGlassStyles utility but customizes for the pill shape
 */
function getPillGlassStyles(
  isDragging: boolean,
  customStyle?: React.CSSProperties
): React.CSSProperties {
  const baseGlass = getGlassStyles("medium", isDragging ? "lg" : "md", false);
  return {
    ...baseGlass,
    borderTop: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
    borderBottom: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
    transition: isDragging ? "none" : "box-shadow 0.2s",
    ...customStyle,
  };
}

/** SSR-safe default position - centered horizontally at top */
function getDefaultPosition(): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 16 };
  }
  return { x: window.innerWidth / 2 - PILL_WIDTH / 2, y: 16 };
}

/** Detect macOS for showing correct modifier key symbol */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Individual toolbar action button component
 * Uses IconButton primitive with ghost variant for consistent styling
 */
interface ToolbarActionButtonProps {
  action: ToolbarAction;
  state: unknown;
  onExecute: () => void;
}

function ToolbarActionButton({ action, state, onExecute }: ToolbarActionButtonProps) {
  const isEnabled = action.isEnabled ? action.isEnabled(state) : true;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEnabled) {
        onExecute();
      }
    },
    [isEnabled, onExecute]
  );

  return (
    <IconButton
      variant="ghost"
      size="sm"
      title={action.tooltip}
      disabled={!isEnabled}
      onClick={handleClick}
      disableMotion
    >
      {action.icon}
    </IconButton>
  );
}

export function FloatingIcon() {
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const isCommandPaletteOpen = useComposedStore((s) => s.commandPalette.open);
  const isConnected = useComposedStore((s) => s.wsConnected);
  const position = useComposedStore((s) => s.floatingIconPosition);
  const setPosition = useComposedStore((s) => s.setFloatingIconPosition);

  // Get plugins state for toolbar action visibility/enabled checks
  const plugins = useComposedStore((s) => s.plugins);

  // Get issue count from eslint plugin
  const issueCount = useComposedStore((s) => {
    const issues = s.plugins?.eslint?.issues;
    if (!issues) return 0;
    let count = 0;
    issues.forEach((arr) => {
      count += arr.length;
    });
    return count;
  });

  // Consolidated local UI state using reducer
  const [state, dispatch] = useReducer(floatingIconReducer, initialState);
  const { isDragging, isHovered, dragOffset, hasInteracted } = state;

  const containerRef = useRef<HTMLDivElement>(null);

  // Track first command palette interaction to hide hint
  useEffect(() => {
    if (isCommandPaletteOpen && !hasInteracted) {
      dispatch({ type: "SET_INTERACTED" });
    }
  }, [isCommandPaletteOpen, hasInteracted]);

  // Get toolbar actions from registered plugins
  const toolbarActions = pluginRegistry.getAllToolbarActions();

  // Filter to only visible actions - pass plugins state for visibility checks
  const visibleActions = toolbarActions.filter((action) => {
    if (action.isVisible) {
      return action.isVisible({ plugins });
    }
    return true; // Default to visible if no isVisible defined
  });

  const currentPosition = position ?? getDefaultPosition();
  const modKey = isMac() ? "\u2325" : "Alt+"; // Option symbol for Mac

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dispatch({
      type: "START_DRAG",
      offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    });
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = Math.max(
        0,
        Math.min(window.innerWidth - PILL_WIDTH, e.clientX - dragOffset.x)
      );
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - PILL_HEIGHT - HINT_ROW_HEIGHT, e.clientY - dragOffset.y)
      );

      setPosition({ x: newX, y: newY });
    },
    [isDragging, dragOffset, setPosition]
  );

  const handleMouseUp = useCallback(() => {
    dispatch({ type: "STOP_DRAG" });
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClick = useCallback(() => {
    if (!isDragging) {
      openCommandPalette();
    }
  }, [isDragging, openCommandPalette]);

  const handleActionClick = useCallback((action: ToolbarAction) => {
    const services = getPluginServices();
    if (services) {
      action.onClick(services);
    }
  }, []);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Determine if hint should be shown
  const showHint = !hasInteracted && !isHovered;

  return createPortal(
    <div
      ref={containerRef}
      onMouseEnter={() => dispatch({ type: "SET_HOVERED", hovered: true })}
      onMouseLeave={() => dispatch({ type: "SET_HOVERED", hovered: false })}
      style={{
        position: "fixed",
        left: currentPosition.x,
        top: currentPosition.y,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        zIndex: 99999,
        pointerEvents: "auto",
      }}
    >
      {/* Top row: grip + search + toolbar actions */}
      <div
        style={{
          height: PILL_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Grip handle */}
        <div
          onMouseDown={handleGripMouseDown}
          style={getPillGlassStyles(isDragging, {
            width: 20,
            height: PILL_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDragging ? "grabbing" : "grab",
            borderRadius: "10px 0 0 10px",
            borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          })}
        >
          <svg
            width="6"
            height="14"
            viewBox="0 0 6 14"
            fill="none"
            style={{ opacity: isHovered ? 0.6 : 0.35 }}
          >
            <circle cx="1.5" cy="2" r="1.5" fill="currentColor" />
            <circle cx="4.5" cy="2" r="1.5" fill="currentColor" />
            <circle cx="1.5" cy="7" r="1.5" fill="currentColor" />
            <circle cx="4.5" cy="7" r="1.5" fill="currentColor" />
            <circle cx="1.5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>

        {/* Main search button */}
        <button
          onClick={handleClick}
          aria-label="Search"
          style={getPillGlassStyles(isDragging, {
            height: PILL_HEIGHT,
            padding: "0 10px",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: isDragging ? "none" : "box-shadow 0.2s, background 0.2s",
            color: "var(--uilint-text-primary)",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
            fontWeight: 400,
            flexShrink: 0,
          })}
          onMouseOver={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = "var(--uilint-glass-heavy, rgba(255, 255, 255, 0.85))";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "var(--uilint-glass-medium, rgba(255, 255, 255, 0.7))";
          }}
        >
          <SearchIcon size={15} style={{ opacity: 0.5 }} />

          <span style={{ opacity: 0.7 }}>Search</span>

          {/* Issue count - subtle inline */}
          {issueCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--uilint-error)",
                opacity: 0.9,
              }}
            >
              {issueCount > 99 ? "99+" : issueCount}
            </span>
          )}
        </button>

        {/* Toolbar actions */}
        {visibleActions.length > 0 && (
          <div
            style={getPillGlassStyles(isDragging, {
              height: PILL_HEIGHT,
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "0 4px",
            })}
          >
            {visibleActions.map((action) => (
              <ToolbarActionButton
                key={action.id}
                action={action}
                state={{ plugins }}
                onExecute={() => handleActionClick(action)}
              />
            ))}
          </div>
        )}

        {/* Right cap */}
        <div
          style={getPillGlassStyles(isDragging, {
            width: 8,
            height: PILL_HEIGHT,
            borderRadius: "0 10px 10px 0",
            borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
          })}
        />

        {/* Connection indicator - subtle dot */}
        {!isConnected && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--uilint-warning)",
              border: "2px solid white",
              boxShadow: "var(--uilint-card-shadow, 0 1px 3px rgba(0,0,0,0.2))",
            }}
          />
        )}
      </div>

      {/* Bottom row: hint text */}
      {showHint && (
        <div
          style={{
            height: HINT_ROW_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 20, // Offset for grip handle
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 10,
            color: "var(--uilint-text-muted)",
            letterSpacing: "-0.01em",
            transition: "opacity 0.3s",
          }}
        >
          {modKey}K for commands
        </div>
      )}
    </div>,
    portalRoot
  );
}
