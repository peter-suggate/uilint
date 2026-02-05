/**
 * Caching layer for LLM color suggestions.
 *
 * Cache invalidation:
 * - configHash changes → invalidate entire cache (semantic colors changed)
 * - fileHash changes → invalidate that file's suggestions only
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const CACHE_VERSION = 1;
const CACHE_FILE = ".uilint/.cache/color-suggestions.json";

export interface ColorSuggestion {
  hardcoded: string;
  suggested: string;
}

export interface FileCacheEntry {
  fileHash: string;
  suggestions: ColorSuggestion[];
  timestamp: number;
}

export interface ColorSuggestionCache {
  version: number;
  configHash: string;
  entries: Record<string, FileCacheEntry>;
}

/**
 * Simple hash function
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Get the cache file path for a project
 */
export function getCachePath(projectRoot: string): string {
  return join(projectRoot, CACHE_FILE);
}

/**
 * Load the cache store
 */
export function loadCache(projectRoot: string): ColorSuggestionCache {
  const cachePath = getCachePath(projectRoot);

  if (!existsSync(cachePath)) {
    return { version: CACHE_VERSION, configHash: "", entries: {} };
  }

  try {
    const content = readFileSync(cachePath, "utf-8");
    const cache = JSON.parse(content) as ColorSuggestionCache;

    // Invalidate if version mismatch
    if (cache.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, configHash: "", entries: {} };
    }

    return cache;
  } catch {
    return { version: CACHE_VERSION, configHash: "", entries: {} };
  }
}

/**
 * Save the cache store
 */
export function saveCache(
  projectRoot: string,
  cache: ColorSuggestionCache
): void {
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
 * Get cached suggestions for a file
 *
 * Returns null if:
 * - No cache entry exists
 * - Config hash changed (semantic colors changed)
 * - File hash changed (file content changed)
 */
export function getCachedSuggestions(
  projectRoot: string,
  filePath: string,
  fileHash: string,
  configHash: string
): ColorSuggestion[] | null {
  const cache = loadCache(projectRoot);

  // Config changed - entire cache is stale
  if (cache.configHash !== configHash) {
    return null;
  }

  const entry = cache.entries[filePath];
  if (!entry) return null;

  // File changed - entry is stale
  if (entry.fileHash !== fileHash) {
    return null;
  }

  return entry.suggestions;
}

/**
 * Set cached suggestions for a file
 */
export function setCachedSuggestions(
  projectRoot: string,
  filePath: string,
  fileHash: string,
  configHash: string,
  suggestions: ColorSuggestion[]
): void {
  const cache = loadCache(projectRoot);

  // If config hash changed, clear all entries
  if (cache.configHash !== configHash) {
    cache.configHash = configHash;
    cache.entries = {};
  }

  cache.entries[filePath] = {
    fileHash,
    suggestions,
    timestamp: Date.now(),
  };

  saveCache(projectRoot, cache);
}

/**
 * Clear cache for a specific file
 */
export function clearFileSuggestions(
  projectRoot: string,
  filePath: string
): void {
  const cache = loadCache(projectRoot);
  delete cache.entries[filePath];
  saveCache(projectRoot, cache);
}

/**
 * Clear entire cache
 */
export function clearAllSuggestions(projectRoot: string): void {
  saveCache(projectRoot, {
    version: CACHE_VERSION,
    configHash: "",
    entries: {},
  });
}
