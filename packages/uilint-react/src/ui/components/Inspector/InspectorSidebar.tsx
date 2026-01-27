/**
 * InspectorSidebar - Docked or floating panel showing issue/element details
 *
 * Two modes:
 * - Docked: Fixed to right edge, pushes page content via document margin
 * - Floating: Draggable, resizable popup window
 *
 * Supports both built-in panels (issue, element) and plugin-contributed panels.
 */
import React, { useMemo, useCallback, useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { IssueDetail } from "./IssueDetail";
import { ElementDetail } from "./ElementDetail";
import { ResizeHandle } from "./ResizeHandle";
import { CloseIcon, MaximizeIcon, DockIcon } from "../../icons";
import { IconButton, getGlassStyles } from "../primitives";
import type { Issue } from "../../types";

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_FLOATING_WIDTH = 450;
const DEFAULT_FLOATING_HEIGHT = 500;

export function InspectorSidebar() {
  const isOpen = useComposedStore((s) => s.inspector.open);
  const panelId = useComposedStore((s) => s.inspector.panelId);
  const panelData = useComposedStore((s) => s.inspector.data);
  const docked = useComposedStore((s) => s.inspector.docked);
  const width = useComposedStore((s) => s.inspector.width);
  const floatingPosition = useComposedStore((s) => s.inspector.floatingPosition);
  const floatingSize = useComposedStore((s) => s.inspector.floatingSize);

  const closeInspector = useComposedStore((s) => s.closeInspector);
  const openInspector = useComposedStore((s) => s.openInspector);
  const toggleInspectorDocked = useComposedStore((s) => s.toggleInspectorDocked);
  const setInspectorWidth = useComposedStore((s) => s.setInspectorWidth);
  const setInspectorFloatingPosition = useComposedStore((s) => s.setInspectorFloatingPosition);
  const setInspectorFloatingSize = useComposedStore((s) => s.setInspectorFloatingSize);

  // Track if component is mounted (for SSR safety)
  const [mounted, setMounted] = useState(false);

  // Drag state for floating mode
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);

  // Get all inspector panels from plugins
  const pluginPanels = useMemo(() => {
    return pluginRegistry.getAllInspectorPanels();
  }, []);

  const handleSelectIssue = useCallback((issue: Issue) => {
    openInspector("issue", { issue });
  }, [openInspector]);

  // Determine which view to show
  const { content, title } = useMemo(() => {
    let content: React.ReactNode = null;
    let title = "Inspector";

    // Check for plugin panel first
    const pluginPanel = pluginPanels.find((p) => p.id === panelId);
    if (pluginPanel) {
      const services = getPluginServices();
      const PanelComponent = pluginPanel.component;
      const data = panelData ?? undefined;
      title = typeof pluginPanel.title === "function"
        ? pluginPanel.title({ data, services: services! })
        : pluginPanel.title;
      content = services ? (
        <PanelComponent data={data} services={services} />
      ) : (
        <div style={{ padding: 16, color: "var(--uilint-text-muted)", textAlign: "center" }}>
          Loading...
        </div>
      );
    } else if (panelId === "issue" && panelData?.issue) {
      title = "Issue Details";
      content = <IssueDetail issue={panelData.issue as Issue} />;
    } else if (panelId === "element" && panelData?.dataLoc) {
      title = "Element Issues";
      content = (
        <ElementDetail
          dataLoc={panelData.dataLoc as string}
          onSelectIssue={handleSelectIssue}
        />
      );
    } else {
      content = (
        <div style={{ padding: 16, color: "var(--uilint-text-muted)", textAlign: "center" }}>
          Select an issue or element to inspect
        </div>
      );
    }

    return { content, title };
  }, [panelId, panelData, pluginPanels, handleSelectIssue]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Manage document margin for docked mode
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (isOpen && docked) {
      // Reserve space on the right for the docked sidebar
      root.style.marginRight = `${width}px`;
      root.style.transition = "margin-right 0.2s ease-out";
    } else {
      // Remove the margin when closed or floating
      root.style.marginRight = "";
      root.style.transition = "margin-right 0.2s ease-out";
    }

    // Cleanup on unmount
    return () => {
      root.style.marginRight = "";
      root.style.transition = "";
    };
  }, [mounted, isOpen, docked, width]);

  // Handle docked resize
  const handleDockedResize = useCallback(
    (deltaX: number) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width - deltaX));
      setInspectorWidth(newWidth);
    },
    [width, setInspectorWidth]
  );

  // Handle floating resize
  const handleFloatingResize = useCallback(
    (deltaX: number, deltaY: number) => {
      const currentSize = floatingSize ?? { width: DEFAULT_FLOATING_WIDTH, height: DEFAULT_FLOATING_HEIGHT };
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, currentSize.width + deltaX));
      const newHeight = Math.max(300, currentSize.height + deltaY);
      setInspectorFloatingSize({ width: newWidth, height: newHeight });
    },
    [floatingSize, setInspectorFloatingSize]
  );

  // Handle drag start for floating mode
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!floatingPosition) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPos: floatingPosition,
      };
    },
    [floatingPosition]
  );

  // Handle drag move/end
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setInspectorFloatingPosition({
        x: dragRef.current.startPos.x + deltaX,
        y: dragRef.current.startPos.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setInspectorFloatingPosition]);

  // Initialize floating position if not set
  useEffect(() => {
    if (!docked && !floatingPosition && mounted) {
      setInspectorFloatingPosition({
        x: window.innerWidth - DEFAULT_FLOATING_WIDTH - 20,
        y: 80,
      });
    }
  }, [docked, floatingPosition, setInspectorFloatingPosition, mounted]);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Shared header component
  const Header = ({ isDraggable = false }: { isDraggable?: boolean }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--uilint-border)",
        background: "var(--uilint-surface-elevated)",
        cursor: isDraggable ? "move" : "default",
        userSelect: "none",
      }}
      onMouseDown={isDraggable ? handleDragStart : undefined}
    >
      <span style={{ fontWeight: 600, color: "var(--uilint-text-primary)" }}>
        {title}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={toggleInspectorDocked}
          title={docked ? "Undock to floating window" : "Dock to side"}
        >
          {docked ? <MaximizeIcon size={16} /> : <DockIcon size={16} />}
        </IconButton>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={closeInspector}
          title="Close"
        >
          <CloseIcon size={16} />
        </IconButton>
      </div>
    </div>
  );

  // Glass morphism styles - uses design system primitives
  const glassStyle = getGlassStyles("heavy", "none", false);

  return createPortal(
    <AnimatePresence>
      {isOpen && docked && (
        // Docked mode - fixed to right edge
        <motion.div
          key="docked"
          initial={{ x: width, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: width, opacity: 0 }}
          transition={{
            duration: 0.15,
            ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth deceleration
          }}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: width,
            ...glassStyle,
            borderLeft: "1px solid var(--uilint-glass-border)",
            boxShadow: "var(--uilint-shadow)",
            zIndex: 99997,
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
          }}
        >
          <ResizeHandle
            direction="horizontal"
            onResize={(deltaX) => handleDockedResize(deltaX)}
          />
          <Header />
          <div style={{ flex: 1, overflowY: "auto" }}>
            {content}
          </div>
        </motion.div>
      )}

      {isOpen && !docked && (
        // Floating mode - draggable, resizable popup
        <motion.div
          key="floating"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            left: floatingPosition?.x ?? window.innerWidth - DEFAULT_FLOATING_WIDTH - 20,
            top: floatingPosition?.y ?? 80,
            width: floatingSize?.width ?? DEFAULT_FLOATING_WIDTH,
            height: floatingSize?.height ?? DEFAULT_FLOATING_HEIGHT,
            ...glassStyle,
            border: "1px solid var(--uilint-glass-border)",
            borderRadius: 12,
            boxShadow: "var(--uilint-shadow)",
            zIndex: 99997,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <Header isDraggable />
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {content}
          </div>
          <ResizeHandle
            direction="corner"
            onResize={handleFloatingResize}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
