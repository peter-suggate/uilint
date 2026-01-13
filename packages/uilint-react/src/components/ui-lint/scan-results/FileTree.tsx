"use client";

/**
 * FileTree - Expandable file list component
 */

import React from "react";
import { ChevronRight } from "lucide-react";
import { IssueCountBadge } from "@/components/ui/badge";
import { IssueRow } from "./IssueRow";
import type { ScannedElement, ESLintIssue } from "../types";
import { cn } from "@/lib/utils";

export interface FileWithIssues {
  path: string;
  displayName: string;
  disambiguatedName: string;
  issueCount: number;
  elementsWithIssues: ElementWithIssues[];
  fileLevelIssues: ESLintIssue[];
}

export interface ElementWithIssues {
  element: ScannedElement;
  issueCount: number;
  ruleIds: string[];
}

interface FileTreeProps {
  files: FileWithIssues[];
  expandedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onElementHover: (element: ScannedElement | null) => void;
  onElementClick: (element: ScannedElement) => void;
  onFileLevelIssueClick: (filePath: string, issue: ESLintIssue) => void;
}

export function FileTree({
  files,
  expandedFiles,
  onToggleFile,
  onElementHover,
  onElementClick,
  onFileLevelIssueClick,
}: FileTreeProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="py-1">
      {files.map((file) => {
        const isExpanded = expandedFiles.has(file.path);

        return (
          <div key={file.path}>
            {/* File header row */}
            <div
              className={cn(
                "flex items-center px-3 py-2 cursor-pointer transition-colors",
                isExpanded
                  ? "bg-blue-500/8"
                  : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
              )}
              title={file.path}
              onClick={() => onToggleFile(file.path)}
            >
              {/* Expand/collapse chevron */}
              <ChevronRight
                className={cn(
                  "w-4 h-4 mr-1.5 text-zinc-500 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />

              {/* File name */}
              <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-3">
                {file.disambiguatedName}
              </span>

              {/* Issue badge */}
              <IssueCountBadge count={file.issueCount} />
            </div>

            {/* Expanded element list */}
            {isExpanded && (
              <div className="bg-zinc-50/40 dark:bg-zinc-900/40 border-t border-b border-zinc-200 dark:border-zinc-800">
                {/* File-level issues section */}
                {file.fileLevelIssues.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[0.625rem]">
                      File-level issues
                    </div>
                    {file.fileLevelIssues.map((issue, index) => (
                      <IssueRow
                        key={`${issue.line}-${issue.column}-${index}`}
                        issue={issue}
                        issueCount={1}
                        tagName={file.displayName}
                        lineNumber={issue.line}
                        columnNumber={issue.column}
                        onFileLevelIssueClick={() =>
                          onFileLevelIssueClick(file.path, issue)
                        }
                        isFileLevel
                      />
                    ))}
                    {file.elementsWithIssues.length > 0 && (
                      <div className="h-px bg-zinc-200 dark:bg-zinc-800 mx-3 my-1" />
                    )}
                  </>
                )}
                {/* Element-level issues */}
                {file.elementsWithIssues.map((item) => (
                  <IssueRow
                    key={item.element.id}
                    element={item.element}
                    issueCount={item.issueCount}
                    tagName={item.element.tagName}
                    lineNumber={item.element.source.lineNumber}
                    columnNumber={item.element.source.columnNumber}
                    onHover={onElementHover}
                    onClick={onElementClick}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
