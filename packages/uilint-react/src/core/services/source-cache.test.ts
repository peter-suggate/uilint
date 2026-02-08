import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getCachedSource,
  setCachedSource,
  invalidateSource,
  clearSourceCache,
  extractContext,
  getPendingRequest,
  setPendingRequest,
} from "./source-cache";

beforeEach(() => {
  clearSourceCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("setCachedSource / getCachedSource", () => {
  it("stores and retrieves a cached source file", () => {
    const content = "line 1\nline 2\nline 3";
    setCachedSource("/src/App.tsx", content, 3, "src/App.tsx");

    const cached = getCachedSource("/src/App.tsx");
    expect(cached).not.toBeNull();
    expect(cached!.content).toBe(content);
    expect(cached!.lines).toEqual(["line 1", "line 2", "line 3"]);
    expect(cached!.totalLines).toBe(3);
    expect(cached!.relativePath).toBe("src/App.tsx");
  });

  it("returns null for uncached file", () => {
    expect(getCachedSource("/nonexistent.ts")).toBeNull();
  });

  it("splits content into lines correctly", () => {
    setCachedSource("/file.ts", "a\nb\nc\nd", 4, "file.ts");
    const cached = getCachedSource("/file.ts");
    expect(cached!.lines).toEqual(["a", "b", "c", "d"]);
  });
});

describe("cache expiration", () => {
  it("returns null after TTL expires (5 minutes)", () => {
    vi.useFakeTimers();
    setCachedSource("/file.ts", "content", 1, "file.ts");

    // Advance past TTL (5 minutes = 300000ms)
    vi.advanceTimersByTime(300001);

    expect(getCachedSource("/file.ts")).toBeNull();
  });

  it("returns cached file within TTL", () => {
    vi.useFakeTimers();
    setCachedSource("/file.ts", "content", 1, "file.ts");

    // Advance within TTL
    vi.advanceTimersByTime(299999);

    expect(getCachedSource("/file.ts")).not.toBeNull();
  });
});

describe("invalidateSource", () => {
  it("removes a cached file", () => {
    setCachedSource("/file.ts", "content", 1, "file.ts");
    expect(getCachedSource("/file.ts")).not.toBeNull();

    invalidateSource("/file.ts");
    expect(getCachedSource("/file.ts")).toBeNull();
  });

  it("does nothing for uncached files", () => {
    // Should not throw
    invalidateSource("/nonexistent.ts");
  });
});

describe("clearSourceCache", () => {
  it("removes all cached files", () => {
    setCachedSource("/a.ts", "a", 1, "a.ts");
    setCachedSource("/b.ts", "b", 1, "b.ts");

    clearSourceCache();

    expect(getCachedSource("/a.ts")).toBeNull();
    expect(getCachedSource("/b.ts")).toBeNull();
  });
});

describe("extractContext", () => {
  const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");

  function getCached() {
    return setCachedSource("/file.ts", content, 20, "file.ts");
  }

  it("extracts lines around a target line", () => {
    const cached = getCached();
    const ctx = extractContext(cached, 10, 3, 3);

    expect(ctx.lines).toEqual([
      "line 7", "line 8", "line 9", "line 10", "line 11", "line 12", "line 13",
    ]);
    expect(ctx.startLine).toBe(7);
    expect(ctx.highlightLine).toBe(10);
  });

  it("clamps at the beginning of the file", () => {
    const cached = getCached();
    const ctx = extractContext(cached, 2, 5, 2);

    expect(ctx.startLine).toBe(1); // Can't go below line 1
    expect(ctx.lines[0]).toBe("line 1");
    expect(ctx.highlightLine).toBe(2);
  });

  it("clamps at the end of the file", () => {
    const cached = getCached();
    const ctx = extractContext(cached, 19, 2, 5);

    expect(ctx.lines[ctx.lines.length - 1]).toBe("line 20");
    expect(ctx.highlightLine).toBe(19);
  });

  it("uses default context of 5 above and 5 below", () => {
    const cached = getCached();
    const ctx = extractContext(cached, 10);

    // Lines 5 through 15 (11 lines)
    expect(ctx.lines).toHaveLength(11);
    expect(ctx.startLine).toBe(5);
  });

  it("preserves the relative path", () => {
    const cached = getCached();
    const ctx = extractContext(cached, 1);

    expect(ctx.relativePath).toBe("file.ts");
  });
});

describe("pendingRequests", () => {
  it("stores and retrieves pending requests", () => {
    const promise = Promise.resolve(null);
    setPendingRequest("/file.ts", promise);

    expect(getPendingRequest("/file.ts")).toBe(promise);
  });

  it("returns undefined for files without pending requests", () => {
    expect(getPendingRequest("/nonexistent.ts")).toBeUndefined();
  });

  it("cleans up after promise resolves", async () => {
    const promise = Promise.resolve(null);
    setPendingRequest("/file.ts", promise);

    await promise;
    // Allow microtask to run
    await new Promise((r) => setTimeout(r, 0));

    expect(getPendingRequest("/file.ts")).toBeUndefined();
  });
});
