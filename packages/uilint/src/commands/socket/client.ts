/**
 * Socket Client
 *
 * WebSocket client for communicating with the UILint socket server.
 * Provides request/response correlation and message handling.
 */

import WebSocket from "ws";
import type {
  ClientMessage,
  ServerMessage,
  LintResultMessage,
  VisionStatusMessage,
  VisionResultMessage,
  SourceResultMessage,
  SourceErrorMessage,
  CoverageResultMessage,
  CoverageErrorMessage,
  RuleConfigResultMessage,
  WorkspaceInfoMessage,
  RulesMetadataMessage,
  ElementManifest,
} from "./types.js";

export interface SocketClientOptions {
  /** WebSocket URL (default: ws://localhost:9234) */
  url?: string;
  /** Port number (convenience, overrides url) */
  port?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Connection timeout in ms (default: 10000) */
  connectTimeout?: number;
}

type MessageHandler = (message: ServerMessage) => void;

interface PendingRequest {
  predicate: (msg: ServerMessage) => boolean;
  resolve: (msg: ServerMessage) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export class SocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private debug: boolean;
  private connectTimeout: number;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;
  private pendingRequests: PendingRequest[] = [];
  private messageQueue: ServerMessage[] = [];
  private messageHandlers: MessageHandler[] = [];

  constructor(options: SocketClientOptions = {}) {
    const port = options.port || 9234;
    this.url = options.url || `ws://localhost:${port}`;
    this.debug = options.debug || false;
    this.connectTimeout = options.connectTimeout || 10000;
  }

