import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../src/index/vector-store.js';
import { MetadataStore } from '../src/index/metadata-store.js';
import {
  findDuplicateGroups,
  findSimilarToLocation,
  findSimilarToQuery,
} from '../src/detection/duplicate-finder.js';
import {
  calculateSizeRatio,
  calculateDuplicateScore,
  calculateGroupAverageSimilarity,
  sortDuplicateGroups,
} from '../src/detection/scorer.js';
import type { StoredChunkMetadata } from '../src/index/types.js';

const createMetadata = (overrides: Partial<StoredChunkMetadata> = {}): StoredChunkMetadata => ({
  filePath: '/test/file.tsx',
  startLine: 1,
  endLine: 10,
  startColumn: 0,
  endColumn: 1,
  kind: 'component',
  name: 'TestComponent',
  contentHash: 'abc123',
  metadata: {},
  ...overrides,
});

describe('Scorer', () => {
  describe('calculateSizeRatio', () => {
    it('should return 1 for identical sizes', () => {
      const chunk1 = createMetadata({ startLine: 1, endLine: 10 });
      const chunk2 = createMetadata({ startLine: 5, endLine: 14 });
      expect(calculateSizeRatio(chunk1, chunk2)).toBe(1);
    });

    it('should return ratio for different sizes', () => {
      const chunk1 = createMetadata({ startLine: 1, endLine: 10 }); // 10 lines
      const chunk2 = createMetadata({ startLine: 1, endLine: 20 }); // 20 lines
      expect(calculateSizeRatio(chunk1, chunk2)).toBe(0.5);
    });

    it('should handle edge case of 1 line chunks', () => {
      const chunk1 = createMetadata({ startLine: 1, endLine: 1 });
      const chunk2 = createMetadata({ startLine: 1, endLine: 1 });
      expect(calculateSizeRatio(chunk1, chunk2)).toBe(1);
    });
  });

  describe('calculateDuplicateScore', () => {
    it('should weight similarity at 85%', () => {
      const chunk1 = createMetadata({ startLine: 1, endLine: 10 });
      const chunk2 = createMetadata({ startLine: 1, endLine: 10 });
      const score = calculateDuplicateScore(0.9, chunk1, chunk2);

      // 0.9 * 0.85 + 1 * 0.15 = 0.765 + 0.15 = 0.915
      expect(score.similarity).toBe(0.9);
      expect(score.sizeRatio).toBe(1);
      expect(score.combinedScore).toBeCloseTo(0.915, 5);
    });
  });

  describe('calculateGroupAverageSimilarity', () => {
    it('should calculate average', () => {
      expect(calculateGroupAverageSimilarity([0.9, 0.8, 0.7])).toBeCloseTo(0.8, 5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateGroupAverageSimilarity([])).toBe(0);
    });
  });

  describe('sortDuplicateGroups', () => {
    it('should sort by member count first', () => {
      const groups = [
        { members: [1, 2], avgSimilarity: 0.9 },
        { members: [1, 2, 3], avgSimilarity: 0.8 },
      ];
      const sorted = sortDuplicateGroups(groups);
      expect(sorted[0].members.length).toBe(3);
    });

    it('should sort by similarity when member count is equal', () => {
      const groups = [
        { members: [1, 2], avgSimilarity: 0.8 },
        { members: [1, 2], avgSimilarity: 0.9 },
      ];
      const sorted = sortDuplicateGroups(groups);
      expect(sorted[0].avgSimilarity).toBe(0.9);
    });
  });
});

