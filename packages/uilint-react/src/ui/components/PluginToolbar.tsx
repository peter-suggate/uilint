/* eslint-disable uilint/prefer-tailwind */
/**
 * PluginToolbar - Renders toolbar action groups contributed by plugins
 *
 * Sits alongside the InspectorToggle in the floating toolbar area.
 * Each plugin toolbar group renders as a button that expands into a menu
 * of actions (e.g., vision capture buttons).
 */
import React, { useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useComposedStore, getPluginServices } from "../../core/store";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { ToolbarActionGroup, ToolbarAction } from "../../core/plugin-system/types";
import { ChevronDown } from "lucide-react";
import { getGlassStyles } from "./primitives";

// ============================================================================
// ToolbarGroupButton - A single toolbar group with dropdown
// ============================================================================

interface ToolbarGroupButtonProps {
  group: ToolbarActionGroup;
  isMobile: boolean;
  disabled?: boolean;
}

function ToolbarGroupButton({ group, isMobile, disabled }: ToolbarGroupButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonSize = isMobile ? 44 : 36;

  const handleToggle = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const handleActionClick = useCallback(
    (action: ToolbarAction) => {
      const services = getPluginServices();
      if (services && action.onClick) {
        action.onClick(services);
      }
      setMenuOpen(false);
    },
    []
  );

  const portalRoot =
    typeof document !== "undefined"
      ? document.getElementById("uilint-portal") || document.body
      : null;

  // If there's only one action, render as a direct button (no dropdown)
  if (group.actions.length === 1) {
    const action = group.actions[0];
    return (
      <motion.button
        whileHover={disabled ? undefined : { scale: 1.05 }}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        onClick={disabled ? undefined : () => handleActionClick(action)}
        disabled={disabled}
        aria-label={action.tooltip}
        title={disabled ? `${action.tooltip} (unavailable)` : action.tooltip}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          border: "none",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
          color: "var(--uilint-text-secondary)",
          ...getGlassStyles("medium", "md", false),
          borderTop:
            "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderBottom:
            "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
          borderLeft:
            "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderRight:
            "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
        }}
      >
        {action.icon as ReactNode}
      </motion.button>
    );
  }

  // Multiple actions: render as button with dropdown
  return (
    <div style={{ position: "relative" }}>
      <motion.button
        whileHover={disabled ? undefined : { scale: 1.05 }}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        onClick={disabled ? undefined : handleToggle}
        disabled={disabled}
        aria-label={group.tooltip}
        title={disabled ? `${group.tooltip} (unavailable)` : group.tooltip}
        aria-expanded={menuOpen}
        style={{
          height: buttonSize,
          padding: "0 10px",
          borderRadius: buttonSize / 2,
          border: "none",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          opacity: disabled ? 0.4 : 1,
          color: "var(--uilint-text-secondary)",
          ...getGlassStyles("medium", "md", false),
          borderTop:
            "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderBottom:
            "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
          borderLeft:
            "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderRight:
            "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
        }}
      >
        {group.icon as ReactNode}
        <ChevronDown
          size={12}
          style={{
            opacity: 0.5,
            transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </motion.button>

      {/* Dropdown menu */}
      {portalRoot &&
        createPortal(
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 99991,
                    pointerEvents: "auto",
                  }}
                  onClick={() => setMenuOpen(false)}
                />
                <DropdownMenu
                  actions={group.actions}
                  onAction={handleActionClick}
                  buttonSize={buttonSize}
                />
              </>
            )}
          </AnimatePresence>,
          portalRoot
        )}
    </div>
  );
}

// ============================================================================
// DropdownMenu - Floating menu for toolbar group actions
// ============================================================================

interface DropdownMenuProps {
  actions: ToolbarAction[];
  onAction: (action: ToolbarAction) => void;
  buttonSize: number;
}

function DropdownMenu({ actions, onAction, buttonSize }: DropdownMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
      style={{
        position: "fixed",
        top: 16 + buttonSize + 8,
        right: 16,
        zIndex: 99992,
        minWidth: 180,
        borderRadius: 12,
        overflow: "hidden",
        pointerEvents: "auto",
        ...getGlassStyles("heavy", "lg", true),
        border:
          "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
      }}
    >
      <div style={{ padding: 4 }}>
        {actions.map((action) => (
          <motion.button
            key={action.id}
            whileHover={{
              backgroundColor: "var(--uilint-hover, rgba(0, 0, 0, 0.05))",
            }}
            onClick={() => onAction(action)}
            title={action.tooltip}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              cursor: "pointer",
              color: "var(--uilint-text-secondary)",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                opacity: 0.7,
              }}
            >
              {action.icon as ReactNode}
            </span>
            <span>{action.tooltip}</span>
            {action.shortcut && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  opacity: 0.4,
                  fontWeight: 400,
                }}
              >
                {action.shortcut}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// PluginToolbar - Main export
// ============================================================================

/**
 * Renders toolbar action groups from all registered plugins.
 * Each group becomes a button (or button+dropdown) in the floating toolbar.
 */
export function PluginToolbar() {
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isInspectorOpen = useComposedStore((s) => s.inspector.open);
  const isCommandPaletteOpen = useComposedStore((s) => s.commandPalette.open);

  // Subscribe to plugin state changes to re-evaluate visibility
  const pluginState = useComposedStore((s) => s.plugins);

  // Get all toolbar action groups from the registry
  const allGroups = pluginRegistry.getAllToolbarActionGroups();

  // Filter by visibility
  const storeState = useComposedStore();
  const visibleGroups = allGroups.filter((group) => {
    if (!group.isVisible) return true;
    return group.isVisible(storeState);
  });

  // Debug: log what we find (only on change)
  if (process.env.NODE_ENV === "development" && allGroups.length > 0) {
    console.debug(
      `[PluginToolbar] ${allGroups.length} group(s) registered, ${visibleGroups.length} visible`
    );
  }

  // Hide when inspector or command palette is open, or no groups
  if (isInspectorOpen || isCommandPaletteOpen || allGroups.length === 0) {
    return null;
  }

  // Render all groups, marking non-visible ones as disabled
  const visibleIds = new Set(visibleGroups.map((g) => g.id));

  return (
    <>
      {allGroups.map((group) => (
        <ToolbarGroupButton
          key={group.id}
          group={group}
          isMobile={isMobile}
          disabled={!visibleIds.has(group.id)}
        />
      ))}
    </>
  );
}
