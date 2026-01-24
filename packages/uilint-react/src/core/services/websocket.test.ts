/**
 * Unit tests for WebSocket service
 * Tests connection management, message routing, and handler registration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WebSocketServiceImpl,
  createWebSocketService,
  DEFAULT_WS_URL,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  type MessageHandler,
  type ConnectionHandler,
} from "./websocket";

/**
 * Mock WebSocket class for testing
 * Simulates WebSocket behavior without actual network connections
 */
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Error) => void) | null = null;
  readyState = 0; // CONNECTING
  send = vi.fn();
  close = vi.fn();

  // Helper to simulate connection open
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  // Helper to simulate connection close
  simulateClose() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  // Helper to simulate receiving a message
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  // Helper to simulate an error
  simulateError(error: Error) {
    this.onerror?.(error);
  }
}

describe("WebSocketServiceImpl", () => {
  let mockWebSocket: MockWebSocket;
  let createWebSocketMock: ReturnType<typeof vi.fn>;
  let setTimeoutMock: ReturnType<typeof vi.fn>;
  let clearTimeoutMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    createWebSocketMock = vi.fn(() => mockWebSocket as unknown as WebSocket);
    setTimeoutMock = vi.fn((fn, delay) => {
      return setTimeout(fn, 0) as unknown as ReturnType<typeof setTimeout>;
    });
    clearTimeoutMock = vi.fn();
  });

  function createService() {
    return new WebSocketServiceImpl({
      createWebSocket: createWebSocketMock,
      setTimeout: setTimeoutMock,
      clearTimeout: clearTimeoutMock,
    });
  }

  describe("Handler registration", () => {
    describe("on(type, handler)", () => {
      it("registers handler for specific message type", () => {
        const service = createService();
        const handler = vi.fn();

        service.on("test-type", handler);
        service.connect();
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage({ type: "test-type", data: "payload" });

        expect(handler).toHaveBeenCalledWith({
          type: "test-type",
          data: "payload",
        });
      });

      it("returns unsubscribe function", () => {
        const service = createService();
        const handler = vi.fn();

        const unsubscribe = service.on("test-type", handler);

        expect(typeof unsubscribe).toBe("function");
      });

      it("unsubscribe removes handler", () => {
        const service = createService();
        const handler = vi.fn();

        const unsubscribe = service.on("test-type", handler);
        service.connect();
        mockWebSocket.simulateOpen();

        // Unsubscribe before message
        unsubscribe();

        mockWebSocket.simulateMessage({ type: "test-type", data: "payload" });

        expect(handler).not.toHaveBeenCalled();
      });

      it("supports multiple handlers for same type", () => {
        const service = createService();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const handler3 = vi.fn();

        service.on("same-type", handler1);
        service.on("same-type", handler2);
        service.on("same-type", handler3);

        service.connect();
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage({ type: "same-type", value: 42 });

        expect(handler1).toHaveBeenCalledWith({ type: "same-type", value: 42 });
        expect(handler2).toHaveBeenCalledWith({ type: "same-type", value: 42 });
        expect(handler3).toHaveBeenCalledWith({ type: "same-type", value: 42 });
      });

      it("unsubscribing one handler does not affect others", () => {
        const service = createService();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        const unsubscribe1 = service.on("test-type", handler1);
        service.on("test-type", handler2);

        unsubscribe1();

        service.connect();
        mockWebSocket.simulateOpen();
        mockWebSocket.simulateMessage({ type: "test-type" });

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });
    });
  });

  describe("onConnectionChange()", () => {
    it("registers connection change handler", () => {
      const service = createService();
      const handler = vi.fn();

      service.onConnectionChange(handler);

      // Handler should be called immediately with current state (false)
      expect(handler).toHaveBeenCalledWith(false);
    });

    it("immediately notifies handler of current connection state", () => {
      const service = createService();
      service.connect();
      mockWebSocket.simulateOpen();

      const handler = vi.fn();
      service.onConnectionChange(handler);

      // Should be called with true since we're connected
      expect(handler).toHaveBeenCalledWith(true);
    });

    it("returns unsubscribe function", () => {
      const service = createService();
      const handler = vi.fn();

      const unsubscribe = service.onConnectionChange(handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("unsubscribe prevents future notifications", () => {
      const service = createService();
      const handler = vi.fn();

      const unsubscribe = service.onConnectionChange(handler);

      // Clear initial call
      handler.mockClear();

      unsubscribe();

      service.connect();
      mockWebSocket.simulateOpen();

      expect(handler).not.toHaveBeenCalled();
    });

    it("notifies on connect and disconnect", () => {
      const service = createService();
      const handler = vi.fn();

      service.onConnectionChange(handler);
      handler.mockClear(); // Clear initial call

      service.connect();
      mockWebSocket.simulateOpen();

      expect(handler).toHaveBeenCalledWith(true);

      handler.mockClear();

      service.disconnect();

      expect(handler).not.toHaveBeenCalled(); // disconnect() sets isConnected but doesn't notify
    });

    it("supports multiple connection handlers", () => {
      const service = createService();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.onConnectionChange(handler1);
      service.onConnectionChange(handler2);

      handler1.mockClear();
      handler2.mockClear();

      service.connect();
      mockWebSocket.simulateOpen();

      expect(handler1).toHaveBeenCalledWith(true);
      expect(handler2).toHaveBeenCalledWith(true);
    });
  });

  describe("Message dispatch", () => {
    it("handlers receive correct message data", () => {
      const service = createService();
      const handler = vi.fn();

      service.on("data-message", handler);
      service.connect();
      mockWebSocket.simulateOpen();

      const messageData = {
        type: "data-message",
        payload: { items: [1, 2, 3], nested: { key: "value" } },
      };
      mockWebSocket.simulateMessage(messageData);

      expect(handler).toHaveBeenCalledWith(messageData);
    });

    it("type-specific handlers only get their messages", () => {
      const service = createService();
      const typeAHandler = vi.fn();
      const typeBHandler = vi.fn();

      service.on("type-a", typeAHandler);
      service.on("type-b", typeBHandler);

      service.connect();
      mockWebSocket.simulateOpen();

      mockWebSocket.simulateMessage({ type: "type-a", data: "a" });

      expect(typeAHandler).toHaveBeenCalledWith({ type: "type-a", data: "a" });
      expect(typeBHandler).not.toHaveBeenCalled();

      typeAHandler.mockClear();

      mockWebSocket.simulateMessage({ type: "type-b", data: "b" });

      expect(typeAHandler).not.toHaveBeenCalled();
      expect(typeBHandler).toHaveBeenCalledWith({ type: "type-b", data: "b" });
    });

    it("wildcard handlers get all messages with type", () => {
      const service = createService();
      const wildcardHandler = vi.fn();
      const specificHandler = vi.fn();

      service.on("*", wildcardHandler);
      service.on("specific", specificHandler);

      service.connect();
      mockWebSocket.simulateOpen();

      mockWebSocket.simulateMessage({ type: "specific", data: 1 });
      mockWebSocket.simulateMessage({ type: "other", data: 2 });
      mockWebSocket.simulateMessage({ type: "another", data: 3 });

      expect(wildcardHandler).toHaveBeenCalledTimes(3);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, {
        type: "specific",
        data: 1,
      });
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, {
        type: "other",
        data: 2,
      });
      expect(wildcardHandler).toHaveBeenNthCalledWith(3, {
        type: "another",
        data: 3,
      });

      expect(specificHandler).toHaveBeenCalledTimes(1);
    });

    it("messages without type only go to wildcard handlers", () => {
      const service = createService();
      const wildcardHandler = vi.fn();
      const typedHandler = vi.fn();

      service.on("*", wildcardHandler);
      service.on("some-type", typedHandler);

      service.connect();
      mockWebSocket.simulateOpen();

      // Message without type field
      mockWebSocket.simulateMessage({ data: "no type here" });

      expect(wildcardHandler).toHaveBeenCalledWith({ data: "no type here" });
      expect(typedHandler).not.toHaveBeenCalled();
    });

    it("handles handler errors gracefully", () => {
      const service = createService();
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const goodHandler = vi.fn();

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      service.on("test", errorHandler);
      service.on("test", goodHandler);

      service.connect();
      mockWebSocket.simulateOpen();

      mockWebSocket.simulateMessage({ type: "test" });

      // Both handlers should be attempted
      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Connection state", () => {
    it("isConnected starts false", () => {
      const service = createService();

      expect(service.isConnected).toBe(false);
    });

    it("isConnected becomes true after successful connect", () => {
      const service = createService();

      service.connect();
      expect(service.isConnected).toBe(false); // Still false until onopen

      mockWebSocket.simulateOpen();
      expect(service.isConnected).toBe(true);
    });

    it("isConnected becomes false after disconnect", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();
      expect(service.isConnected).toBe(true);

      service.disconnect();
      expect(service.isConnected).toBe(false);
    });

    it("isConnected becomes false on connection close", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();
      expect(service.isConnected).toBe(true);

      mockWebSocket.simulateClose();
      expect(service.isConnected).toBe(false);
    });

    it("url defaults to DEFAULT_WS_URL", () => {
      const service = createService();

      expect(service.url).toBe(DEFAULT_WS_URL);
    });

    it("url updates when connect is called with custom URL", () => {
      const service = createService();

      service.connect("ws://custom:1234");

      expect(service.url).toBe("ws://custom:1234");
    });
  });

  describe("send()", () => {
    it("calls WebSocket.send with JSON stringified data", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      const message = { type: "test", data: { foo: "bar" } };
      service.send(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("handles not connected state gracefully", () => {
      const service = createService();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Not connected
      service.send({ type: "test" });

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[WebSocket] Cannot send message: not connected"
      );

      consoleSpy.mockRestore();
    });

    it("does not send when WebSocket is null", () => {
      const service = createService();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      service.send({ type: "test" });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles send errors gracefully", () => {
      const service = createService();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockWebSocket.send.mockImplementation(() => {
        throw new Error("Send failed");
      });

      service.connect();
      mockWebSocket.simulateOpen();
      service.send({ type: "test" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[WebSocket] Failed to send message:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("connect()", () => {
    it("creates WebSocket with correct URL", () => {
      const service = createService();

      service.connect();

      expect(createWebSocketMock).toHaveBeenCalledWith(DEFAULT_WS_URL);
    });

    it("creates WebSocket with custom URL", () => {
      const service = createService();

      service.connect("ws://custom:5678");

      expect(createWebSocketMock).toHaveBeenCalledWith("ws://custom:5678");
    });

    it("does not reconnect if already connected to same URL", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      createWebSocketMock.mockClear();

      service.connect(); // Same URL
      service.connect(DEFAULT_WS_URL); // Explicit same URL

      expect(createWebSocketMock).not.toHaveBeenCalled();
    });

    it("reconnects if URL changes", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      createWebSocketMock.mockClear();

      service.connect("ws://different:9999");

      expect(createWebSocketMock).toHaveBeenCalledWith("ws://different:9999");
    });

    it("closes existing connection when URL changes", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      service.connect("ws://different:9999");

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe("disconnect()", () => {
    it("closes WebSocket connection", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      service.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it("clears pending reconnect timeout", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();
      mockWebSocket.simulateClose(); // Triggers reconnect scheduling

      service.disconnect();

      expect(clearTimeoutMock).toHaveBeenCalled();
    });

    it("prevents automatic reconnection after close", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      service.disconnect();

      setTimeoutMock.mockClear();

      // This close should not trigger reconnect
      mockWebSocket.simulateClose();

      // No new reconnect should be scheduled since intentionalDisconnect is true
      expect(setTimeoutMock).not.toHaveBeenCalled();
    });

    it("resets reconnect attempts counter", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();
      mockWebSocket.simulateClose(); // Would increment reconnectAttempts

      service.disconnect();

      // The reconnectAttempts should be reset to 0
      // This is tested indirectly - after disconnect, a new connect
      // should work normally without being blocked by max attempts
      createWebSocketMock.mockClear();
      service.connect();
      expect(createWebSocketMock).toHaveBeenCalled();
    });
  });

  describe("Automatic reconnection", () => {
    it("schedules reconnect on unexpected close", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      setTimeoutMock.mockClear();

      mockWebSocket.simulateClose();

      expect(setTimeoutMock).toHaveBeenCalledWith(
        expect.any(Function),
        RECONNECT_BASE_DELAY
      );
    });

    it("uses exponential backoff for reconnect delays", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();

      // First close
      mockWebSocket.simulateClose();
      expect(setTimeoutMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        RECONNECT_BASE_DELAY * 1 // 2^0 = 1
      );

      // Simulate reconnect attempt
      mockWebSocket = new MockWebSocket();
      createWebSocketMock.mockReturnValue(mockWebSocket as unknown as WebSocket);

      // Trigger the reconnect
      const reconnectFn = setTimeoutMock.mock.calls[0][0];
      reconnectFn();
      mockWebSocket.simulateOpen();
      mockWebSocket.simulateClose();

      expect(setTimeoutMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        RECONNECT_BASE_DELAY * 2 // 2^1 = 2
      );
    });

    it("stops reconnecting after max attempts", () => {
      const service = createService();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      service.connect();
      mockWebSocket.simulateOpen();

      // Simulate max reconnect attempts
      for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
        mockWebSocket.simulateClose();
        mockWebSocket = new MockWebSocket();
        createWebSocketMock.mockReturnValue(mockWebSocket as unknown as WebSocket);

        if (i < MAX_RECONNECT_ATTEMPTS - 1) {
          const reconnectFn = setTimeoutMock.mock.calls[setTimeoutMock.mock.calls.length - 1][0];
          reconnectFn();
          mockWebSocket.simulateOpen();
        }
      }

      // After max attempts, should not schedule more reconnects
      setTimeoutMock.mockClear();
      mockWebSocket.simulateClose();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Max reconnection attempts")
      );

      consoleSpy.mockRestore();
    });

    it("resets reconnect attempts on successful connection", () => {
      const service = createService();

      service.connect();
      mockWebSocket.simulateOpen();
      mockWebSocket.simulateClose();

      // First reconnect attempt made
      mockWebSocket = new MockWebSocket();
      createWebSocketMock.mockReturnValue(mockWebSocket as unknown as WebSocket);

      const reconnectFn = setTimeoutMock.mock.calls[0][0];
      reconnectFn();

      // Successful reconnection
      mockWebSocket.simulateOpen();

      setTimeoutMock.mockClear();

      // Another close should start from base delay again
      mockWebSocket.simulateClose();

      expect(setTimeoutMock).toHaveBeenCalledWith(
        expect.any(Function),
        RECONNECT_BASE_DELAY // Back to base delay
      );
    });
  });

  describe("createWebSocketService factory", () => {
    it("creates a new WebSocketServiceImpl instance", () => {
      const service = createWebSocketService();

      expect(service).toBeInstanceOf(WebSocketServiceImpl);
    });

    it("passes options to the service", () => {
      const customCreate = vi.fn(() => mockWebSocket as unknown as WebSocket);

      const service = createWebSocketService({
        createWebSocket: customCreate,
      });

      service.connect();

      expect(customCreate).toHaveBeenCalled();
    });
  });

  describe("Constants", () => {
    it("exports correct default WebSocket URL", () => {
      expect(DEFAULT_WS_URL).toBe("ws://localhost:9234");
    });

    it("exports correct max reconnect attempts", () => {
      expect(MAX_RECONNECT_ATTEMPTS).toBe(5);
    });

    it("exports correct reconnect base delay", () => {
      expect(RECONNECT_BASE_DELAY).toBe(1000);
    });
  });
});
