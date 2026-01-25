/**
 * ESLint Plugin DOM Integration Tests
 *
 * Tests the integration between the ESLint plugin and DOM observer.
 * Verifies that:
 * - Plugin subscribes to DOM observer during initialization
 * - Plugin sends lint:file requests when elements are detected
 * - Plugin avoids duplicate requests for already-scanned files
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { eslintPlugin } from "./index";
import {
  createMockPluginServices,
  flushPromises,
} from "../../__tests__/test-utils";
import type { MockPluginServices } from "../../__tests__/test-utils";
import type { ScannedElementInfo } from "../../core/plugin-system/types";

/**
 * Helper to create ESLint plugin state (scoped - services.getState() returns this directly)
 */
function createESLintState(overrides?: {
  scanStatus?: "idle" | "scanning" | "complete" | "error";
  requestedFiles?: Set<string>;
}) {
  return {
    issues: new Map(),
    scannedDataLocs: new Set(),
    requestedFiles: overrides?.requestedFiles ?? new Set(),
    scanStatus: overrides?.scanStatus ?? "scanning",
    availableRules: [],
    disabledRules: new Set(),
    workspaceRoot: null,
  };
}

/**
 * Create a mock scanned element without relying on DOM APIs
 * (DOM APIs are not available in Node.js test environment)
 */
function createMockScannedElement(
  overrides?: Partial<ScannedElementInfo>
): ScannedElementInfo {
  const dataLoc = overrides?.dataLoc ?? "test.tsx:10:5";
  const id = overrides?.id ?? `loc:${dataLoc}#1`;

  return {
    id,
    dataLoc,
    element: overrides?.element ?? ({} as Element),
    tagName: overrides?.tagName ?? "div",
    rect: overrides?.rect ?? ({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect),
  };
}

describe("ESLint Plugin DOM Integration", () => {
  let services: MockPluginServices;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    services = createMockPluginServices({
      websocket: { isConnected: true },
      initialState: createESLintState(),
    });
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    services.__websocket.__clearHandlers();
    services.__domObserver.__clearHandlers();
  });

  describe("initialization", () => {
    it("subscribes to domObserver.onElementsAdded during initialize", () => {
      // Initialize the plugin
      cleanup = eslintPlugin.initialize?.(services);

      // Verify onElementsAdded was called
      expect(services.domObserver.onElementsAdded).toHaveBeenCalled();
    });

    it("returns a cleanup function that unsubscribes from DOM observer", () => {
      // Initialize the plugin
      cleanup = eslintPlugin.initialize?.(services);

      // Get the handlers before cleanup
      const handlersBefore = services.__domObserver.__getAddedHandlers();
      expect(handlersBefore.size).toBeGreaterThan(0);

      // Call cleanup
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }

      // Handlers should be cleared (unsubscribed)
      // Note: The mock's unsubscribe removes from the set
      const handlersAfter = services.__domObserver.__getAddedHandlers();
      expect(handlersAfter.size).toBe(0);
    });
  });

  describe("lint request triggering", () => {
    it("sends lint:file message when new elements are detected", async () => {
      // Initialize the plugin
      cleanup = eslintPlugin.initialize?.(services);

      // Create mock elements from different files
      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
        createMockScannedElement({ dataLoc: "components/Button.tsx:20:3" }),
      ];

      // Simulate DOM observer detecting elements
      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Verify lint:file messages were sent
      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "lint:file",
          filePath: "app/page.tsx",
        })
      );
      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "lint:file",
          filePath: "components/Button.tsx",
        })
      );
    });

    it("only sends one request per unique file path", async () => {
      cleanup = eslintPlugin.initialize?.(services);

      // Create multiple elements from the same file
      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
        createMockScannedElement({ dataLoc: "app/page.tsx:15:8" }),
        createMockScannedElement({ dataLoc: "app/page.tsx:20:3" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Should only send one request for app/page.tsx
      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
      const lintFileCalls = sendCalls.filter(
        (call) => call[0]?.type === "lint:file" && call[0]?.filePath === "app/page.tsx"
      );

      expect(lintFileCalls.length).toBe(1);
    });

    it("does not send duplicate requests for already-requested files", async () => {
      // Set up state with already-requested file
      services = createMockPluginServices({
        websocket: { isConnected: true },
        initialState: createESLintState({
          requestedFiles: new Set(["app/page.tsx"]),
        }),
      });

      cleanup = eslintPlugin.initialize?.(services);

      // Simulate detecting an element from the already-requested file
      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Should not send another request for app/page.tsx
      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
      const lintFileCalls = sendCalls.filter(
        (call) => call[0]?.type === "lint:file" && call[0]?.filePath === "app/page.tsx"
      );

      expect(lintFileCalls.length).toBe(0);
    });

    it("sends requests for new files but not already-requested ones", async () => {
      services = createMockPluginServices({
        websocket: { isConnected: true },
        initialState: createESLintState({
          requestedFiles: new Set(["app/page.tsx"]),
        }),
      });

      cleanup = eslintPlugin.initialize?.(services);

      // Mix of already-requested and new files
      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }), // Already requested
        createMockScannedElement({ dataLoc: "components/Button.tsx:5:0" }), // New
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;

      // Should NOT send for app/page.tsx
      const pageRequests = sendCalls.filter(
        (call) => call[0]?.type === "lint:file" && call[0]?.filePath === "app/page.tsx"
      );
      expect(pageRequests.length).toBe(0);

      // Should send for components/Button.tsx
      const buttonRequests = sendCalls.filter(
        (call) => call[0]?.type === "lint:file" && call[0]?.filePath === "components/Button.tsx"
      );
      expect(buttonRequests.length).toBe(1);
    });

    it("tracks requested files in state", async () => {
      cleanup = eslintPlugin.initialize?.(services);

      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Verify state was updated with the requested file
      const state = services.__getInternalState() as { requestedFiles?: Set<string> };
      expect(state.requestedFiles).toBeInstanceOf(Set);
      expect(state.requestedFiles?.has("app/page.tsx")).toBe(true);
    });

    it("includes requestId in lint:file messages", async () => {
      cleanup = eslintPlugin.initialize?.(services);

      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "lint:file",
          filePath: "app/page.tsx",
          requestId: expect.any(String),
        })
      );
    });
  });

  describe("connection state handling", () => {
    it("does not send requests when WebSocket is not connected", async () => {
      services = createMockPluginServices({
        websocket: { isConnected: false },
        initialState: createESLintState(),
      });

      cleanup = eslintPlugin.initialize?.(services);

      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Should not send any lint:file requests
      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
      const lintFileCalls = sendCalls.filter(
        (call) => call[0]?.type === "lint:file"
      );

      expect(lintFileCalls.length).toBe(0);
    });
  });

  describe("scan status handling", () => {
    it("does not send requests when scan status is idle", async () => {
      services = createMockPluginServices({
        websocket: { isConnected: true },
        initialState: createESLintState({ scanStatus: "idle" }),
      });

      cleanup = eslintPlugin.initialize?.(services);

      const elements = [
        createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      ];

      services.__domObserver.__simulateElementsAdded(elements);

      await flushPromises();

      // Should not send any lint:file requests when scanning is not active
      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
      const lintFileCalls = sendCalls.filter(
        (call) => call[0]?.type === "lint:file"
      );

      expect(lintFileCalls.length).toBe(0);
    });
  });
});
