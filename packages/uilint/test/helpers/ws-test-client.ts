/**
 * WebSocket test client helper
 *
 * A lightweight WebSocket client for E2E testing the UILint server.
 * Allows sending messages and waiting for specific responses.
 */

import WebSocket from "ws";

export interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// Lint Messages
// ============================================================================

export interface LintFileMessage extends ClientMessage {
  type: "lint:file";
  filePath: string;
  requestId?: string;
}

export interface LintElementMessage extends ClientMessage {
  type: "lint:element";
  filePath: string;
  dataLoc: string;
  requestId?: string;
}

export interface LintResultMessage extends ServerMessage {
  type: "lint:result";
  filePath: string;
  issues: Array<{
    line: number;
    column?: number;
    message: string;
    ruleId?: string;
    dataLoc?: string;
  }>;
  requestId?: string;
}

export interface LintProgressMessage extends ServerMessage {
  type: "lint:progress";
  filePath: string;
  phase: string;
  requestId?: string;
}

// ============================================================================
// Vision Messages
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

export interface VisionAnalyzeMessage extends ClientMessage {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot?: string;
  screenshotFile?: string;
  manifest: ElementManifest[];
  requestId?: string;
}

export interface VisionCheckMessage extends ClientMessage {
  type: "vision:check";
  requestId?: string;
}

export interface VisionResultMessage extends ServerMessage {
  type: "vision:result";
  route: string;
  issues: Array<{
    elementText: string;
    dataLoc?: string;
    message: string;
    category: string;
    severity: "error" | "warning" | "info";
    suggestion?: string;
  }>;
  analysisTime: number;
  error?: string;
  requestId?: string;
}

export interface VisionProgressMessage extends ServerMessage {
  type: "vision:progress";
  route: string;
  phase: string;
  requestId?: string;
}

export interface VisionStatusMessage extends ServerMessage {
  type: "vision:status";
  available: boolean;
  model?: string;
  requestId?: string;
}

// ============================================================================
// Workspace Messages
// ============================================================================

export interface WorkspaceInfoMessage extends ServerMessage {
  type: "workspace:info";
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
}

export interface WorkspaceCapabilitiesMessage extends ServerMessage {
  type: "workspace:capabilities";
  postToolUseHook: {
    enabled: boolean;
    provider: "claude" | "cursor" | null;
  };
}

