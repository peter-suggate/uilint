"use client";

import React, { useState } from "react";
import { useUILint } from "./UILint";
import { ViolationList } from "./ViolationList";
import { QuestionPanel } from "./QuestionPanel";

interface OverlayProps {
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

export function Overlay({ position }: OverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { violations, isScanning, scan, elementCount } = useUILint();

  const positionStyles: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
    ...(position.includes("bottom") ? { bottom: "16px" } : { top: "16px" }),
    ...(position.includes("left") ? { left: "16px" } : { right: "16px" }),
  };

  const violationCount = violations.length;
  const hasViolations = violationCount > 0;

  return (
    <div style={positionStyles}>
      {isExpanded ? (
        <ExpandedPanel
          onCollapse={() => setIsExpanded(false)}
          onScan={scan}
          isScanning={isScanning}
          elementCount={elementCount}
        />
      ) : (
        <CollapsedButton
          onClick={() => setIsExpanded(true)}
          violationCount={violationCount}
          hasViolations={hasViolations}
          isScanning={isScanning}
        />
      )}
    </div>
  );
}

interface CollapsedButtonProps {
  onClick: () => void;
  violationCount: number;
  hasViolations: boolean;
  isScanning: boolean;
}

function CollapsedButton({
  onClick,
  violationCount,
  hasViolations,
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
        backgroundColor: isScanning
          ? "#3B82F6"
          : hasViolations
          ? "#EF4444"
          : "#10B981",
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
      title={
        isScanning
          ? "Analyzing..."
          : `UILint: ${violationCount} issue${
              violationCount !== 1 ? "s" : ""
            } found`
      }
    >
      {isScanning ? <SpinnerIcon /> : hasViolations ? violationCount : "✓"}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: "uilint-spin 1s linear infinite",
      }}
    >
      <style>{`
        @keyframes uilint-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        fill="none"
      />
    </svg>
  );
}

interface ExpandedPanelProps {
  onCollapse: () => void;
  onScan: () => void;
  isScanning: boolean;
  elementCount: number;
}

function ExpandedPanel({
  onCollapse,
  onScan,
  isScanning,
  elementCount,
}: ExpandedPanelProps) {
  const [activeTab, setActiveTab] = useState<"violations" | "questions">(
    "violations"
  );

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
          {elementCount > 0 && !isScanning && (
            <span
              style={{
                fontSize: "11px",
                color: "#6B7280",
                marginLeft: "4px",
              }}
            >
              ({elementCount} elements)
            </span>
          )}
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
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isScanning && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  animation: "uilint-spin 1s linear infinite",
                }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="31.4 31.4"
                  fill="none"
                />
              </svg>
            )}
            {isScanning ? "Analyzing..." : "Scan"}
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
          active={activeTab === "violations"}
          onClick={() => setActiveTab("violations")}
        >
          Violations
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
        {activeTab === "violations" ? <ViolationList /> : <QuestionPanel />}
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
