/**
 * InspectorSidebar - Docked or floating panel showing issues
 *
 * Two modes:
 * - Docked: Fixed to right edge, pushes page content via document margin
 * - Floating: Draggable, resizable popup window
 *
 * Now uses the unified IssuesList component as the primary content,
 * with the same filter model as tiles and heatmap.
 *
 * Legacy panel support (issue, element, plugin panels) is preserved
 * for backwards compatibility but deprecated.
 *
 * Drag state is managed by the centralized drag-slice in the store.
 * Auto-undock on mobile is handled by the subscription system (initializeInspectorAutoUndock).
 */
import React, { useMemo, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { HealthPulse } from "./HealthPulse";
import { ElementContextPanel } from "./ElementContextPanel";
import { RuleCardList } from "./RuleCardList";
import { IssueDetail } from "./IssueDetail";
import { ElementDetail } from "./ElementDetail";
import { ResizeHandle } from "./ResizeHandle";
import { CloseIcon, MaximizeIcon, DockIcon } from "../../icons";
import { IconButton, getGlassStyles } from "../primitives";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_FLOATING_WIDTH = 450;
const DEFAULT_FLOATING_HEIGHT = 500;

export function InspectorSidebar() {
  const isOpen = useComposedStore((s) => s.inspector.open);
  const panelId = useComposedStore((s) => s.inspector.panelId);
  const panelData = useComposedStore((s) => s.inspector.data);
  const selectedElementDataLoc = useComposedStore((s) => s.inspector.selectedElementDataLoc);
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

  // Mobile detection from store (updated by subscription system)
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Drag state from store (managed by subscription system)
  const activeDrag = useComposedStore((s) => s.activeDrag);
  const startDrag = useComposedStore((s) => s.startDrag);
  const isDragging = activeDrag?.type === "inspector-floating";

  // Get all inspector panels from plugins
  const pluginPanels = useMemo(() => {
    return pluginRegistry.getAllInspectorPanels();
  }, []);

  const handleSelectIssue = useCallback((issue: Issue) => {
    openInspector("issue", { issue });
  }, [openInspector]);

  // Determine which view to show
  // Default is now the unified IssuesList, with legacy panel support for backwards compatibility
  const { content, title } = useMemo(() => {
    let content: React.ReactNode = null;
    let title = "Issues";

    // Check for legacy plugin panel first (backwards compatibility)
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
        <div className="p-4 text-text-muted text-center">
          Loading...
        </div>
      );
    } else if (panelId === "issue" && panelData?.issue) {
      // Legacy: single issue detail view
      const issue = panelData.issue as Issue;
      const ruleContribution = issue.ruleId
        ? pluginRegistry.getRuleContribution(issue.ruleId) ||
          pluginRegistry.getRuleContribution(issue.ruleId.replace("uilint/", ""))
        : undefined;

      if (ruleContribution?.inspectorPanel) {
        const services = getPluginServices();
        const CustomPanel = ruleContribution.inspectorPanel;
        title = "Issue Details";
        content = services ? (
          <CustomPanel data={panelData} services={services} />
        ) : (
          <div className="p-4 text-text-muted text-center">
            Loading...
          </div>
        );
      } else {
        title = "Issue Details";
        content = <IssueDetail issue={issue} />;
      }
    } else if (panelId === "element" && panelData?.dataLoc) {
      // Legacy: element detail view
      title = "Element Issues";
      content = (
        <ElementDetail
          dataLoc={panelData.dataLoc as string}
          onSelectIssue={handleSelectIssue}
        />
      );
    } else {
      // Default: Three-zone narrative inspector
      title = "Issues";
      content = (
        <div className="flex flex-col h-full">
          <HealthPulse />
          {selectedElementDataLoc && <ElementContextPanel />}
          <RuleCardList />
        </div>
      );
    }

    return { content, title };
  }, [panelId, panelData, pluginPanels, handleSelectIssue]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Note: Auto-undock on mobile is handled by initializeInspectorAutoUndock
  // in the subscription system (subscriptions.ts). No useEffect needed here.

  // Manage document margin for docked mode (useLayoutEffect for DOM manipulation)
  useLayoutEffect(() => {
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

  // Update floating position during drag
  // The subscription system handles mouse/touch move events and updates activeDrag.currentPos
  useLayoutEffect(() => {
    if (!isDragging || !activeDrag || !activeDrag.elementStartPos) return;

    const { currentPos, startPos, elementStartPos } = activeDrag;
    const deltaX = currentPos.x - startPos.x;
    const deltaY = currentPos.y - startPos.y;
    setInspectorFloatingPosition({
      x: elementStartPos.x + deltaX,
      y: elementStartPos.y + deltaY,
    });
  }, [isDragging, activeDrag, setInspectorFloatingPosition]);

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

  // Drag handlers - just start the drag, the subscription system handles move/end
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!floatingPosition || isMobile) return;
      e.preventDefault();
      const startPos = { x: e.clientX, y: e.clientY };
      // Use offset of {0, 0} since we track element start position directly
      startDrag("inspector-floating", startPos, { x: 0, y: 0 }, floatingPosition);
    },
    [floatingPosition, isMobile, startDrag]
  );

  const handleTouchDragStart = useCallback(
    (e: React.TouchEvent) => {
      if (!floatingPosition || isMobile) return;
      const touch = e.touches[0];
      const startPos = { x: touch.clientX, y: touch.clientY };
      startDrag("inspector-floating", startPos, { x: 0, y: 0 }, floatingPosition);
    },
    [floatingPosition, isMobile, startDrag]
  );

  // Note: Global mouse/touch move and end events are handled by the subscription system
  // in subscriptions.ts (initializeDragHandlers). This eliminates the need for
  // useEffect-based event listener management.

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
      className={cn(
        "flex items-center justify-between border-b border-border bg-surface-elevated select-none",
        isMobile ? "px-4 py-4" : "px-4 py-3",
        isDraggable && !isMobile ? "cursor-move" : "cursor-default"
      )}
      style={{
        paddingTop: isMobile ? "calc(16px + env(safe-area-inset-top, 0px))" : undefined,
      }}
      onMouseDown={isDraggable && !isMobile ? handleDragStart : undefined}
      onTouchStart={isDraggable && !isMobile ? handleTouchDragStart : undefined}
    >
      <span className="font-semibold text-text-primary">
        {title}
      </span>
      {/* Stop mousedown propagation so header drag doesn't capture button clicks */}
      <div
        className={cn("flex items-center", isMobile ? "gap-2" : "gap-1")}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Hide dock/undock toggle on mobile - not useful in fullscreen mode */}
        {!isMobile && (
          <IconButton
            variant="ghost"
            size="sm"
            onClick={toggleInspectorDocked}
            title={docked ? "Undock to floating window" : "Dock to side"}
          >
            {docked ? <MaximizeIcon size={16} /> : <DockIcon size={16} />}
          </IconButton>
        )}
        <IconButton
          variant="ghost"
          size={isMobile ? "default" : "sm"}
          onClick={closeInspector}
          title="Close"
          className={isMobile ? "min-w-[44px] min-h-[44px]" : undefined}
        >
          <CloseIcon size={isMobile ? 20 : 16} />
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
          className="fixed inset-y-0 right-0 flex flex-col border-l border-glass-border shadow-default z-[99997] pointer-events-auto"
          style={{
            width: width,
            ...glassStyle,
          }}
        >
          <ResizeHandle
            direction="horizontal"
            onResize={(deltaX) => handleDockedResize(deltaX)}
          />
          <Header />
          <div className="flex-1 overflow-y-auto">
            {content}
          </div>
        </motion.div>
      )}

      {isOpen && !docked && (
        // Floating mode - draggable, resizable popup (fullscreen on mobile)
        <motion.div
          key="floating"
          initial={{ opacity: 0, scale: isMobile ? 1 : 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: isMobile ? 1 : 0.95 }}
          transition={{ duration: 0.15 }}
          style={isMobile ? {
            // Mobile: fullscreen overlay
            position: "fixed",
            inset: 0,
            width: "100%",
            height: "100%",
            ...glassStyle,
            border: "none",
            borderRadius: 0,
            boxShadow: "none",
            zIndex: 99997,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            pointerEvents: "auto",
          } : {
            // Desktop: positioned floating window
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
          <div
            className="flex-1 overflow-y-auto min-h-0"
            style={{
              paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : undefined,
            }}
          >
            {content}
          </div>
          {/* Hide resize handle on mobile - not needed in fullscreen mode */}
          {!isMobile && (
            <ResizeHandle
              direction="corner"
              onResize={handleFloatingResize}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