  /**
   * Connect to the socket server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout to ${this.url}`));
      }, this.connectTimeout);

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        this.connected = true;
        this.log("Connected to", this.url);
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as ServerMessage;
          this.log("Received:", message.type);
          this.handleMessage(message);
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(err);
        } else {
          console.error("WebSocket error:", err);
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.log("Disconnected");
        // Reject all pending requests
        for (const req of this.pendingRequests) {
          clearTimeout(req.timeout);
          req.reject(new Error("Disconnected"));
        }
        this.pendingRequests = [];
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
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Add a handler for all incoming messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Send a raw message
   */
  send(message: ClientMessage): void {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected");
    }
    this.log("Sending:", message.type);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Wait for a message matching the predicate
   */
  waitFor(
    predicate: (msg: ServerMessage) => boolean,
    timeout = 30000
  ): Promise<ServerMessage> {
    // Check existing messages first
    const existing = this.messageQueue.find(predicate);
    if (existing) {
      this.messageQueue = this.messageQueue.filter((m) => m !== existing);
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests = this.pendingRequests.filter(
          (r) => r.timeout !== timeoutId
        );
        reject(new Error(`Timeout waiting for message (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.push({
        predicate,
        resolve,
        reject,
        timeout: timeoutId,
      });
    });
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ==========================================================================
  // High-Level API Methods
  // ==========================================================================

  /**
   * Wait for workspace info (sent on connect)
   */
  async waitForWorkspaceInfo(timeout = 5000): Promise<WorkspaceInfoMessage> {
    const existing = this.messageQueue.find((m) => m.type === "workspace:info");
    if (existing) {
      return existing as WorkspaceInfoMessage;
    }
    return (await this.waitFor(
      (msg) => msg.type === "workspace:info",
      timeout
    )) as WorkspaceInfoMessage;
  }

  /**
   * Wait for rules metadata (sent on connect)
   */
  async waitForRulesMetadata(timeout = 5000): Promise<RulesMetadataMessage> {
    const existing = this.messageQueue.find((m) => m.type === "rules:metadata");
    if (existing) {
      return existing as RulesMetadataMessage;
    }
    return (await this.waitFor(
      (msg) => msg.type === "rules:metadata",
      timeout
    )) as RulesMetadataMessage;
  }

  /**
   * Lint a file
   */
  async lintFile(filePath: string, timeout = 30000): Promise<LintResultMessage> {
    const requestId = this.generateRequestId();
    this.send({ type: "lint:file", filePath, requestId });
    return (await this.waitFor(
      (msg) =>
        msg.type === "lint:result" &&
        (msg as LintResultMessage).requestId === requestId,
      timeout
    )) as LintResultMessage;
  }

  /**
   * Lint a specific element
   */
  async lintElement(
    filePath: string,
    dataLoc: string,
    timeout = 30000
  ): Promise<LintResultMessage> {
    const requestId = this.generateRequestId();
    this.send({ type: "lint:element", filePath, dataLoc, requestId });
    return (await this.waitFor(
      (msg) =>
        msg.type === "lint:result" &&
        (msg as LintResultMessage).requestId === requestId,
      timeout
    )) as LintResultMessage;
  }

  /**
   * Check if vision analysis is available
   */
  async visionCheck(timeout = 10000): Promise<VisionStatusMessage> {
    const requestId = this.generateRequestId();
    this.send({ type: "vision:check", requestId });
    return (await this.waitFor(
      (msg) =>
        msg.type === "vision:status" &&
        (msg as VisionStatusMessage).requestId === requestId,
      timeout
    )) as VisionStatusMessage;
  }

  /**
   * Run vision analysis
   */
  async visionAnalyze(
    params: {
      route: string;
      manifest: ElementManifest[];
      screenshot?: string;
      screenshotFile?: string;
    },
    timeout = 120000
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
    });
    return (await this.waitFor(
      (msg) =>
        msg.type === "vision:result" &&
        (msg as VisionResultMessage).requestId === requestId,
      timeout
    )) as VisionResultMessage;
  }

  /**
   * Fetch source code
   */
  async fetchSource(
    filePath: string,
    timeout = 10000
  ): Promise<SourceResultMessage | SourceErrorMessage> {
    const requestId = this.generateRequestId();
    this.send({ type: "source:fetch", filePath, requestId });
    return (await this.waitFor(
      (msg) =>
        (msg.type === "source:result" || msg.type === "source:error") &&
        ((msg as SourceResultMessage).requestId === requestId ||
          (msg as SourceErrorMessage).requestId === requestId),
      timeout
    )) as SourceResultMessage | SourceErrorMessage;
  }

  /**
   * Request coverage data
   */
  async requestCoverage(
    timeout = 30000
  ): Promise<CoverageResultMessage | CoverageErrorMessage> {
    const requestId = this.generateRequestId();
    this.send({ type: "coverage:request", requestId });
    return (await this.waitFor(
      (msg) =>
        (msg.type === "coverage:result" || msg.type === "coverage:error") &&
        ((msg as CoverageResultMessage).requestId === requestId ||
          (msg as CoverageErrorMessage).requestId === requestId),
      timeout
    )) as CoverageResultMessage | CoverageErrorMessage;
  }

  /**
   * Set rule configuration
   */
  async setRuleConfig(
    ruleId: string,
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>,
    timeout = 10000
  ): Promise<RuleConfigResultMessage> {
    const requestId = this.generateRequestId();
    this.send({
      type: "rule:config:set",
      ruleId,
      severity,
      options,
      requestId,
    });
    return (await this.waitFor(
      (msg) =>
        msg.type === "rule:config:result" &&
        (msg as RuleConfigResultMessage).requestId === requestId,
      timeout
    )) as RuleConfigResultMessage;
  }

  /**
   * Set a configuration value
   */
  setConfig(key: string, value: unknown): void {
    this.send({ type: "config:set", key, value });
  }

  /**
   * Subscribe to file changes
   */
  subscribeFile(filePath: string): void {
    this.send({ type: "subscribe:file", filePath });
  }

  /**
   * Invalidate cache
   */
  invalidateCache(filePath?: string): void {
    this.send({ type: "cache:invalidate", filePath });
  }

  /**
   * Get all queued messages
   */
  getMessages(): ServerMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Clear message queue
   */
  clearMessages(): void {
    this.messageQueue = [];
  }

  private handleMessage(message: ServerMessage): void {
    // Notify all handlers
    for (const handler of this.messageHandlers) {
      handler(message);
    }

    // Check if any pending request matches
    for (let i = 0; i < this.pendingRequests.length; i++) {
      const req = this.pendingRequests[i]!;
      if (req.predicate(message)) {
        clearTimeout(req.timeout);
        this.pendingRequests.splice(i, 1);
        req.resolve(message);
        return;
      }
    }

    // Otherwise queue it
    this.messageQueue.push(message);
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[SocketClient]", ...args);
    }
  }
}

/**
 * Create a connected socket client
 */
export async function createSocketClient(
  options: SocketClientOptions = {}
): Promise<SocketClient> {
  const client = new SocketClient(options);
  await client.connect();
  return client;
}
