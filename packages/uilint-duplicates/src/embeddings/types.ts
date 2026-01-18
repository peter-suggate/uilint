/**
 * Core types for code chunking and embeddings
 */

export type ChunkKind =
  | "component"
  | "hook"
  | "function"
  | "jsx-fragment"
  | "jsx-section"
  | "component-summary"
  | "function-section"
  | "function-summary";

export interface ChunkMetadata {
  /** Props/parameters for components and hooks */
  props?: string[];
  /** React hooks used in the chunk */
  hooks?: string[];
  /** JSX element tags used */
  jsxElements?: string[];
  /** Import dependencies */
  imports?: string[];
  /** Whether the chunk is exported */
  isExported?: boolean;
  /** Whether it's a default export */
  isDefaultExport?: boolean;
}

export interface CodeChunk {
  /** Unique identifier (hash of content + location) */
  id: string;
  /** Absolute file path */
  filePath: string;
  /** Start line number (1-indexed) */
  startLine: number;
  /** End line number (1-indexed) */
  endLine: number;
  /** Start column */
  startColumn: number;
  /** End column */
  endColumn: number;
  /** Type of code chunk */
  kind: ChunkKind;
  /** Name of the function/component/hook (null if anonymous) */
  name: string | null;
  /** Raw source code content */
  content: string;
  /** Extracted metadata */
  metadata: ChunkMetadata;
  /** Parent chunk ID (for sub-chunks like jsx-section) */
  parentId?: string;
  /** Section index within parent (for ordering) */
  sectionIndex?: number;
  /** Human-readable section label (e.g., "header", "form-fields") */
  sectionLabel?: string;
}

export interface ChunkingOptions {
  /** Minimum number of lines for a chunk (default: 3) */
  minLines?: number;
  /** Maximum lines before splitting a component (default: 100) */
  maxLines?: number;
  /** Whether to include anonymous functions (default: false) */
  includeAnonymous?: boolean;
  /** Chunk kinds to extract (default: all) */
  kinds?: ChunkKind[];
  /** Strategy for splitting large chunks (default: "jsx-children") */
  splitStrategy?: "jsx-children" | "line-based" | "none";
}
