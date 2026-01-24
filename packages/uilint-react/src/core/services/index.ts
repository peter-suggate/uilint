/**
 * Core Services - Shared services for all plugins
 */

// WebSocket Service
export {
  websocket,
  WebSocketServiceImpl,
  createWebSocketService,
  DEFAULT_WS_URL,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  type WebSocketService,
  type WebSocketServiceOptions,
  type MessageHandler,
  type ConnectionHandler,
} from "./websocket";

// DOM Observer Service
export {
  // Singleton (backward compatibility)
  domObserver,
  // Factory function
  createDOMObserverService,
  // Class implementation
  DOMObserverServiceImpl,
  // Pure functions (testable without DOM)
  generateElementId,
  parseDataLoc,
  shouldFilterPath,
  // Constants
  DATA_LOC_ATTR,
  RECONCILE_DEBOUNCE_MS,
  // Types
  type DOMObserverOptions,
  type DOMObserverService,
  type ScannedElementInfo,
  type ElementAddedHandler,
  type ElementRemovedHandler,
} from "./dom-observer";
