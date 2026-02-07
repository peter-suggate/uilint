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
      className="font-mono text-xs bg-surface rounded border border-border overflow-auto"
      style={{ maxHeight: maxHeight || 200 }}
    >
      {lines.map((line, index) => {
        const lineNum = startLine + index;
        const isHighlighted = highlightSet.has(lineNum);

        return (
          <div
            key={index}
            className={`flex ${isHighlighted ? "bg-accent/15" : "bg-transparent"}`}
          >
            <span className="w-12 pr-2 text-right text-muted-foreground select-none shrink-0 border-r border-border">
              {lineNum}
            </span>
            <pre className="m-0 px-2 whitespace-pre-wrap break-all flex-1">
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
    <div className="mb-3">
      {section.label && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {IconComponent && (
              <span className="text-muted-foreground">
                <IconComponent size={14} />
              </span>
            )}
            <span className="text-xs font-medium text-text-secondary">
              {section.label}
            </span>
          </div>
          {handleNavigate && (
            <button
              onClick={handleNavigate}
              className="bg-transparent border-none p-1 cursor-pointer text-accent text-xs"
            >
              Open in editor
            </button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground text-xs bg-surface rounded border border-border">
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
        <div className="p-4 text-center text-muted-foreground text-xs bg-surface rounded border border-border">
          No code available
        </div>
      )}
    </div>
  );
}