describe('Duplicate Finder', () => {
  let vectorStore: VectorStore;
  let metadataStore: MetadataStore;

  beforeEach(() => {
    vectorStore = new VectorStore();
    metadataStore = new MetadataStore();
  });

  describe('findDuplicateGroups', () => {
    it('should find duplicate groups above threshold', () => {
      // Add similar vectors (high cosine similarity)
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0]; // Very similar to v1
      const v3 = [0, 1, 0, 0]; // Different from v1 and v2

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);
      vectorStore.add('id3', v3);

      metadataStore.set('id1', createMetadata({ name: 'Component1', filePath: '/a.tsx' }));
      metadataStore.set('id2', createMetadata({ name: 'Component2', filePath: '/b.tsx' }));
      metadataStore.set('id3', createMetadata({ name: 'Component3', filePath: '/c.tsx' }));

      const groups = findDuplicateGroups(vectorStore, metadataStore, { threshold: 0.9 });

      expect(groups.length).toBe(1);
      expect(groups[0].members.length).toBe(2);
      expect(groups[0].members.map(m => m.metadata.name)).toContain('Component1');
      expect(groups[0].members.map(m => m.metadata.name)).toContain('Component2');
      expect(groups[0].members.map(m => m.metadata.name)).not.toContain('Component3');
    });

    it('should respect minGroupSize', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0];

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);

      metadataStore.set('id1', createMetadata({ name: 'Component1' }));
      metadataStore.set('id2', createMetadata({ name: 'Component2' }));

      // With minGroupSize 3, no groups should be found
      const groups = findDuplicateGroups(vectorStore, metadataStore, {
        threshold: 0.9,
        minGroupSize: 3,
      });

      expect(groups.length).toBe(0);
    });

    it('should filter by kind', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0];
      const v3 = [0.88, 0.12, 0, 0];

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);
      vectorStore.add('id3', v3);

      metadataStore.set('id1', createMetadata({ name: 'Component1', kind: 'component' }));
      metadataStore.set('id2', createMetadata({ name: 'useHook', kind: 'hook' }));
      metadataStore.set('id3', createMetadata({ name: 'Component2', kind: 'component' }));

      const groups = findDuplicateGroups(vectorStore, metadataStore, {
        threshold: 0.9,
        kind: 'component',
      });

      expect(groups.length).toBe(1);
      expect(groups[0].members.every(m => m.metadata.kind === 'component')).toBe(true);
    });

    it('should prefer same-kind groupings when no filter', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0]; // Similar but different kind
      const v3 = [0.88, 0.12, 0, 0]; // Similar and same kind

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);
      vectorStore.add('id3', v3);

      metadataStore.set('id1', createMetadata({ name: 'Component1', kind: 'component' }));
      metadataStore.set('id2', createMetadata({ name: 'useHook', kind: 'hook' }));
      metadataStore.set('id3', createMetadata({ name: 'Component2', kind: 'component' }));

      const groups = findDuplicateGroups(vectorStore, metadataStore, { threshold: 0.9 });

      // Should group Component1 and Component2 together (same kind)
      expect(groups.length).toBe(1);
      expect(groups[0].kind).toBe('component');
    });

    it('should exclude specified paths', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0];

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);

      metadataStore.set('id1', createMetadata({ name: 'Component1', filePath: '/src/a.tsx' }));
      metadataStore.set('id2', createMetadata({ name: 'Component2', filePath: '/vendor/b.tsx' }));

      const groups = findDuplicateGroups(vectorStore, metadataStore, {
        threshold: 0.9,
        excludePaths: ['/vendor/'],
      });

      // Should not find groups because one member is excluded
      expect(groups.length).toBe(0);
    });
  });

  describe('findSimilarToLocation', () => {
    it('should find chunks similar to a location', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.85, 0.15, 0, 0];
      const v3 = [0, 1, 0, 0];

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);
      vectorStore.add('id3', v3);

      metadataStore.set('id1', createMetadata({ name: 'Component1', filePath: '/a.tsx', startLine: 1, endLine: 10 }));
      metadataStore.set('id2', createMetadata({ name: 'Component2', filePath: '/b.tsx', startLine: 1, endLine: 10 }));
      metadataStore.set('id3', createMetadata({ name: 'Component3', filePath: '/c.tsx', startLine: 1, endLine: 10 }));

      const results = findSimilarToLocation(vectorStore, metadataStore, '/a.tsx', 5, { top: 10, threshold: 0.5 });

      // Should find Component2 (similar) but not itself
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === 'id2')).toBe(true);
      expect(results.some(r => r.id === 'id1')).toBe(false); // Should not include self
    });

    it('should return empty for unknown location', () => {
      const results = findSimilarToLocation(vectorStore, metadataStore, '/unknown.tsx', 5);
      expect(results.length).toBe(0);
    });
  });

  describe('findSimilarToQuery', () => {
    it('should find chunks similar to query embedding', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0.8, 0.2, 0, 0]; // Changed to be more similar to query
      const v3 = [0, 1, 0, 0]; // Orthogonal, low similarity

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);
      vectorStore.add('id3', v3);

      metadataStore.set('id1', createMetadata({ name: 'Component1' }));
      metadataStore.set('id2', createMetadata({ name: 'Component2' }));
      metadataStore.set('id3', createMetadata({ name: 'Component3' }));

      const queryEmbedding = [0.95, 0.05, 0, 0]; // Similar to v1 and v2
      const results = findSimilarToQuery(vectorStore, queryEmbedding, { top: 10, threshold: 0.5 });

      // Should find at least v1 and v2 which are similar to query
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].id).toBe('id1'); // Most similar first
    });

    it('should respect threshold', () => {
      const v1 = [0.9, 0.1, 0, 0];
      const v2 = [0, 1, 0, 0]; // Orthogonal to query

      vectorStore.add('id1', v1);
      vectorStore.add('id2', v2);

      metadataStore.set('id1', createMetadata({ name: 'Component1' }));
      metadataStore.set('id2', createMetadata({ name: 'Component2' }));

      const queryEmbedding = [0.95, 0.05, 0, 0]; // Similar to v1 only
      const results = findSimilarToQuery(vectorStore, queryEmbedding, { top: 10, threshold: 0.9 });

      // Should only find v1 due to high threshold
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('id1');
    });
  });
});
