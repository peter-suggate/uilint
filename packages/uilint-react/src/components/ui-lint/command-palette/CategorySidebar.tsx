"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

interface FileCategory {
  filePath: string;
  fileName: string;
  directory: string;
  issueCount: number;
}

interface CategorySidebarProps {
  /** File categories with issue counts */
  fileCategories: FileCategory[];
  /** Number of settings items in current results */
  settingsCount: number;
  /** Number of vision action items in current results */
  visionCount: number;
  /** Number of captures in current results */
  capturesCount: number;
  /** Number of rules in current results */
  rulesCount: number;
  /** Called when a category is clicked */
  onCategoryClick: (categoryId: string) => void;
}

/**
 * Sidebar showing categories for quick navigation
 * Order: Issues (files) → Vision → Rules → Settings
 */
export function CategorySidebar({
  fileCategories,
  settingsCount,
  visionCount,
  capturesCount,
  rulesCount,
  onCategoryClick,
}: CategorySidebarProps) {
  // Don't render if nothing to show
  const hasContent = settingsCount > 0 || visionCount > 0 || fileCategories.length > 0 || capturesCount > 0 || rulesCount > 0;
  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 py-2 px-2",
        "w-[180px] flex-shrink-0",
        "border-r border-border",
        "overflow-y-auto"
      )}
      data-ui-lint
    >
      {/* File categories (issues grouped by file) - FIRST */}
      {fileCategories.map((file) => (
        <SidebarItem
          key={file.filePath}
          icon={<Icons.File className="w-3.5 h-3.5" />}
          label={file.fileName}
          subtitle={file.directory}
          count={file.issueCount}
          onClick={() => onCategoryClick(`file:${file.filePath}`)}
        />
      ))}

      {/* Captures (screenshots) category */}
      {capturesCount > 0 && (
        <SidebarItem
          icon={<Icons.Camera className="w-3.5 h-3.5" />}
          label="Captures"
          count={capturesCount}
          onClick={() => onCategoryClick("captures")}
        />
      )}

      {/* Vision category (capture actions) */}
      {visionCount > 0 && (
        <SidebarItem
          icon={<Icons.Eye className="w-3.5 h-3.5" />}
          label="Vision"
          count={visionCount}
          onClick={() => onCategoryClick("vision")}
        />
      )}

      {/* Rules category */}
      {rulesCount > 0 && (
        <SidebarItem
          icon={<Icons.Settings className="w-3.5 h-3.5" />}
          label="Rules"
          count={rulesCount}
          onClick={() => onCategoryClick("rules")}
        />
      )}

      {/* Settings category - LAST */}
      {settingsCount > 0 && (
        <SidebarItem
          icon={<Icons.Settings className="w-3.5 h-3.5" />}
          label="Settings"
          count={settingsCount}
          onClick={() => onCategoryClick("settings")}
        />
      )}
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  count: number;
  onClick: () => void;
}

function SidebarItem({ icon, label, subtitle, count, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md",
        "text-left text-xs",
        "text-text-secondary",
        "hover:bg-hover",
        "transition-colors duration-75"
      )}
    >
      <span className="flex-shrink-0 text-muted-foreground">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {subtitle && (
          <div className="truncate text-[10px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      <span className="flex-shrink-0 text-[10px] text-muted-foreground">
        ({count})
      </span>
    </button>
  );
}
