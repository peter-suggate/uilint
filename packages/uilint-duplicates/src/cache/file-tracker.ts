/**
 * File Tracker
 *
 * Tracks file content hashes for incremental updates.
 * Uses xxhash for fast hashing (following uilint-eslint patterns).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "fs";
import { join } from "path";

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
 * Synchronous hash using djb2 algorithm (fallback)
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

export interface FileHashEntry {
  /** xxhash of file content */
  contentHash: string;
  /** Last modification time in ms */
  mtimeMs: number;
  /** IDs of chunks from this file */
  chunkIds: string[];
}

export interface HashStore {
  version: number;
  files: Record<string, FileHashEntry>;
}

export interface FileChange {
  path: string;
  type: "added" | "modified" | "deleted";
  oldHash?: string;
  newHash?: string;
}

const HASH_STORE_VERSION = 1;

export class FileTracker {
  private store: HashStore = {
    version: HASH_STORE_VERSION,
    files: {},
  };

  /**
   * Get the hash entry for a file
   */
  getEntry(filePath: string): FileHashEntry | null {
    return this.store.files[filePath] || null;
  }

  /**
   * Set the hash entry for a file
   */
  setEntry(filePath: string, entry: FileHashEntry): void {
    this.store.files[filePath] = entry;
  }

  /**
   * Remove the hash entry for a file
   */
  removeEntry(filePath: string): boolean {
    if (this.store.files[filePath]) {
      delete this.store.files[filePath];
      return true;
    }
    return false;
  }

  /**
   * Get all tracked file paths
   */
  getTrackedFiles(): string[] {
    return Object.keys(this.store.files);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store = {
      version: HASH_STORE_VERSION,
      files: {},
    };
  }

  /**
   * Detect changes between current files and stored hashes
   */
  async detectChanges(files: string[]): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    const currentFiles = new Set(files);

    // Check for deleted files
    for (const storedPath of Object.keys(this.store.files)) {
      if (!currentFiles.has(storedPath)) {
        changes.push({
          path: storedPath,
          type: "deleted",
          oldHash: this.store.files[storedPath].contentHash,
        });
      }
    }

    // Check for added or modified files
    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const newHash = await hashContent(content);
        const stat = statSync(filePath);

        const entry = this.store.files[filePath];

        if (!entry) {
          // New file
          changes.push({
            path: filePath,
            type: "added",
            newHash,
          });
        } else if (entry.contentHash !== newHash) {
          // Modified file
          changes.push({
            path: filePath,
            type: "modified",
            oldHash: entry.contentHash,
            newHash,
          });
        }
        // If hash matches and mtime is similar, no change
      } catch (error) {
        // File might be deleted or unreadable
        if (this.store.files[filePath]) {
          changes.push({
            path: filePath,
            type: "deleted",
            oldHash: this.store.files[filePath].contentHash,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Update stored hash for a file
   */
  async updateFile(
    filePath: string,
    content: string,
    chunkIds: string[]
  ): Promise<void> {
    const hash = await hashContent(content);
    const stat = statSync(filePath);

    this.store.files[filePath] = {
      contentHash: hash,
      mtimeMs: stat.mtimeMs,
      chunkIds,
    };
  }

  /**
   * Save to disk
   */
  async save(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    const hashesPath = join(dirPath, "hashes.json");
    writeFileSync(hashesPath, JSON.stringify(this.store, null, 2), "utf-8");
  }

  /**
   * Load from disk
   */
  async load(dirPath: string): Promise<void> {
    const hashesPath = join(dirPath, "hashes.json");

    if (!existsSync(hashesPath)) {
      // No existing hash store - start fresh
      this.clear();
      return;
    }

    const content = readFileSync(hashesPath, "utf-8");
    const data = JSON.parse(content) as HashStore;

    // Version check
    if (data.version !== HASH_STORE_VERSION) {
      // Incompatible version - start fresh
      this.clear();
      return;
    }

    this.store = data;
  }

  /**
   * Get stats
   */
  getStats(): { trackedFiles: number } {
    return {
      trackedFiles: Object.keys(this.store.files).length,
    };
  }
}
