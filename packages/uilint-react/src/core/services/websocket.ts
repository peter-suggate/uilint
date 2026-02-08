/**
 * WebSocket Service - Singleton shared by all plugins
 *
 * Provides connection management, message routing, and automatic reconnection
 * with exponential backoff.
 */

import { devLog, devWarn, devError } from "uilint-core";

// Constants
export const DEFAULT_PORT = 9234;
export const DEFAULT_WS_URL = `ws://localhost:${DEFAULT_PORT}`;
export const MAX_RECONNECT_ATTEMPTS = 10;
export const RECONNECT_BASE_DELAY = 1000;
export const MAX_RECONNECT_DELAY = 10_000;

// Discovery constants
export const DISCOVERY_PORT_START = DEFAULT_PORT;
export const DISCOVERY_PORT_COUNT = 10;
export const DISCOVERY_TIMEOUT_MS = 500;

// Type definitions
export type MessageHandler<T = unknown> = (data: T) => void;
export type ConnectionHandler = (connected: boolean) => void;
export type ReconnectHandler = (attempts: number, maxAttempts: number, exhausted: boolean) => void;

/**
 * Options for dependency injection in WebSocketService
 * Allows injecting mock implementations for testing
 */
export interface WebSocketServiceOptions {
  /** Factory function to create WebSocket instances */
  createWebSocket?: (url: string) => WebSocket;
  /** Custom setTimeout implementation */
  setTimeout?: typeof globalThis.setTimeout;
  /** Custom clearTimeout implementation */
  clearTimeout?: typeof globalThis.clearTimeout;
}

/**
 * WebSocket service interface
 */
export interface WebSocketService {
  readonly isConnected: boolean;
  readonly url: string;
  readonly reconnectAttempts: number;
  connect(url?: string): void;
  disconnect(): void;
  send(message: unknown): void;
  on<T>(type: string, handler: MessageHandler<T>): () => void;
  onConnectionChange(handler: ConnectionHandler): () => void;
  onReconnectAttempt(handler: ReconnectHandler): () => void;
}

/**
 * WebSocket service implementation
 */
export class WebSocketServiceImpl implements WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectHandlers: Set<ReconnectHandler> = new Set();
  private _reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect: boolean = false;

  // Injectable dependencies with defaults
  private readonly createWebSocket: (url: string) => WebSocket;
  private readonly _setTimeout: typeof globalThis.setTimeout;
  private readonly _clearTimeout: typeof globalThis.clearTimeout;

  public isConnected: boolean = false;
  public url: string = DEFAULT_WS_URL;

  /** Current reconnection attempt count */
  public get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  /**
   * Create a new WebSocket service instance
   * @param options - Optional dependency injection options for testing
   */
  constructor(private options: WebSocketServiceOptions = {}) {
    this.createWebSocket =
      options.createWebSocket ?? ((url: string) => new WebSocket(url));
    this._setTimeout = options.setTimeout ?? globalThis.setTimeout;
    this._clearTimeout = options.clearTimeout ?? globalThis.clearTimeout;
  }

  /**
   * Connect to the WebSocket server
   * @param url - Optional URL to connect to (defaults to DEFAULT_WS_URL)
   */
  connect(url?: string): void {
    // SSR guard - WebSocket is not available during server-side rendering
    // Skip check if a custom createWebSocket factory was provided (e.g., in tests)
    if (typeof WebSocket === "undefined" && !this.options.createWebSocket) {
      devWarn("[WebSocket] WebSocket is not available in this environment");
      return;
    }

    // Don't reconnect if already connected to the same URL
    if (this.ws && this.isConnected && (!url || url === this.url)) {
      return;
    }

    // Close existing connection if URL changed
    if (this.ws) {
      this.intentionalDisconnect = true;
      this.ws.close();
    }

    this.url = url ?? DEFAULT_WS_URL;
    this.intentionalDisconnect = false;

    try {
      this.ws = this.createWebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      devError("[WebSocket] Failed to create WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   * Prevents automatic reconnection
   */
  disconnect(): void {
    this.intentionalDisconnect = true;

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      this._clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this._reconnectAttempts = 0;
  }

  /**
   * Send a message to the WebSocket server
   * @param message - The message to send (will be JSON stringified)
   */
  send(message: unknown): void {
    if (!this.ws || !this.isConnected) {
      devWarn("[WebSocket] Cannot send message: not connected");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      devError("[WebSocket] Failed to send message:", error);
    }
  }

  /**
   * Subscribe to messages of a specific type
   * @param type - Message type to subscribe to, or "*" for all messages
   * @param handler - Handler function to call when message is received
   * @returns Unsubscribe function
   */
  on<T>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const handlers = this.handlers.get(type)!;
    handlers.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as MessageHandler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  /**
   * Subscribe to connection status changes
   * @param handler - Handler function to call when connection status changes
   * @returns Unsubscribe function
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);

    // Immediately notify of current state
    handler(this.isConnected);

    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to reconnection attempt changes
   * @param handler - Handler called when reconnect attempts change
   * @returns Unsubscribe function
   */
  onReconnectAttempt(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);

    // Immediately notify of current state
    const exhausted = this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS;
    handler(this._reconnectAttempts, MAX_RECONNECT_ATTEMPTS, exhausted);

    // Return unsubscribe function
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  /**
   * Notify all reconnect handlers of attempt changes
   */
  private notifyReconnectAttempt(): void {
    const exhausted = this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS;
    this.reconnectHandlers.forEach((handler) => {
      try {
        handler(this._reconnectAttempts, MAX_RECONNECT_ATTEMPTS, exhausted);
      } catch (error) {
        devError("[WebSocket] Reconnect handler error:", error);
      }
    });
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      devLog(`[WebSocket] Connected to ${this.url}`);
      this.isConnected = true;
      this._reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      this.notifyReconnectAttempt();
    };

    this.ws.onclose = (event) => {
      devLog(`[WebSocket] Disconnected from ${this.url} (code: ${event?.code ?? 'unknown'}, reason: ${event?.reason || 'none'})`);
      this.isConnected = false;
      this.notifyConnectionChange(false);

      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      devError("[WebSocket] Connection error:", event);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const type = message.type as string | undefined;

        devLog(`[WebSocket] Received message: ${type || 'unknown'}`, message);

        if (type) {
          this.dispatch(type, message);
        } else {
          // If no type, dispatch to wildcard handlers only
          this.dispatch("*", message);
        }
      } catch (error) {
        devError("[WebSocket] Failed to parse message:", error);
      }
    };
  }

  /**
   * Dispatch a message to registered handlers
   * @param type - Message type
   * @param data - Message data
   */
  private dispatch(type: string, data: unknown): void {
    // Dispatch to specific type handlers
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          devError(`[WebSocket] Handler error for type "${type}":`, error);
        }
      });
    }

    // Also dispatch to wildcard handlers (unless this is already a wildcard dispatch)
    if (type !== "*") {
      const wildcardHandlers = this.handlers.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler(data);
          } catch (error) {
            devError("[WebSocket] Wildcard handler error:", error);
          }
        });
      }
    }
  }

  /**
   * Notify all connection handlers of a status change
   * @param connected - Current connection status
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        devError("[WebSocket] Connection handler error:", error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) {
      return;
    }

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      devWarn(
        `[WebSocket] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      // Notify handlers that reconnection is exhausted
      this.notifyReconnectAttempt();
      return;
    }

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      this._clearTimeout(this.reconnectTimeout);
    }

    // Calculate delay with exponential backoff, capped at MAX_RECONNECT_DELAY
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this._reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    this._reconnectAttempts++;

    // Notify handlers of the new attempt count
    this.notifyReconnectAttempt();

    devLog(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeout = this._setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.url);
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// Server discovery
// ---------------------------------------------------------------------------

export interface ServerInfo {
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
  port: number;
  pid: number;
  probeExists?: boolean;
}

/**
 * Probe a single port for a running uilint server.
 * Returns null if the port is not a uilint server or unreachable.
 */
