/**
 * Code Viewer Section Renderer
 *
 * Renders a code block with syntax highlighting and optional diff highlighting.
 * Uses the existing ScrollableCodeSection component when available.
 */

import React from "react";
import type { CodeViewerSection as CodeViewerSectionSchema } from "uilint-core";
import {
  resolveDynamicValue,
  resolveBinding,
  createActionPayload,
  isDataBinding,
  type BindingContext,
} from "../binding-utils";
import { getIcon } from "../icon-map";

interface CodeViewerSectionProps {
  section: CodeViewerSectionSchema;
  ctx: BindingContext;
  onAction: (type: string, payload: Record<string, unknown>) => void;
  onFetch?: (type: string, params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Simple code display component (placeholder for full ScrollableCodeSection)
 */
function SimpleCodeViewer({
  code,
  startLine = 1,
  highlightLines,
  maxHeight,
}: {
  code: string;
  startLine?: number;
  highlightLines?: number[];
  maxHeight?: number;
}) {
  const lines = code.split("\n");
  const highlightSet = new Set(highlightLines || []);

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "0.75rem",
        backgroundColor: "var(--uilint-surface)",
        borderRadius: "4px",
        border: "1px solid var(--uilint-border)",
        overflow: "auto",
        maxHeight: maxHeight || 200,
      }}
    >
      {lines.map((line, index) => {
        const lineNum = startLine + index;
        const isHighlighted = highlightSet.has(lineNum);

        return (
          <div
            key={index}
            style={{
              display: "flex",
              backgroundColor: isHighlighted
                ? "rgba(var(--uilint-accent-rgb), 0.15)"
                : "transparent",
            }}
          >
            <span
              style={{
                width: "3rem",
                paddingRight: "0.5rem",
                textAlign: "right",
                color: "var(--uilint-text-muted)",
                userSelect: "none",
                flexShrink: 0,
                borderRight: "1px solid var(--uilint-border)",
              }}
            >
              {lineNum}
            </span>
            <pre
              style={{
                margin: 0,
                padding: "0 0.5rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {line || " "}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders a code viewer section
 */
export function CodeViewerSection({
  section,
  ctx,
  onAction,
  onFetch,
}: CodeViewerSectionProps) {
  const [code, setCode] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Determine code source
  const codeSource = section.code;

  React.useEffect(() => {
    if (isDataBinding(codeSource)) {
      // Code comes from binding
      const boundCode = resolveBinding(codeSource, ctx);
      setCode(typeof boundCode === "string" ? boundCode : null);
    } else if ("fetch" in codeSource && onFetch) {
      // Code needs to be fetched
      setIsLoading(true);
      const fetchConfig = codeSource.fetch;
      const params: Record<string, unknown> = {};

      // Resolve fetch params
      if (fetchConfig.params.filePath) {
        params.filePath = resolveBinding(fetchConfig.params.filePath, ctx);
      }
      if (fetchConfig.params.line) {
        params.line = resolveBinding(fetchConfig.params.line, ctx);
      }
      if (fetchConfig.params.contextAbove !== undefined) {
        params.contextAbove = fetchConfig.params.contextAbove;
      }
      if (fetchConfig.params.contextBelow !== undefined) {
        params.contextBelow = fetchConfig.params.contextBelow;
      }

      onFetch(fetchConfig.type, params)
        .then((result) => {
          setCode(typeof result === "string" ? result : JSON.stringify(result, null, 2));
        })
        .catch((error) => {
          console.error("[CodeViewerSection] Fetch failed:", error);
          setCode(`// Error loading code: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [codeSource, ctx, onFetch]);

  const startLine = resolveDynamicValue(section.startLine, ctx);
  const highlightLines = section.highlightLines
    ? (resolveBinding(section.highlightLines, ctx) as number[] | undefined)
    : undefined;

  const IconComponent = section.icon ? getIcon(section.icon) : null;

  const handleNavigate = section.onNavigate
    ? () => {
        const payload = createActionPayload(
          section.onNavigate!.payload,
          section.onNavigate!.payloadBindings,
          ctx
        );
        onAction(section.onNavigate!.type, payload);
      }
    : undefined;

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {section.label && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {IconComponent && (
              <span style={{ color: "var(--uilint-text-muted)" }}>
                <IconComponent size={14} />
              </span>
            )}
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--uilint-text-secondary)",
              }}
            >
              {section.label}
            </span>
          </div>
          {handleNavigate && (
            <button
              onClick={handleNavigate}
              style={{
                background: "none",
                border: "none",
                padding: "0.25rem",
                cursor: "pointer",
                color: "var(--uilint-accent)",
                fontSize: "0.75rem",
              }}
            >
              Open in editor
            </button>
          )}
        </div>
      )}
      {isLoading ? (
        <div
          style={{
            padding: "1rem",
            textAlign: "center",
            color: "var(--uilint-text-muted)",
            fontSize: "0.75rem",
            backgroundColor: "var(--uilint-surface)",
            borderRadius: "4px",
            border: "1px solid var(--uilint-border)",
          }}
        >
          Loading code...
        </div>
      ) : code ? (
        <SimpleCodeViewer
          code={code}
          startLine={typeof startLine === "number" ? startLine : 1}
          highlightLines={highlightLines}
          maxHeight={section.maxHeight}
        />
      ) : (
        <div
          style={{
            padding: "1rem",
            textAlign: "center",
            color: "var(--uilint-text-muted)",
            fontSize: "0.75rem",
            backgroundColor: "var(--uilint-surface)",
            borderRadius: "4px",
            border: "1px solid var(--uilint-border)",
          }}
        >
          No code available
        </div>
      )}
    </div>
  );
}
