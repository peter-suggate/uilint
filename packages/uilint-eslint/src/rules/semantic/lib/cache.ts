/**
 * File-hash based caching for LLM semantic rule
 *
 * Uses xxhash for fast hashing of file contents.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

// Lazy-loaded xxhash
let xxhashInstance: Awaited<
  ReturnType<typeof import("xxhash-wasm")["default"]>
> | null = null;

async function getXxhash() {
  if (!xxhashInstance) {
    const xxhash = await import("xxhash-wasm");
    xxhashInstance = await xxhash.default();
  }
  return xxhashInstance;
}

/**
 * Synchronous hash using a simple djb2 algorithm (fallback when xxhash not available)
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Hash content using xxhash (async) or djb2 (sync fallback)
 */
export async function hashContent(content: string): Promise<string> {
  try {
    const xxhash = await getXxhash();
    return xxhash.h64ToString(content);
  } catch {
    return djb2Hash(content);
  }
}

/**
 * Synchronous hash for when async is not possible
 */
export function hashContentSync(content: string): string {
  return djb2Hash(content);
}

export interface CacheEntry {
  fileHash: string;
  styleguideHash: string;
  issues: CachedIssue[];
  timestamp: number;
}

export interface CachedIssue {
  line: number;
  column?: number;
  message: string;
  ruleId: string;
  severity: 1 | 2; // 1 = warn, 2 = error
}

export interface CacheStore {
  version: number;
  entries: Record<string, CacheEntry>;
}

const CACHE_VERSION = 1;
const CACHE_FILE = ".uilint/.cache/eslint-semantic.json";

/**
 * Get the cache file path for a project
 */
export function getCachePath(projectRoot: string): string {
  return join(projectRoot, CACHE_FILE);
}

/**
 * Load the cache store
 */
export function loadCache(projectRoot: string): CacheStore {
  const cachePath = getCachePath(projectRoot);

  if (!existsSync(cachePath)) {
    return { version: CACHE_VERSION, entries: {} };
  }

  try {
    const content = readFileSync(cachePath, "utf-8");
    const cache = JSON.parse(content) as CacheStore;

    // Invalidate if version mismatch
    if (cache.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} };
    }

    return cache;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

/**
 * Save the cache store
 */
export function saveCache(projectRoot: string, cache: CacheStore): void {
  const cachePath = getCachePath(projectRoot);

  try {
    const cacheDir = dirname(cachePath);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Silently fail - caching is optional
  }
}

/**
 * Get cached entry for a file
 */
export function getCacheEntry(
  projectRoot: string,
  filePath: string,
  fileHash: string,
  styleguideHash: string
): CacheEntry | null {
  const cache = loadCache(projectRoot);
  const entry = cache.entries[filePath];

  if (!entry) return null;

  // Check if hashes match
  if (entry.fileHash !== fileHash || entry.styleguideHash !== styleguideHash) {
    return null;
  }

  return entry;
}

/**
 * Set cached entry for a file
 */
export function setCacheEntry(
  projectRoot: string,
  filePath: string,
  entry: CacheEntry
): void {
  const cache = loadCache(projectRoot);
  cache.entries[filePath] = entry;
  saveCache(projectRoot, cache);
}

/**
 * Clear cache for a specific file
 */
export function clearCacheEntry(projectRoot: string, filePath: string): void {
  const cache = loadCache(projectRoot);
  delete cache.entries[filePath];
  saveCache(projectRoot, cache);
}

/**
 * Clear entire cache
 */
export function clearCache(projectRoot: string): void {
  saveCache(projectRoot, { version: CACHE_VERSION, entries: {} });
}
