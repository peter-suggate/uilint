/**
 * InspectorSidebar - Docked panel showing issue/element details
 *
 * Supports both built-in panels (issue, element) and plugin-contributed panels.
 * Queries the plugin registry for available inspector panels.
 * Features glass morphism styling and slide-in animation.
 */
import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { IssueDetail } from "./IssueDetail";
import { ElementDetail } from "./ElementDetail";
import { CloseIcon } from "../../icons";
import type { Issue } from "../../types";

export function InspectorSidebar() {
  const isOpen = useComposedStore((s) => s.inspector.open);
  const panelId = useComposedStore((s) => s.inspector.panelId);
  const panelData = useComposedStore((s) => s.inspector.data);
  const width = useComposedStore((s) => s.inspector.width);
  const closeInspector = useComposedStore((s) => s.closeInspector);
  const openInspector = useComposedStore((s) => s.openInspector);

  // Get all inspector panels from plugins
  const pluginPanels = useMemo(() => {
    return pluginRegistry.getAllInspectorPanels();
  }, []);

  const handleSelectIssue = (issue: Issue) => {
    openInspector("issue", { issue });
  };

  // Determine which view to show (computed even when closed for animation purposes)
  const { content, title } = useMemo(() => {
    let content: React.ReactNode = null;
    let title = "Inspector";

    // Check for plugin panel first
    const pluginPanel = pluginPanels.find((p) => p.id === panelId);
    if (pluginPanel) {
      // Plugin-contributed panel
      const services = getPluginServices();
      const PanelComponent = pluginPanel.component;
      // Convert null to undefined for type compatibility
      const data = panelData ?? undefined;
      title = typeof pluginPanel.title === "function"
        ? pluginPanel.title({ data, services: services! })
        : pluginPanel.title;
      content = services ? (
        <PanelComponent data={data} services={services} />
      ) : (
        <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>
          Loading...
        </div>
      );
    } else if (panelId === "issue" && panelData?.issue) {
      // Built-in issue panel
      title = "Issue Details";
      content = <IssueDetail issue={panelData.issue as Issue} />;
    } else if (panelId === "element" && panelData?.dataLoc) {
      // Built-in element panel
      title = "Element Issues";
      content = (
        <ElementDetail
          dataLoc={panelData.dataLoc as string}
          onSelectIssue={handleSelectIssue}
        />
      );
    } else {
      content = (
        <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>
          Select an issue or element to inspect
        </div>
      );
    }

    return { content, title };
  }, [panelId, panelData, pluginPanels, handleSelectIssue]);

  const portalRoot = document.getElementById("uilint-portal") || document.body;
  const panelWidth = width || 360;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: panelWidth, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: panelWidth, opacity: 0 }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
          }}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: panelWidth,
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderLeft: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
            zIndex: 99997,
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.5)",
          }}>
            <span style={{ fontWeight: 600, color: "#111827" }}>
              {title}
            </span>
            <button
              onClick={closeInspector}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 4,
                color: "#6b7280",
              }}
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {content}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
