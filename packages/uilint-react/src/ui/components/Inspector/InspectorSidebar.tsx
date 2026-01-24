/**
 * InspectorSidebar - Docked panel showing issue/element details
 */
import React from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../../core/store";
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

  if (!isOpen) return null;

  const handleSelectIssue = (issue: Issue) => {
    openInspector("issue", { issue });
  };

  // Determine which view to show
  let content: React.ReactNode = null;
  let title = "Inspector";

  if (panelId === "issue" && panelData?.issue) {
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
      <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>
        Select an issue or element to inspect
      </div>
    );
  }

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: width || 360,
        background: "white",
        borderLeft: "1px solid #e5e7eb",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
        zIndex: 99997,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #e5e7eb",
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
    </div>,
    portalRoot
  );
}
