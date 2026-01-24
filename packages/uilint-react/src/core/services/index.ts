/**
 * Core Services - Shared services for all plugins
 */

// WebSocket Service
export {
  websocket,
  WebSocketServiceImpl,
  DEFAULT_WS_URL,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  type WebSocketService,
  type MessageHandler,
  type ConnectionHandler,
} from "./websocket";

// DOM Observer Service
export {
  domObserver,
  DOMObserverServiceImpl,
  DATA_LOC_ATTR,
  RECONCILE_DEBOUNCE_MS,
  type DOMObserverService,
  type ScannedElementInfo,
  type ElementAddedHandler,
  type ElementRemovedHandler,
} from "./dom-observer";
