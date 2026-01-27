/**
 * Socket CLI Types
 *
 * Shared types for the socket CLI tool and test harness.
 */

// ============================================================================
// Element Manifest
// ============================================================================

export interface ElementManifest {
  id: string;
  text: string;
  dataLoc: string;
  rect: { x: number; y: number; width: number; height: number };
  tagName: string;
  role?: string;
  instanceCount?: number;
}

// ============================================================================
// Client -> Server Messages
// ============================================================================

export interface LintFileMessage {
  type: "lint:file";
  filePath: string;
  requestId?: string;
}

export interface LintElementMessage {
  type: "lint:element";
  filePath: string;
  dataLoc: string;
  requestId?: string;
}

export interface VisionCheckMessage {
  type: "vision:check";
  requestId?: string;
}

export interface VisionAnalyzeMessage {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot?: string;
  screenshotFile?: string;
  manifest: ElementManifest[];
  requestId?: string;
}

export interface ConfigSetMessage {
  type: "config:set";
  key: string;
  value: unknown;
}

export interface RuleConfigSetMessage {
  type: "rule:config:set";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  requestId?: string;
}

export interface SourceFetchMessage {
  type: "source:fetch";
  filePath: string;
  requestId?: string;
}

export interface CoverageRequestMessage {
  type: "coverage:request";
  requestId?: string;
}

export interface SubscribeFileMessage {
  type: "subscribe:file";
  filePath: string;
}

export interface CacheInvalidateMessage {
  type: "cache:invalidate";
  filePath?: string;
}

export interface ScreenshotSaveMessage {
  type: "screenshot:save";
  dataUrl: string;
  route: string;
  timestamp: number;
  requestId?: string;
}

export type ClientMessage =
  | LintFileMessage
  | LintElementMessage
  | VisionCheckMessage
  | VisionAnalyzeMessage
  | ConfigSetMessage
  | RuleConfigSetMessage
  | SourceFetchMessage
  | CoverageRequestMessage
  | SubscribeFileMessage
  | CacheInvalidateMessage
  | ScreenshotSaveMessage;

// ============================================================================
// Server -> Client Messages
// ============================================================================

export interface LintIssue {
  line: number;
  column?: number;
  message: string;
  ruleId?: string;
  dataLoc?: string;
}

export interface LintResultMessage {
  type: "lint:result";
  filePath: string;
  issues: LintIssue[];
  requestId?: string;
}

export interface LintProgressMessage {
  type: "lint:progress";
  filePath: string;
  phase: string;
  requestId?: string;
}

export interface FileChangedMessage {
  type: "file:changed";
  filePath: string;
}

export interface WorkspaceInfoMessage {
  type: "workspace:info";
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
}

export interface WorkspaceCapabilitiesMessage {
  type: "workspace:capabilities";
  postToolUseHook: {
    enabled: boolean;
    provider: "claude" | "cursor" | null;
  };
}

export interface RulesMetadataMessage {
  type: "rules:metadata";
  rules: Array<{
    id: string;
    name: string;
    description: string;
    category: "static" | "semantic";
    defaultSeverity: "error" | "warn" | "off";
    currentSeverity?: "error" | "warn" | "off";
    currentOptions?: Record<string, unknown>;
    docs?: string;
  }>;
}

export interface VisionIssue {
  elementText: string;
  dataLoc?: string;
  message: string;
  category: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
}

export interface VisionResultMessage {
  type: "vision:result";
  route: string;
  issues: VisionIssue[];
  analysisTime: number;
  error?: string;
  requestId?: string;
}

export interface VisionProgressMessage {
  type: "vision:progress";
  route: string;
  phase: string;
  requestId?: string;
}

export interface VisionStatusMessage {
  type: "vision:status";
  available: boolean;
  model?: string;
  requestId?: string;
}

export interface ConfigUpdateMessage {
  type: "config:update";
  key: string;
  value: unknown;
}

export interface RuleConfigResultMessage {
  type: "rule:config:result";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  success: boolean;
  error?: string;
  requestId?: string;
}

export interface RuleConfigChangedMessage {
  type: "rule:config:changed";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

export interface SourceResultMessage {
  type: "source:result";
  filePath: string;
  content: string;
  totalLines: number;
  relativePath: string;
  requestId?: string;
}

export interface SourceErrorMessage {
  type: "source:error";
  filePath: string;
  error: string;
  requestId?: string;
}

export interface CoverageResultMessage {
  type: "coverage:result";
  coverage: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

export interface CoverageErrorMessage {
  type: "coverage:error";
  error: string;
  requestId?: string;
}

export interface DuplicatesIndexingStartMessage {
  type: "duplicates:indexing:start";
}

export interface DuplicatesIndexingProgressMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

export interface DuplicatesIndexingCompleteMessage {
  type: "duplicates:indexing:complete";
  added: number;
  modified: number;
  deleted: number;
  totalChunks: number;
  duration: number;
}

export interface DuplicatesIndexingErrorMessage {
  type: "duplicates:indexing:error";
  error: string;
}

export interface ScreenshotSavedMessage {
  type: "screenshot:saved";
  filename: string;
  path: string;
  requestId?: string;
}

export interface ScreenshotErrorMessage {
  type: "screenshot:error";
  error: string;
  requestId?: string;
}

export type ServerMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage
  | WorkspaceInfoMessage
  | WorkspaceCapabilitiesMessage
  | RulesMetadataMessage
  | VisionResultMessage
  | VisionProgressMessage
  | VisionStatusMessage
  | ConfigUpdateMessage
  | RuleConfigResultMessage
  | RuleConfigChangedMessage
  | SourceResultMessage
  | SourceErrorMessage
  | CoverageResultMessage
  | CoverageErrorMessage
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage
  | ScreenshotSavedMessage
  | ScreenshotErrorMessage;
