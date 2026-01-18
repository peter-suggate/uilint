/**
 * Tests for: no-semantic-duplicates
 *
 * Tests the detection of semantically similar code using a pre-built index.
 * These tests create actual temporary index files to test the rule.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule, { clearIndexCache } from "./no-semantic-duplicates.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

// Use a fixed temp directory
const TEST_DIR = join(tmpdir(), "uilint-dupe-test-fixed");

// Helper to create a mock vector (embedding)
function createMockVector(seed: number, dimension: number = 384): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimension; i++) {
    vector.push(Math.sin(seed * (i + 1) * 0.1) * 0.5);
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

// Helper to create similar vectors (high cosine similarity)
function createSimilarVector(base: number[], similarity: number): number[] {
  const noise: number[] = [];
  for (let i = 0; i < base.length; i++) {
    noise.push(Math.cos((i + 1) * 0.7) * 0.5);
  }
  const noiseNorm = Math.sqrt(noise.reduce((sum, v) => sum + v * v, 0));
  const normalizedNoise = noise.map((v) => v / noiseNorm);

  const dotProduct = base.reduce((sum, v, i) => sum + v * normalizedNoise[i], 0);
  const orthogonal = normalizedNoise.map((v, i) => v - dotProduct * base[i]);
  const orthNorm = Math.sqrt(orthogonal.reduce((sum, v) => sum + v * v, 0));
  const normalizedOrth = orthogonal.map((v) => v / orthNorm);

  const perpComponent = Math.sqrt(1 - similarity * similarity);
  const result = base.map((v, i) => v * similarity + normalizedOrth[i] * perpComponent);

  const resultNorm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
  return result.map((v) => v / resultNorm);
}

// Helper to create binary embeddings buffer
function createEmbeddingsBuffer(vectors: Map<string, number[]>, ids: string[]): Buffer {
  const dimension = vectors.get(ids[0])?.length || 384;
  const count = ids.length;
  const buffer = Buffer.alloc(8 + count * dimension * 4);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, dimension, true);
  view.setUint32(4, count, true);

  let offset = 8;
  for (const id of ids) {
    const vector = vectors.get(id) || [];
    for (const value of vector) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
  }

  return buffer;
}

interface ChunkDef {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  name: string | null;
  kind: string;
  vector: number[];
}

function setupIndex(
  projectRoot: string,
  chunks: ChunkDef[],
  indexPath = ".uilint/.duplicates-index"
): void {
  const fullIndexPath = join(projectRoot, indexPath);
  mkdirSync(fullIndexPath, { recursive: true });

  const metadata: Record<string, object> = {};
  const vectors = new Map<string, number[]>();
  const ids: string[] = [];

  for (const chunk of chunks) {
    metadata[chunk.id] = {
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      startColumn: chunk.startColumn ?? 0,
      endColumn: chunk.endColumn ?? 0,
      name: chunk.name,
      kind: chunk.kind,
    };
    vectors.set(chunk.id, chunk.vector);
    ids.push(chunk.id);
  }

  writeFileSync(join(fullIndexPath, "manifest.json"), JSON.stringify({ version: 1 }));
  writeFileSync(join(fullIndexPath, "metadata.json"), JSON.stringify({ entries: metadata }));
  writeFileSync(join(fullIndexPath, "ids.json"), JSON.stringify(ids));
  writeFileSync(join(fullIndexPath, "embeddings.bin"), createEmbeddingsBuffer(vectors, ids));
}

function createProject(name: string): string {
  const projectDir = join(TEST_DIR, name);
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, "package.json"), JSON.stringify({ name: `test-${name}` }));
  return projectDir;
}

// Clean up and create test directory
if (existsSync(TEST_DIR)) {
  rmSync(TEST_DIR, { recursive: true, force: true });
}
mkdirSync(TEST_DIR, { recursive: true });

// Create vectors at module load time
const baseVector = createMockVector(1);
const similarVector92 = createSimilarVector(baseVector, 0.92);
const differentVector = createMockVector(100);

// Create projects
const projects = {
  noIndex: createProject("no-index"),
  lowSimilarity: createProject("low-similarity"),
  duplicates: createProject("duplicates"),
  selfSimilarity: createProject("self-similarity"),
  customPath: createProject("custom-path"),
  edgeCases: createProject("edge-cases"),
};

// Setup indexes
setupIndex(projects.lowSimilarity, [
  {
    id: "chunk-1",
    filePath: join(projects.lowSimilarity, "src/ComponentA.tsx"),
    startLine: 1,
    endLine: 5,
    name: "ComponentA",
    kind: "component",
    vector: baseVector,
  },
  {
    id: "chunk-2",
    filePath: join(projects.lowSimilarity, "src/ComponentB.tsx"),
    startLine: 1,
    endLine: 5,
    name: "ComponentB",
    kind: "component",
    vector: differentVector,
  },
]);

setupIndex(projects.duplicates, [
  {
    id: "chunk-usercard",
    filePath: join(projects.duplicates, "src/UserCard.tsx"),
    startLine: 1,
    endLine: 10,
    name: "UserCard",
    kind: "component",
    vector: baseVector,
  },
  {
    id: "chunk-profilecard",
    filePath: join(projects.duplicates, "src/ProfileCard.tsx"),
    startLine: 1,
    endLine: 10,
    name: "ProfileCard",
    kind: "component",
    vector: similarVector92,
  },
]);

setupIndex(projects.selfSimilarity, [
  {
    id: "chunk-only",
    filePath: join(projects.selfSimilarity, "src/OnlyComponent.tsx"),
    startLine: 1,
    endLine: 5,
    name: "OnlyComponent",
    kind: "component",
    vector: baseVector,
  },
]);

setupIndex(
  projects.customPath,
  [
    {
      id: "chunk-1",
      filePath: join(projects.customPath, "src/Comp1.tsx"),
      startLine: 1,
      endLine: 5,
      name: "Comp1",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-2",
      filePath: join(projects.customPath, "src/Comp2.tsx"),
      startLine: 1,
      endLine: 5,
      name: "Comp2",
      kind: "component",
      vector: similarVector92,
    },
  ],
  "custom-index"
);

// Clear cache before each test
beforeEach(() => {
  clearIndexCache();
});

// Cleanup after all tests
afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// ============================================
// TESTS WITHOUT INDEX
// ============================================
describe("no-semantic-duplicates without index", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "no warning when index does not exist",
        filename: join(projects.noIndex, "src/components/UserCard.tsx"),
        code: `function UserCard({ user }) { return <div>{user.name}</div>; }`,
      },
      {
        name: "no warning for arrow function when index does not exist",
        filename: join(projects.noIndex, "src/components/ProfileCard.tsx"),
        code: `const ProfileCard = ({ profile }) => { return <div>{profile.name}</div>; };`,
      },
    ],
    invalid: [],
  });
});

// ============================================
// TESTS WITH INDEX - LOW SIMILARITY
// ============================================
describe("no-semantic-duplicates - low similarity", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "no warning when similarity is low",
        filename: join(projects.lowSimilarity, "src/ComponentA.tsx"),
        code: `function ComponentA() { return <div>A</div>; }`,
      },
    ],
    invalid: [],
  });
});

// ============================================
// TESTS WITH INDEX - DUPLICATE DETECTION
// ============================================
describe("no-semantic-duplicates - duplicate detection", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [],
    invalid: [
      {
        name: "warns on semantically similar arrow function",
        filename: join(projects.duplicates, "src/ProfileCard.tsx"),
        code: `const ProfileCard = ({ profile }) => { return <div>{profile.name}</div>; };`,
        errors: [{ messageId: "semanticDuplicate" }],
      },
    ],
  });
});

// ============================================
// SELF-SIMILARITY EXCLUSION
// ============================================
describe("no-semantic-duplicates self-similarity", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "does not report chunk as similar to itself",
        filename: join(projects.selfSimilarity, "src/OnlyComponent.tsx"),
        code: `function OnlyComponent() { return <div>Only one</div>; }`,
      },
    ],
    invalid: [],
  });
});

// ============================================
// CUSTOM INDEX PATH
// ============================================
describe("no-semantic-duplicates with custom index path", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [],
    invalid: [
      {
        name: "uses custom index path when specified",
        filename: join(projects.customPath, "src/Comp1.tsx"),
        code: `function Comp1() { return <div>Component 1</div>; }`,
        options: [{ indexPath: "custom-index" }],
        errors: [{ messageId: "semanticDuplicate" }],
      },
    ],
  });
});

// ============================================
// THRESHOLD CONFIGURATION
// ============================================
describe("no-semantic-duplicates threshold", () => {
  // Create a project with chunks that have similarity between 0.85 and 0.95
  const thresholdProject = createProject("threshold");
  const midSimilarVector = createSimilarVector(baseVector, 0.88);

  setupIndex(thresholdProject, [
    {
      id: "chunk-original",
      filePath: join(thresholdProject, "src/Original.tsx"),
      startLine: 1,
      endLine: 5,
      name: "Original",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-similar",
      filePath: join(thresholdProject, "src/Similar.tsx"),
      startLine: 1,
      endLine: 5,
      name: "Similar",
      kind: "component",
      vector: midSimilarVector,
    },
  ]);

  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "does not warn when similarity is below custom threshold",
        filename: join(thresholdProject, "src/Similar.tsx"),
        code: `function Similar() { return <div>Similar</div>; }`,
        options: [{ threshold: 0.95 }], // 88% similarity < 95% threshold
      },
    ],
    invalid: [
      {
        name: "warns when similarity meets default threshold",
        filename: join(thresholdProject, "src/Similar.tsx"),
        code: `function Similar() { return <div>Similar</div>; }`,
        // Default threshold is 0.85, 88% > 85%
        errors: [{ messageId: "semanticDuplicate" }],
      },
      {
        name: "warns when similarity meets custom lower threshold",
        filename: join(thresholdProject, "src/Similar.tsx"),
        code: `function Similar() { return <div>Similar</div>; }`,
        options: [{ threshold: 0.80 }],
        errors: [{ messageId: "semanticDuplicate" }],
      },
    ],
  });
});

// ============================================
// FUNCTION DECLARATION DETECTION
// ============================================
describe("no-semantic-duplicates function types", () => {
  const funcTypesProject = createProject("func-types");

  setupIndex(funcTypesProject, [
    {
      id: "chunk-func-decl",
      filePath: join(funcTypesProject, "src/FuncDecl.tsx"),
      startLine: 1,
      endLine: 5,
      name: "FuncDecl",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-arrow",
      filePath: join(funcTypesProject, "src/Arrow.tsx"),
      startLine: 1,
      endLine: 5,
      name: "Arrow",
      kind: "component",
      vector: similarVector92,
    },
    {
      id: "chunk-func-expr",
      filePath: join(funcTypesProject, "src/FuncExpr.tsx"),
      startLine: 1,
      endLine: 5,
      name: "FuncExpr",
      kind: "component",
      vector: similarVector92,
    },
  ]);

  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [],
    invalid: [
      {
        name: "detects similar function declaration",
        filename: join(funcTypesProject, "src/FuncDecl.tsx"),
        code: `function FuncDecl() { return <div>Func</div>; }`,
        errors: [{ messageId: "semanticDuplicate" }],
      },
      {
        name: "detects similar arrow function",
        filename: join(funcTypesProject, "src/Arrow.tsx"),
        code: `const Arrow = () => { return <div>Arrow</div>; };`,
        errors: [{ messageId: "semanticDuplicate" }],
      },
      {
        name: "detects similar function expression",
        filename: join(funcTypesProject, "src/FuncExpr.tsx"),
        code: `const FuncExpr = function() { return <div>Expr</div>; };`,
        errors: [{ messageId: "semanticDuplicate" }],
      },
    ],
  });
});

// ============================================
// EDGE CASES
// ============================================
describe("no-semantic-duplicates edge cases", () => {
  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "handles class methods (not checked by rule)",
        filename: join(projects.edgeCases, "src/MyComponent.tsx"),
        code: `class MyComponent { render() { return <div>Hello</div>; } }`,
      },
      {
        name: "handles object methods (not checked by rule)",
        filename: join(projects.edgeCases, "src/utils.ts"),
        code: `const obj = { getData() { return { value: 1 }; } };`,
      },
      {
        name: "handles async functions",
        filename: join(projects.edgeCases, "src/api.ts"),
        code: `async function fetchData() { const response = await fetch('/api/data'); return response.json(); }`,
      },
      {
        name: "handles generator functions",
        filename: join(projects.edgeCases, "src/generators.ts"),
        code: `function* generateNumbers() { yield 1; yield 2; }`,
      },
    ],
    invalid: [],
  });
});

// ============================================
// MESSAGE FORMAT VALIDATION
// ============================================
describe("no-semantic-duplicates message format", () => {
  const messageProject = createProject("message-format");

  setupIndex(messageProject, [
    {
      id: "chunk-usercard",
      filePath: join(messageProject, "src/components/UserCard.tsx"),
      startLine: 5,
      endLine: 15,
      name: "UserCard",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-profilecard",
      filePath: join(messageProject, "src/components/ProfileCard.tsx"),
      startLine: 1,
      endLine: 10,
      name: "ProfileCard",
      kind: "component",
      vector: similarVector92,
    },
  ]);

  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [],
    invalid: [
      {
        name: "includes correct information in error message",
        filename: join(messageProject, "src/components/ProfileCard.tsx"),
        code: `function ProfileCard({ profile }) { return <div>{profile.name}</div>; }`,
        errors: [
          {
            messageId: "semanticDuplicate",
            data: {
              kind: "component",
              name: "ProfileCard",
              similarity: "92",
              otherName: "UserCard",
              otherLocation: "src/components/UserCard.tsx:5",
            },
          },
        ],
      },
    ],
  });
});

// ============================================
// MINLINES OPTION
// ============================================
describe("no-semantic-duplicates minLines option", () => {
  const minLinesProject = createProject("minLines");

  // Setup index with chunks of different sizes
  setupIndex(minLinesProject, [
    {
      id: "chunk-small",
      filePath: join(minLinesProject, "src/Small.tsx"),
      startLine: 1,
      endLine: 2, // Only 2 lines
      startColumn: 0,
      endColumn: 1,
      name: "Small",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-large",
      filePath: join(minLinesProject, "src/Large.tsx"),
      startLine: 1,
      endLine: 5, // 5 lines
      startColumn: 0,
      endColumn: 1,
      name: "Large",
      kind: "component",
      vector: similarVector92,
    },
  ]);

  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [
      {
        name: "does not warn for chunks below minLines threshold (default 3)",
        filename: join(minLinesProject, "src/Small.tsx"),
        code: `function Small() { return <div>A</div>; }`,
        // 2 lines < 3 (default minLines), so no warning
      },
      {
        name: "does not warn for chunks below custom minLines threshold",
        filename: join(minLinesProject, "src/Large.tsx"),
        code: `function Large() {
  return (
    <div>Large</div>
  );
}`,
        options: [{ minLines: 6 }], // 5 lines < 6, so no warning
      },
    ],
    invalid: [
      {
        name: "warns for chunks meeting minLines threshold",
        filename: join(minLinesProject, "src/Large.tsx"),
        code: `function Large() {
  return (
    <div>Large</div>
  );
}`,
        options: [{ minLines: 3 }], // 5 lines >= 3, so warns
        errors: [{ messageId: "semanticDuplicate" }],
      },
      {
        name: "warns when minLines is set to 1",
        filename: join(minLinesProject, "src/Small.tsx"),
        code: `function Small() { return <div>A</div>; }`,
        options: [{ minLines: 1 }], // 2 lines >= 1, so warns
        errors: [{ messageId: "semanticDuplicate" }],
      },
    ],
  });
});

// ============================================
// LOCATION HIGHLIGHTING (LOC)
// ============================================
describe("no-semantic-duplicates location highlighting", () => {
  const locProject = createProject("location");

  setupIndex(locProject, [
    {
      id: "chunk-a",
      filePath: join(locProject, "src/CompA.tsx"),
      startLine: 1,
      endLine: 5,
      startColumn: 0,
      endColumn: 1,
      name: "CompA",
      kind: "component",
      vector: baseVector,
    },
    {
      id: "chunk-b",
      filePath: join(locProject, "src/CompB.tsx"),
      startLine: 2,
      endLine: 8,
      startColumn: 2,
      endColumn: 3,
      name: "CompB",
      kind: "component",
      vector: similarVector92,
    },
  ]);

  ruleTester.run("no-semantic-duplicates", rule, {
    valid: [],
    invalid: [
      {
        name: "highlights entire function region using loc",
        filename: join(locProject, "src/CompB.tsx"),
        code: `// comment
function CompB() {
  return (
    <div>
      B
    </div>
  );
}`,
        errors: [
          {
            messageId: "semanticDuplicate",
            line: 2, // startLine from metadata
            endLine: 8, // endLine from metadata
            column: 3, // startColumn + 1 (ESLint is 1-indexed for column in tests)
            endColumn: 4, // endColumn + 1
          },
        ],
      },
    ],
  });
});
