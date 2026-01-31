/**
 * FloatingIcon - Draggable glassmorphic toolbar with separated pills
 *
 * Layout:
 * [ ≡ grip | 🔍 Search (⌘K) [3] ]   [ 📷 ▾ ]
 *
 * Elements:
 * - Search pill (primary): grip handle + search button with issue count badge
 * - Vision pill (detached): dropdown with capture options + shortcuts
 *
 * Drag state is managed by the centralized drag-slice in the store.
 * Global mouse/touch event handlers are managed by the subscription system.
 */
import React, { useRef, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../core/store";
import { pluginRegistry } from "../../core/plugin-system/registry";
import { getPluginServices } from "../../core/store/composed-store";
import { SearchIcon } from "../icons";
import { getGlassStyles } from "./primitives";
import type { ToolbarAction, ToolbarActionGroup } from "../../core/plugin-system/types";

interface Position {
  x: number;
  y: number;
}

const PILL_HEIGHT = 36;
const HINT_ROW_HEIGHT = 18;
const PILL_GAP = 8;

/**
 * Build base glass styles for pill segments using CSS variables
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

/** SSR-safe default position */
function getDefaultPosition(): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 16 };
  }
  return { x: window.innerWidth / 2 - 150, y: 16 };
}

/** Detect macOS for showing correct modifier key symbol */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/** Chevron down icon for dropdown indicator */
const ChevronDownSmall = React.createElement(
  "svg",
  {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
  },
  React.createElement("polyline", { points: "6 9 12 15 18 9" })
);

/**
 * Dropdown menu for toolbar action groups
 */
interface ActionGroupDropdownProps {
  group: ToolbarActionGroup;
  state: unknown;
  onActionClick: (action: ToolbarAction) => void;
}

