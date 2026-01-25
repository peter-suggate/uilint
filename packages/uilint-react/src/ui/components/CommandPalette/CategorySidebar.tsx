/**
 * CategorySidebar - Left sidebar with category navigation
 */
import React from "react";
import { PlayIcon, RuleIcon, FileIcon, WarningIcon } from "../../icons";

interface CategorySidebarProps {
  commandCount: number;
  issueCount: number;
  ruleCount: number;
  activeCategory: "all" | "commands" | "issues" | "rules";
  onCategoryChange: (category: "all" | "commands" | "issues" | "rules") => void;
}

interface CategoryItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryItem({ icon, label, count, active, onClick }: CategoryItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 12px",
        border: "none",
        borderRadius: 8,
        background: active ? "rgba(59, 130, 246, 0.1)" : "transparent",
        color: active ? "#3b82f6" : "#6b7280",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textAlign: "left",
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            background: active ? "rgba(59, 130, 246, 0.2)" : "#f3f4f6",
            color: active ? "#3b82f6" : "#9ca3af",
            padding: "1px 6px",
            borderRadius: 10,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function CategorySidebar({
  commandCount,
  issueCount,
  ruleCount,
  activeCategory,
  onCategoryChange,
}: CategorySidebarProps) {
  return (
    <div
      style={{
        width: 160,
        borderRight: "1px solid rgba(0,0,0,0.08)",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        background: "rgba(255,255,255,0.3)",
        flexShrink: 0,
      }}
    >
      <CategoryItem
        icon={<span style={{ fontSize: 14 }}>*</span>}
        label="All"
        count={commandCount + issueCount + ruleCount}
        active={activeCategory === "all"}
        onClick={() => onCategoryChange("all")}
      />
      <CategoryItem
        icon={<PlayIcon size={14} />}
        label="Commands"
        count={commandCount}
        active={activeCategory === "commands"}
        onClick={() => onCategoryChange("commands")}
      />
      <CategoryItem
        icon={<WarningIcon size={14} />}
        label="Issues"
        count={issueCount}
        active={activeCategory === "issues"}
        onClick={() => onCategoryChange("issues")}
      />
      <CategoryItem
        icon={<RuleIcon size={14} />}
        label="Rules"
        count={ruleCount}
        active={activeCategory === "rules"}
        onClick={() => onCategoryChange("rules")}
      />
    </div>
  );
}
