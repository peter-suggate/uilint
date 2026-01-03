"use client";

import React from "react";
import { useUILint } from "./UILint";
import type { Violation } from "../consistency/types";

export function ViolationList() {
  const {
    violations,
    selectedViolation,
    setSelectedViolation,
    lockedViolation,
    setLockedViolation,
    isScanning,
  } = useUILint();

  if (isScanning) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "#9CA3AF",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
        <div style={{ fontSize: "14px" }}>Analyzing page...</div>
        <div style={{ fontSize: "12px", marginTop: "4px", color: "#6B7280" }}>
          This may take a moment
        </div>
      </div>
    );
  }

  if (violations.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "#9CA3AF",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>✨</div>
        <div style={{ fontSize: "14px" }}>No consistency issues found</div>
        <div style={{ fontSize: "12px", marginTop: "4px" }}>
          Click "Scan" to analyze the page
        </div>
      </div>
    );
  }

  const handleClick = (violation: Violation) => {
    if (lockedViolation?.elementIds.join(",") === violation.elementIds.join(",")) {
      // Clicking locked violation unlocks it
      setLockedViolation(null);
    } else {
      // Lock this violation
      setLockedViolation(violation);
    }
  };

  return (
    <div style={{ padding: "8px" }}>
      {violations.map((violation, index) => (
        <ViolationCard
          key={`${violation.elementIds.join("-")}-${index}`}
          violation={violation}
          isSelected={
            selectedViolation?.elementIds.join(",") ===
            violation.elementIds.join(",")
          }
          isLocked={
            lockedViolation?.elementIds.join(",") ===
            violation.elementIds.join(",")
          }
          onHover={() => setSelectedViolation(violation)}
          onLeave={() => setSelectedViolation(null)}
          onClick={() => handleClick(violation)}
        />
      ))}
    </div>
  );
}

interface ViolationCardProps {
  violation: Violation;
  isSelected: boolean;
  isLocked: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

function ViolationCard({
  violation,
  isSelected,
  isLocked,
  onHover,
  onLeave,
  onClick,
}: ViolationCardProps) {
  const categoryColors: Record<string, string> = {
    spacing: "#10B981",
    color: "#F59E0B",
    typography: "#8B5CF6",
    sizing: "#3B82F6",
    borders: "#06B6D4",
    shadows: "#6B7280",
  };

  const severityIcons: Record<string, string> = {
    error: "✖",
    warning: "⚠",
    info: "ℹ",
  };

  const categoryColor = categoryColors[violation.category] || "#6B7280";
  const severityIcon = severityIcons[violation.severity] || "•";
  const isHighlighted = isSelected || isLocked;

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        padding: "12px",
        marginBottom: "8px",
        backgroundColor: isHighlighted ? "#374151" : "#111827",
        borderRadius: "8px",
        border: isLocked
          ? "1px solid #3B82F6"
          : isSelected
          ? "1px solid #4B5563"
          : "1px solid transparent",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {/* Header: Category badge and severity */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            fontSize: "11px",
            fontWeight: "600",
            textTransform: "uppercase",
          }}
        >
          {violation.category}
        </div>
        <span
          style={{
            fontSize: "12px",
            color:
              violation.severity === "error"
                ? "#EF4444"
                : violation.severity === "warning"
                ? "#F59E0B"
                : "#9CA3AF",
          }}
        >
          {severityIcon}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "#6B7280",
            marginLeft: "auto",
          }}
        >
          {violation.elementIds.length} element
          {violation.elementIds.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: "13px",
          color: "#F3F4F6",
          lineHeight: "1.4",
          marginBottom: "8px",
        }}
      >
        {violation.message}
      </div>

      {/* Details */}
      {violation.details && (
        <div
          style={{
            fontSize: "12px",
            color: "#9CA3AF",
          }}
        >
          {violation.details.property && (
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#6B7280" }}>Property: </span>
              <code
                style={{
                  padding: "2px 4px",
                  backgroundColor: "#374151",
                  borderRadius: "3px",
                  fontSize: "11px",
                }}
              >
                {violation.details.property}
              </code>
            </div>
          )}
          {violation.details.values.length > 0 && (
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#6B7280" }}>Values: </span>
              {violation.details.values.map((val, i) => (
                <span key={i}>
                  <code
                    style={{
                      padding: "2px 4px",
                      backgroundColor: "#374151",
                      borderRadius: "3px",
                      fontSize: "11px",
                    }}
                  >
                    {val}
                  </code>
                  {i < violation.details.values.length - 1 && (
                    <span style={{ margin: "0 4px", color: "#6B7280" }}>vs</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestion */}
      {violation.details.suggestion && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px",
            backgroundColor: "#1E3A5F",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#93C5FD",
          }}
        >
          💡 {violation.details.suggestion}
        </div>
      )}

      {/* Lock indicator */}
      {isLocked && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "11px",
            color: "#3B82F6",
          }}
        >
          🔒 Click to unlock
        </div>
      )}
    </div>
  );
}
