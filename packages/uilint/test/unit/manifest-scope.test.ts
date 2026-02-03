/**
 * Tests for: manifest scope extraction integration
 *
 * Tests that the manifest generator properly extracts and includes
 * scope information for each lint issue.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { ScopeInfo } from "../../src/scope-extractor.js";
import type { ManifestIssue } from "../../src/commands/manifest/types.js";

// Mock the eslint-utils module to control lint results
vi.mock("../../src/utils/eslint-utils.js", () => ({
  findESLintCwd: vi.fn((dir: string) => dir),
  lintFileWithDataLoc: vi.fn(),
  extractSourceSnippet: vi.fn(() => ({ lines: [], startLine: 1, endLine: 1 })),
  normalizeDataLocFilePath: vi.fn((absPath: string, cwd: string) => {
    // Return a relative path
    return absPath.replace(cwd + "/", "");
  }),
}));

// Mock the eslint-config-inject module
vi.mock("../../src/utils/eslint-config-inject.js", () => ({
  findEslintConfigFile: vi.fn(() => null),
  readRuleConfigsFromConfig: vi.fn(() => new Map()),
}));

// Mock uilint-core to avoid workspace root issues
vi.mock("uilint-core/node", () => ({
  findWorkspaceRoot: vi.fn((dir: string) => dir),
}));

// Mock uilint-eslint to avoid registry issues
vi.mock("uilint-eslint", () => ({
  ruleRegistry: [],
}));

describe("Manifest Scope Integration", () => {
  let testDir: string;
  let testFilePath: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(
      tmpdir(),
      `uilint-manifest-scope-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    testFilePath = join(testDir, "Button.tsx");
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("ManifestIssue includes scope", () => {
    it("populates scopeInfo field for issues", async () => {
      // Create a test file with a React component
      const sourceCode = `
function Button({ children }) {
  const count = 0;
  return <button>{children}</button>;
}
`;
      writeFileSync(testFilePath, sourceCode);

      // Mock the lint results
      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 3,
          column: 9,
          message: "'count' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:3:9",
        },
      ]);

      // Import and run the generator
      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      // Verify the manifest has files with issues
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]!.issues).toHaveLength(1);

      // Verify scopeInfo is populated
      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo).toBeDefined();
      expect(issue.scopeInfo?.enclosingScope).toBe("Button");
      expect(issue.scopeInfo?.scopeType).toBe("component");
    });

    it("identifies React components with scopeType 'component'", async () => {
      const sourceCode = `
const Card = ({ title }) => {
  const unused = "test";
  return (
    <div className="card">
      <h2>{title}</h2>
    </div>
  );
};
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 3,
          column: 9,
          message: "'unused' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:3:9",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.enclosingScope).toBe("Card");
      expect(issue.scopeInfo?.scopeType).toBe("component");
    });

    it("identifies hooks with scopeType 'hook'", async () => {
      const sourceCode = `
function useCounter(initialValue) {
  const unused = 0;
  const [count, setCount] = useState(initialValue);
  return { count, increment: () => setCount(c => c + 1) };
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 3,
          column: 9,
          message: "'unused' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:3:9",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.enclosingScope).toBe("useCounter");
      expect(issue.scopeInfo?.scopeType).toBe("hook");
    });

    it("identifies regular functions with correct scope name", async () => {
      const sourceCode = `
function processData(items) {
  const unused = [];
  return items.map(item => item.id);
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 3,
          column: 9,
          message: "'unused' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:3:9",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.enclosingScope).toBe("processData");
      expect(issue.scopeInfo?.scopeType).toBe("function");
    });

    it("identifies module-level issues with scopeType 'module'", async () => {
      const sourceCode = `
const API_URL = 'https://api.example.com';
const unusedConstant = 'test';

function Component() {
  return <div />;
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 3,
          column: 7,
          message: "'unusedConstant' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:3:7",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.scopeType).toBe("module");
      expect(issue.scopeInfo?.enclosingScope).toBeNull();
    });
  });

  describe("Graceful degradation", () => {
    it("continues manifest generation if scope extraction fails for a file", async () => {
      // Create a file with invalid syntax that will cause parsing to fail
      const invalidSource = `
function broken( {
  this is not valid syntax
}
`;
      writeFileSync(testFilePath, invalidSource);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 2,
          column: 1,
          message: "Parsing error: Unexpected token",
          ruleId: null,
          dataLoc: "Button.tsx:2:1",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );

      // Should not throw
      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      // Manifest should still be generated with issues
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]!.issues).toHaveLength(1);

      // Issue should exist but scopeInfo should be undefined when extraction fails
      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.message).toBe("Parsing error: Unexpected token");
      // scopeInfo might be undefined for files that can't be parsed
    });

    it("includes issues without scope when extraction returns null", async () => {
      // Create a valid file
      const sourceCode = `
function Component() {
  return <div />;
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 1,
          column: 1,
          message: "Some issue at position 0",
          ruleId: "test-rule",
          dataLoc: "Button.tsx:1:1",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );

      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      // Issue should be included regardless of scope extraction result
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]!.issues).toHaveLength(1);
      expect(manifest.files[0]!.issues[0]!.message).toBe(
        "Some issue at position 0"
      );
    });

    it("handles multiple issues in same file with mixed scope results", async () => {
      const sourceCode = `
const GLOBAL_VAR = "test";

function Component() {
  const unused = "test";
  return <div />;
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 2,
          column: 7,
          message: "'GLOBAL_VAR' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:2:7",
        },
        {
          line: 5,
          column: 9,
          message: "'unused' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:5:9",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );

      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      expect(manifest.files[0]!.issues).toHaveLength(2);

      // First issue should be at module level
      const moduleIssue = manifest.files[0]!.issues[0]!;
      expect(moduleIssue.scopeInfo?.scopeType).toBe("module");

      // Second issue should be in the Component
      const componentIssue = manifest.files[0]!.issues[1]!;
      expect(componentIssue.scopeInfo?.enclosingScope).toBe("Component");
      expect(componentIssue.scopeInfo?.scopeType).toBe("component");
    });
  });

  describe("Scope info properties", () => {
    it("includes parentScope for nested functions", async () => {
      const sourceCode = `
function TodoList({ items }) {
  const handleDelete = (id) => {
    const unused = true;
    deleteItem(id);
  };
  return <ul>{items.map(renderItem)}</ul>;
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 4,
          column: 11,
          message: "'unused' is defined but never used",
          ruleId: "no-unused-vars",
          dataLoc: "Button.tsx:4:11",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );

      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.enclosingScope).toBe("handleDelete");
      expect(issue.scopeInfo?.scopeType).toBe("arrow-function");
      expect(issue.scopeInfo?.parentScope).toBe("TodoList");
    });

    it("includes jsxElementType when inside JSX", async () => {
      const sourceCode = `
function App() {
  return (
    <div className="app">
      <Button onClick={handleClick}>
        Click me
      </Button>
    </div>
  );
}
`;
      writeFileSync(testFilePath, sourceCode);

      const { lintFileWithDataLoc } = await import(
        "../../src/utils/eslint-utils.js"
      );
      // Issue at the "Click me" text line (line 6)
      vi.mocked(lintFileWithDataLoc).mockResolvedValue([
        {
          line: 6,
          column: 9,
          message: "Some JSX issue",
          ruleId: "jsx-rule",
          dataLoc: "Button.tsx:6:9",
        },
      ]);

      const { generateManifest } = await import(
        "../../src/commands/manifest/generator.js"
      );

      const manifest = await generateManifest({
        cwd: testDir,
        include: ["*.tsx"],
        includeSource: false,
      });

      const issue = manifest.files[0]!.issues[0]!;
      expect(issue.scopeInfo?.jsxElementType).toBe("Button");
    });
  });
});
