/**
 * CategorySidebar - Left sidebar with category navigation
 */
import React from "react";
import { PlayIcon, RuleIcon, WarningIcon } from "../../icons";

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
      className={`flex items-center gap-2 w-full px-3 py-2 border-none rounded-lg cursor-pointer text-[13px] text-left ${
        active
          ? "bg-blue-500/10 text-blue-500 font-medium"
          : "bg-transparent text-gray-500 font-normal"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count > 0 && (
        <span
          className={`text-[11px] font-medium px-1.5 py-px rounded-full ${
            active ? "bg-blue-500/20 text-blue-500" : "bg-gray-100 text-gray-400"
          }`}
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
    <div className="w-40 border-r border-black/[0.08] p-2 flex flex-col gap-0.5 bg-white/30 shrink-0">
      <CategoryItem
        icon={<span className="text-sm">*</span>}
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
