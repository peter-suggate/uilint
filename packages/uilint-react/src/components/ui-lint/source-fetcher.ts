/**
 * Client for fetching source code from the dev API
 */

import type { SourceApiResponse, CachedSource, SourceLocation } from "./types";

// Cache for fetched source files
const sourceCache = new Map<string, CachedSource>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * API endpoint for source fetching
 */
const API_ENDPOINT = "/api/.uilint/source";

/**
 * Fetch source code for a file
 */
export async function fetchSource(
  filePath: string
): Promise<SourceApiResponse | null> {
  // Check cache first
  const cached = sourceCache.get(filePath);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return {
      content: cached.content,
      relativePath: cached.relativePath,
    };
  }

  try {
    const response = await fetch(
      `${API_ENDPOINT}?path=${encodeURIComponent(filePath)}`
    );

    if (!response.ok) {
      console.warn(`[UILint] Failed to fetch source: ${response.statusText}`);
      return null;
    }

    const data: SourceApiResponse = await response.json();

    // Cache the result
    sourceCache.set(filePath, {
      ...data,
      fetchedAt: Date.now(),
    });

    return data;
  } catch (error) {
    console.error("[UILint] Error fetching source:", error);
    return null;
  }
}

/**
 * Fetch source and extract lines around a specific location
 */
export async function fetchSourceWithContext(
  source: SourceLocation,
  contextLines: number = 5
): Promise<{
  lines: string[];
  startLine: number;
  highlightLine: number;
  relativePath: string;
} | null> {
  const result = await fetchSource(source.fileName);
  if (!result) return null;

  const allLines = result.content.split("\n");
  const targetLine = source.lineNumber - 1; // 0-indexed
  const startLine = Math.max(0, targetLine - contextLines);
  const endLine = Math.min(allLines.length, targetLine + contextLines + 1);

  return {
    lines: allLines.slice(startLine, endLine),
    startLine: startLine + 1, // Back to 1-indexed
    highlightLine: source.lineNumber,
    relativePath: result.relativePath,
  };
}

/**
 * Fetch source and extract an asymmetric window around a specific location.
 * This supports expanding above/below independently in the UI.
 */
export async function fetchSourceWithWindow(
  source: SourceLocation,
  window: { linesAbove: number; linesBelow: number }
): Promise<{
  lines: string[];
  startLine: number;
  highlightLine: number;
  relativePath: string;
} | null> {
  const result = await fetchSource(source.fileName);
  if (!result) return null;

  const allLines = result.content.split("\n");
  const targetLine = source.lineNumber - 1; // 0-indexed
  const startLine = Math.max(0, targetLine - Math.max(0, window.linesAbove));
  const endLine = Math.min(
    allLines.length,
    targetLine + Math.max(0, window.linesBelow) + 1
  );

  return {
    lines: allLines.slice(startLine, endLine),
    startLine: startLine + 1, // Back to 1-indexed
    highlightLine: source.lineNumber,
    relativePath: result.relativePath,
  };
}

/**
 * Clear the source cache
 */
export function clearSourceCache(): void {
  sourceCache.clear();
}

/**
 * Get cached source without fetching
 */
export function getCachedSource(filePath: string): SourceApiResponse | null {
  const cached = sourceCache.get(filePath);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt >= CACHE_TTL) {
    sourceCache.delete(filePath);
    return null;
  }
  return {
    content: cached.content,
    relativePath: cached.relativePath,
  };
}

/**
 * Prefetch source files for a list of paths
 */
export async function prefetchSources(filePaths: string[]): Promise<void> {
  // Deduplicate and filter already cached
  const uniquePaths = [...new Set(filePaths)].filter((path) => {
    const cached = sourceCache.get(path);
    return !cached || Date.now() - cached.fetchedAt >= CACHE_TTL;
  });

  // Fetch in parallel with a limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < uniquePaths.length; i += BATCH_SIZE) {
    const batch = uniquePaths.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fetchSource));
  }
}
