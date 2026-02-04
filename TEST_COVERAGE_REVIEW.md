# UILint Test Coverage Review

## Executive Summary

This document provides a comprehensive review of test quality and coverage across the UILint monorepo. The analysis identifies critical gaps, evaluates whether tests focus on behaviors vs. implementation details, and proposes an improvement plan.

### Key Findings

| Package | Test Files | Test Count | Coverage | Critical Gaps |
|---------|-----------|------------|----------|---------------|
| **uilint-core** | 0 | 0 | **0%** | **CRITICAL - No tests at all** |
| **uilint-react** | 53 | 1,344 | 60.5% (statements) | Medium - some complex modules untested |
| **uilint** | 39 | 318 | Unknown | High - 26 failing tests, mock issues |
| **uilint-eslint** | 22 | 783 | Unknown | Low - mostly well-tested rules |
| **uilint-duplicates** | 11 | ~100 | Unknown | Low - good algorithm coverage |
| **jsx-loc-plugin** | 0 | 0 | **0%** | Low risk (simple plugin) |

---

## 1. Critical Coverage Gap: uilint-core (0% Coverage)

### The Problem

`uilint-core` is the foundational library used by all other packages, yet it has **zero tests**. This is the highest priority issue.

### Untested Modules (by risk)

| Module | Lines | Risk | Description |
|--------|-------|------|-------------|
| `consistency/analyzer.ts` | 210 | **CRITICAL** | Parses violations from LLM responses, validates data structures |
| `styleguide/parser.ts` | 403 | **CRITICAL** | Parses markdown style guides, extracts Tailwind allowlists |
| `ollama/client.ts` | 419 | **HIGH** | LLM client with streaming, JSON parsing, error handling |
| `scanner/style-extractor.ts` | 284 | **HIGH** | DOM style extraction, RGB-to-hex conversion |
| `tailwind/class-tokens.ts` | ~150 | **MEDIUM** | Tailwind class tokenization |
| `scanner/html-parser.ts` | ~100 | **MEDIUM** | HTML parsing utilities |
| `styleguide/generator.ts` | ~100 | **MEDIUM** | Style guide generation |

### Pure Functions That MUST Be Tested

These functions in `uilint-core` have complex logic that is highly testable:

```typescript
// consistency/analyzer.ts - 5 testable functions
parseGroupedSnapshot(json: string): GroupedSnapshot | null
parseViolationsResponse(response: string): Violation[]
validateViolations(violations: unknown[]): Violation[]
formatConsistencyViolations(violations: Violation[]): string

// styleguide/parser.ts - 6 testable functions
parseStyleGuide(markdown: string): StyleGuide
parseColorSection(content: string): ColorRule[]
parseTypographySection(content: string): TypographyRule[]
extractStyleValues(content: string): ExtractedStyleValues
extractTailwindAllowlist(content: string): TailwindAllowlist

// scanner/style-extractor.ts - 5 testable functions
extractStyles(root: Element, getComputedStyle: fn): ExtractedStyles
rgbToHex(rgb: string): string | null
serializeStyles(styles: ExtractedStyles): SerializedStyles
deserializeStyles(serialized: SerializedStyles): ExtractedStyles
createStyleSummary(styles: ExtractedStyles): string
```

---

## 2. Test Quality Analysis: Behaviors vs. Implementation Details

### Examples of Good Behavior-Focused Tests

**✅ `init-eslint.test.ts` (uilint CLI) - EXCELLENT**
```typescript
it("injects uilint block into existing eslint.config.mjs", async () => {
  fixture = useFixture("has-eslint-flat");

  // Tests the actual user outcome, not implementation
  const initialConfig = fixture.readFile("eslint.config.mjs");
  expect(initialConfig).not.toContain("uilint");

  // Execute the workflow
  const result = await execute(plan, { ... });

  // Verify user-observable outcomes
  expect(result.success).toBe(true);
  expect(fixture.exists(`.uilint/rules/prefer-tailwind.js`)).toBe(true);
  expect(updatedConfig).toContain("uilint/prefer-tailwind");
});
```

**✅ `no-secrets-in-code.test.ts` (uilint-eslint) - EXCELLENT**
```typescript
ruleTester.run("no-secrets-in-code", rule, {
  valid: [
    { name: "process.env reference", code: `const apiKey = process.env.API_KEY;` },
    { name: "placeholder - your_key_here", code: `const apiKey = 'your_api_key_here';` },
  ],
  invalid: [
    { name: "AWS Access Key ID", code: `const accessKeyId = 'AKIAIOSFODNN7EXAMPLE';`,
      errors: [{ messageId: "secretDetected" }] },
  ],
});
```

