import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createManifestFetcher,
  configureManifestFetcher,
  getManifestFetcher,
  clearManifestFetcher,
} from "./manifest-fetcher";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_MANIFEST = {
  version: "1.0",
  files: [
    { path: "src/App.tsx", issues: [{ line: 1, message: "test", ruleId: "r1" }] },
  ],
  summary: { totalIssues: 1, filesWithIssues: 1 },
};

beforeEach(() => {
  mockFetch.mockReset();
  clearManifestFetcher();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createManifestFetcher", () => {
  it("fetches manifest from URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_MANIFEST),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    const result = await fetcher.fetch();

    expect(result.manifest).toEqual(VALID_MANIFEST);
    expect(result.cached).toBe(false);
    expect(result.fetchedAt).toBeGreaterThan(0);
  });

  it("caches the manifest on second fetch (no TTL)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_MANIFEST),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    await fetcher.fetch();
    mockFetch.mockClear();

    const result2 = await fetcher.fetch();

    expect(result2.cached).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("respects cache TTL", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_MANIFEST),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      cacheTtl: 5000,
    });

    await fetcher.fetch();
    vi.advanceTimersByTime(5001);

    const cachedResult = fetcher.getCached();
    expect(cachedResult).toBeNull();
  });

  it("retries on fetch failure", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(VALID_MANIFEST),
      });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      retries: 2,
      retryDelay: 0,
    });

    const result = await fetcher.fetch();

    expect(result.manifest).toEqual(VALID_MANIFEST);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      retries: 1,
      retryDelay: 0,
    });

    await expect(fetcher.fetch()).rejects.toThrow("Network error");
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      retries: 0,
    });

    await expect(fetcher.fetch()).rejects.toThrow("Failed to fetch manifest: 404");
  });

  it("throws on invalid manifest version", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...VALID_MANIFEST, version: "2.0" }),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      retries: 0,
    });

    await expect(fetcher.fetch()).rejects.toThrow("Unsupported manifest version");
  });

  it("throws on missing files array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "1.0" }),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
      retries: 0,
    });

    await expect(fetcher.fetch()).rejects.toThrow("missing files array");
  });

  it("deduplicates concurrent fetches", async () => {
    let resolveCount = 0;
    mockFetch.mockImplementation(async () => {
      resolveCount++;
      return {
        ok: true,
        json: () => Promise.resolve(VALID_MANIFEST),
      };
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    const [r1, r2] = await Promise.all([fetcher.fetch(), fetcher.fetch()]);

    expect(resolveCount).toBe(1); // Only one actual fetch
    expect(r1.manifest).toEqual(r2.manifest);
  });

  it("invalidate clears the cache", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_MANIFEST),
    });

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    await fetcher.fetch();
    fetcher.invalidate();

    expect(fetcher.getCached()).toBeNull();
  });

  it("isFetching reports fetch state", async () => {
    let resolveFetch!: () => void;
    mockFetch.mockImplementation(
      () =>
        new Promise<{ ok: boolean; json: () => Promise<typeof VALID_MANIFEST> }>((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: () => Promise.resolve(VALID_MANIFEST),
            });
        })
    );

    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    expect(fetcher.isFetching()).toBe(false);
    const promise = fetcher.fetch();
    expect(fetcher.isFetching()).toBe(true);

    resolveFetch();
    await promise;
    expect(fetcher.isFetching()).toBe(false);
  });

  it("getManifestUrl returns the configured URL", () => {
    const fetcher = createManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    expect(fetcher.getManifestUrl()).toBe("https://example.com/manifest.json");
  });
});

describe("global manifest fetcher", () => {
  it("configureManifestFetcher sets global fetcher", () => {
    configureManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });

    expect(getManifestFetcher()).not.toBeNull();
  });

  it("clearManifestFetcher removes global fetcher", () => {
    configureManifestFetcher({
      manifestUrl: "https://example.com/manifest.json",
    });
    clearManifestFetcher();

    expect(getManifestFetcher()).toBeNull();
  });

  it("getManifestFetcher returns null when not configured", () => {
    expect(getManifestFetcher()).toBeNull();
  });
});
