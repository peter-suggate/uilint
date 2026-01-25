/**
 * DevTool E2E Integration Tests
 *
 * These tests verify that the DevTool component correctly wires up:
 * 1. The WebSocket service (not a stub)
 * 2. The DOM observer service (not a stub)
 * 3. The store with real services
 *
 * This catches bugs where services are passed but methods aren't bound,
 * or where the store uses default stubs instead of real services.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pluginRegistry } from "./core/plugin-system/registry";
import { eslintPlugin } from "./plugins/eslint";
import {
  initializePlugins,
  resetStore,
  getPluginServices,
} from "./core/store";
import { createWebSocketService } from "./core/services/websocket";
import { createDOMObserverService } from "./core/services/dom-observer";

describe("DevTool E2E: Service Wiring", () => {
  beforeEach(() => {
    // Reset all state before each test
    resetStore();
    pluginRegistry.clear();
  });

  afterEach(() => {
    // Clean up
    resetStore();
    pluginRegistry.clear();
  });

  it("initializePlugins passes real websocket service with bound methods", async () => {
    // Create a fresh websocket service with a mock createWebSocket factory
    const mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const testWebsocket = createWebSocketService({
      createWebSocket: () => mockWs as unknown as WebSocket,
    });

    // Register plugin and initialize with real websocket
    pluginRegistry.register(eslintPlugin);
    await initializePlugins({ websocket: testWebsocket });

    // Get the plugin services that were passed to plugins
    const services = getPluginServices();
    expect(services).not.toBeNull();

    // The websocket.on method should work without "Cannot read properties of undefined"
    // This was the bug: methods weren't bound, so `this` was wrong
    const handler = vi.fn();
    const unsubscribe = services!.websocket.on("lint:result", handler);

    // Should return an unsubscribe function, not throw
    expect(typeof unsubscribe).toBe("function");

    // Clean up
    unsubscribe();
  });

  it("initializePlugins passes real domObserver service with bound methods", async () => {
    // Create mock DOM observer with injectable dependencies
    const mockRoot = {
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as unknown as Element;

    const testDomObserver = createDOMObserverService({
      root: mockRoot,
      MutationObserverImpl: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      })),
      querySelectorAll: vi.fn().mockReturnValue([]),
    });

    // Create a mock websocket to avoid SSR issues
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const testWebsocket = createWebSocketService({
      createWebSocket: () => mockWs as unknown as WebSocket,
    });

    // Register plugin and initialize with real services
    pluginRegistry.register(eslintPlugin);
    await initializePlugins({
      websocket: testWebsocket,
      domObserver: testDomObserver,
    });

    // Get the plugin services
    const services = getPluginServices();
    expect(services).not.toBeNull();

    // The domObserver.onElementsAdded method should work without throwing
    // This was the bug: the domObserver was passed directly without binding
    const handler = vi.fn();
    const unsubscribe = services!.domObserver.onElementsAdded(handler);

    // Should return an unsubscribe function, not throw
    expect(typeof unsubscribe).toBe("function");

    // Clean up
    unsubscribe();
  });

  it("ESLint plugin can subscribe to websocket messages via services", async () => {
    // This test verifies the complete wiring: plugin → services → websocket
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const testWebsocket = createWebSocketService({
      createWebSocket: () => mockWs as unknown as WebSocket,
    });

    // The ESLint plugin subscribes to websocket messages during initialize()
    // If the websocket service isn't properly wired, this would fail
    pluginRegistry.register(eslintPlugin);

    // This should NOT throw "Cannot read properties of undefined (reading 'has')"
    await initializePlugins({ websocket: testWebsocket });

    // Verify plugin initialized successfully
    const plugins = pluginRegistry.getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe("eslint");
  });

  it("ESLint plugin can subscribe to DOM observer via services", async () => {
    const mockRoot = {
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as unknown as Element;

    const testDomObserver = createDOMObserverService({
      root: mockRoot,
      MutationObserverImpl: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      })),
      querySelectorAll: vi.fn().mockReturnValue([]),
    });

    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const testWebsocket = createWebSocketService({
      createWebSocket: () => mockWs as unknown as WebSocket,
    });

    pluginRegistry.register(eslintPlugin);

    // This should NOT log "[ComposedStore] DOMObserver onElementsAdded called but not implemented"
    await initializePlugins({
      websocket: testWebsocket,
      domObserver: testDomObserver,
    });

    // Verify plugin initialized
    const plugins = pluginRegistry.getPlugins();
    expect(plugins).toHaveLength(1);

    // The DOM observer should have received a subscription from the ESLint plugin
    // We can verify this by checking the services
    const services = getPluginServices();
    expect(services).not.toBeNull();
  });

  it("store uses provided websocket service, not default stub", async () => {
    const connectSpy = vi.fn();

    // Create a custom websocket service that tracks connect calls
    const testWebsocket = createWebSocketService({
      createWebSocket: () => {
        connectSpy();
        const mockWs = {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
        return mockWs as unknown as WebSocket;
      },
    });

    // Create mock domObserver to avoid warnings
    const mockRoot = {
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as unknown as Element;

    const testDomObserver = createDOMObserverService({
      root: mockRoot,
      MutationObserverImpl: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      })),
      querySelectorAll: vi.fn().mockReturnValue([]),
    });

    pluginRegistry.register(eslintPlugin);
    await initializePlugins({ websocket: testWebsocket, domObserver: testDomObserver });

    const services = getPluginServices();

    // Connect via the services interface
    services!.websocket.connect();

    // The custom createWebSocket should have been called, not the default stub
    // (which would log a warning instead of calling our spy)
    expect(connectSpy).toHaveBeenCalled();
  });
});