**✅ `scanner.test.ts` (uilint-react) - GOOD**
```typescript
it("extracts file path from standard dataLoc format", () => {
  expect(parseFilePathFromDataLoc("app/page.tsx:10:5")).toBe("app/page.tsx");
});

it("handles Windows-style paths", () => {
  expect(parseFilePathFromDataLoc("C:\\Users\\dev\\src\\App.tsx:10:5")).toBe(
    "C:\\Users\\dev\\src\\App.tsx"
  );
});
```

### Examples of Over-Detailed Tests (Testing Implementation)

**⚠️ `core-slice.test.ts` - TOO GRANULAR**
```typescript
// These test internal state shape rather than behavior
it("has altKeyHeld as false by default", () => {
  expect(getState().altKeyHeld).toBe(false);
});

it("has selectedElementId as null by default", () => {
  expect(getState().selectedElementId).toBeNull();
});

it("has default width of 400", () => {
  expect(getState().inspector.width).toBe(400);
});
```

**Better approach:** Test the behavior that depends on these values:
```typescript
it("inspector opens at default width", () => {
  const { getState } = createTestSlice();
  getState().openInspector("test-panel");
  expect(getState().inspector.width).toBe(400);
});

it("selecting an element enables element-specific actions", () => {
  const { getState } = createTestSlice();
  expect(getState().canDeleteSelection).toBe(false);
  getState().setSelectedElementId("element-123");
  expect(getState().canDeleteSelection).toBe(true);
});
```

### Test Quality Summary by Package

| Package | Behavior Tests | Implementation Tests | Assessment |
|---------|---------------|---------------------|------------|
| uilint (CLI) | 85% | 15% | **Excellent** - integration tests focus on outcomes |
| uilint-eslint | 95% | 5% | **Excellent** - RuleTester pattern is ideal |
| uilint-react | 60% | 40% | **Mixed** - store tests too granular |
| uilint-duplicates | 80% | 20% | **Good** - algorithm tests are appropriate |

---

## 3. High Complexity / Low Coverage Areas

### uilint-react (60.5% coverage)

**Modules needing more coverage:**

| Module | Est. Coverage | Complexity | Priority |
|--------|---------------|------------|----------|
| `plugins/vision/` | ~40% | High | HIGH |
| `core/services/websocket.ts` | ~50% | High | HIGH |
| `plugins/semantic/` | ~45% | High | MEDIUM |
| `scanner/dom-scanner.ts` | ~55% | Medium | MEDIUM |
| `ui/components/Inspector/` | ~65% | Medium | LOW |

### uilint (CLI)

**26 failing tests indicate infrastructure issues:**
- E2E tests (`socket-service.test.ts`, `websocket-lint-flow.test.ts`) - Server startup failures
- Unit tests (`vision-run.test.ts`) - Mock configuration issues

These aren't coverage gaps but **broken tests that need fixing**.

---

## 4. Improvement Plan

### Phase 1: Critical Foundation (Week 1-2)

**Goal: Establish tests for uilint-core**

#### 1.1 Create test infrastructure for uilint-core
```bash
# In packages/uilint-core/
npm install -D vitest @vitest/coverage-v8
```

#### 1.2 Priority 1: Test parsing functions (highest value, lowest effort)

Create `packages/uilint-core/src/consistency/analyzer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  parseGroupedSnapshot,
  parseViolationsResponse,
  validateViolations,
} from './analyzer.js';

describe('parseGroupedSnapshot', () => {
  it('parses valid JSON with all group types', () => {
    const input = JSON.stringify({
      buttons: [{ id: '1', styles: {} }],
      headings: [],
      cards: [],
      links: [],
      inputs: [],
      containers: [],
    });
    const result = parseGroupedSnapshot(input);
    expect(result).not.toBeNull();
    expect(result?.buttons).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseGroupedSnapshot('not json')).toBeNull();
  });

  it('returns empty arrays for missing properties', () => {
    const result = parseGroupedSnapshot('{}');
    expect(result?.buttons).toEqual([]);
    expect(result?.headings).toEqual([]);
  });
});

describe('parseViolationsResponse', () => {
  it('extracts violations from valid JSON response', () => {
    const response = JSON.stringify({
      violations: [{
        elementIds: ['el-1'],
        category: 'spacing',
        severity: 'warning',
        message: 'Inconsistent spacing',
        details: { property: 'margin', values: ['8px', '16px'] }
      }]
    });
    const violations = parseViolationsResponse(response);
    expect(violations).toHaveLength(1);
    expect(violations[0].category).toBe('spacing');
  });

  it('extracts JSON from markdown-wrapped response', () => {
    const response = `Here's the analysis:\n\`\`\`json\n{"violations":[]}\n\`\`\``;
    const violations = parseViolationsResponse(response);
    expect(violations).toEqual([]);
  });

  it('returns empty array for malformed response', () => {
    expect(parseViolationsResponse('garbage')).toEqual([]);
  });
});
```

Create `packages/uilint-core/src/styleguide/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseStyleGuide, extractTailwindAllowlist } from './parser.js';

