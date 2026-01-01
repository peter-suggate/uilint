"use client";

import React, { useState } from "react";
import { useUILint } from "./UILint";
import { IssueList } from "./IssueList";
import { QuestionPanel } from "./QuestionPanel";

interface OverlayProps {
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

export function Overlay({ position }: OverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { issues, isScanning, scan } = useUILint();

  const positionStyles: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
    ...(position.includes("bottom") ? { bottom: "16px" } : { top: "16px" }),
    ...(position.includes("left") ? { left: "16px" } : { right: "16px" }),
  };

  const issueCount = issues.length;
  const hasIssues = issueCount > 0;

  return (
    <div style={positionStyles}>
      {isExpanded ? (
        <ExpandedPanel
          onCollapse={() => setIsExpanded(false)}
          onScan={scan}
          isScanning={isScanning}
        />
      ) : (
        <CollapsedButton
          onClick={() => setIsExpanded(true)}
          issueCount={issueCount}
          hasIssues={hasIssues}
          isScanning={isScanning}
        />
      )}
    </div>
  );
}

interface CollapsedButtonProps {
  onClick: () => void;
  issueCount: number;
  hasIssues: boolean;
  isScanning: boolean;
}

function CollapsedButton({
  onClick,
  issueCount,
  hasIssues,
  isScanning,
}: CollapsedButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        border: "none",
        backgroundColor: hasIssues ? "#EF4444" : "#10B981",
        color: "white",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        transition: "transform 0.2s, box-shadow 0.2s",
        fontSize: "20px",
        fontWeight: "bold",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      }}
      title={`UILint: ${issueCount} issues found`}
    >
      {isScanning ? (
        <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
      ) : hasIssues ? (
        issueCount
      ) : (
        "✓"
      )}
    </button>
  );
}

interface ExpandedPanelProps {
  onCollapse: () => void;
  onScan: () => void;
  isScanning: boolean;
}

function ExpandedPanel({ onCollapse, onScan, isScanning }: ExpandedPanelProps) {
  const [activeTab, setActiveTab] = useState<"issues" | "questions">("issues");

  return (
    <div
      style={{
        width: "380px",
        maxHeight: "500px",
        backgroundColor: "#1F2937",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#F9FAFB",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #374151",
          backgroundColor: "#111827",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🎨</span>
          <span style={{ fontWeight: "600", fontSize: "14px" }}>UILint</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onScan}
            disabled={isScanning}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#3B82F6",
              color: "white",
              fontSize: "12px",
              fontWeight: "500",
              cursor: isScanning ? "not-allowed" : "pointer",
              opacity: isScanning ? 0.7 : 1,
            }}
          >
            {isScanning ? "Scanning..." : "Scan"}
          </button>
          <button
            onClick={onCollapse}
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "transparent",
              color: "#9CA3AF",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #374151",
        }}
      >
        <TabButton
          active={activeTab === "issues"}
          onClick={() => setActiveTab("issues")}
        >
          Issues
        </TabButton>
        <TabButton
          active={activeTab === "questions"}
          onClick={() => setActiveTab("questions")}
        >
          Questions
        </TabButton>
      </div>

      {/* Content */}
      <div style={{ maxHeight: "380px", overflow: "auto" }}>
        {activeTab === "issues" ? <IssueList /> : <QuestionPanel />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 16px",
        border: "none",
        backgroundColor: "transparent",
        color: active ? "#3B82F6" : "#9CA3AF",
        fontSize: "13px",
        fontWeight: "500",
        cursor: "pointer",
        borderBottom: active ? "2px solid #3B82F6" : "2px solid transparent",
        marginBottom: "-1px",
      }}
    >
      {children}
    </button>
  );
}
