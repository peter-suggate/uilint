/**
 * WebSocket Service - Singleton shared by all plugins
 *
 * Provides connection management, message routing, and automatic reconnection
 * with exponential backoff.
 */

// Constants
export const DEFAULT_WS_URL = "ws://localhost:9234";
export const MAX_RECONNECT_ATTEMPTS = 5;
export const RECONNECT_BASE_DELAY = 1000;

// Type definitions
export type MessageHandler<T = unknown> = (data: T) => void;
export type ConnectionHandler = (connected: boolean) => void;

/**
 * WebSocket service interface
 */
export interface WebSocketService {
  readonly isConnected: boolean;
  readonly url: string;
  connect(url?: string): void;
  disconnect(): void;
  send(message: unknown): void;
  on<T>(type: string, handler: MessageHandler<T>): () => void;
  onConnectionChange(handler: ConnectionHandler): () => void;
}

/**
 * WebSocket service implementation
 */
export class WebSocketServiceImpl implements WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect: boolean = false;

  public isConnected: boolean = false;
  public url: string = DEFAULT_WS_URL;

  /**
   * Connect to the WebSocket server
   * @param url - Optional URL to connect to (defaults to DEFAULT_WS_URL)
   */
  connect(url?: string): void {
    // SSR guard - WebSocket is not available during server-side rendering
    if (typeof WebSocket === "undefined") {
      console.warn("[WebSocket] WebSocket is not available in this environment");
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
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WebSocket] Failed to create WebSocket:", error);
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
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Send a message to the WebSocket server
   * @param message - The message to send (will be JSON stringified)
   */
  send(message: unknown): void {
    if (!this.ws || !this.isConnected) {
      console.warn("[WebSocket] Cannot send message: not connected");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
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
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.notifyConnectionChange(false);

      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error("[WebSocket] Connection error:", event);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const type = message.type as string | undefined;

        if (type) {
          this.dispatch(type, message);
        } else {
          // If no type, dispatch to wildcard handlers only
          this.dispatch("*", message);
        }
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
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
          console.error(`[WebSocket] Handler error for type "${type}":`, error);
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
            console.error("[WebSocket] Wildcard handler error:", error);
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
        console.error("[WebSocket] Connection handler error:", error);
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

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `[WebSocket] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return;
    }

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Calculate delay with exponential backoff
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.url);
    }, delay);
  }
}

// Export singleton instance
export const websocket = new WebSocketServiceImpl();
