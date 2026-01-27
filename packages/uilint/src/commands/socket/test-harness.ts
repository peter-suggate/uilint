/**
 * Socket Test Harness
 *
 * A programmatic API for writing integration tests against the UILint socket server.
 * This provides a high-level interface for testing ESLint, Vision, and Semantic plugins.
 *
 * @example
 * ```typescript
 * import { createTestHarness } from 'uilint/socket-test';
 *
 * const harness = await createTestHarness({ port: 9234 });
 *
 * // Test linting
 * const lintResult = await harness.lintFile('app/page.tsx');
 * expect(lintResult.issues).toHaveLength(0);
 *
 * // Test vision
 * if (await harness.isVisionAvailable()) {
 *   const visionResult = await harness.analyzeVision({
 *     route: '/',
 *     screenshot: base64Image,
 *     manifest: elements,
 *   });
 *   expect(visionResult.issues).toHaveLength(0);
 * }
 *
 * await harness.close();
 * ```
 */

import { SocketClient, createSocketClient, type SocketClientOptions } from "./client.js";
import type {
  LintResultMessage,
  VisionResultMessage,
  VisionStatusMessage,
  SourceResultMessage,
  SourceErrorMessage,
  CoverageResultMessage,
  CoverageErrorMessage,
  RuleConfigResultMessage,
  WorkspaceInfoMessage,
  RulesMetadataMessage,
  ElementManifest,
  LintIssue,
  VisionIssue,
  ServerMessage,
} from "./types.js";

export interface TestHarnessOptions extends SocketClientOptions {
  /** Auto-wait for workspace info on connect (default: true) */
  waitForWorkspace?: boolean;
}

export interface VisionAnalyzeParams {
  route: string;
  manifest: ElementManifest[];
  screenshot?: string;
  screenshotFile?: string;
}

/**
 * Test harness for UILint socket server integration testing
 */
export class SocketTestHarness {
  private client: SocketClient;
  private workspaceInfo: WorkspaceInfoMessage | null = null;
  private rulesMetadata: RulesMetadataMessage | null = null;