describe('parseStyleGuide', () => {
  it('parses colors from markdown', () => {
    const markdown = `
## Colors
- **Primary**: #3B82F6 (used in buttons)
- **Secondary**: #6366F1 (used in links)
`;
    const guide = parseStyleGuide(markdown);
    expect(guide.colors).toHaveLength(2);
    expect(guide.colors[0]).toEqual({
      name: 'Primary',
      value: '#3B82F6',
      usage: 'used in buttons',
    });
  });

  it('parses typography section', () => {
    const markdown = `
## Typography
- **Headings**: font-family: "Inter", font-size: 24px, font-weight: 600
`;
    const guide = parseStyleGuide(markdown);
    expect(guide.typography).toHaveLength(1);
    expect(guide.typography[0].fontFamily).toBe('Inter');
    expect(guide.typography[0].fontSize).toBe('24px');
  });
});

describe('extractTailwindAllowlist', () => {
  it('extracts allowlist from JSON code block', () => {
    const content = `
## Tailwind
\`\`\`json
{
  "allowAnyColor": false,
  "allowedUtilities": ["flex", "grid", "p-4"],
  "themeTokens": {
    "colors": ["blue-500", "gray-100"]
  }
}
\`\`\`
`;
    const allowlist = extractTailwindAllowlist(content);
    expect(allowlist.allowAnyColor).toBe(false);
    expect(allowlist.allowedUtilities).toContain('flex');
    expect(allowlist.allowedTailwindColors.has('tailwind:blue-500')).toBe(true);
  });
});
```

#### 1.3 Priority 2: Test style extraction

Create `packages/uilint-core/src/scanner/style-extractor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { serializeStyles, deserializeStyles } from './style-extractor.js';

describe('serializeStyles / deserializeStyles', () => {
  it('round-trips ExtractedStyles', () => {
    const original = {
      colors: new Map([['#FF0000', 5], ['#00FF00', 3]]),
      fontSizes: new Map([['16px', 10]]),
      fontFamilies: new Map([['Inter', 8]]),
      fontWeights: new Map([['400', 12]]),
      spacing: new Map([['8px', 20]]),
      borderRadius: new Map([['4px', 5]]),
    };

    const serialized = serializeStyles(original);
    const restored = deserializeStyles(serialized);

    expect(restored.colors.get('#FF0000')).toBe(5);
    expect(restored.fontSizes.get('16px')).toBe(10);
  });
});
```

### Phase 2: Fix Broken Tests (Week 2)

**Goal: Get all existing tests passing**

#### 2.1 Fix uilint CLI test failures

1. **E2E tests** - Server startup issues in `test/e2e/`:
   - Review `test/helpers/server-starter.ts`
   - Increase startup timeout or fix race conditions
   - Consider using testcontainers or proper port allocation

2. **Mock issues** in `test/unit/vision-run.test.ts`:
   ```typescript
   // Current broken mock
   vi.mock("uilint-core/node");

   // Fix: Use importOriginal to include missing exports
   vi.mock("uilint-core/node", async (importOriginal) => {
     const actual = await importOriginal();
     return {
       ...actual,
       findUILintStyleGuideUpwards: vi.fn(),
     };
   });
   ```

#### 2.2 Fix uilint-eslint test failures

- Import resolution issue for `uilint-core`
- Add alias configuration in `vitest.config.ts`:
  ```typescript
  resolve: {
    alias: {
      'uilint-core': path.resolve(__dirname, '../uilint-core/src'),
    },
  },
  ```

### Phase 3: Refactor Over-Detailed Tests (Week 3)

**Goal: Convert implementation tests to behavior tests**

#### 3.1 Consolidate core-slice tests

Instead of 50+ individual state property tests, focus on user scenarios:

```typescript
// BEFORE: Testing implementation details
describe("Core Slice - Initial State", () => {
  it("has altKeyHeld as false by default", () => { ... });
  it("has selectedElementId as null by default", () => { ... });
  it("has commandPalette.open as false by default", () => { ... });
  // ... 20 more like this
});