async function probePort(
  port: number,
  probePath: string | null
): Promise<ServerInfo | null> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    DISCOVERY_TIMEOUT_MS
  );
  try {
    const query = probePath ? `?probe=${encodeURIComponent(probePath)}` : "";
    const res = await fetch(`http://localhost:${port}/_uilint/info${query}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerInfo;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Extract a sample file path from the first data-loc attribute in the DOM.
 * Returns the file path portion (strips :line:col suffix).
 */
function getSampleDataLoc(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-loc]");
  if (!el) return null;
  const loc = el.getAttribute("data-loc");
  if (!loc) return null;
  // data-loc format: "relative/path/file.tsx:line:col"
  // Strip the trailing :line:col
  const parts = loc.split(":");
  if (parts.length >= 3) {
    return parts.slice(0, -2).join(":");
  }
  return loc;
}

/**
 * Discover the uilint server that owns this app by scanning ports
 * and probing with a data-loc path from the DOM.
 *
 * Returns the matching ServerInfo, or null if none found.
 */
export async function discoverServer(): Promise<ServerInfo | null> {
  // SSR guard
  if (typeof window === "undefined") return null;

  const sampleLoc = getSampleDataLoc();

  const ports = Array.from(
    { length: DISCOVERY_PORT_COUNT },
    (_, i) => DISCOVERY_PORT_START + i
  );

  const results = await Promise.all(ports.map((p) => probePort(p, sampleLoc)));
  const servers = results.filter(
    (info): info is ServerInfo => info !== null
  );

  if (servers.length === 0) return null;
  if (servers.length === 1) return servers[0];

  // Multiple servers — prefer the one that owns our file
  if (sampleLoc) {
    const match = servers.find((s) => s.probeExists === true);
    if (match) return match;
  }

  // Fallback: prefer the default port, then the lowest port
  return (
    servers.find((s) => s.port === DISCOVERY_PORT_START) ?? servers[0]
  );
}

/**
 * Factory function to create a WebSocket service instance
 * @param options - Optional dependency injection options for testing
 * @returns A new WebSocket service instance
 */
export function createWebSocketService(
  options?: WebSocketServiceOptions
): WebSocketService {
  return new WebSocketServiceImpl(options);
}

// Export singleton instance
export const websocket = new WebSocketServiceImpl();
