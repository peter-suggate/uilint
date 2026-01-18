import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaEmbeddingClient, getOllamaEmbeddingClient } from '../src/embeddings/ollama-embeddings.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaEmbeddingClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const client = new OllamaEmbeddingClient();
      expect(client.getModel()).toBe('nomic-embed-text');
    });

    it('should accept custom options', () => {
      const client = new OllamaEmbeddingClient({
        model: 'mxbai-embed-large',
        baseUrl: 'http://custom:11434',
      });
      expect(client.getModel()).toBe('mxbai-embed-large');
    });
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const mockEmbedding = Array(768).fill(0).map(() => Math.random());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [mockEmbedding],
        }),
      });

      const client = new OllamaEmbeddingClient();
      const result = await client.embed('Hello world');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello world'),
        })
      );
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.model).toBe('nomic-embed-text');
    });

    it('should handle alternative embedding response format', async () => {
      const mockEmbedding = Array(768).fill(0).map(() => Math.random());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,  // Some models return this format
        }),
      });

      const client = new OllamaEmbeddingClient();
      const result = await client.embed('test');

      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const client = new OllamaEmbeddingClient();
      await expect(client.embed('test')).rejects.toThrow('Ollama API error (500)');
    });

    it('should throw on invalid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const client = new OllamaEmbeddingClient();
      await expect(client.embed('test')).rejects.toThrow('Invalid embedding response');
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [
        Array(768).fill(0).map(() => Math.random()),
        Array(768).fill(0).map(() => Math.random()),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: mockEmbeddings,
        }),
      });

      const client = new OllamaEmbeddingClient();
      const results = await client.embedBatch(['Hello', 'World']);

      expect(results.length).toBe(2);
      expect(results[0].embedding).toEqual(mockEmbeddings[0]);
      expect(results[1].embedding).toEqual(mockEmbeddings[1]);
    });

    it('should handle empty array', async () => {
      const client = new OllamaEmbeddingClient();
      const results = await client.embedBatch([]);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should batch large inputs', async () => {
      const client = new OllamaEmbeddingClient({ batchSize: 2 });

      // Setup mock for two batches
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [
            Array(768).fill(0.1),
            Array(768).fill(0.2),
          ],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [
            Array(768).fill(0.3),
          ],
        }),
      });

      const results = await client.embedBatch(['one', 'two', 'three']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(3);
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const client = new OllamaEmbeddingClient();
      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const client = new OllamaEmbeddingClient();
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true when model is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'nomic-embed-text:latest' },
            { name: 'llama2:7b' },
          ],
        }),
      });

      const client = new OllamaEmbeddingClient();
      const available = await client.isModelAvailable();

      expect(available).toBe(true);
    });

    it('should return false when model is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:7b' },
          ],
        }),
      });

      const client = new OllamaEmbeddingClient();
      const available = await client.isModelAvailable();

      expect(available).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const client = new OllamaEmbeddingClient();
      const available = await client.isModelAvailable();

      expect(available).toBe(false);
    });
  });

  describe('ensureModel', () => {
    it('should not pull if model is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'nomic-embed-text:latest' }],
        }),
      });

      const client = new OllamaEmbeddingClient();
      await client.ensureModel();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        expect.anything()
      );
    });

    it('should pull model if not available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ models: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'success' }),
        });

      const client = new OllamaEmbeddingClient();
      await client.ensureModel();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pull'),
        expect.anything()
      );
    });

    it('should throw if pull fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ models: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Pull failed',
        });

      const client = new OllamaEmbeddingClient();
      await expect(client.ensureModel()).rejects.toThrow('Failed to pull model');
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return the dimension of embeddings', async () => {
      const mockEmbedding = Array(768).fill(0);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [mockEmbedding] }),
      });

      const client = new OllamaEmbeddingClient();
      const dimension = await client.getEmbeddingDimension();

      expect(dimension).toBe(768);
    });
  });

  describe('model accessors', () => {
    it('should get and set model', () => {
      const client = new OllamaEmbeddingClient();
      expect(client.getModel()).toBe('nomic-embed-text');

      client.setModel('mxbai-embed-large');
      expect(client.getModel()).toBe('mxbai-embed-large');
    });
  });
});

describe('getOllamaEmbeddingClient', () => {
  it('should return singleton instance', () => {
    const client1 = getOllamaEmbeddingClient();
    const client2 = getOllamaEmbeddingClient();
    expect(client1).toBe(client2);
  });

  it('should create new instance with options', () => {
    const client1 = getOllamaEmbeddingClient();
    const client2 = getOllamaEmbeddingClient({ model: 'different' });
    expect(client2.getModel()).toBe('different');
  });
});

// Integration tests - only run if Ollama is available
describe.skipIf(!process.env.TEST_OLLAMA)('OllamaEmbeddingClient Integration', () => {
  beforeEach(() => {
    // Restore real fetch for integration tests
    mockFetch.mockRestore();
  });

  it('should generate real embeddings', async () => {
    const client = new OllamaEmbeddingClient();

    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      console.log('Skipping: Ollama not available');
      return;
    }

    const result = await client.embed('Hello world');
    expect(result.embedding.length).toBeGreaterThan(0);
    expect(result.embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should generate batch embeddings', async () => {
    const client = new OllamaEmbeddingClient();

    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      console.log('Skipping: Ollama not available');
      return;
    }

    const results = await client.embedBatch(['Hello', 'World']);
    expect(results.length).toBe(2);
    expect(results[0].embedding.length).toBe(results[1].embedding.length);
  });
});