// AFTER: Testing behaviors
describe("Core Slice - User Scenarios", () => {
  it("starts with nothing selected and UI closed", () => {
    const { getState } = createTestSlice();
    expect(getState().selectedElementId).toBeNull();
    expect(getState().inspector.open).toBe(false);
    expect(getState().commandPalette.open).toBe(false);
  });

  it("opening command palette with K resets any existing query", () => {
    const { getState } = createTestSlice();
    getState().setCommandPaletteQuery("old search");
    getState().openCommandPalette();
    expect(getState().commandPalette.query).toBe("");
  });

  it("selecting element via tile opens inspector with element data", () => {
    const { getState, services } = createTestSlice();
    getState().setSelectedElementId("el-123");
    getState().openInspector("element", { elementId: "el-123" });

    expect(getState().inspector.open).toBe(true);
    expect(getState().inspector.data?.elementId).toBe("el-123");
  });
});
```

### Phase 4: Increase Coverage in Key Areas (Week 4+)

**Goal: Achieve 80% coverage in critical paths**

#### 4.1 uilint-react priorities

| Module | Current | Target | Approach |
|--------|---------|--------|----------|
| `plugins/vision/` | ~40% | 70% | Mock LLM, test state transitions |
| `core/services/websocket.ts` | ~50% | 80% | Mock WebSocket, test message handling |
| `plugins/semantic/` | ~45% | 70% | Test duplicate detection integration |

#### 4.2 Add missing integration tests

```typescript
// Test the full plugin lifecycle
describe("ESLint Plugin Integration", () => {
  it("scans DOM, sends to server, receives issues, updates store", async () => {
    const store = createComposedStore();
    const mockWs = createMockWebSocketService();

    // Simulate elements being added to DOM
    store.getState().eslint.addScannedElement({
      id: "el-1",
      dataLoc: "app/page.tsx:10:5"
    });

    // Verify lint request is sent
    expect(mockWs.send).toHaveBeenCalledWith({
      type: "lint",
      files: ["app/page.tsx"],
    });

    // Simulate response
    mockWs.simulateMessage({
      type: "lint-result",
      issues: [{ ruleId: "no-console", line: 10, column: 5 }],
    });

    // Verify store is updated
    expect(store.getState().eslint.issues).toHaveLength(1);
  });
});
```

---

## 5. Metrics and Success Criteria

### Target Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| uilint-core coverage | 0% | 70% | 2 weeks |
| uilint-react coverage | 60.5% | 75% | 4 weeks |
| Failing tests | 28 | 0 | 2 weeks |
| Implementation detail tests | 40% | 15% | 4 weeks |

### Definition of Done for New Tests

Every new test should answer YES to at least one:
- [ ] Does this test a user-visible behavior?
- [ ] Does this test an edge case that caused a bug?
- [ ] Does this test a complex algorithm with specific expected outputs?

And NO to:
- [ ] Does this test merely assert initial state values?
- [ ] Does this test the internal structure of data?
- [ ] Would this test break if we refactored without changing behavior?

---

## 6. Quick Wins (Can Do Today)

1. **Create vitest config for uilint-core** - 10 minutes
2. **Write 5 tests for `parseViolationsResponse`** - 30 minutes
3. **Write 5 tests for `parseStyleGuide`** - 30 minutes
4. **Fix mock in `vision-run.test.ts`** - 15 minutes

These 4 actions would immediately improve the most critical gap and demonstrate the testing pattern for the team.

---

## Appendix: Test File Inventory

### uilint-core (0 test files)
**NONE** - All modules untested

### uilint-react (53 test files)
```
src/integration.test.ts
src/devtool-e2e.test.ts
src/components/ui-lint/*.test.ts (5 files)
src/plugins/eslint/*.test.ts (7 files)
src/plugins/semantic/*.test.ts (3 files)
src/plugins/vision/*.test.ts (2 files)
src/core/store/*.test.ts (8 files)
src/core/services/*.test.ts (2 files)
src/core/plugin-system/*.test.ts (2 files)
src/ui/components/**/*.test.tsx (18 files)
src/ui/hooks/*.test.ts (2 files)
```

### uilint CLI (39 test files)
```
test/integration/*.test.ts (10 files)
test/unit/*.test.ts (12 files)
test/init/**/*.test.ts (14 files)
test/e2e/*.test.ts (3 files)
```

### uilint-eslint (22 test files)
```
src/rules/*.test.ts (17 files - one per rule)
src/utils/*.test.ts (5 files)
```

### uilint-duplicates (11 test files)
```
test/*.test.ts (11 files)
```