export interface RulesMetadataMessage extends ServerMessage {
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

// ============================================================================
// Config Messages
// ============================================================================

export interface ConfigSetMessage extends ClientMessage {
  type: "config:set";
  key: string;
  value: unknown;
}

export interface ConfigUpdateMessage extends ServerMessage {
  type: "config:update";
  key: string;
  value: unknown;
}

export interface RuleConfigSetMessage extends ClientMessage {
  type: "rule:config:set";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  requestId?: string;
}

export interface RuleConfigResultMessage extends ServerMessage {
  type: "rule:config:result";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  success: boolean;
  error?: string;
  requestId?: string;
}

export interface RuleConfigChangedMessage extends ServerMessage {
  type: "rule:config:changed";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

// ============================================================================
// Source Messages
// ============================================================================

export interface SourceFetchMessage extends ClientMessage {
  type: "source:fetch";
  filePath: string;
  requestId?: string;
}

export interface SourceResultMessage extends ServerMessage {
  type: "source:result";
  filePath: string;
  content: string;
  totalLines: number;
  relativePath: string;
  requestId?: string;
}

export interface SourceErrorMessage extends ServerMessage {
  type: "source:error";
  filePath: string;
  error: string;
  requestId?: string;
}

// ============================================================================
// Coverage Messages
// ============================================================================

export interface CoverageRequestMessage extends ClientMessage {
  type: "coverage:request";
  requestId?: string;
}

export interface CoverageResultMessage extends ServerMessage {
  type: "coverage:result";
  coverage: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

export interface CoverageErrorMessage extends ServerMessage {
  type: "coverage:error";
  error: string;
  requestId?: string;
}

// ============================================================================
// Duplicates/Semantic Messages
// ============================================================================

export interface DuplicatesIndexingStartMessage extends ServerMessage {
  type: "duplicates:indexing:start";
}

export interface DuplicatesIndexingProgressMessage extends ServerMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

export interface DuplicatesIndexingCompleteMessage extends ServerMessage {
  type: "duplicates:indexing:complete";
  added: number;
  modified: number;
  deleted: number;
  totalChunks: number;
  duration: number;
}

export interface DuplicatesIndexingErrorMessage extends ServerMessage {
  type: "duplicates:indexing:error";
  error: string;
}

// ============================================================================
// Subscription Messages
// ============================================================================

export interface SubscribeFileMessage extends ClientMessage {
  type: "subscribe:file";
  filePath: string;
}

export interface CacheInvalidateMessage extends ClientMessage {
  type: "cache:invalidate";
  filePath?: string;
}

export interface FileChangedMessage extends ServerMessage {
  type: "file:changed";
  filePath: string;
}

// ============================================================================
// Screenshot Messages
// ============================================================================

export interface ScreenshotSaveMessage extends ClientMessage {
  type: "screenshot:save";
  dataUrl: string;
  route: string;
  timestamp: number;
  requestId?: string;
}

export interface ScreenshotSavedMessage extends ServerMessage {
  type: "screenshot:saved";
  filename: string;
  path: string;
  requestId?: string;
}

export interface ScreenshotErrorMessage extends ServerMessage {
  type: "screenshot:error";
  error: string;
  requestId?: string;
}

export class WsTestClient {
  private ws: WebSocket | null = null;
  private messageQueue: ServerMessage[] = [];
  private waiters: Array<{
    predicate: (msg: ServerMessage) => boolean;
    resolve: (msg: ServerMessage) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    private url: string,
    private options: { debug?: boolean } = {}
  ) {}

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout to ${this.url}`));
      }, 10000);

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        this.connected = true;
        if (this.options.debug) {
          console.log(`[WsTestClient] Connected to ${this.url}`);
        }
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as ServerMessage;
          if (this.options.debug) {
            console.log(`[WsTestClient] Received:`, message.type);
          }
          this.handleMessage(message);
        } catch (e) {
          console.error("[WsTestClient] Failed to parse message:", e);
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(err);
        } else {
          console.error("[WsTestClient] WebSocket error:", err);
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        if (this.options.debug) {
          console.log("[WsTestClient] Disconnected");
        }
      });
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.connectionPromise = null;
    }
    // Reject all pending waiters
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Disconnected"));
    }
    this.waiters = [];
  }

  /**
   * Send a message to the server
   */
  send(message: ClientMessage): void {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected");
    }
    if (this.options.debug) {
      console.log(`[WsTestClient] Sending:`, message.type);
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ==========================================================================
  // Lint Methods
  // ==========================================================================

  /**
   * Send a lint:file request and wait for the result
   */
  async lintFile(
    filePath: string,
    options: { timeout?: number } = {}
  ): Promise<LintResultMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "lint:file",
      filePath,
      requestId,
    } as LintFileMessage);

    return (await this.waitFor(
      (msg) =>
        msg.type === "lint:result" &&
        (msg as LintResultMessage).requestId === requestId,
      options.timeout || 30000
    )) as LintResultMessage;
  }

  /**
   * Send a lint:element request and wait for the result
   */
  async lintElement(
    filePath: string,
    dataLoc: string,
    options: { timeout?: number } = {}
  ): Promise<LintResultMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "lint:element",
      filePath,
      dataLoc,
      requestId,
    } as LintElementMessage);

    return (await this.waitFor(
      (msg) =>
        msg.type === "lint:result" &&
        (msg as LintResultMessage).requestId === requestId,
      options.timeout || 30000
    )) as LintResultMessage;
  }

  // ==========================================================================
  // Vision Methods
  // ==========================================================================

  /**
   * Check if vision analysis is available (Ollama running)
   */
  async visionCheck(options: { timeout?: number } = {}): Promise<VisionStatusMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "vision:check",
      requestId,
    } as VisionCheckMessage);

    return (await this.waitFor(
      (msg) =>
        msg.type === "vision:status" &&
        (msg as VisionStatusMessage).requestId === requestId,
      options.timeout || 10000
    )) as VisionStatusMessage;
  }

  /**
   * Run vision analysis on a screenshot
   */
  async visionAnalyze(
    params: {
      route: string;
      manifest: ElementManifest[];
      screenshot?: string;
      screenshotFile?: string;
    },
    options: { timeout?: number } = {}
  ): Promise<VisionResultMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "vision:analyze",
      route: params.route,
      timestamp: Date.now(),
      screenshot: params.screenshot,
      screenshotFile: params.screenshotFile,
      manifest: params.manifest,
      requestId,
    } as VisionAnalyzeMessage);

    return (await this.waitFor(
      (msg) =>
        msg.type === "vision:result" &&
        (msg as VisionResultMessage).requestId === requestId,
      options.timeout || 120000 // Vision analysis can take a while
    )) as VisionResultMessage;
  }

  // ==========================================================================
  // Workspace Methods
  // ==========================================================================

  /**
   * Wait for the workspace:info message (sent on connect)
   */
  async waitForWorkspaceInfo(timeout = 5000): Promise<WorkspaceInfoMessage> {
    // Check if we already received it
    const existing = this.messageQueue.find(
      (m) => m.type === "workspace:info"
    );
    if (existing) {
      return existing as WorkspaceInfoMessage;
    }

    return (await this.waitFor(
      (msg) => msg.type === "workspace:info",
      timeout
    )) as WorkspaceInfoMessage;
  }

  /**
   * Wait for workspace:capabilities message (sent on connect)
   */
  async waitForWorkspaceCapabilities(timeout = 5000): Promise<WorkspaceCapabilitiesMessage> {
    const existing = this.messageQueue.find(
      (m) => m.type === "workspace:capabilities"
    );
    if (existing) {
      return existing as WorkspaceCapabilitiesMessage;
    }

    return (await this.waitFor(
      (msg) => msg.type === "workspace:capabilities",
      timeout
    )) as WorkspaceCapabilitiesMessage;
  }

  /**
   * Wait for rules:metadata message (sent on connect)
   */
  async waitForRulesMetadata(timeout = 5000): Promise<RulesMetadataMessage> {
    // Check if we already received it
    const existing = this.messageQueue.find(
      (m) => m.type === "rules:metadata"
    );
    if (existing) {
      return existing as RulesMetadataMessage;
    }

    return (await this.waitFor(
      (msg) => msg.type === "rules:metadata",
      timeout
    )) as RulesMetadataMessage;
  }

  // ==========================================================================
  // Config Methods
  // ==========================================================================

  /**
   * Set a configuration value
   */
  setConfig(key: string, value: unknown): void {
    this.send({
      type: "config:set",
      key,
      value,
    } as ConfigSetMessage);
  }

  /**
   * Set a rule configuration and wait for the result
   */
  async setRuleConfig(
    ruleId: string,
    severity: "error" | "warn" | "off",
    ruleOptions?: Record<string, unknown>,
    options: { timeout?: number } = {}
  ): Promise<RuleConfigResultMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "rule:config:set",
      ruleId,
      severity,
      options: ruleOptions,
      requestId,
    } as RuleConfigSetMessage);

    return (await this.waitFor(
      (msg) =>
        msg.type === "rule:config:result" &&
        (msg as RuleConfigResultMessage).requestId === requestId,
      options.timeout || 10000
    )) as RuleConfigResultMessage;
  }

  // ==========================================================================
  // Source Methods
  // ==========================================================================

  /**
   * Fetch source code for a file
   */
  async fetchSource(
    filePath: string,
    options: { timeout?: number } = {}
  ): Promise<SourceResultMessage | SourceErrorMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "source:fetch",
      filePath,
      requestId,
    } as SourceFetchMessage);

    return (await this.waitFor(
      (msg) =>
        (msg.type === "source:result" || msg.type === "source:error") &&
        ((msg as SourceResultMessage).requestId === requestId ||
          (msg as SourceErrorMessage).requestId === requestId),
      options.timeout || 10000
    )) as SourceResultMessage | SourceErrorMessage;
  }

  // ==========================================================================
  // Coverage Methods
  // ==========================================================================

  /**
   * Request coverage data
   */
  async requestCoverage(
    options: { timeout?: number } = {}
  ): Promise<CoverageResultMessage | CoverageErrorMessage> {
    const requestId = this.generateRequestId();

    this.send({
      type: "coverage:request",
      requestId,
    } as CoverageRequestMessage);

    return (await this.waitFor(
      (msg) =>
        (msg.type === "coverage:result" || msg.type === "coverage:error") &&
        ((msg as CoverageResultMessage).requestId === requestId ||
          (msg as CoverageErrorMessage).requestId === requestId),
      options.timeout || 30000
    )) as CoverageResultMessage | CoverageErrorMessage;
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to file changes
   */
  subscribeFile(filePath: string): void {
    this.send({
      type: "subscribe:file",
      filePath,
    } as SubscribeFileMessage);
  }

  /**
   * Invalidate the lint cache
   */
  invalidateCache(filePath?: string): void {
    this.send({
      type: "cache:invalidate",
      filePath,
    } as CacheInvalidateMessage);
  }

  /**
   * Wait for a file:changed notification
   */
  async waitForFileChanged(
    filePath?: string,
    timeout = 10000
  ): Promise<FileChangedMessage> {
    return (await this.waitFor(
      (msg) =>
        msg.type === "file:changed" &&
        (filePath === undefined || (msg as FileChangedMessage).filePath === filePath),
      timeout
    )) as FileChangedMessage;
  }

  // ==========================================================================
  // Duplicates/Semantic Methods
  // ==========================================================================

  /**
   * Wait for duplicates indexing to complete
   */
  async waitForDuplicatesIndexingComplete(
    timeout = 60000
  ): Promise<DuplicatesIndexingCompleteMessage> {
    return (await this.waitFor(
      (msg) => msg.type === "duplicates:indexing:complete",
      timeout
    )) as DuplicatesIndexingCompleteMessage;
  }

  /**
   * Wait for duplicates indexing to start
   */
  async waitForDuplicatesIndexingStart(
    timeout = 30000
  ): Promise<DuplicatesIndexingStartMessage> {
    // Check if already received
    const existing = this.messageQueue.find(
      (m) => m.type === "duplicates:indexing:start"
    );
    if (existing) {
      return existing as DuplicatesIndexingStartMessage;
    }

    return (await this.waitFor(
      (msg) => msg.type === "duplicates:indexing:start",
      timeout
    )) as DuplicatesIndexingStartMessage;
  }

  /**
   * Collect all duplicates indexing progress messages until complete
   */
  async collectDuplicatesIndexingMessages(
    timeout = 60000
  ): Promise<{
    start?: DuplicatesIndexingStartMessage;
    progress: DuplicatesIndexingProgressMessage[];
    complete?: DuplicatesIndexingCompleteMessage;
    error?: DuplicatesIndexingErrorMessage;
  }> {
    const result: {
      start?: DuplicatesIndexingStartMessage;
      progress: DuplicatesIndexingProgressMessage[];
      complete?: DuplicatesIndexingCompleteMessage;
      error?: DuplicatesIndexingErrorMessage;
    } = { progress: [] };

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const msg = await this.waitFor(
          (m) => m.type.startsWith("duplicates:indexing:"),
          Math.max(1000, timeout - (Date.now() - startTime))
        );

        if (msg.type === "duplicates:indexing:start") {
          result.start = msg as DuplicatesIndexingStartMessage;
        } else if (msg.type === "duplicates:indexing:progress") {
          result.progress.push(msg as DuplicatesIndexingProgressMessage);
        } else if (msg.type === "duplicates:indexing:complete") {
          result.complete = msg as DuplicatesIndexingCompleteMessage;
          break;
        } else if (msg.type === "duplicates:indexing:error") {
          result.error = msg as DuplicatesIndexingErrorMessage;
          break;
        }
      } catch {
        // Timeout on single message, check if we're done
        break;
      }
    }

    return result;
  }

  /**
   * Wait for a message matching the predicate
   */
  async waitFor(
    predicate: (msg: ServerMessage) => boolean,
    timeout = 10000
  ): Promise<ServerMessage> {
    // Check existing messages first
    const existing = this.messageQueue.find(predicate);
    if (existing) {
      // Remove from queue
      this.messageQueue = this.messageQueue.filter((m) => m !== existing);
      return existing;
    }

    // Wait for new message
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timeout !== timeoutId);
        reject(new Error(`Timeout waiting for message (${timeout}ms)`));
      }, timeout);

      this.waiters.push({
        predicate,
        resolve,
        reject,
        timeout: timeoutId,
      });
    });
  }

  /**
   * Get all messages received so far
   */
  getMessages(): ServerMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Clear the message queue
   */
  clearMessages(): void {
    this.messageQueue = [];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(message: ServerMessage): void {
    // Check if any waiter matches
    for (let i = 0; i < this.waiters.length; i++) {
      const waiter = this.waiters[i]!;
      if (waiter.predicate(message)) {
        clearTimeout(waiter.timeout);
        this.waiters.splice(i, 1);
        waiter.resolve(message);
        return;
      }
    }

    // Otherwise queue it
    this.messageQueue.push(message);
  }
}

/**
 * Create a test client and connect to the server
 */
export async function createTestClient(
  port = 9234,
  options: { debug?: boolean } = {}
): Promise<WsTestClient> {
  const client = new WsTestClient(`ws://localhost:${port}`, options);
  await client.connect();
  return client;
}
