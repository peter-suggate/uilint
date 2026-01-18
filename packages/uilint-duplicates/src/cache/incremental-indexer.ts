/**
 * Incremental Indexer
 *
 * Combines chunker, embedding client, and storage to build and update
 * the semantic index incrementally.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { glob } from "glob";
import { chunkFile, prepareEmbeddingInput } from "../embeddings/chunker.js";
import {
  OllamaEmbeddingClient,
  type EmbeddingOptions,
} from "../embeddings/ollama-embeddings.js";
import { VectorStore } from "../index/vector-store.js";
import { MetadataStore } from "../index/metadata-store.js";
import {
  FileTracker,
  hashContentSync,
  type FileChange,
} from "./file-tracker.js";
import type { ChunkingOptions } from "../embeddings/types.js";
import type { IndexManifest, StoredChunkMetadata } from "../index/types.js";

const INDEX_DIR = ".uilint/.duplicates-index";
const MANIFEST_FILE = "manifest.json";
const MANIFEST_VERSION = 1;

export interface IndexerOptions {
  /** Embedding model to use */
  model?: string;
  /** Ollama server URL */
  baseUrl?: string;
  /** Glob patterns to include (default: **\/*.{ts,tsx,js,jsx}) */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Chunking options */
  chunking?: ChunkingOptions;
  /** Progress callback */
  onProgress?: (message: string, current?: number, total?: number) => void;
}

export interface IndexUpdateResult {
  /** Number of files added */
  added: number;
  /** Number of files modified */
  modified: number;
  /** Number of files deleted */
  deleted: number;
  /** Total chunks in index */
  totalChunks: number;
  /** Duration in milliseconds */
  duration: number;
}

export class IncrementalIndexer {
  private vectorStore: VectorStore;
  private metadataStore: MetadataStore;
  private fileTracker: FileTracker;
  private embeddingClient: OllamaEmbeddingClient;
  private projectRoot: string;
  private indexDir: string;
  private options: IndexerOptions;
  private manifest: IndexManifest | null = null;

  constructor(projectRoot: string, options: IndexerOptions = {}) {
    this.projectRoot = projectRoot;
    this.indexDir = join(projectRoot, INDEX_DIR);
    this.options = options;

    this.vectorStore = new VectorStore();
    this.metadataStore = new MetadataStore();
    this.fileTracker = new FileTracker();
    this.embeddingClient = new OllamaEmbeddingClient({
      model: options.model,
      baseUrl: options.baseUrl,
    });
  }

  /**
   * Get the include patterns
   */
  private getIncludePatterns(): string[] {
    return this.options.include || ["**/*.{ts,tsx,js,jsx}"];
  }

  /**
   * Get the exclude patterns
   */
  private getExcludePatterns(): string[] {
    return [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
      "**/__tests__/**",
      ...(this.options.exclude || []),
    ];
  }

