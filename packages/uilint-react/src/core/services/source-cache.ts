/**
 * Source Code Cache Service
 *
 * Caches fetched source files with TTL and provides
 * line extraction utilities for the source viewer.
 */

export interface CachedSourceFile {
  content: string;
  lines: string[];
  totalLines: number;
  relativePath: string;
  fetchedAt: number;
}

export interface SourceContext {
  lines: string[];
  startLine: number; // 1-indexed
  highlightLine: number; // 1-indexed
  relativePath: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CachedSourceFile>();

// Pending requests to deduplicate concurrent fetches
const pendingRequests = new Map<string, Promise<CachedSourceFile | null>>();

/**
 * Get cached source file if available and not expired
 */
export function getCachedSource(filePath: string): CachedSourceFile | null {
  const cached = cache.get(filePath);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    cache.delete(filePath);
    return null;
  }
  return cached;
}

/**
 * Store source file in cache
 */
export function setCachedSource(
  filePath: string,
  content: string,
  totalLines: number,
  relativePath: string
): CachedSourceFile {
  const entry: CachedSourceFile = {
    content,
    lines: content.split("\n"),
    totalLines,
    relativePath,
    fetchedAt: Date.now(),
  };
  cache.set(filePath, entry);
  return entry;
}

/**
 * Invalidate cached source for a file (called on file:changed)
 */
export function invalidateSource(filePath: string): void {
  cache.delete(filePath);
}

/**
 * Clear entire source cache
 */
export function clearSourceCache(): void {
  cache.clear();
}

/**
 * Extract lines around a target line with configurable context.
 */
export function extractContext(
  cached: CachedSourceFile,
  targetLine: number,
  contextAbove: number = 5,
  contextBelow: number = 5
): SourceContext {
  const lineIndex = targetLine - 1; // 0-indexed
  const startIndex = Math.max(0, lineIndex - contextAbove);
  const endIndex = Math.min(cached.lines.length, lineIndex + contextBelow + 1);

  return {
    lines: cached.lines.slice(startIndex, endIndex),
    startLine: startIndex + 1,
    highlightLine: targetLine,
    relativePath: cached.relativePath,
  };
}

/**
 * Get or set pending request for deduplication
 */
export function getPendingRequest(
  filePath: string
): Promise<CachedSourceFile | null> | undefined {
  return pendingRequests.get(filePath);
}

export function setPendingRequest(
  filePath: string,
  promise: Promise<CachedSourceFile | null>
): void {
  pendingRequests.set(filePath, promise);
  // Clean up after promise resolves
  promise.finally(() => {
    pendingRequests.delete(filePath);
  });
}
