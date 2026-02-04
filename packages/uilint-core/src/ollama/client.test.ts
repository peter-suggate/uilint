/**
 * Unit tests for OllamaClient
 * Tests constructor behavior, API interactions, streaming, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaClient, getOllamaClient } from "./client.js";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "./defaults.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Helper to create a mock Response
function createMockResponse(
  body: unknown,
  options: { ok?: boolean; status?: number } = {}
): Response {
  const { ok = true, status = 200 } = options;
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    body: null,
  } as unknown as Response;
}

// Helper to create a streaming response with ReadableStream
function createStreamingResponse(
  chunks: Array<{ response?: string; thinking?: string; done?: boolean; prompt_eval_count?: number; eval_count?: number }>,
  options: { ok?: boolean; status?: number } = {}
): Response {
  const { ok = true, status = 200 } = options;

  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex];
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
        chunkIndex++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok,
    status,
    body: stream,
    json: vi.fn(),
  } as unknown as Response;
}

describe("OllamaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor behavior", () => {
    it("uses default values when no options provided", () => {
      const client = new OllamaClient();

      expect(client.getModel()).toBe(UILINT_DEFAULT_OLLAMA_MODEL);
    });

    it("accepts custom baseUrl", async () => {
      const client = new OllamaClient({ baseUrl: "http://custom:8080" });

      mockFetch.mockResolvedValueOnce(createMockResponse({ models: [] }));

      await client.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://custom:8080/api/tags",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("accepts custom model", () => {
      const client = new OllamaClient({ model: "custom-model:7b" });

      expect(client.getModel()).toBe("custom-model:7b");
    });

    it("accepts custom timeout", async () => {
      // We'll test timeout behavior indirectly via the abort signal
      const client = new OllamaClient({ timeout: 50 });

      // Create a mock that responds to the abort signal
      mockFetch.mockImplementationOnce(
        (_url: string, options?: RequestInit) =>
          new Promise((resolve, reject) => {
            const signal = options?.signal as AbortSignal | undefined;

            // Listen for abort
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted", "AbortError"));
              });
            }

            // Simulate slow response (longer than timeout)
            setTimeout(() => {
              resolve(createMockResponse({ response: "test" }));
            }, 200);
          })
      );

      // The request should be aborted due to timeout
      await expect(client.complete("test prompt")).rejects.toThrow();
    });

    it("accepts instrumentation callbacks", () => {
      const onGenerationStart = vi.fn();
      const client = new OllamaClient({
        instrumentation: { onGenerationStart },
      });

      expect(client.hasInstrumentation()).toBe(true);
    });
  });

  describe("parseIssuesResponse (via analyzeStyles)", () => {
    it("valid JSON with issues array returns issues", async () => {
      const mockIssues = [
        {
          id: "issue-1",
          type: "color",
          message: "Inconsistent color",
          currentValue: "#3B82F6",
          expectedValue: "#3575E2",
        },
      ];

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: JSON.stringify({ issues: mockIssues }),
        })
      );

      const client = new OllamaClient();
      const result = await client.analyzeStyles("test styles", null);

      expect(result.issues).toEqual(mockIssues);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it("malformed JSON returns empty array", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: "not valid json {{{",
        })
      );

      const client = new OllamaClient();
      const result = await client.analyzeStyles("test styles", null);

      expect(result.issues).toEqual([]);
      consoleSpy.mockRestore();
    });

    it("missing issues property returns empty array", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: JSON.stringify({ otherKey: "value" }),
        })
      );

      const client = new OllamaClient();
      const result = await client.analyzeStyles("test styles", null);

      expect(result.issues).toEqual([]);
      consoleSpy.mockRestore();
    });

    it("empty response returns empty array", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: "",
        })
      );

      const client = new OllamaClient();
      const result = await client.analyzeStyles("test styles", null);

      expect(result.issues).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("parseIssuesResponse (via analyzeSource)", () => {
    it("valid JSON with issues array returns issues", async () => {
      const mockIssues = [
        {
          id: "source-issue-1",
          type: "typography",
          message: "Font size mismatch",
          currentValue: "14px",
          expectedValue: "16px",
        },
      ];

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: JSON.stringify({ issues: mockIssues }),
        })
      );

      const client = new OllamaClient();
      const result = await client.analyzeSource("<div>Test</div>", null);

      expect(result.issues).toEqual(mockIssues);
    });

    it("handles analysis failure gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new OllamaClient();
      const result = await client.analyzeSource("<div>Test</div>", null);

      expect(result.issues).toEqual([]);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
      consoleSpy.mockRestore();
    });
  });

  describe("isAvailable()", () => {
    it("returns true when fetch returns ok response", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ models: ["test-model"] })
      );

      const client = new OllamaClient();
      const result = await client.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns false when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const client = new OllamaClient();
      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it("returns false when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({}, { ok: false, status: 500 })
      );

      const client = new OllamaClient();
      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it("uses custom baseUrl for availability check", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ models: [] }));

      const client = new OllamaClient({ baseUrl: "http://remote-ollama:11434" });
      await client.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://remote-ollama:11434/api/tags",
        expect.anything()
      );
    });
  });

  describe("complete()", () => {
    describe("non-streaming path", () => {
      it("sends correct request body without json format", async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ response: "Hello world" })
        );

        const client = new OllamaClient({ model: "test-model" });
        const result = await client.complete("Say hello");

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:11434/api/generate",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "test-model",
              prompt: "Say hello",
              stream: false,
            }),
          })
        );
        expect(result).toBe("Hello world");
      });

      it("sends correct request body with json format", async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ response: '{"key": "value"}' })
        );

        const client = new OllamaClient({ model: "test-model" });
        const result = await client.complete("Generate JSON", { json: true });

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:11434/api/generate",
          expect.objectContaining({
            body: JSON.stringify({
              model: "test-model",
              prompt: "Generate JSON",
              stream: false,
              format: "json",
            }),
          })
        );
        expect(result).toBe('{"key": "value"}');
      });

      it("returns empty string when response is missing", async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({}));

        const client = new OllamaClient();
        const result = await client.complete("test");

        expect(result).toBe("");
      });
    });

    describe("streaming path", () => {
      it("uses streaming when stream option and onProgress provided", async () => {
        const chunks = [
          { response: "Hello " },
          { response: "world", done: true, prompt_eval_count: 10, eval_count: 5 },
        ];
        mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

        const onProgress = vi.fn();
        const client = new OllamaClient();
        const result = await client.complete("Say hello", {
          stream: true,
          onProgress,
        });

        expect(result).toBe("Hello world");
        expect(onProgress).toHaveBeenCalled();
      });

      it("handles thinking delta in streaming response", async () => {
        const chunks = [
          { thinking: "Let me think...", response: "" },
          { thinking: "", response: "Answer: 42", done: true },
        ];
        mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

        const onProgress = vi.fn();
        const client = new OllamaClient();
        await client.complete("Think about this", {
          stream: true,
          onProgress,
        });

        // Check that thinking delta was passed to onProgress
        expect(onProgress).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          undefined,
          "Let me think..."
        );
      });

      it("falls back to non-streaming when only stream option provided without onProgress", async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ response: "non-streaming response" })
        );

        const client = new OllamaClient();
        const result = await client.complete("test", { stream: true });

        expect(result).toBe("non-streaming response");
        // Verify non-streaming request was made
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"stream":false'),
          })
        );
      });

      it("handles json format in streaming mode", async () => {
        const chunks = [
          { response: '{"issues' },
          { response: '": []}', done: true },
        ];
        mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

        const onProgress = vi.fn();
        const client = new OllamaClient();
        const result = await client.complete("Generate JSON", {
          json: true,
          stream: true,
          onProgress,
        });

        expect(result).toBe('{"issues": []}');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"format":"json"'),
          })
        );
      });
    });
  });

  describe("Error handling", () => {
    it("throws on API error response (non-streaming)", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({}, { ok: false, status: 500 })
      );

      const client = new OllamaClient();

      await expect(client.complete("test")).rejects.toThrow(
        "Ollama API error: 500"
      );
    });

    it("throws on API error response (streaming)", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse([], { ok: false, status: 503 })
      );

      const client = new OllamaClient();

      await expect(
        client.complete("test", { stream: true, onProgress: vi.fn() })
      ).rejects.toThrow("Ollama API error: 503");
    });

    it("throws when streaming response has no body", async () => {
      const response = {
        ok: true,
        status: 200,
        body: null,
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(response);

      const client = new OllamaClient();

      await expect(
        client.complete("test", { stream: true, onProgress: vi.fn() })
      ).rejects.toThrow("No response body for streaming");
    });

    it("handles network errors gracefully in analyzeStyles", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new OllamaClient();
      const result = await client.analyzeStyles("styles", null);

      expect(result.issues).toEqual([]);
      consoleSpy.mockRestore();
    });

    it("handles network errors gracefully in generateStyleGuide", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new OllamaClient();
      const result = await client.generateStyleGuide("styles");

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("timeout aborts the request", async () => {
      const client = new OllamaClient({ timeout: 50 });

      mockFetch.mockImplementationOnce((_url, options) => {
        return new Promise((resolve, reject) => {
          const signal = options?.signal as AbortSignal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
          // Never resolve - wait for timeout
        });
      });

      await expect(client.complete("test")).rejects.toThrow();
    });
  });

  describe("Instrumentation", () => {
    it("calls onGenerationStart with correct params for non-streaming", async () => {
      const mockSpan = { end: vi.fn() };
      const onGenerationStart = vi.fn().mockReturnValue(mockSpan);

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          response: "test response",
          prompt_eval_count: 100,
          eval_count: 50,
        })
      );

      const client = new OllamaClient({
        model: "test-model",
        instrumentation: { onGenerationStart },
      });

      await client.complete("test prompt", { json: true });

      expect(onGenerationStart).toHaveBeenCalledWith({
        name: "ollama-generate",
        model: "test-model",
        prompt: "test prompt",
        metadata: { jsonFormat: true, stream: false },
      });

      expect(mockSpan.end).toHaveBeenCalledWith("test response", {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it("calls span.end with error on failure", async () => {
      const mockSpan = { end: vi.fn() };
      const onGenerationStart = vi.fn().mockReturnValue(mockSpan);

      mockFetch.mockResolvedValueOnce(
        createMockResponse({}, { ok: false, status: 500 })
      );

      const client = new OllamaClient({
        instrumentation: { onGenerationStart },
      });

      await expect(client.complete("test")).rejects.toThrow();

      expect(mockSpan.end).toHaveBeenCalledWith("", {
        error: "Ollama API error: 500",
      });
    });

    it("handles undefined onGenerationStart gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: "test" })
      );

      const client = new OllamaClient({
        instrumentation: {},
      });

      // Should not throw
      const result = await client.complete("test");
      expect(result).toBe("test");
    });

    it("calls instrumentation for streaming requests", async () => {
      const mockSpan = { end: vi.fn() };
      const onGenerationStart = vi.fn().mockReturnValue(mockSpan);

      const chunks = [
        { response: "Hello" },
        { response: " world", done: true, prompt_eval_count: 10, eval_count: 5 },
      ];
      mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

      const client = new OllamaClient({
        instrumentation: { onGenerationStart },
      });

      await client.complete("test", { stream: true, onProgress: vi.fn() });

      expect(onGenerationStart).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { jsonFormat: false, stream: true },
        })
      );

      expect(mockSpan.end).toHaveBeenCalledWith("Hello world", {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe("Model management", () => {
    it("getModel returns current model", () => {
      const client = new OllamaClient({ model: "llama2:7b" });

      expect(client.getModel()).toBe("llama2:7b");
    });

    it("setModel updates the model", () => {
      const client = new OllamaClient({ model: "llama2:7b" });

      client.setModel("mistral:7b");

      expect(client.getModel()).toBe("mistral:7b");
    });

    it("new requests use updated model", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ response: "test" }));

      const client = new OllamaClient({ model: "old-model" });
      client.setModel("new-model");

      await client.complete("test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"new-model"'),
        })
      );
    });
  });

  describe("Instrumentation management", () => {
    it("setInstrumentation updates instrumentation callbacks", () => {
      const client = new OllamaClient();

      expect(client.hasInstrumentation()).toBe(false);

      client.setInstrumentation({ onGenerationStart: vi.fn() });

      expect(client.hasInstrumentation()).toBe(true);
    });

    it("setInstrumentation can clear instrumentation", () => {
      const client = new OllamaClient({
        instrumentation: { onGenerationStart: vi.fn() },
      });

      expect(client.hasInstrumentation()).toBe(true);

      client.setInstrumentation(undefined);

      expect(client.hasInstrumentation()).toBe(false);
    });
  });

  describe("generateStyleGuide", () => {
    it("returns generated style guide string", async () => {
      const styleGuideContent = "# UI Style Guide\n\n## Colors\n- Primary: #3B82F6";

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: styleGuideContent })
      );

      const client = new OllamaClient();
      const result = await client.generateStyleGuide("colors: #3B82F6 (5)");

      expect(result).toBe(styleGuideContent);
    });

    it("returns null on error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error("API error"));

      const client = new OllamaClient();
      const result = await client.generateStyleGuide("styles");

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("sends request without json format", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: "# Style Guide" })
      );

      const client = new OllamaClient();
      await client.generateStyleGuide("styles");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.not.stringContaining('"format":"json"'),
        })
      );
    });
  });

  describe("analyzeStyles with streaming", () => {
    it("uses streaming when onProgress callback provided", async () => {
      const chunks = [
        { response: '{"issues' },
        { response: '": [{"id": "1", "type": "color", "message": "test"}]}', done: true },
      ];
      mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

      const onProgress = vi.fn();
      const client = new OllamaClient();
      const result = await client.analyzeStyles("styles", null, onProgress);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].id).toBe("1");
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe("analyzeSource with streaming", () => {
    it("uses streaming when onProgress callback provided", async () => {
      const chunks = [
        { response: '{"issues": []}', done: true },
      ];
      mockFetch.mockResolvedValueOnce(createStreamingResponse(chunks));

      const onProgress = vi.fn();
      const client = new OllamaClient();
      const result = await client.analyzeSource("<div>Test</div>", null, onProgress);

      expect(result.issues).toEqual([]);
      expect(onProgress).toHaveBeenCalled();
    });

    it("accepts options for source analysis", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: '{"issues": []}' })
      );

      const client = new OllamaClient();
      await client.analyzeSource(
        "<div>Test</div>",
        "# Style Guide",
        undefined,
        { filePath: "test.tsx", languageHint: "tsx" }
      );

      // Verify the prompt includes the file path
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("test.tsx"),
        })
      );
    });
  });

  describe("getOllamaClient factory", () => {
    it("creates a new client with options", () => {
      const client = getOllamaClient({ model: "factory-model" });

      expect(client).toBeInstanceOf(OllamaClient);
      expect(client.getModel()).toBe("factory-model");
    });
  });

  describe("Streaming edge cases", () => {
    it("handles malformed JSON chunks gracefully", async () => {
      // Create a response with a malformed chunk
      const encoder = new TextEncoder();
      let chunkIndex = 0;
      const chunks = ["not json\n", '{"response": "valid"}\n', '{"done": true}\n'];

      const stream = new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });

      const response = {
        ok: true,
        status: 200,
        body: stream,
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(response);

      const client = new OllamaClient();
      const result = await client.complete("test", {
        stream: true,
        onProgress: vi.fn(),
      });

      // Should still get the valid response
      expect(result).toBe("valid");
    });

    it("handles empty lines in streaming response", async () => {
      const encoder = new TextEncoder();
      let chunkIndex = 0;
      const chunks = [
        '{"response": "Hello"}\n',
        "\n",
        '{"response": " World", "done": true}\n',
      ];

      const stream = new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });

      const response = {
        ok: true,
        status: 200,
        body: stream,
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(response);

      const client = new OllamaClient();
      const result = await client.complete("test", {
        stream: true,
        onProgress: vi.fn(),
      });

      expect(result).toBe("Hello World");
    });

    it("processes remaining buffer content after stream ends", async () => {
      // Create a response where the final chunk doesn't end with newline
      const encoder = new TextEncoder();
      let chunkIndex = 0;
      const chunks = [
        '{"response": "Part1"}\n',
        '{"response": "Part2", "done": true}', // No trailing newline
      ];

      const stream = new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });

      const response = {
        ok: true,
        status: 200,
        body: stream,
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(response);

      const client = new OllamaClient();
      const result = await client.complete("test", {
        stream: true,
        onProgress: vi.fn(),
      });

      expect(result).toBe("Part1Part2");
    });
  });
});
