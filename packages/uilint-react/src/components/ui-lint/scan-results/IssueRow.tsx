"use client";

/**
 * IssueRow - Individual issue display component
 */

import React from "react";
import { IssueCountBadge } from "@/components/ui/badge";
import type { ScannedElement, ESLintIssue } from "../types";
import { cn } from "@/lib/utils";

interface IssueRowProps {
  element?: ScannedElement;
  issue?: ESLintIssue;
  issueCount: number;
  tagName: string;
  lineNumber: number;
  columnNumber?: number;
  onHover?: (element: ScannedElement | null) => void;
  onClick?: (element: ScannedElement) => void;
  onFileLevelIssueClick?: () => void;
  isFileLevel?: boolean;
}

export function IssueRow({
  element,
  issue,
  issueCount,
  tagName,
  lineNumber,
  columnNumber,
  onHover,
  onClick,
  onFileLevelIssueClick,
  isFileLevel = false,
}: IssueRowProps) {
  const handleMouseEnter = () => {
    if (element && onHover) {
      onHover(element);
    }
  };

  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null);
    }
  };

  const handleClick = () => {
    if (element && onClick) {
      onClick(element);
    } else if (isFileLevel && onFileLevelIssueClick) {
      onFileLevelIssueClick();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center px-3 py-1.5 cursor-pointer transition-colors",
        "hover:bg-blue-500/15 bg-transparent"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Element tag and line number */}
      <div className="flex items-center gap-1 flex-1 mr-3">
        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
          &lt;{tagName}&gt;
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          :{lineNumber}
          {columnNumber ? `:${columnNumber}` : ""}
        </span>
      </div>

      {/* Issue count badge */}
      <IssueCountBadge count={issueCount} />
    </div>
  );
}