  constructor(client: SocketClient) {
    this.client = client;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Check if connected to the server
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Close the connection
   */
  close(): void {
    this.client.disconnect();
  }

  /**
   * Get the underlying socket client
   */
  getClient(): SocketClient {
    return this.client;
  }

  // ==========================================================================
  // Workspace Information
  // ==========================================================================

  /**
   * Get workspace info (cached from connection)
   */
  async getWorkspaceInfo(): Promise<WorkspaceInfoMessage> {
    if (!this.workspaceInfo) {
      this.workspaceInfo = await this.client.waitForWorkspaceInfo();
    }
    return this.workspaceInfo;
  }

  /**
   * Get rules metadata (cached from connection)
   */
  async getRulesMetadata(): Promise<RulesMetadataMessage> {
    if (!this.rulesMetadata) {
      this.rulesMetadata = await this.client.waitForRulesMetadata();
    }
    return this.rulesMetadata;
  }

  /**
   * Get list of available rule IDs
   */
  async getRuleIds(): Promise<string[]> {
    const metadata = await this.getRulesMetadata();
    return metadata.rules.map((r) => r.id);
  }

  // ==========================================================================
  // Linting
  // ==========================================================================

  /**
   * Lint a file and return the result
   */
  async lintFile(filePath: string, timeout?: number): Promise<LintResultMessage> {
    return this.client.lintFile(filePath, timeout);
  }

  /**
   * Lint a file and return just the issues
   */
  async getLintIssues(filePath: string, timeout?: number): Promise<LintIssue[]> {
    const result = await this.lintFile(filePath, timeout);
    return result.issues;
  }

  /**
   * Lint a file and check if it passes (no issues)
   */
  async lintPasses(filePath: string, timeout?: number): Promise<boolean> {
    const issues = await this.getLintIssues(filePath, timeout);
    return issues.length === 0;
  }

  /**
   * Lint a file and get issues for a specific rule
   */
  async getIssuesForRule(filePath: string, ruleId: string, timeout?: number): Promise<LintIssue[]> {
    const issues = await this.getLintIssues(filePath, timeout);
    return issues.filter((i) => i.ruleId === ruleId);
  }

  /**
   * Lint a specific element
   */
  async lintElement(
    filePath: string,
    dataLoc: string,
    timeout?: number
  ): Promise<LintResultMessage> {
    return this.client.lintElement(filePath, dataLoc, timeout);
  }

  // ==========================================================================
  // Vision Analysis
  // ==========================================================================

  /**
   * Check if vision analysis is available
   */
  async isVisionAvailable(timeout?: number): Promise<boolean> {
    const status = await this.client.visionCheck(timeout);
    return status.available;
  }

  /**
   * Get vision status with model info
   */
  async getVisionStatus(timeout?: number): Promise<VisionStatusMessage> {
    return this.client.visionCheck(timeout);
  }

  /**
   * Run vision analysis on a screenshot
   */
  async analyzeVision(params: VisionAnalyzeParams, timeout?: number): Promise<VisionResultMessage> {
    return this.client.visionAnalyze(params, timeout);
  }

  /**
   * Run vision analysis and return just the issues
   */
  async getVisionIssues(params: VisionAnalyzeParams, timeout?: number): Promise<VisionIssue[]> {
    const result = await this.analyzeVision(params, timeout);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.issues;
  }

  /**
   * Run vision analysis and check if it passes (no issues)
   */
  async visionPasses(params: VisionAnalyzeParams, timeout?: number): Promise<boolean> {
    const issues = await this.getVisionIssues(params, timeout);
    return issues.length === 0;
  }

  // ==========================================================================
  // Source Fetching
  // ==========================================================================

  /**
   * Fetch source code for a file
   */
  async fetchSource(filePath: string, timeout?: number): Promise<string> {
    const result = await this.client.fetchSource(filePath, timeout);
    if (result.type === "source:error") {
      throw new Error(result.error);
    }
    return result.content;
  }

  /**
   * Check if a source file exists
   */
  async sourceExists(filePath: string, timeout?: number): Promise<boolean> {
    const result = await this.client.fetchSource(filePath, timeout);
    return result.type === "source:result";
  }

  // ==========================================================================
  // Coverage
  // ==========================================================================

  /**
   * Request coverage data
   */
  async getCoverage(
    timeout?: number
  ): Promise<CoverageResultMessage | CoverageErrorMessage> {
    return this.client.requestCoverage(timeout);
  }

  /**
   * Check if coverage data is available
   */
  async hasCoverage(timeout?: number): Promise<boolean> {
    const result = await this.getCoverage(timeout);
    return result.type === "coverage:result";
  }

  // ==========================================================================
  // Rule Configuration
  // ==========================================================================

  /**
   * Set a rule's severity
   */
  async setRuleSeverity(
    ruleId: string,
    severity: "error" | "warn" | "off",
    timeout?: number
  ): Promise<RuleConfigResultMessage> {
    return this.client.setRuleConfig(ruleId, severity, undefined, timeout);
  }

  /**
   * Set a rule's configuration (severity + options)
   */
  async setRuleConfig(
    ruleId: string,
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>,
    timeout?: number
  ): Promise<RuleConfigResultMessage> {
    return this.client.setRuleConfig(ruleId, severity, options, timeout);
  }

  /**
   * Disable a rule
   */
  async disableRule(ruleId: string, timeout?: number): Promise<boolean> {
    const result = await this.setRuleSeverity(ruleId, "off", timeout);
    return result.success;
  }

  /**
   * Enable a rule as error
   */
  async enableRuleAsError(ruleId: string, timeout?: number): Promise<boolean> {
    const result = await this.setRuleSeverity(ruleId, "error", timeout);
    return result.success;
  }

  /**
   * Enable a rule as warning
   */
  async enableRuleAsWarning(ruleId: string, timeout?: number): Promise<boolean> {
    const result = await this.setRuleSeverity(ruleId, "warn", timeout);
    return result.success;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Invalidate the lint cache for a file or all files
   */
  invalidateCache(filePath?: string): void {
    this.client.invalidateCache(filePath);
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Wait for a specific message type
   */
  waitFor<T extends ServerMessage>(
    predicate: (msg: ServerMessage) => msg is T,
    timeout?: number
  ): Promise<T>;
  waitFor(predicate: (msg: ServerMessage) => boolean, timeout?: number): Promise<ServerMessage>;
  waitFor(
    predicate: (msg: ServerMessage) => boolean,
    timeout = 30000
  ): Promise<ServerMessage> {
    return this.client.waitFor(predicate, timeout);
  }

  /**
   * Add a message handler
   */
  onMessage(handler: (msg: ServerMessage) => void): () => void {
    return this.client.onMessage(handler);
  }

  /**
   * Get queued messages
   */
  getQueuedMessages(): ServerMessage[] {
    return this.client.getMessages();
  }

  /**
   * Clear queued messages
   */
  clearQueuedMessages(): void {
    this.client.clearMessages();
  }
}

/**
 * Create a test harness connected to the socket server
 */
export async function createTestHarness(
  options: TestHarnessOptions = {}
): Promise<SocketTestHarness> {
  const waitForWorkspace = options.waitForWorkspace !== false;

  const client = await createSocketClient(options);
  const harness = new SocketTestHarness(client);

  if (waitForWorkspace) {
    try {
      await harness.getWorkspaceInfo();
    } catch {
      // Ignore timeout, workspace info will be fetched on demand
    }
  }

  return harness;
}

// Re-export types for convenience
export type {
  ElementManifest,
  LintIssue,
  VisionIssue,
  LintResultMessage,
  VisionResultMessage,
  VisionStatusMessage,
  SourceResultMessage,
  SourceErrorMessage,
  CoverageResultMessage,
  CoverageErrorMessage,
  RuleConfigResultMessage,
  WorkspaceInfoMessage,
  RulesMetadataMessage,
  ServerMessage,
} from "./types.js";
