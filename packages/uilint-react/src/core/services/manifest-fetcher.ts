/**
 * Manifest Fetcher Service
 *
 * Fetches and caches the static lint manifest.
 * Used in static/remote mode as an alternative to the WebSocket connection.
 */

import type { LintManifest } from "./manifest-types";

/**
 * Options for creating a manifest fetcher
 */
export interface ManifestFetcherOptions {
  /** URL to fetch manifest from */
  manifestUrl: string;
  /** Number of retry attempts on failure (default: 3) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Cache TTL in ms (default: 0 = no expiry, fetch once) */
  cacheTtl?: number;
}

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  manifest: LintManifest;
  /** Whether this came from cache */
  cached: boolean;
  /** Timestamp when fetched */
  fetchedAt: number;
}

/**
 * Manifest fetcher interface
 */
export interface ManifestFetcher {
  /** Fetch the manifest (uses cache if available) */
  fetch(): Promise<FetchResult>;
  /** Get cached manifest without fetching */
  getCached(): LintManifest | null;
  /** Invalidate the cache */
  invalidate(): void;
  /** Check if manifest is currently being fetched */
  isFetching(): boolean;
  /** Get the manifest URL */
  getManifestUrl(): string;
}

/**
 * Create a manifest fetcher instance
 */
export function createManifestFetcher(
  options: ManifestFetcherOptions
): ManifestFetcher {
  const {
    manifestUrl,
    retries = 3,
    retryDelay = 1000,
    cacheTtl = 0,
  } = options;

  let cached: LintManifest | null = null;
  let cachedAt: number | null = null;
  let fetchPromise: Promise<FetchResult> | null = null;

  /**
   * Check if cache is still valid
   */
  function isCacheValid(): boolean {
    if (!cached || cachedAt === null) return false;
    if (cacheTtl === 0) return true; // No expiry
    return Date.now() - cachedAt < cacheTtl;
  }

  /**
   * Sleep for a duration
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch with retries
   */
  async function fetchWithRetries(): Promise<LintManifest> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[ManifestFetcher] Retry attempt ${attempt}/${retries}...`
          );
          await sleep(retryDelay * attempt); // Exponential backoff
        }

        const response = await fetch(manifestUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch manifest: ${response.status} ${response.statusText}`
          );
        }

        const manifest = (await response.json()) as LintManifest;

        // Basic validation
        if (manifest.version !== "1.0") {
          throw new Error(
            `Unsupported manifest version: ${manifest.version}`
          );
        }

        if (!Array.isArray(manifest.files)) {
          throw new Error("Invalid manifest: missing files array");
        }

        return manifest;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          `[ManifestFetcher] Fetch failed (attempt ${attempt + 1}):`,
          lastError.message
        );
      }
    }

    throw lastError ?? new Error("Failed to fetch manifest");
  }

  return {
    async fetch(): Promise<FetchResult> {
      // Return cached if valid
      if (isCacheValid() && cached) {
        return {
          manifest: cached,
          cached: true,
          fetchedAt: cachedAt!,
        };
      }

      // Deduplicate concurrent fetches
      if (fetchPromise) {
        return fetchPromise;
      }

      fetchPromise = (async () => {
        try {
          console.log(
            `[ManifestFetcher] Fetching manifest from ${manifestUrl}...`
          );
          const manifest = await fetchWithRetries();

          cached = manifest;
          cachedAt = Date.now();

          console.log(
            `[ManifestFetcher] Loaded manifest: ${manifest.summary.totalIssues} issues in ${manifest.summary.filesWithIssues} files`
          );

          return {
            manifest,
            cached: false,
            fetchedAt: cachedAt,
          };
        } finally {
          fetchPromise = null;
        }
      })();

      return fetchPromise;
    },

    getCached(): LintManifest | null {
      return isCacheValid() ? cached : null;
    },

    invalidate(): void {
      cached = null;
      cachedAt = null;
      console.log("[ManifestFetcher] Cache invalidated");
    },

    isFetching(): boolean {
      return fetchPromise !== null;
    },

    getManifestUrl(): string {
      return manifestUrl;
    },
  };
}

/**
 * Global manifest fetcher instance (set when static mode is configured)
 */
let globalFetcher: ManifestFetcher | null = null;

/**
 * Configure the global manifest fetcher for static mode
 */
export function configureManifestFetcher(
  options: ManifestFetcherOptions
): ManifestFetcher {
  globalFetcher = createManifestFetcher(options);
  return globalFetcher;
}

/**
 * Get the global manifest fetcher
 */
export function getManifestFetcher(): ManifestFetcher | null {
  return globalFetcher;
}

/**
 * Clear the global manifest fetcher
 */
export function clearManifestFetcher(): void {
  globalFetcher = null;
}
