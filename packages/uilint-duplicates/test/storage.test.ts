import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { VectorStore } from '../src/index/vector-store.js';
import { MetadataStore } from '../src/index/metadata-store.js';
import { FileTracker, hashContent, hashContentSync } from '../src/cache/file-tracker.js';
import type { StoredChunkMetadata } from '../src/index/types.js';

const TEST_DIR = join(__dirname, '.test-storage');

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  describe('add and get', () => {
    it('should add and retrieve vectors', () => {
      const vector = [0.1, 0.2, 0.3, 0.4];
      store.add('id1', vector);

      expect(store.get('id1')).toEqual(vector);
      expect(store.size()).toBe(1);
    });

    it('should update existing vectors', () => {
      store.add('id1', [0.1, 0.2]);
      store.add('id1', [0.3, 0.4]);

      expect(store.get('id1')).toEqual([0.3, 0.4]);
      expect(store.size()).toBe(1);
    });

    it('should enforce dimension consistency', () => {
      store.add('id1', [0.1, 0.2, 0.3]);

      expect(() => store.add('id2', [0.1, 0.2])).toThrow('dimension mismatch');
    });

    it('should return null for non-existent IDs', () => {
      expect(store.get('nonexistent')).toBeNull();
    });
  });

  describe('addBatch', () => {
    it('should add multiple vectors', () => {
      store.addBatch([
        { id: 'id1', vector: [0.1, 0.2] },
        { id: 'id2', vector: [0.3, 0.4] },
      ]);

      expect(store.size()).toBe(2);
      expect(store.get('id1')).toEqual([0.1, 0.2]);
      expect(store.get('id2')).toEqual([0.3, 0.4]);
    });
  });

  describe('remove', () => {
    it('should remove vectors', () => {
      store.add('id1', [0.1, 0.2]);
      expect(store.remove('id1')).toBe(true);
      expect(store.get('id1')).toBeNull();
      expect(store.size()).toBe(0);
    });

    it('should return false for non-existent IDs', () => {
      expect(store.remove('nonexistent')).toBe(false);
    });
  });

  describe('findSimilar', () => {
    beforeEach(() => {
      // Add some test vectors
      store.add('id1', [1, 0, 0, 0]); // Pure X
      store.add('id2', [0, 1, 0, 0]); // Pure Y
      store.add('id3', [0.7, 0.7, 0, 0]); // Mix of X and Y
      store.add('id4', [0.9, 0.1, 0, 0]); // Mostly X
    });

    it('should find similar vectors', () => {
      const query = [1, 0, 0, 0]; // Query for X
      const results = store.findSimilar(query, 2);

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('id1'); // Exact match
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should return results sorted by score', () => {
      const query = [1, 0, 0, 0];
      const results = store.findSimilar(query, 10);

      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('should filter by threshold', () => {
      const query = [1, 0, 0, 0];
      const results = store.findSimilar(query, 10, 0.9);

      expect(results.every(r => r.score >= 0.9)).toBe(true);
    });

    it('should return top k results', () => {
      const query = [1, 0, 0, 0];
      const results = store.findSimilar(query, 2);

      expect(results.length).toBe(2);
    });

    it('should include distance in results', () => {
      const query = [1, 0, 0, 0];
      const results = store.findSimilar(query, 1);

      expect(results[0].distance).toBeCloseTo(1 - results[0].score, 5);
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
      mkdirSync(TEST_DIR, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
    });

    it('should save and load vectors', async () => {
      store.add('id1', [0.1, 0.2, 0.3]);
      store.add('id2', [0.4, 0.5, 0.6]);

      await store.save(TEST_DIR);

      const loaded = new VectorStore();
      await loaded.load(TEST_DIR);

      expect(loaded.size()).toBe(2);
      // Float32 has limited precision, so we compare with tolerance
      const v1 = loaded.get('id1')!;
      const v2 = loaded.get('id2')!;
      expect(v1[0]).toBeCloseTo(0.1, 5);
      expect(v1[1]).toBeCloseTo(0.2, 5);
      expect(v1[2]).toBeCloseTo(0.3, 5);
      expect(v2[0]).toBeCloseTo(0.4, 5);
      expect(v2[1]).toBeCloseTo(0.5, 5);
      expect(v2[2]).toBeCloseTo(0.6, 5);
    });

    it('should preserve dimension after load', async () => {
      store.add('id1', [0.1, 0.2, 0.3]);
      await store.save(TEST_DIR);

      const loaded = new VectorStore();
      await loaded.load(TEST_DIR);

      expect(loaded.getDimension()).toBe(3);
    });

    it('should handle empty store', async () => {
      await store.save(TEST_DIR);

      const loaded = new VectorStore();
      await loaded.load(TEST_DIR);

      expect(loaded.size()).toBe(0);
    });

    it('should create directory if not exists', async () => {
      const nestedPath = join(TEST_DIR, 'nested', 'path');
      store.add('id1', [0.1, 0.2]);

      await store.save(nestedPath);

      expect(existsSync(nestedPath)).toBe(true);
    });
  });

  describe('entries iterator', () => {
    it('should iterate over all entries', () => {
      store.add('id1', [0.1, 0.2]);
      store.add('id2', [0.3, 0.4]);

      const entries = [...store.entries()];

      expect(entries.length).toBe(2);
      expect(entries.map(([id]) => id).sort()).toEqual(['id1', 'id2']);
    });
  });
});

describe('MetadataStore', () => {
  let store: MetadataStore;

  const createMetadata = (overrides: Partial<StoredChunkMetadata> = {}): StoredChunkMetadata => ({
    filePath: '/test/file.tsx',
    startLine: 1,
    endLine: 10,
    kind: 'component',
    name: 'TestComponent',
    contentHash: 'abc123',
    ...overrides,
  });

  beforeEach(() => {
    store = new MetadataStore();
  });

  describe('set and get', () => {
    it('should add and retrieve metadata', () => {
      const metadata = createMetadata();
      store.set('id1', metadata);

      expect(store.get('id1')).toEqual(metadata);
      expect(store.size()).toBe(1);
    });

    it('should return null for non-existent IDs', () => {
      expect(store.get('nonexistent')).toBeNull();
    });
  });

  describe('getByFilePath', () => {
    it('should find all chunks for a file', () => {
      store.set('id1', createMetadata({ filePath: '/a.tsx', name: 'A' }));
      store.set('id2', createMetadata({ filePath: '/a.tsx', name: 'B' }));
      store.set('id3', createMetadata({ filePath: '/b.tsx', name: 'C' }));

      const results = store.getByFilePath('/a.tsx');

      expect(results.length).toBe(2);
      expect(results.map(r => r.metadata.name).sort()).toEqual(['A', 'B']);
    });
  });

  describe('removeByFilePath', () => {
    it('should remove all chunks for a file', () => {
      store.set('id1', createMetadata({ filePath: '/a.tsx' }));
      store.set('id2', createMetadata({ filePath: '/a.tsx' }));
      store.set('id3', createMetadata({ filePath: '/b.tsx' }));

      const removed = store.removeByFilePath('/a.tsx');

      expect(removed.length).toBe(2);
      expect(store.size()).toBe(1);
      expect(store.get('id3')).not.toBeNull();
    });
  });

  describe('getByContentHash', () => {
    it('should find chunk by content hash', () => {
      store.set('id1', createMetadata({ contentHash: 'hash1' }));
      store.set('id2', createMetadata({ contentHash: 'hash2' }));

      const result = store.getByContentHash('hash1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('id1');
    });
  });

  describe('getAtLocation', () => {
    it('should find chunk at line number', () => {
      store.set('id1', createMetadata({ filePath: '/a.tsx', startLine: 1, endLine: 10 }));
      store.set('id2', createMetadata({ filePath: '/a.tsx', startLine: 15, endLine: 25 }));

      const result = store.getAtLocation('/a.tsx', 5);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('id1');
    });

    it('should return null if no chunk at location', () => {
      store.set('id1', createMetadata({ startLine: 1, endLine: 10 }));

      const result = store.getAtLocation('/test/file.tsx', 15);

      expect(result).toBeNull();
    });
  });

  describe('filterByKind', () => {
    it('should filter by kind', () => {
      store.set('id1', createMetadata({ kind: 'component' }));
      store.set('id2', createMetadata({ kind: 'hook' }));
      store.set('id3', createMetadata({ kind: 'component' }));

      const results = store.filterByKind('component');

      expect(results.length).toBe(2);
    });
  });

  describe('searchByName', () => {
    it('should search by name case-insensitively', () => {
      store.set('id1', createMetadata({ name: 'UserCard' }));
      store.set('id2', createMetadata({ name: 'ProfileCard' }));
      store.set('id3', createMetadata({ name: 'useUserData' }));

      const results = store.searchByName('user');

      expect(results.length).toBe(2);
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
      mkdirSync(TEST_DIR, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
    });

    it('should save and load metadata', async () => {
      store.set('id1', createMetadata({ name: 'Component1' }));
      store.set('id2', createMetadata({ name: 'Component2' }));

      await store.save(TEST_DIR);

      const loaded = new MetadataStore();
      await loaded.load(TEST_DIR);

      expect(loaded.size()).toBe(2);
      expect(loaded.get('id1')?.name).toBe('Component1');
    });
  });
});

describe('FileTracker', () => {
  let tracker: FileTracker;

  beforeEach(() => {
    tracker = new FileTracker();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('hashContent', () => {
    it('should generate consistent hashes', async () => {
      const hash1 = await hashContent('test content');
      const hash2 = await hashContent('test content');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', async () => {
      const hash1 = await hashContent('content1');
      const hash2 = await hashContent('content2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashContentSync', () => {
    it('should generate consistent hashes', () => {
      const hash1 = hashContentSync('test content');
      const hash2 = hashContentSync('test content');
      expect(hash1).toBe(hash2);
    });
  });

  describe('setEntry and getEntry', () => {
    it('should store and retrieve entries', () => {
      tracker.setEntry('/test.tsx', {
        contentHash: 'hash1',
        mtimeMs: 12345,
        chunkIds: ['id1', 'id2'],
      });

      const entry = tracker.getEntry('/test.tsx');
      expect(entry).not.toBeNull();
      expect(entry!.contentHash).toBe('hash1');
      expect(entry!.chunkIds).toEqual(['id1', 'id2']);
    });
  });

  describe('detectChanges', () => {
    it('should detect added files', async () => {
      const filePath = join(TEST_DIR, 'new.tsx');
      writeFileSync(filePath, 'new content');

      const changes = await tracker.detectChanges([filePath]);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('added');
      expect(changes[0].path).toBe(filePath);
    });

    it('should detect modified files', async () => {
      const filePath = join(TEST_DIR, 'modified.tsx');
      writeFileSync(filePath, 'original content');

      // Track the file
      await tracker.updateFile(filePath, 'original content', ['id1']);

      // Modify the file
      writeFileSync(filePath, 'modified content');

      const changes = await tracker.detectChanges([filePath]);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('modified');
    });

    it('should detect deleted files', async () => {
      const filePath = join(TEST_DIR, 'deleted.tsx');

      // Pretend we tracked a file that no longer exists
      tracker.setEntry(filePath, {
        contentHash: 'old_hash',
        mtimeMs: 12345,
        chunkIds: ['id1'],
      });

      const changes = await tracker.detectChanges([]);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('deleted');
    });

    it('should detect unchanged files', async () => {
      const filePath = join(TEST_DIR, 'unchanged.tsx');
      writeFileSync(filePath, 'same content');

      await tracker.updateFile(filePath, 'same content', ['id1']);

      const changes = await tracker.detectChanges([filePath]);

      expect(changes.length).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should save and load hash store', async () => {
      tracker.setEntry('/a.tsx', {
        contentHash: 'hash1',
        mtimeMs: 12345,
        chunkIds: ['id1'],
      });

      await tracker.save(TEST_DIR);

      const loaded = new FileTracker();
      await loaded.load(TEST_DIR);

      expect(loaded.getEntry('/a.tsx')?.contentHash).toBe('hash1');
    });

    it('should handle missing hash store', async () => {
      const loaded = new FileTracker();
      await loaded.load(TEST_DIR); // No file exists

      expect(loaded.getTrackedFiles().length).toBe(0);
    });
  });
});
