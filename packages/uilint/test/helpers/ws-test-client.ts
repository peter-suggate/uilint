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

export interface LintFileMessage extends ClientMessage {
  type: "lint:file";
  filePath: string;
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

export interface WorkspaceInfoMessage extends ServerMessage {
  type: "workspace:info";
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
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
   * Send a lint:file request and wait for the result
   */
  async lintFile(
    filePath: string,
    options: { timeout?: number } = {}
  ): Promise<LintResultMessage> {
    const requestId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
