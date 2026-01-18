/**
 * Ollama Embedding Client
 *
 * Uses Ollama's /api/embed endpoint to generate text embeddings.
 * Follows the patterns from uilint-core's OllamaClient.
 */

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_BATCH_SIZE = 10;

export interface EmbeddingOptions {
  /** Ollama embedding model (default: nomic-embed-text) */
  model?: string;
  /** Ollama server URL (default: http://localhost:11434) */
  baseUrl?: string;
  /** Request timeout in ms (default: 60000) */
  timeout?: number;
  /** Batch size for embedding multiple texts (default: 10) */
  batchSize?: number;
}

export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** The model used */
  model: string;
  /** Number of tokens in the input (if available) */
  promptTokens?: number;
}

export class OllamaEmbeddingClient {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private batchSize: number;

  constructor(options: EmbeddingOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.model = options.model || DEFAULT_MODEL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Ollama returns embeddings in an array even for single input
      const embedding = data.embeddings?.[0] || data.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding response from Ollama");
      }

      return {
        embedding,
        model: this.model,
        promptTokens: data.prompt_eval_count,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate embeddings for multiple texts
   * Automatically batches large inputs
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // If small enough, embed all at once
    if (texts.length <= this.batchSize) {
      return this.embedBatchDirect(texts);
    }

    // Otherwise, process in batches
    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchResults = await this.embedBatchDirect(batch);
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Embed a batch directly (no chunking)
   */
  private async embedBatchDirect(texts: string[]): Promise<EmbeddingResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const embeddings: number[][] = data.embeddings;

      if (!embeddings || !Array.isArray(embeddings)) {
        throw new Error("Invalid batch embedding response from Ollama");
      }

      return embeddings.map((embedding) => ({
        embedding,
        model: this.model,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if the embedding model is available
   */
  async isModelAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const models = data.models || [];

      return models.some(
        (m: { name: string }) =>
          m.name === this.model || m.name.startsWith(`${this.model}:`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Pull the embedding model if not available
   */
  async ensureModel(): Promise<void> {
    const available = await this.isModelAvailable();
    if (available) return;

    console.log(`Pulling embedding model ${this.model}...`);

    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull model ${this.model}: ${errorText}`);
    }
  }

  /**
   * Get the embedding dimension for the current model
   * (Requires generating a test embedding)
   */
  async getEmbeddingDimension(): Promise<number> {
    const result = await this.embed("test");
    return result.embedding.length;
  }

  /**
   * Get the current model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Set the model name
   */
  setModel(model: string): void {
    this.model = model;
  }
}

// Default singleton instance
let defaultClient: OllamaEmbeddingClient | null = null;

export function getOllamaEmbeddingClient(
  options?: EmbeddingOptions
): OllamaEmbeddingClient {
  if (!defaultClient || options) {
    defaultClient = new OllamaEmbeddingClient(options);
  }
  return defaultClient;
}
