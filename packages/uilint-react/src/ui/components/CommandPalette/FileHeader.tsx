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
    <div
      style={{
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#fafafa",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <FileIcon size={14} color="#6b7280" />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#374151",
        }}
      >
        {fileName}
      </span>
      {directory && (
        <span
          style={{
            fontSize: 11,
            color: "#9ca3af",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {directory}
        </span>
      )}
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "#6b7280",
          background: "#e5e7eb",
          padding: "1px 6px",
          borderRadius: 10,
        }}
      >
        {count}
      </span>
    </div>
  );
}
