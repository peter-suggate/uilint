/**
 * CommandPalette - Main search interface
 */
import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../../core/store";
import { useIssues } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { ResultItem } from "./ResultItem";
import { CloseIcon } from "../../icons";
import type { Issue } from "../../types";

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const openInspector = useComposedStore((s) => s.openInspector);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { allIssues } = useIssues();

  // Filter issues by query
  const filteredIssues = useMemo(() => {
    if (!query.trim()) return allIssues.slice(0, 100);

    const lowerQuery = query.toLowerCase();
    return allIssues.filter((issue) =>
      issue.message.toLowerCase().includes(lowerQuery) ||
      issue.ruleId.toLowerCase().includes(lowerQuery) ||
      issue.filePath.toLowerCase().includes(lowerQuery)
    ).slice(0, 100);
  }, [allIssues, query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredIssues.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filteredIssues[selectedIndex]) {
      e.preventDefault();
      handleSelectIssue(filteredIssues[selectedIndex]);
    }
  }, [filteredIssues, selectedIndex]);

  // Handle selecting an issue
  const handleSelectIssue = useCallback((issue: Issue) => {
    openInspector("issue", { issue });
    closeCommandPalette();
  }, [openInspector, closeCommandPalette]);

  // Reset selection when query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 100,
        zIndex: 99998,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          overflow: "hidden",
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
            UILint ({allIssues.length} issues)
          </span>
          <button
            onClick={closeCommandPalette}
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

        {/* Search */}
        <SearchInput value={query} onChange={setQuery} />

        {/* Results */}
        <div style={{
          maxHeight: 400,
          overflowY: "auto",
        }}>
          {filteredIssues.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: "center",
              color: "#6b7280",
            }}>
              {query ? "No issues match your search" : "No issues found"}
            </div>
          ) : (
            filteredIssues.map((issue, index) => (
              <ResultItem
                key={issue.id}
                issue={issue}
                isSelected={index === selectedIndex}
                onClick={() => handleSelectIssue(issue)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid #e5e7eb",
          fontSize: 12,
          color: "#9ca3af",
          display: "flex",
          gap: 16,
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
