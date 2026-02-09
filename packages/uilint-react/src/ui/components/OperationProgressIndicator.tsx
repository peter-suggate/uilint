/**
 * OperationProgressIndicator - Shows a spinner in the toolbar when
 * plugin operations (semantic analysis, vision capture, etc.) are active.
 */
import React from "react";
import { useComposedStore } from "../../core/store";
import type { PluginOperation } from "../../core/store/core-slice";

function formatTooltip(ops: PluginOperation[]): string {
  return ops
    .map((op) => {
      const label = `${op.pluginId}: ${op.operationName}`;
      if (op.current != null && op.total != null) {
        return `${label} (${op.current}/${op.total})`;
      }
      if (op.message) {
        return `${label} — ${op.message}`;
      }
      return label;
    })
    .join("\n");
}

export function OperationProgressIndicator() {
  const operations = useComposedStore((s) => s.activePluginOperations);
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  const activeOps = Object.values(operations).filter(
    (op) => op.status === "active"
  );

  if (activeOps.length === 0) return null;

  const size = isMobile ? 44 : 36;
  const tooltip = formatTooltip(activeOps);

  return (
    <div
      className="relative flex items-center justify-center rounded-full border border-border bg-glass-medium"
      style={{ width: size, height: size }}
      title={tooltip}
      aria-label={`${activeOps.length} operation${activeOps.length > 1 ? "s" : ""} in progress`}
    >
      {/* Spinner ring */}
      <div
        className="animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
        style={{ width: size * 0.5, height: size * 0.5 }}
      />

      {/* Count badge when multiple ops */}
      {activeOps.length > 1 && (
        <span
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"
        >
          {activeOps.length}
        </span>
      )}
    </div>
  );
}
