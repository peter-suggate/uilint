/**
 * FileHeader - File group header in command palette
 */
import React from "react";
import { FileIcon } from "../../icons";

interface FileHeaderProps {
  fileName: string;
  directory: string;
  count: number;
}

export function FileHeader({ fileName, directory, count }: FileHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border-b border-border">
      <FileIcon size={14} className="text-muted-foreground shrink-0" />
      <span className="text-xs font-medium text-foreground">{fileName}</span>
      {directory && (
        <span className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">
          {directory}
        </span>
      )}
      <span className="text-xs font-medium text-muted-foreground bg-hover px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}