function ActionGroupDropdown({ group, state, onActionClick }: ActionGroupDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mac = isMac();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleActionClick = useCallback(
    (action: ToolbarAction) => {
      setIsOpen(false);
      onActionClick(action);
    },
    [onActionClick]
  );

  /** Format shortcut for display — swap ⌘ for Ctrl on non-Mac */
  const formatShortcut = (shortcut?: string) => {
    if (!shortcut) return null;
    if (!mac) {
      return shortcut.replace("⌘", "Ctrl+").replace("⇧", "Shift+");
    }
    return shortcut;
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger button — rounded pill */}
      <button
        onClick={handleToggle}
        title={group.tooltip}
        style={getPillGlassStyles(false, {
          height: PILL_HEIGHT,
          padding: "0 10px",
          border: "none",
          borderRadius: PILL_HEIGHT / 2,
          borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--uilint-text-secondary)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          transition: "box-shadow 0.2s, background 0.2s",
        })}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "var(--uilint-glass-heavy, rgba(255, 255, 255, 0.85))";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "var(--uilint-glass-medium, rgba(255, 255, 255, 0.7))";
        }}
      >
        <span style={{ display: "flex", alignItems: "center" }}>{group.icon}</span>
        {ChevronDownSmall}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: PILL_HEIGHT + 6,
            right: 0,
            minWidth: 220,
            background: "var(--uilint-glass-heavy, rgba(255, 255, 255, 0.92))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 10,
            border: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)",
            padding: "4px",
            zIndex: 100000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {group.actions.map((action) => {
            const isEnabled = action.isEnabled ? action.isEnabled(state) : true;
            const shortcutLabel = formatShortcut(action.shortcut);

            return (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEnabled) {
                    handleActionClick(action);
                  }
                }}
                disabled={!isEnabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: 7,
                  background: "transparent",
                  cursor: isEnabled ? "pointer" : "default",
                  opacity: isEnabled ? 1 : 0.4,
                  color: "var(--uilint-text-primary)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => {
                  if (isEnabled) {
                    e.currentTarget.style.background = "var(--uilint-hover, rgba(0, 0, 0, 0.05))";
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
                  {action.icon}
                </span>
                <span style={{ flex: 1 }}>{action.tooltip}</span>
                {shortcutLabel && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--uilint-text-muted)",
                      fontWeight: 500,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {shortcutLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FloatingIcon() {
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const isCommandPaletteOpen = useComposedStore((s) => s.commandPalette.open);
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

  // Drag state from store (managed by subscription system)
  const activeDrag = useComposedStore((s) => s.activeDrag);
  const startDrag = useComposedStore((s) => s.startDrag);
  const isDragging = activeDrag?.type === "floating-icon";

  // Local UI state that's truly component-specific
  const [isHovered, setIsHovered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Mobile/touch detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isTouchDevice = useComposedStore((s) => s.mobile.isTouchDevice);

  const containerRef = useRef<HTMLDivElement>(null);

  // Track first command palette interaction to hide hint
  useEffect(() => {
    if (isCommandPaletteOpen && !hasInteracted) {
      setHasInteracted(true);
    }
  }, [isCommandPaletteOpen, hasInteracted]);

  // Update floating icon position during drag
  // The subscription system handles mouse/touch move events and updates activeDrag.currentPos
  useLayoutEffect(() => {
    if (!isDragging || !activeDrag) return;

    const { currentPos, offset } = activeDrag;
    const newX = Math.max(0, Math.min(window.innerWidth - 300, currentPos.x - offset.x));
    const newY = Math.max(
      0,
      Math.min(window.innerHeight - PILL_HEIGHT - HINT_ROW_HEIGHT, currentPos.y - offset.y)
    );

    setPosition({ x: newX, y: newY });
  }, [isDragging, activeDrag, setPosition]);

  // Get toolbar action groups from registered plugins
  const toolbarActionGroups = pluginRegistry.getAllToolbarActionGroups();

  // Filter to only visible groups
  const visibleGroups = toolbarActionGroups.filter((group) => {
    if (group.isVisible) {
      return group.isVisible({ plugins });
    }
    return true;
  });

  // Also get legacy flat toolbar actions (for backward compatibility)
  const toolbarActions = pluginRegistry.getAllToolbarActions();
  const visibleActions = toolbarActions.filter((action) => {
    if (action.isVisible) {
      return action.isVisible({ plugins });
    }
    return true;
  });

  const currentPosition = position ?? getDefaultPosition();
  const modKey = isMac() ? "⌘" : "Ctrl+";

  // Drag handlers - just start the drag, the subscription system handles move/end
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      startDrag("floating-icon", { x: e.clientX, y: e.clientY }, offset);
      e.preventDefault();
      e.stopPropagation();
    },
    [startDrag]
  );

  const handleGripTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const offset = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      startDrag("floating-icon", { x: touch.clientX, y: touch.clientY }, offset);
      e.preventDefault();
      e.stopPropagation();
    },
    [startDrag]
  );

  // Note: Global mouse/touch move and end events are handled by the subscription system
  // in subscriptions.ts (initializeDragHandlers). This eliminates the need for
  // useEffect-based event listener management.

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

  // Hide the floating icon when command palette is open
  if (isCommandPaletteOpen) {
    return null;
  }

  // Determine if hint should be shown (hide on touch devices)
  const showHint = !hasInteracted && !isHovered && !isTouchDevice;

  // Use larger touch targets on mobile (at least 44px per Apple HIG)
  const pillHeight = isMobile ? 44 : PILL_HEIGHT;

  const hasIssues = issueCount > 0;

  return createPortal(
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "fixed",
        left: currentPosition.x,
        top: currentPosition.y,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        zIndex: 99999,
        pointerEvents: "auto",
      }}
    >
      {/* Top row: search pill (with issue badge) + vision dropdown pill */}
      <div
        style={{
          height: pillHeight,
          display: "flex",
          alignItems: "center",
          gap: PILL_GAP,
        }}
      >
        {/* ========== SEARCH PILL (primary) ========== */}
        <div
          style={{
            height: pillHeight,
            display: "flex",
            alignItems: "center",
            gap: 0,
            position: "relative",
          }}
        >
          {/* Grip handle */}
          <div
            onMouseDown={handleGripMouseDown}
            onTouchStart={handleGripTouchStart}
            style={getPillGlassStyles(isDragging, {
              width: isMobile ? 28 : 20,
              height: pillHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isDragging ? "grabbing" : "grab",
              borderRadius: `${pillHeight / 2}px 0 0 ${pillHeight / 2}px`,
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
              height: pillHeight,
              padding: isMobile ? "0 16px 0 12px" : "0 14px 0 10px",
              border: "none",
              borderRadius: `0 ${pillHeight / 2}px ${pillHeight / 2}px 0`,
              borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: isDragging ? "none" : "box-shadow 0.2s, background 0.2s",
              color: "var(--uilint-text-primary)",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
            {!isTouchDevice && (
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.45,
                  fontWeight: 500,
                  marginLeft: 2,
                }}
              >
                {modKey}K
              </span>
            )}
          </button>

          {/* Issue count badge */}
          {hasIssues && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 9,
                background: "var(--uilint-glass-heavy, rgba(255, 255, 255, 0.9))",
                border: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--uilint-error)",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {issueCount > 99 ? "99+" : issueCount}
            </span>
          )}
        </div>

        {/* ========== VISION DROPDOWN PILLS (detached) ========== */}
        {visibleGroups.map((group) => (
          <ActionGroupDropdown
            key={group.id}
            group={group}
            state={{ plugins }}
            onActionClick={handleActionClick}
          />
        ))}

        {/* Legacy flat toolbar actions (backward compat) */}
        {visibleActions.length > 0 && (
          <div
            style={getPillGlassStyles(isDragging, {
              height: pillHeight,
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: isMobile ? "0 8px" : "0 6px",
              borderRadius: pillHeight / 2,
              borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
            })}
          >
            {visibleActions.map((action) => (
              <button
                key={action.id}
                title={action.tooltip}
                disabled={action.isEnabled ? !action.isEnabled({ plugins }) : false}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(action);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--uilint-text-muted)",
                }}
              >
                {action.icon}
              </button>
            ))}
          </div>
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
            paddingLeft: 20,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
