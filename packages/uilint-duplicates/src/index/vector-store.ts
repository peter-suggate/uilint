/**
 * Vector Store
 *
 * File-based vector storage with cosine similarity search.
 * Uses binary Float32 format for efficient storage.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface SimilarityResult {
  /** Chunk ID */
  id: string;
  /** Cosine similarity score (0-1) */
  score: number;
  /** Distance (1 - score) */
  distance: number;
}

export interface VectorStoreOptions {
  /** Expected dimension of vectors (validated on add) */
  dimension?: number;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export class VectorStore {
  private vectors: Map<string, number[]> = new Map();
  private dimension: number | null = null;
  private idIndex: string[] = []; // Ordered list of IDs for binary storage

  constructor(options: VectorStoreOptions = {}) {
    if (options.dimension) {
      this.dimension = options.dimension;
    }
  }

  /**
   * Add a vector to the store
   */
  add(id: string, vector: number[]): void {
    // Validate dimension
    if (this.dimension === null) {
      this.dimension = vector.length;
    } else if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`
      );
    }

    // Add to store
    if (!this.vectors.has(id)) {
      this.idIndex.push(id);
    }
    this.vectors.set(id, vector);
  }

  /**
   * Add multiple vectors at once
   */
  addBatch(items: Array<{ id: string; vector: number[] }>): void {
    for (const { id, vector } of items) {
      this.add(id, vector);
    }
  }

  /**
   * Remove a vector from the store
   */
  remove(id: string): boolean {
    if (!this.vectors.has(id)) {
      return false;
    }
    this.vectors.delete(id);
    this.idIndex = this.idIndex.filter((i) => i !== id);
    return true;
  }

  /**
   * Get a vector by ID
   */
  get(id: string): number[] | null {
    return this.vectors.get(id) || null;
  }

  /**
   * Check if a vector exists
   */
  has(id: string): boolean {
    return this.vectors.has(id);
  }

  /**
   * Find the most similar vectors to a query vector
   */
  findSimilar(
    query: number[],
    k: number = 10,
    threshold: number = 0
  ): SimilarityResult[] {
    if (this.dimension !== null && query.length !== this.dimension) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.dimension}, got ${query.length}`
      );
    }

    const results: SimilarityResult[] = [];

    for (const [id, vector] of this.vectors) {
      const score = cosineSimilarity(query, vector);
      if (score >= threshold) {
        results.push({
          id,
          score,
          distance: 1 - score,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top k
    return results.slice(0, k);
  }

  /**
   * Get the number of vectors in the store
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * Get the dimension of vectors
   */
  getDimension(): number | null {
    return this.dimension;
  }

  /**
   * Get all IDs
   */
  getIds(): string[] {
    return [...this.idIndex];
  }

  /**
   * Clear all vectors
   */
  clear(): void {
    this.vectors.clear();
    this.idIndex = [];
    this.dimension = null;
  }

  /**
   * Save the vector store to disk
   *
   * Format:
   * - embeddings.bin: Binary Float32 vectors
   * - ids.json: Ordered array of IDs matching vector positions
   */
  async save(dirPath: string): Promise<void> {
    // Ensure directory exists
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Save IDs
    const idsPath = join(dirPath, "ids.json");
    writeFileSync(idsPath, JSON.stringify(this.idIndex), "utf-8");

    // Save vectors as binary
    const embeddingsPath = join(dirPath, "embeddings.bin");

    if (this.vectors.size === 0) {
      // Write empty file with header only
      const header = new Uint32Array([0, 0]); // dimension=0, count=0
      writeFileSync(embeddingsPath, Buffer.from(header.buffer));
      return;
    }

    const dimension = this.dimension!;
    const count = this.vectors.size;

    // Create buffer: 8 bytes header (2 uint32) + vectors
    const headerSize = 8;
    const vectorsSize = count * dimension * 4; // Float32 = 4 bytes
    const buffer = Buffer.alloc(headerSize + vectorsSize);

    // Write header
    buffer.writeUInt32LE(dimension, 0);
    buffer.writeUInt32LE(count, 4);

    // Write vectors in ID order
    let offset = headerSize;
    for (const id of this.idIndex) {
      const vector = this.vectors.get(id)!;
      for (const value of vector) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
    }

    writeFileSync(embeddingsPath, buffer);
  }

  /**
   * Load the vector store from disk
   */
  async load(dirPath: string): Promise<void> {
    const idsPath = join(dirPath, "ids.json");
    const embeddingsPath = join(dirPath, "embeddings.bin");

    if (!existsSync(idsPath) || !existsSync(embeddingsPath)) {
      throw new Error(`Vector store files not found in ${dirPath}`);
    }

    // Clear current state
    this.clear();

    // Load IDs
    const idsContent = readFileSync(idsPath, "utf-8");
    this.idIndex = JSON.parse(idsContent);

    // Load vectors
    const buffer = readFileSync(embeddingsPath);

    // Read header
    const dimension = buffer.readUInt32LE(0);
    const count = buffer.readUInt32LE(4);

    if (count === 0) {
      // Empty store
      return;
    }

    this.dimension = dimension;

    // Read vectors
    let offset = 8;
    for (let i = 0; i < count; i++) {
      const vector: number[] = [];
      for (let j = 0; j < dimension; j++) {
        vector.push(buffer.readFloatLE(offset));
        offset += 4;
      }
      this.vectors.set(this.idIndex[i], vector);
    }
  }

  /**
   * Iterate over all vectors
   */
  *entries(): IterableIterator<[string, number[]]> {
    for (const id of this.idIndex) {
      yield [id, this.vectors.get(id)!];
    }
  }

  /**
   * Get stats about the store
   */
  getStats(): { size: number; dimension: number | null; memoryBytes: number } {
    const memoryBytes = this.dimension
      ? this.vectors.size * this.dimension * 4 + this.idIndex.length * 50 // Rough estimate
      : 0;

    return {
      size: this.vectors.size,
      dimension: this.dimension,
      memoryBytes,
    };
  }
}
