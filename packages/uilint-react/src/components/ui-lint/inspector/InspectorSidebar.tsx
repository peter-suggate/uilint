"use client";

import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Icons } from "../command-palette/icons";
import { useUILintStore, type UILintStore } from "../store";
import { RuleInspector } from "./RuleInspector";
import { IssueInspector } from "./IssueInspector";
import { ElementInspector } from "./ElementInspector";
import { FixesInspector } from "./FixesInspector";
import { ResizeHandle } from "./ResizeHandle";
import { getUILintPortalHost } from "../portal-host";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { InspectorPanelProps, PluginServices } from "../../../core/plugin-system/types";

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_FLOATING_WIDTH = 450;
const DEFAULT_FLOATING_HEIGHT = 500;

/**
 * Inspector sidebar - docked or floating panel showing detailed information
 *
 * Docked mode: Uses CSS margin on document.documentElement to reserve space,
 * while the sidebar itself uses position: fixed. This ensures the page content
 * shrinks to accommodate the sidebar regardless of where UILint is mounted.
 *
 * Floating mode: Simple fixed positioning with drag/resize support.
 */
export function InspectorSidebar() {
  const inspectorOpen = useUILintStore((s: UILintStore) => s.inspectorOpen);
  const inspectorMode = useUILintStore((s: UILintStore) => s.inspectorMode);
  const inspectorPanelId = useUILintStore((s: UILintStore) => s.inspectorPanelId);
  const inspectorPanelData = useUILintStore((s: UILintStore) => s.inspectorPanelData);
  const inspectorRuleId = useUILintStore((s: UILintStore) => s.inspectorRuleId);
  const inspectorIssue = useUILintStore((s: UILintStore) => s.inspectorIssue);
  const inspectorElementId = useUILintStore((s: UILintStore) => s.inspectorElementId);
  const inspectorDocked = useUILintStore((s: UILintStore) => s.inspectorDocked);
  const inspectorWidth = useUILintStore((s: UILintStore) => s.inspectorWidth);
  const inspectorFloatingPosition = useUILintStore((s: UILintStore) => s.inspectorFloatingPosition);
  const inspectorFloatingSize = useUILintStore((s: UILintStore) => s.inspectorFloatingSize);

  const closeInspector = useUILintStore((s: UILintStore) => s.closeInspector);
  const toggleInspectorDocked = useUILintStore((s: UILintStore) => s.toggleInspectorDocked);
  const setInspectorWidth = useUILintStore((s: UILintStore) => s.setInspectorWidth);
  const setInspectorFloatingPosition = useUILintStore((s: UILintStore) => s.setInspectorFloatingPosition);
  const setInspectorFloatingSize = useUILintStore((s: UILintStore) => s.setInspectorFloatingSize);
  const openInspector = useUILintStore((s: UILintStore) => s.openInspector);

  // Get all inspector panels from registered plugins
  const pluginPanels = useMemo(() => pluginRegistry.getAllInspectorPanels(), []);

  // Find the active plugin panel if one is selected
  const activePluginPanel = useMemo(
    () => (inspectorPanelId ? pluginPanels.find((p) => p.id === inspectorPanelId) : null),
    [inspectorPanelId, pluginPanels]
  );

  // Create plugin services object for passing to panel components
  const pluginServices = useMemo((): PluginServices => {
    const services = pluginRegistry.getServices();
    if (services) {
      return services;
    }
    // Fallback services if registry not initialized
    return {
      websocket: {
        isConnected: false,
        url: "",
        connect: () => {},
        disconnect: () => {},
        send: () => {},
        on: () => () => {},
        onConnectionChange: () => () => {},
      },
      domObserver: {
        start: () => {},
        stop: () => {},
        onElementsAdded: () => () => {},
        onElementsRemoved: () => () => {},
      },
      getState: <T = unknown>() => useUILintStore.getState() as T,
      setState: <T = unknown>(partial: Partial<T>) => useUILintStore.setState(partial as Partial<UILintStore>),
      openInspector: (mode, data) => openInspector(mode, data as Parameters<typeof openInspector>[1]),
      closeCommandPalette: () => useUILintStore.getState().closeCommandPalette(),
    };
  }, [openInspector]);

  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Manage document margin for docked mode
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (inspectorOpen && inspectorDocked) {
      // Reserve space on the right for the docked sidebar
      root.style.marginRight = `${inspectorWidth}px`;
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
  }, [mounted, inspectorOpen, inspectorDocked, inspectorWidth]);

  // Handle docked resize
  const handleDockedResize = useCallback(
    (deltaX: number) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, inspectorWidth - deltaX));
      setInspectorWidth(newWidth);
    },
    [inspectorWidth, setInspectorWidth]
  );

  // Handle floating resize
  const handleFloatingResize = useCallback(
    (deltaX: number, deltaY: number) => {
      const currentSize = inspectorFloatingSize ?? { width: DEFAULT_FLOATING_WIDTH, height: DEFAULT_FLOATING_HEIGHT };
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, currentSize.width + deltaX));
      const newHeight = Math.max(300, currentSize.height + deltaY);
      setInspectorFloatingSize({ width: newWidth, height: newHeight });
    },
    [inspectorFloatingSize, setInspectorFloatingSize]
  );

  // Handle drag start for floating mode
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!inspectorFloatingPosition) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPos: inspectorFloatingPosition,
      };
    },
    [inspectorFloatingPosition]
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
    if (!inspectorDocked && !inspectorFloatingPosition && mounted) {
      setInspectorFloatingPosition({
        x: window.innerWidth - DEFAULT_FLOATING_WIDTH - 20,
        y: 80,
      });
    }
  }, [inspectorDocked, inspectorFloatingPosition, setInspectorFloatingPosition, mounted]);

  // Get title based on mode or active plugin panel
  // (computed before early returns to satisfy React hooks rules)
  const title = useMemo(() => {
    // If a plugin panel is active, use its title
    if (activePluginPanel) {
      const panelTitle = activePluginPanel.title;
      if (typeof panelTitle === "function") {
        // Dynamic title function
        return panelTitle({
          data: inspectorPanelData ?? undefined,
          services: pluginServices,
        });
      }
      return panelTitle;
    }

    // Built-in mode titles
    switch (inspectorMode) {
      case "rule":
        return "Rule Details";
      case "issue":
        return "Issue Details";
      case "element":
        return "Element Issues";
      case "fixes":
        return "Fix Issues";
      default:
        return "Inspector";
    }
  }, [activePluginPanel, inspectorMode, inspectorPanelData, pluginServices]);

  // Render content based on mode or active plugin panel
  // (computed before early returns to satisfy React hooks rules)
  const content = useMemo(() => {
    // If a plugin panel is active, render its component
    if (activePluginPanel) {
      const PanelComponent = activePluginPanel.component;
      const panelProps: InspectorPanelProps = {
        data: inspectorPanelData ?? undefined,
        services: pluginServices,
      };
      return <PanelComponent {...panelProps} />;
    }

    // Render built-in inspectors based on mode
    return (
      <>
        {inspectorMode === "rule" && inspectorRuleId && (
          <RuleInspector ruleId={inspectorRuleId} />
        )}
        {inspectorMode === "issue" && inspectorIssue && (
          <IssueInspector
            issue={inspectorIssue.issue}
            elementId={inspectorIssue.elementId}
            filePath={inspectorIssue.filePath}
          />
        )}
        {inspectorMode === "element" && inspectorElementId && (
          <ElementInspector elementId={inspectorElementId} />
        )}
        {inspectorMode === "fixes" && <FixesInspector />}
      </>
    );
  }, [
    activePluginPanel,
    inspectorMode,
    inspectorPanelData,
    pluginServices,
    inspectorRuleId,
    inspectorIssue,
    inspectorElementId,
  ]);

  if (!mounted || !inspectorOpen) return null;

  const portalHost = getUILintPortalHost();
  if (!portalHost) return null;

  // Floating mode
  if (!inspectorDocked) {
    const pos = inspectorFloatingPosition ?? { x: window.innerWidth - DEFAULT_FLOATING_WIDTH - 20, y: 80 };
    const size = inspectorFloatingSize ?? { width: DEFAULT_FLOATING_WIDTH, height: DEFAULT_FLOATING_HEIGHT };

    return createPortal(
      <div
        ref={panelRef}
        data-ui-lint
        className={cn(
          "fixed z-[99999]",
          "flex flex-col",
          "bg-surface border border-border rounded-lg shadow-lg",
          "overflow-hidden"
        )}
        style={{
          left: pos.x,
          top: pos.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* Header - draggable */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 cursor-move"
          onMouseDown={handleDragStart}
        >
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleInspectorDocked}
              className="p-1 rounded hover:bg-hover transition-colors"
              title="Dock to side"
              data-ui-lint
            >
              <Icons.PanelRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={closeInspector}
              className="p-1 rounded hover:bg-hover transition-colors"
              title="Close"
              data-ui-lint
            >
              <Icons.X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {content}
        </div>

        {/* Resize handle - bottom right corner */}
        <ResizeHandle
          direction="corner"
          onResize={handleFloatingResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        />
      </div>,
      portalHost
    );
  }

  // Docked mode - fixed position on right edge
  return createPortal(
    <div
      ref={panelRef}
      data-ui-lint
      className={cn(
        "fixed top-0 right-0 h-full z-[99999]",
        "flex flex-col",
        "bg-surface border-l border-border shadow-lg"
      )}
      style={{ width: inspectorWidth }}
    >
      {/* Resize handle - left edge */}
      <ResizeHandle
        direction="horizontal"
        onResize={(deltaX) => handleDockedResize(deltaX)}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleInspectorDocked}
            className="p-1 rounded hover:bg-hover transition-colors"
            title="Undock"
            data-ui-lint
          >
            <Icons.Maximize2 className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={closeInspector}
            className="p-1 rounded hover:bg-hover transition-colors"
            title="Close"
            data-ui-lint
          >
            <Icons.X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {content}
      </div>
    </div>,
    portalHost
  );
}
