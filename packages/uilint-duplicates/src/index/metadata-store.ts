/**
 * Metadata Store
 *
 * JSON-based storage for chunk metadata (file paths, line numbers, etc.)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { StoredChunkMetadata } from "./types.js";

export class MetadataStore {
  private chunks: Map<string, StoredChunkMetadata> = new Map();

  /**
   * Add or update chunk metadata
   */
  set(id: string, metadata: StoredChunkMetadata): void {
    this.chunks.set(id, metadata);
  }

  /**
   * Add multiple chunks at once
   */
  setBatch(items: Array<{ id: string; metadata: StoredChunkMetadata }>): void {
    for (const { id, metadata } of items) {
      this.set(id, metadata);
    }
  }

  /**
   * Get chunk metadata by ID
   */
  get(id: string): StoredChunkMetadata | null {
    return this.chunks.get(id) || null;
  }

  /**
   * Check if a chunk exists
   */
  has(id: string): boolean {
    return this.chunks.has(id);
  }

  /**
   * Remove chunk metadata
   */
  remove(id: string): boolean {
    return this.chunks.delete(id);
  }

  /**
   * Remove all chunks for a given file path
   */
  removeByFilePath(filePath: string): string[] {
    const removedIds: string[] = [];
    for (const [id, metadata] of this.chunks) {
      if (metadata.filePath === filePath) {
        this.chunks.delete(id);
        removedIds.push(id);
      }
    }
    return removedIds;
  }

  /**
   * Get all chunks for a given file path
   */
  getByFilePath(
    filePath: string
  ): Array<{ id: string; metadata: StoredChunkMetadata }> {
    const results: Array<{ id: string; metadata: StoredChunkMetadata }> = [];
    for (const [id, metadata] of this.chunks) {
      if (metadata.filePath === filePath) {
        results.push({ id, metadata });
      }
    }
    return results;
  }

  /**
   * Get chunk by content hash
   */
  getByContentHash(
    contentHash: string
  ): { id: string; metadata: StoredChunkMetadata } | null {
    for (const [id, metadata] of this.chunks) {
      if (metadata.contentHash === contentHash) {
        return { id, metadata };
      }
    }
    return null;
  }

  /**
   * Get chunk at a specific location
   */
  getAtLocation(
    filePath: string,
    line: number
  ): { id: string; metadata: StoredChunkMetadata } | null {
    for (const [id, metadata] of this.chunks) {
      if (
        metadata.filePath === filePath &&
        metadata.startLine <= line &&
        metadata.endLine >= line
      ) {
        return { id, metadata };
      }
    }
    return null;
  }

  /**
   * Get all unique file paths
   */
  getFilePaths(): string[] {
    const paths = new Set<string>();
    for (const metadata of this.chunks.values()) {
      paths.add(metadata.filePath);
    }
    return [...paths];
  }

  /**
   * Get number of chunks
   */
  size(): number {
    return this.chunks.size;
  }

  /**
   * Clear all metadata
   */
  clear(): void {
    this.chunks.clear();
  }

  /**
   * Iterate over all chunks
   */
  *entries(): IterableIterator<[string, StoredChunkMetadata]> {
    yield* this.chunks.entries();
  }

  /**
   * Get all IDs
   */
  getIds(): string[] {
    return [...this.chunks.keys()];
  }

  /**
   * Save to disk
   */
  async save(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    const metadataPath = join(dirPath, "metadata.json");
    const data = Object.fromEntries(this.chunks);
    writeFileSync(metadataPath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Load from disk
   */
  async load(dirPath: string): Promise<void> {
    const metadataPath = join(dirPath, "metadata.json");

    if (!existsSync(metadataPath)) {
      throw new Error(`Metadata file not found: ${metadataPath}`);
    }

    this.clear();
    const content = readFileSync(metadataPath, "utf-8");
    const data = JSON.parse(content) as Record<string, StoredChunkMetadata>;

    for (const [id, metadata] of Object.entries(data)) {
      this.chunks.set(id, metadata);
    }
  }

  /**
   * Filter chunks by kind
   */
  filterByKind(
    kind: string
  ): Array<{ id: string; metadata: StoredChunkMetadata }> {
    const results: Array<{ id: string; metadata: StoredChunkMetadata }> = [];
    for (const [id, metadata] of this.chunks) {
      if (metadata.kind === kind) {
        results.push({ id, metadata });
      }
    }
    return results;
  }

  /**
   * Search by name (case-insensitive partial match)
   */
  searchByName(
    query: string
  ): Array<{ id: string; metadata: StoredChunkMetadata }> {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ id: string; metadata: StoredChunkMetadata }> = [];
    for (const [id, metadata] of this.chunks) {
      if (metadata.name && metadata.name.toLowerCase().includes(lowerQuery)) {
        results.push({ id, metadata });
      }
    }
    return results;
  }
}