  /**
   * Find all files to index
   */
  private async findFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.getIncludePatterns()) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: this.getExcludePatterns(),
        absolute: true,
        nodir: true,
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Dedupe
  }

  /**
   * Load existing index from disk
   */
  async load(): Promise<void> {
    if (!existsSync(this.indexDir)) {
      return;
    }

    try {
      // Load manifest
      const manifestPath = join(this.indexDir, MANIFEST_FILE);
      if (existsSync(manifestPath)) {
        const content = readFileSync(manifestPath, "utf-8");
        this.manifest = JSON.parse(content);
      }

      // Load stores
      await this.vectorStore.load(this.indexDir);
      await this.metadataStore.load(this.indexDir);
      await this.fileTracker.load(this.indexDir);
    } catch (error) {
      // If loading fails, start fresh
      this.vectorStore = new VectorStore();
      this.metadataStore = new MetadataStore();
      this.fileTracker = new FileTracker();
      this.manifest = null;
    }
  }

  /**
   * Save index to disk
   */
  async save(): Promise<void> {
    if (!existsSync(this.indexDir)) {
      mkdirSync(this.indexDir, { recursive: true });
    }

    // Update and save manifest
    const now = new Date().toISOString();
    const dimension = this.vectorStore.getDimension();

    this.manifest = {
      version: MANIFEST_VERSION,
      createdAt: this.manifest?.createdAt || now,
      updatedAt: now,
      embeddingModel: this.embeddingClient.getModel(),
      dimension: dimension || 0,
      fileCount: this.fileTracker.getTrackedFiles().length,
      chunkCount: this.metadataStore.size(),
    };

    const manifestPath = join(this.indexDir, MANIFEST_FILE);
    writeFileSync(
      manifestPath,
      JSON.stringify(this.manifest, null, 2),
      "utf-8"
    );

    // Save stores
    await this.vectorStore.save(this.indexDir);
    await this.metadataStore.save(this.indexDir);
    await this.fileTracker.save(this.indexDir);
  }

  /**
   * Index all files from scratch
   */
  async indexAll(force: boolean = false): Promise<IndexUpdateResult> {
    const startTime = Date.now();
    const log = this.options.onProgress || (() => {});

    // Check if Ollama is available
    const available = await this.embeddingClient.isAvailable();
    if (!available) {
      throw new Error(
        "Ollama is not available. Make sure it's running at " +
          (this.options.baseUrl || "http://localhost:11434")
      );
    }

    // Clear existing index if force
    if (force) {
      this.vectorStore.clear();
      this.metadataStore.clear();
      this.fileTracker.clear();
    } else {
      await this.load();
    }

    // Find files
    log("Finding files...");
    const files = await this.findFiles();
    log(`Found ${files.length} files`);

    // Detect changes
    const changes = force
      ? files.map((path) => ({ path, type: "added" as const, newHash: "" }))
      : await this.fileTracker.detectChanges(files);

    // Process changes
    const result = await this.processChanges(changes, log);

    // Save index
    log("Saving index...");
    await this.save();

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Update index incrementally
   */
  async update(): Promise<IndexUpdateResult> {
    const startTime = Date.now();
    const log = this.options.onProgress || (() => {});

    // Load existing index
    await this.load();

    // Check if Ollama is available
    const available = await this.embeddingClient.isAvailable();
    if (!available) {
      throw new Error("Ollama is not available");
    }

    // Find files and detect changes
    log("Detecting changes...");
    const files = await this.findFiles();
    const changes = await this.fileTracker.detectChanges(files);

    if (changes.length === 0) {
      log("No changes detected");
      return {
        added: 0,
        modified: 0,
        deleted: 0,
        totalChunks: this.metadataStore.size(),
        duration: Date.now() - startTime,
      };
    }

    log(`Found ${changes.length} changed files`);

    // Process changes
    const result = await this.processChanges(changes, log);

    // Save index
    log("Saving index...");
    await this.save();

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Process file changes
   */
  private async processChanges(
    changes: FileChange[],
    log: (msg: string, current?: number, total?: number) => void
  ): Promise<Omit<IndexUpdateResult, "duration">> {
    let added = 0;
    let modified = 0;
    let deleted = 0;

    // Handle deletions first
    const deletedFiles = changes.filter((c) => c.type === "deleted");
    for (const change of deletedFiles) {
      const removedIds = this.metadataStore.removeByFilePath(change.path);
      for (const id of removedIds) {
        this.vectorStore.remove(id);
      }
      this.fileTracker.removeEntry(change.path);
      deleted++;
    }

    // Handle additions and modifications
    const filesToProcess = changes.filter((c) => c.type !== "deleted");

    for (let i = 0; i < filesToProcess.length; i++) {
      const change = filesToProcess[i];
      log(
        `Processing ${relative(this.projectRoot, change.path)}`,
        i + 1,
        filesToProcess.length
      );

      try {
        // Read file content
        const content = readFileSync(change.path, "utf-8");

        // Remove old chunks if modified
        if (change.type === "modified") {
          const removedIds = this.metadataStore.removeByFilePath(change.path);
          for (const id of removedIds) {
            this.vectorStore.remove(id);
          }
          modified++;
        } else {
          added++;
        }

        // Chunk the file
        const chunks = chunkFile(change.path, content, this.options.chunking);

        if (chunks.length === 0) {
          // No chunks to embed, but still track the file
          await this.fileTracker.updateFile(change.path, content, []);
          continue;
        }

        // Prepare embedding inputs
        const embeddingInputs = chunks.map((c) => prepareEmbeddingInput(c));

        // Generate embeddings
        const embeddings =
          await this.embeddingClient.embedBatch(embeddingInputs);

        // Store chunks and embeddings
        const chunkIds: string[] = [];
        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          const embedding = embeddings[j].embedding;

          // Store vector
          this.vectorStore.add(chunk.id, embedding);

          // Store metadata
          const metadata: StoredChunkMetadata = {
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            startColumn: chunk.startColumn,
            endColumn: chunk.endColumn,
            kind: chunk.kind,
            name: chunk.name,
            contentHash: hashContentSync(chunk.content),
            metadata: {
              props: chunk.metadata.props,
              hooks: chunk.metadata.hooks,
              jsxElements: chunk.metadata.jsxElements,
              isExported: chunk.metadata.isExported,
              isDefaultExport: chunk.metadata.isDefaultExport,
            },
          };
          this.metadataStore.set(chunk.id, metadata);

          chunkIds.push(chunk.id);
        }

        // Update file tracker
        await this.fileTracker.updateFile(change.path, content, chunkIds);
      } catch (error) {
        console.warn(`Error processing ${change.path}:`, error);
      }
    }

    return {
      added,
      modified,
      deleted,
      totalChunks: this.metadataStore.size(),
    };
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalFiles: number;
    totalChunks: number;
    indexSizeBytes: number;
    manifest: IndexManifest | null;
  } {
    return {
      totalFiles: this.fileTracker.getTrackedFiles().length,
      totalChunks: this.metadataStore.size(),
      indexSizeBytes: this.vectorStore.getStats().memoryBytes,
      manifest: this.manifest,
    };
  }

  /**
   * Get the vector store (for queries)
   */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  /**
   * Get the metadata store (for queries)
   */
  getMetadataStore(): MetadataStore {
    return this.metadataStore;
  }

  /**
   * Check if index exists
   */
  hasIndex(): boolean {
    return existsSync(join(this.indexDir, MANIFEST_FILE));
  }
}

/**
 * Create an indexer for a project
 */
export function createIndexer(
  projectRoot: string,
  options?: IndexerOptions
): IncrementalIndexer {
  return new IncrementalIndexer(projectRoot, options);
}
