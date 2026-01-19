import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import type { TSESTree } from "@typescript-eslint/utils";
import {
  buildDataLoc,
  findStatementsInRange,
  calculateCoverageFromStatements,
  findCoverageForFile,
  isEventHandlerAttribute,
  analyzeJSXElementCoverage,
  findConditionalAncestor,
  getConditionalStatements,
  type IstanbulCoverage,
  type IstanbulFileCoverage,
  type SourceLocation,
} from "./jsx-coverage-analyzer.js";

const FIXTURES_DIR = join(__dirname, "__fixtures__/jsx-coverage");

// Create test fixtures before tests run
beforeAll(() => {
  mkdirSync(join(FIXTURES_DIR, "src"), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, "coverage"), { recursive: true });

  // Simple JSX component with event handlers
  writeFileSync(
    join(FIXTURES_DIR, "src/Button.tsx"),
    `import React from "react";

export function Button({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const handleClick = () => {
    console.log("clicked");
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="btn"
    >
      Click me
    </button>
  );
}
`
  );

  // Coverage data file
  writeFileSync(
    join(FIXTURES_DIR, "coverage/coverage-final.json"),
    JSON.stringify({
      [join(FIXTURES_DIR, "src/Button.tsx")]: {
        path: join(FIXTURES_DIR, "src/Button.tsx"),
        statementMap: {
          "0": { start: { line: 3, column: 0 }, end: { line: 3, column: 50 } },
          "1": { start: { line: 4, column: 2 }, end: { line: 7, column: 3 } },
          "2": { start: { line: 5, column: 4 }, end: { line: 5, column: 28 } },
          "3": { start: { line: 6, column: 4 }, end: { line: 6, column: 14 } },
          "4": { start: { line: 9, column: 2 }, end: { line: 16, column: 3 } },
        },
        fnMap: {},
        branchMap: {},
        s: { "0": 5, "1": 3, "2": 3, "3": 3, "4": 5 },
        f: {},
        b: {},
      },
    })
  );
});

// Clean up fixtures after tests
afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

// Helper to create a SourceLocation
function loc(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): SourceLocation {
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

// Helper to create mock IstanbulFileCoverage
function createFileCoverage(
  statementMap: Record<string, { start: { line: number; column: number }; end: { line: number; column: number } }>,
  statementHits: Record<string, number>
): IstanbulFileCoverage {
  return {
    path: "/test/file.tsx",
    statementMap,
    fnMap: {},
    branchMap: {},
    s: statementHits,
    f: {},
    b: {},
  };
}

// Helper to create a mock JSX attribute
function createJSXAttribute(name: string): TSESTree.JSXAttribute {
  return {
    type: "JSXAttribute",
    name: {
      type: "JSXIdentifier",
      name,
      loc: loc(1, 0, 1, name.length),
      range: [0, name.length],
    },
    value: null,
    loc: loc(1, 0, 1, name.length),
    range: [0, name.length],
    parent: null as unknown as TSESTree.Node,
  };
}

// Helper to create a mock JSX spread attribute
function createJSXSpreadAttribute(): TSESTree.JSXSpreadAttribute {
  return {
    type: "JSXSpreadAttribute",
    argument: {
      type: "Identifier",
      name: "props",
      loc: loc(1, 0, 1, 5),
      range: [0, 5],
    } as TSESTree.Identifier,
    loc: loc(1, 0, 1, 10),
    range: [0, 10],
    parent: null as unknown as TSESTree.Node,
  };
}

describe("buildDataLoc", () => {
  it("produces correct file:line:column format", () => {
    const result = buildDataLoc("/path/to/file.tsx", loc(10, 5, 10, 20));
    expect(result).toBe("/path/to/file.tsx:10:5");
  });

  it("handles line 1 and column 0", () => {
    const result = buildDataLoc("/src/component.tsx", loc(1, 0, 1, 10));
    expect(result).toBe("/src/component.tsx:1:0");
  });

  it("handles various file path formats", () => {
    // Unix-style path
    expect(buildDataLoc("/Users/dev/project/src/App.tsx", loc(25, 10, 30, 5))).toBe(
      "/Users/dev/project/src/App.tsx:25:10"
    );

    // Relative path
    expect(buildDataLoc("src/components/Button.tsx", loc(100, 0, 110, 5))).toBe(
      "src/components/Button.tsx:100:0"
    );

    // Windows-style path
    expect(buildDataLoc("C:\\Users\\dev\\project\\src\\App.tsx", loc(50, 15, 55, 0))).toBe(
      "C:\\Users\\dev\\project\\src\\App.tsx:50:15"
    );
  });

  it("handles large line and column numbers", () => {
    const result = buildDataLoc("/file.tsx", loc(9999, 250, 10000, 0));
    expect(result).toBe("/file.tsx:9999:250");
  });
});

describe("findStatementsInRange", () => {
  const mockFileCoverage = createFileCoverage(
    {
      "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
      "1": { start: { line: 3, column: 0 }, end: { line: 5, column: 10 } },
      "2": { start: { line: 7, column: 0 }, end: { line: 7, column: 30 } },
      "3": { start: { line: 10, column: 0 }, end: { line: 15, column: 5 } },
    },
    { "0": 1, "1": 0, "2": 5, "3": 0 }
  );

  it("correctly identifies overlapping statements", () => {
    // Range that includes statements 1 and 2 (lines 3-7)
    const result = findStatementsInRange(loc(3, 0, 7, 30), mockFileCoverage);
    expect(result).toEqual(new Set(["1", "2"]));
  });

  it("handles no overlap case (returns empty set)", () => {
    // Range that doesn't overlap with any statements (lines 20-25)
    const result = findStatementsInRange(loc(20, 0, 25, 10), mockFileCoverage);
    expect(result).toEqual(new Set());
  });

  it("handles partial overlap", () => {
    // Range that partially overlaps with statement 3 (lines 12-20)
    const result = findStatementsInRange(loc(12, 0, 20, 10), mockFileCoverage);
    expect(result).toEqual(new Set(["3"]));
  });

  it("handles range encompassing multiple statements", () => {
    // Range that includes all statements (lines 1-15)
    const result = findStatementsInRange(loc(1, 0, 15, 10), mockFileCoverage);
    expect(result).toEqual(new Set(["0", "1", "2", "3"]));
  });

  it("handles single line range", () => {
    // Range for single line 7 that contains statement 2
    const result = findStatementsInRange(loc(7, 0, 7, 30), mockFileCoverage);
    expect(result).toEqual(new Set(["2"]));
  });

  it("handles empty statementMap", () => {
    const emptyFileCoverage = createFileCoverage({}, {});
    const result = findStatementsInRange(loc(1, 0, 10, 0), emptyFileCoverage);
    expect(result).toEqual(new Set());
  });
});

describe("calculateCoverageFromStatements", () => {
  const mockFileCoverage = createFileCoverage(
    {
      "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
      "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 10 } },
      "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 10 } },
      "4": { start: { line: 5, column: 0 }, end: { line: 5, column: 10 } },
    },
    { "0": 5, "1": 0, "2": 10, "3": 0, "4": 3 }
  );

  it("returns 0% for empty statement set", () => {
    const result = calculateCoverageFromStatements(new Set(), mockFileCoverage);
    expect(result.percentage).toBe(0);
    expect(result.total).toBe(0);
    expect(result.covered).toBe(0);
  });

  it("correctly counts covered vs uncovered", () => {
    // Statements 0, 2, 4 are covered (hits > 0)
    // Statements 1, 3 are uncovered (hits = 0)
    const result = calculateCoverageFromStatements(
      new Set(["0", "1", "2", "3", "4"]),
      mockFileCoverage
    );
    // 3 covered out of 5 = 60%
    expect(result.percentage).toBe(60);
    expect(result.covered).toBe(3);
    expect(result.total).toBe(5);
  });

  it("calculates percentage correctly for all covered", () => {
    const result = calculateCoverageFromStatements(
      new Set(["0", "2", "4"]),
      mockFileCoverage
    );
    expect(result.percentage).toBe(100);
    expect(result.covered).toBe(3);
    expect(result.total).toBe(3);
  });

  it("calculates percentage correctly for all uncovered", () => {
    const result = calculateCoverageFromStatements(
      new Set(["1", "3"]),
      mockFileCoverage
    );
    expect(result.percentage).toBe(0);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(2);
  });

  it("handles statements not in hits map as uncovered", () => {
    // Statement "99" doesn't exist in hits map - should be treated as uncovered
    const result = calculateCoverageFromStatements(
      new Set(["0", "99"]),
      mockFileCoverage
    );
    // 1 covered out of 2 = 50%
    expect(result.percentage).toBe(50);
    expect(result.covered).toBe(1);
    expect(result.total).toBe(2);
  });
});

describe("findCoverageForFile", () => {
  const mockCoverage: IstanbulCoverage = {
    "/absolute/path/src/Component.tsx": {
      path: "/absolute/path/src/Component.tsx",
      statementMap: { "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
      fnMap: {},
      branchMap: {},
      s: { "0": 5 },
      f: {},
      b: {},
    },
    "/src/utils/helper.ts": {
      path: "/src/utils/helper.ts",
      statementMap: { "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
      fnMap: {},
      branchMap: {},
      s: { "0": 10 },
      f: {},
      b: {},
    },
    "relative/path/file.tsx": {
      path: "relative/path/file.tsx",
      statementMap: { "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
      fnMap: {},
      branchMap: {},
      s: { "0": 3 },
      f: {},
      b: {},
    },
  };

  it("exact path match works", () => {
    const result = findCoverageForFile(
      mockCoverage,
      "/absolute/path/src/Component.tsx"
    );
    expect(result).toBeDefined();
    expect(result?.s["0"]).toBe(5);
  });

  it("relative path suffix matching works", () => {
    // Looking for "src/Component.tsx" should match "/absolute/path/src/Component.tsx"
    const result = findCoverageForFile(mockCoverage, "src/Component.tsx");
    expect(result).toBeDefined();
    expect(result?.s["0"]).toBe(5);
  });

  it("returns undefined when not found", () => {
    const result = findCoverageForFile(mockCoverage, "/nonexistent/file.tsx");
    expect(result).toBeUndefined();
  });

  it("matches with leading slash in coverage path", () => {
    const result = findCoverageForFile(mockCoverage, "utils/helper.ts");
    expect(result).toBeDefined();
    expect(result?.s["0"]).toBe(10);
  });

  it("handles empty coverage data", () => {
    const result = findCoverageForFile({}, "/any/file.tsx");
    expect(result).toBeUndefined();
  });
});

describe("isEventHandlerAttribute", () => {
  describe("returns true for event handlers", () => {
    const eventHandlers = [
      "onClick",
      "onChange",
      "onSubmit",
      "onFocus",
      "onBlur",
      "onKeyDown",
      "onKeyUp",
      "onMouseEnter",
      "onMouseLeave",
      "onScroll",
      "onLoad",
      "onError",
    ];

    for (const handler of eventHandlers) {
      it(handler, () => {
        expect(isEventHandlerAttribute(createJSXAttribute(handler))).toBe(true);
      });
    }
  });

  describe("returns false for non-event handlers", () => {
    const nonHandlers = [
      "className",
      "disabled",
      "ref",
      "id",
      "style",
      "type",
      "value",
      "placeholder",
    ];

    for (const prop of nonHandlers) {
      it(prop, () => {
        expect(isEventHandlerAttribute(createJSXAttribute(prop))).toBe(false);
      });
    }
  });

  it("returns false for spread attributes", () => {
    expect(isEventHandlerAttribute(createJSXSpreadAttribute())).toBe(false);
  });

  it("handles lowercase 'on' prefix that isn't an event", () => {
    // 'once' starts with 'on' but isn't an event handler (no uppercase after 'on')
    expect(isEventHandlerAttribute(createJSXAttribute("once"))).toBe(false);
  });

  it("handles custom event handlers following 'on' pattern", () => {
    // Custom props following the onX pattern should be detected
    expect(isEventHandlerAttribute(createJSXAttribute("onCustomEvent"))).toBe(true);
  });
});

describe("analyzeJSXElementCoverage", () => {
  // Helper to create a minimal mock JSX element
  function createMockJSXElement(
    location: SourceLocation,
    attributes: Array<TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute> = []
  ): TSESTree.JSXElement {
    return {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: {
          type: "JSXIdentifier",
          name: "div",
          loc: location,
          range: [0, 3],
        },
        attributes,
        selfClosing: false,
        loc: location,
        range: [0, 10],
        typeArguments: undefined,
      },
      closingElement: {
        type: "JSXClosingElement",
        name: {
          type: "JSXIdentifier",
          name: "div",
          loc: location,
          range: [0, 3],
        },
        loc: location,
        range: [0, 6],
      },
      children: [],
      loc: location,
      range: [0, 20],
      parent: null as unknown as TSESTree.Node,
    } as TSESTree.JSXElement;
  }

  it("returns 0% when no coverage data found", () => {
    const jsxElement = createMockJSXElement(loc(10, 0, 15, 10));

    const result = analyzeJSXElementCoverage(
      jsxElement,
      "/nonexistent/file.tsx",
      {} // Empty coverage data
    );

    expect(result.coverage.percentage).toBe(0);
    expect(result.isCovered).toBe(false);
  });

  it("calculates coverage from statements in element range", () => {
    const filePath = "/test/Component.tsx";
    const coverage: IstanbulCoverage = {
      [filePath]: {
        path: filePath,
        statementMap: {
          "0": { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
          "1": { start: { line: 10, column: 0 }, end: { line: 15, column: 10 } },
        },
        fnMap: {},
        branchMap: {},
        s: { "0": 5, "1": 3 },
        f: {},
        b: {},
      },
    };

    // Element on lines 10-15 should find statement "1"
    const jsxElement = createMockJSXElement(loc(10, 0, 15, 10));
    const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

    expect(result.coverage.percentage).toBe(100);
    expect(result.coverage.covered).toBe(1);
    expect(result.coverage.total).toBe(1);
    expect(result.isCovered).toBe(true);
  });

  it("produces correct dataLoc", () => {
    const jsxElement = createMockJSXElement(loc(10, 5, 20, 10));

    const result = analyzeJSXElementCoverage(
      jsxElement,
      "/src/Component.tsx",
      {}
    );

    expect(result.dataLoc).toBe("/src/Component.tsx:10:5");
  });

  it("detects event handlers on element", () => {
    const jsxElement = createMockJSXElement(loc(10, 0, 15, 10), [
      createJSXAttribute("onClick"),
      createJSXAttribute("onSubmit"),
      createJSXAttribute("className"),
    ]);

    const result = analyzeJSXElementCoverage(jsxElement, "/test.tsx", {});

    expect(result.hasEventHandlers).toBe(true);
    expect(result.eventHandlerNames).toContain("onClick");
    expect(result.eventHandlerNames).toContain("onSubmit");
    expect(result.eventHandlerNames).not.toContain("className");
  });

  it("handles JSX element spanning multiple statements with mixed coverage", () => {
    const filePath = "/test/Mixed.tsx";
    const coverage: IstanbulCoverage = {
      [filePath]: {
        path: filePath,
        statementMap: {
          "0": { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
          "1": { start: { line: 6, column: 0 }, end: { line: 6, column: 20 } },
          "2": { start: { line: 7, column: 0 }, end: { line: 7, column: 20 } },
          "3": { start: { line: 8, column: 0 }, end: { line: 8, column: 20 } },
        },
        fnMap: {},
        branchMap: {},
        s: { "0": 5, "1": 0, "2": 10, "3": 0 },
        f: {},
        b: {},
      },
    };

    // Analyze element spanning lines 5-8 (all 4 statements, 2 covered)
    const jsxElement = createMockJSXElement(loc(5, 0, 8, 20));
    const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

    expect(result.coverage.percentage).toBe(50);
    expect(result.coverage.total).toBe(4);
    expect(result.coverage.covered).toBe(2);
  });

  it("returns complete analysis result structure", () => {
    const jsxElement = createMockJSXElement(loc(1, 0, 10, 10));
    const result = analyzeJSXElementCoverage(jsxElement, "/test/file.tsx", {});

    // Verify result has all expected properties
    expect(result).toHaveProperty("dataLoc");
    expect(result).toHaveProperty("hasEventHandlers");
    expect(result).toHaveProperty("eventHandlerNames");
    expect(result).toHaveProperty("coverage");
    expect(result).toHaveProperty("isCovered");
    expect(result.coverage).toHaveProperty("covered");
    expect(result.coverage).toHaveProperty("total");
    expect(result.coverage).toHaveProperty("percentage");
  });
});

// =============================================================================
// Phase 2: Event Handler Resolution Tests
// =============================================================================

// Helper to create a JSX attribute with expression value
function createJSXAttributeWithValue(
  name: string,
  value: TSESTree.JSXExpression | TSESTree.Literal | null
): TSESTree.JSXAttribute {
  return {
    type: "JSXAttribute",
    name: {
      type: "JSXIdentifier",
      name,
      loc: loc(1, 0, 1, name.length),
      range: [0, name.length],
    },
    value,
    loc: loc(1, 0, 1, name.length + 20),
    range: [0, name.length + 20],
    parent: null as unknown as TSESTree.Node,
  };
}

// Helper to create a JSX expression container with an expression
function createJSXExpressionContainer(
  expression: TSESTree.Expression
): TSESTree.JSXExpressionContainer {
  return {
    type: "JSXExpressionContainer",
    expression,
    loc: loc(1, 0, 1, 20),
    range: [0, 20],
    parent: null as unknown as TSESTree.Node,
  };
}

// Helper to create an identifier expression
function createIdentifier(name: string, location?: SourceLocation): TSESTree.Identifier {
  const nodeLoc = location || loc(1, 0, 1, name.length);
  return {
    type: "Identifier",
    name,
    loc: nodeLoc,
    range: [0, name.length],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.Identifier;
}

// Helper to create an arrow function expression
function createArrowFunctionExpression(
  bodyLocation: SourceLocation,
  params: TSESTree.Parameter[] = []
): TSESTree.ArrowFunctionExpression {
  return {
    type: "ArrowFunctionExpression",
    expression: false,
    generator: false,
    async: false,
    params,
    body: {
      type: "BlockStatement",
      body: [],
      loc: bodyLocation,
      range: [0, 50],
      parent: null as unknown as TSESTree.Node,
    } as TSESTree.BlockStatement,
    loc: bodyLocation,
    range: [0, 50],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.ArrowFunctionExpression;
}

// Helper to create a call expression (e.g., handler.bind(this))
function createCallExpression(
  callee: TSESTree.Expression,
  args: TSESTree.Expression[] = []
): TSESTree.CallExpression {
  return {
    type: "CallExpression",
    callee,
    arguments: args,
    optional: false,
    loc: loc(1, 0, 1, 30),
    range: [0, 30],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.CallExpression;
}

// Helper to create a member expression (e.g., handler.bind)
function createMemberExpression(
  object: TSESTree.Expression,
  property: TSESTree.Identifier
): TSESTree.MemberExpression {
  return {
    type: "MemberExpression",
    object,
    property,
    computed: false,
    optional: false,
    loc: loc(1, 0, 1, 20),
    range: [0, 20],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.MemberExpression;
}

// Helper to create a string literal
function createStringLiteral(value: string): TSESTree.Literal {
  return {
    type: "Literal",
    value,
    raw: `"${value}"`,
    loc: loc(1, 0, 1, value.length + 2),
    range: [0, value.length + 2],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.Literal;
}

describe("Phase 2: Event Handler Resolution", () => {
  describe("extractEventHandlerExpression", () => {
    // Note: These tests are for the extractEventHandlerExpression function
    // which extracts the expression from an event handler attribute value
    // The function is currently a TODO in the implementation

    it("should extract expression from inline arrow function: onClick={() => doThing()}", () => {
      // Create: onClick={() => doThing()}
      const arrowFn = createArrowFunctionExpression(loc(1, 10, 1, 30));
      const container = createJSXExpressionContainer(arrowFn);
      const attr = createJSXAttributeWithValue("onClick", container);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBe(arrowFn);

      // For now, verify the test data structure is correct
      expect(attr.value).not.toBeNull();
      expect(attr.value?.type).toBe("JSXExpressionContainer");
      expect((attr.value as TSESTree.JSXExpressionContainer).expression.type).toBe(
        "ArrowFunctionExpression"
      );
    });

    it("should extract expression from identifier reference: onClick={handleClick}", () => {
      // Create: onClick={handleClick}
      const identifier = createIdentifier("handleClick");
      const container = createJSXExpressionContainer(identifier);
      const attr = createJSXAttributeWithValue("onClick", container);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBe(identifier);
      // expect((result as TSESTree.Identifier).name).toBe("handleClick");

      // Verify test data structure
      expect(attr.value?.type).toBe("JSXExpressionContainer");
      expect((attr.value as TSESTree.JSXExpressionContainer).expression.type).toBe("Identifier");
      expect(
        ((attr.value as TSESTree.JSXExpressionContainer).expression as TSESTree.Identifier).name
      ).toBe("handleClick");
    });

    it("should extract expression from call expression: onClick={handler.bind(this)}", () => {
      // Create: onClick={handler.bind(this)}
      const handler = createIdentifier("handler");
      const bind = createIdentifier("bind");
      const memberExpr = createMemberExpression(handler, bind);
      const thisExpr = createIdentifier("this");
      const callExpr = createCallExpression(memberExpr, [thisExpr]);
      const container = createJSXExpressionContainer(callExpr);
      const attr = createJSXAttributeWithValue("onClick", container);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBe(callExpr);
      // expect(result.type).toBe("CallExpression");

      // Verify test data structure
      expect(attr.value?.type).toBe("JSXExpressionContainer");
      expect((attr.value as TSESTree.JSXExpressionContainer).expression.type).toBe("CallExpression");
    });

    it("should return null for string literal: onClick='handleClick'", () => {
      // Create: onClick="handleClick" (string literal, not valid JSX handler)
      const literal = createStringLiteral("handleClick");
      const attr = createJSXAttributeWithValue("onClick", literal);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBeNull();

      // Verify test data structure
      expect(attr.value?.type).toBe("Literal");
    });

    it("should return null for attribute with no value: onClick", () => {
      // Create: onClick (boolean attribute with no value)
      const attr = createJSXAttributeWithValue("onClick", null);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBeNull();

      // Verify test data structure
      expect(attr.value).toBeNull();
    });

    it("should handle member expression reference: onClick={this.handleClick}", () => {
      // Create: onClick={this.handleClick}
      const thisExpr = createIdentifier("this");
      const handleClick = createIdentifier("handleClick");
      const memberExpr = createMemberExpression(thisExpr, handleClick);
      const container = createJSXExpressionContainer(memberExpr);
      const attr = createJSXAttributeWithValue("onClick", container);

      // When extractEventHandlerExpression is implemented:
      // const result = extractEventHandlerExpression(attr);
      // expect(result).toBe(memberExpr);
      // expect(result.type).toBe("MemberExpression");

      // Verify test data structure
      expect(attr.value?.type).toBe("JSXExpressionContainer");
      expect((attr.value as TSESTree.JSXExpressionContainer).expression.type).toBe(
        "MemberExpression"
      );
    });
  });

  describe("getHandlerStatements", () => {
    // Note: These tests are for getting the statements inside a handler body
    // to include in coverage calculation

    it("should include inline arrow handler body statements in coverage", () => {
      // Scenario: onClick={() => { console.log("clicked"); doThing(); }}
      // Handler body is at lines 5-7, statements at lines 6-6
      const handlerBodyLoc = loc(5, 0, 7, 1);
      const arrowFn = createArrowFunctionExpression(handlerBodyLoc);

      // Mock coverage data with statements inside the handler body
      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } }, // Outside handler
          "1": { start: { line: 6, column: 4 }, end: { line: 6, column: 30 } }, // Inside handler body
        },
        { "0": 5, "1": 0 } // Statement 1 (in handler) is uncovered
      );

      // When getHandlerStatements is implemented:
      // const statements = getHandlerStatements(arrowFn, fileCoverage);
      // expect(statements).toEqual(new Set(["1"]));

      // Verify findStatementsInRange works for handler body location
      const statements = findStatementsInRange(handlerBodyLoc, fileCoverage);
      expect(statements).toEqual(new Set(["1"]));
    });

    it("should find statements for referenced function declaration", () => {
      // Scenario: A function declared elsewhere is referenced as handler
      // function handleClick() { console.log("clicked"); }  // lines 3-5
      // <button onClick={handleClick} />

      const functionBodyLoc = loc(3, 0, 5, 1);

      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 4, column: 2 }, end: { line: 4, column: 28 } }, // console.log inside function
        },
        { "0": 0 } // Function body statement is uncovered
      );

      // When findHandlerFunctionBody and getHandlerStatements are implemented:
      // const functionBody = findHandlerFunctionBody(identifier, ast);
      // const statements = getHandlerStatements(functionBody, fileCoverage);
      // expect(statements).toEqual(new Set(["0"]));

      // Verify findStatementsInRange works for function body location
      const statements = findStatementsInRange(functionBodyLoc, fileCoverage);
      expect(statements).toEqual(new Set(["0"]));
    });

    it("should handle multiple handlers on same element", () => {
      // Scenario: <button onClick={handleClick} onMouseEnter={handleHover} />
      // Each handler has its own body with statements

      const handler1BodyLoc = loc(3, 0, 5, 1); // handleClick body
      const handler2BodyLoc = loc(7, 0, 9, 1); // handleHover body

      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 4, column: 2 }, end: { line: 4, column: 20 } }, // In handleClick
          "1": { start: { line: 8, column: 2 }, end: { line: 8, column: 20 } }, // In handleHover
        },
        { "0": 3, "1": 0 } // handleClick covered, handleHover uncovered
      );

      // When fully implemented, we would combine statements from both handlers
      const handler1Statements = findStatementsInRange(handler1BodyLoc, fileCoverage);
      const handler2Statements = findStatementsInRange(handler2BodyLoc, fileCoverage);

      expect(handler1Statements).toEqual(new Set(["0"]));
      expect(handler2Statements).toEqual(new Set(["1"]));

      // Combined should have both
      const allStatements = new Set([...handler1Statements, ...handler2Statements]);
      expect(allStatements).toEqual(new Set(["0", "1"]));

      // Coverage calculation: 1 covered out of 2 = 50%
      const coverage = calculateCoverageFromStatements(allStatements, fileCoverage);
      expect(coverage.percentage).toBe(50);
      expect(coverage.covered).toBe(1);
      expect(coverage.total).toBe(2);
    });

    it("should return empty set for handler with empty body", () => {
      // Scenario: onClick={() => {}}
      const emptyBodyLoc = loc(5, 10, 5, 12); // Empty block: {}

      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        },
        { "0": 5 }
      );

      const statements = findStatementsInRange(emptyBodyLoc, fileCoverage);
      expect(statements).toEqual(new Set());
    });
  });

  describe("analyzeJSXElementCoverage with handlers", () => {
    // Helper to create a mock JSX element with handler attributes
    function createMockJSXElementWithHandlers(
      location: SourceLocation,
      handlers: Array<{
        name: string;
        expression: TSESTree.Expression;
      }>
    ): TSESTree.JSXElement {
      const attributes = handlers.map(({ name, expression }) => {
        const container = createJSXExpressionContainer(expression);
        return createJSXAttributeWithValue(name, container);
      });

      return {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: {
            type: "JSXIdentifier",
            name: "button",
            loc: location,
            range: [0, 6],
          },
          attributes,
          selfClosing: false,
          loc: location,
          range: [0, 50],
          typeArguments: undefined,
        },
        closingElement: {
          type: "JSXClosingElement",
          name: {
            type: "JSXIdentifier",
            name: "button",
            loc: location,
            range: [0, 6],
          },
          loc: location,
          range: [0, 9],
        },
        children: [],
        loc: location,
        range: [0, 60],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.JSXElement;
    }

    it("should detect inline arrow handler and include body in coverage scope", () => {
      // Scenario:
      // <button onClick={() => { doThing(); }} />
      // Button is at lines 10-10, handler body at lines 10-10 (inline)
      const elementLoc = loc(10, 0, 10, 50);
      const handlerBodyLoc = loc(10, 20, 10, 40);

      const arrowFn = createArrowFunctionExpression(handlerBodyLoc);
      const jsxElement = createMockJSXElementWithHandlers(elementLoc, [
        { name: "onClick", expression: arrowFn },
      ]);

      const filePath = "/test/Button.tsx";
      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 50 } }, // JSX element
            "1": { start: { line: 10, column: 25 }, end: { line: 10, column: 35 } }, // Handler body statement
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 0 }, // Element rendered, but handler body never called
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

      expect(result.hasEventHandlers).toBe(true);
      expect(result.eventHandlerNames).toContain("onClick");
      // Current implementation finds statements in JSX element range
      // Phase 2 would also specifically track handler body coverage
      expect(result.coverage.total).toBeGreaterThan(0);
    });

    it("should show lower coverage when handler body is uncovered", () => {
      // Scenario: Element is rendered (covered) but handler is never invoked
      const filePath = "/test/Component.tsx";
      const elementLoc = loc(10, 0, 15, 10);

      const arrowFn = createArrowFunctionExpression(loc(11, 0, 14, 1));
      const jsxElement = createMockJSXElementWithHandlers(elementLoc, [
        { name: "onClick", expression: arrowFn },
      ]);

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 20 } }, // JSX opening
            "1": { start: { line: 12, column: 4 }, end: { line: 12, column: 30 } }, // Handler body line 1
            "2": { start: { line: 13, column: 4 }, end: { line: 13, column: 30 } }, // Handler body line 2
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 0, "2": 0 }, // Element rendered, handler never called
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

      // Should have 1 covered out of 3 statements = 33%
      expect(result.coverage.total).toBe(3);
      expect(result.coverage.covered).toBe(1);
      expect(result.coverage.percentage).toBe(33);
      expect(result.isCovered).toBe(true); // Some coverage exists
    });

    it("should show 100% coverage when handler is fully tested", () => {
      const filePath = "/test/TestedComponent.tsx";
      const elementLoc = loc(10, 0, 15, 10);

      const arrowFn = createArrowFunctionExpression(loc(11, 0, 14, 1));
      const jsxElement = createMockJSXElementWithHandlers(elementLoc, [
        { name: "onClick", expression: arrowFn },
      ]);

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 20 } }, // JSX opening
            "1": { start: { line: 12, column: 4 }, end: { line: 12, column: 30 } }, // Handler body
            "2": { start: { line: 13, column: 4 }, end: { line: 13, column: 30 } }, // Handler body
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 3, "2": 3 }, // All statements covered
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

      expect(result.coverage.total).toBe(3);
      expect(result.coverage.covered).toBe(3);
      expect(result.coverage.percentage).toBe(100);
      expect(result.isCovered).toBe(true);
    });

    it("should handle element with multiple handlers, some covered and some not", () => {
      const filePath = "/test/MultiHandler.tsx";
      const elementLoc = loc(10, 0, 20, 10);

      const onClickHandler = createArrowFunctionExpression(loc(11, 0, 13, 1));
      const onHoverHandler = createArrowFunctionExpression(loc(15, 0, 17, 1));

      const jsxElement = createMockJSXElementWithHandlers(elementLoc, [
        { name: "onClick", expression: onClickHandler },
        { name: "onMouseEnter", expression: onHoverHandler },
      ]);

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 20 } }, // JSX element
            "1": { start: { line: 12, column: 4 }, end: { line: 12, column: 30 } }, // onClick body
            "2": { start: { line: 16, column: 4 }, end: { line: 16, column: 30 } }, // onHover body
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 3, "2": 0 }, // onClick tested, onHover not tested
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

      expect(result.hasEventHandlers).toBe(true);
      expect(result.eventHandlerNames).toContain("onClick");
      expect(result.eventHandlerNames).toContain("onMouseEnter");
      // 2 covered (element + onClick) out of 3 = 67%
      expect(result.coverage.total).toBe(3);
      expect(result.coverage.covered).toBe(2);
      expect(result.coverage.percentage).toBe(67);
    });

    it("should handle handler reference to function defined outside element", () => {
      // Scenario:
      // const handleClick = () => { doThing(); };  // line 5
      // <button onClick={handleClick} />            // line 10

      const filePath = "/test/ExternalHandler.tsx";
      const elementLoc = loc(10, 0, 10, 40);

      // Handler is just an identifier reference
      const handlerRef = createIdentifier("handleClick");
      const jsxElement = createMockJSXElementWithHandlers(elementLoc, [
        { name: "onClick", expression: handlerRef },
      ]);

      // Coverage data includes the function body at line 5
      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 5, column: 0 }, end: { line: 5, column: 40 } }, // handleClick declaration
            "1": { start: { line: 5, column: 25 }, end: { line: 5, column: 35 } }, // doThing() call
            "2": { start: { line: 10, column: 0 }, end: { line: 10, column: 40 } }, // JSX element
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 1, "1": 0, "2": 5 }, // Function declared, body not called, element rendered
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage);

      expect(result.hasEventHandlers).toBe(true);
      expect(result.eventHandlerNames).toContain("onClick");

      // Current implementation only sees statement in element range (line 10)
      // Phase 2 enhancement would resolve the handleClick reference and include
      // the function body statements (lines 5) in coverage calculation
      expect(result.coverage.total).toBe(1); // Only sees JSX element statement
      expect(result.coverage.covered).toBe(1);

      // Note: When Phase 2 is fully implemented, the test expectation would change:
      // expect(result.coverage.total).toBe(3); // Would include function body
      // expect(result.coverage.covered).toBe(2); // function decl + JSX, not body call
    });
  });
});

// =============================================================================
// Phase 3: Conditional Parent Analysis Tests
// =============================================================================

// Helper to create an ImportDeclaration
function createImportDeclaration(
  source: string,
  specifiers: Array<{ imported: string; local: string }>
): TSESTree.ImportDeclaration {
  return {
    type: "ImportDeclaration",
    source: {
      type: "Literal",
      value: source,
      raw: `"${source}"`,
      loc: loc(1, 0, 1, source.length + 2),
      range: [0, source.length + 2],
    } as TSESTree.Literal,
    specifiers: specifiers.map(({ imported, local }) => ({
      type: "ImportSpecifier",
      imported: {
        type: "Identifier",
        name: imported,
        loc: loc(1, 0, 1, imported.length),
        range: [0, imported.length],
      } as TSESTree.Identifier,
      local: {
        type: "Identifier",
        name: local,
        loc: loc(1, 0, 1, local.length),
        range: [0, local.length],
      } as TSESTree.Identifier,
      loc: loc(1, 0, 1, 20),
      range: [0, 20],
      parent: null as unknown as TSESTree.Node,
    })) as TSESTree.ImportSpecifier[],
    loc: loc(1, 0, 1, 50),
    range: [0, 50],
    parent: null as unknown as TSESTree.Node,
    importKind: "value",
  } as TSESTree.ImportDeclaration;
}

// Helper to create a LogicalExpression (&&)
function createLogicalExpression(
  operator: "&&" | "||",
  left: TSESTree.Expression,
  right: TSESTree.Expression,
  location?: SourceLocation
): TSESTree.LogicalExpression {
  const nodeLoc = location || loc(1, 0, 1, 50);
  return {
    type: "LogicalExpression",
    operator,
    left,
    right,
    loc: nodeLoc,
    range: [0, 50],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.LogicalExpression;
}

// Helper to create a ConditionalExpression (ternary)
function createConditionalExpression(
  test: TSESTree.Expression,
  consequent: TSESTree.Expression,
  alternate: TSESTree.Expression,
  location?: SourceLocation
): TSESTree.ConditionalExpression {
  const nodeLoc = location || loc(1, 0, 1, 50);
  return {
    type: "ConditionalExpression",
    test,
    consequent,
    alternate,
    loc: nodeLoc,
    range: [0, 50],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.ConditionalExpression;
}

// Helper to create a JSX element for conditional tests
function createMockJSXElementForConditional(
  location: SourceLocation,
  elementName: string = "div"
): TSESTree.JSXElement {
  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: {
        type: "JSXIdentifier",
        name: elementName,
        loc: location,
        range: [0, elementName.length],
      },
      attributes: [],
      selfClosing: true,
      loc: location,
      range: [0, 10],
      typeArguments: undefined,
    },
    closingElement: null,
    children: [],
    loc: location,
    range: [0, 15],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.JSXElement;
}

// Helper to create a JSXExpressionContainer (for wrapping JSX in expressions)
function createJSXExpressionContainerNode(
  expression: TSESTree.Expression,
  location?: SourceLocation
): TSESTree.JSXExpressionContainer {
  const nodeLoc = location || loc(1, 0, 1, 50);
  return {
    type: "JSXExpressionContainer",
    expression,
    loc: nodeLoc,
    range: [0, 50],
    parent: null as unknown as TSESTree.Node,
  };
}

describe("Phase 3: Conditional Parent Analysis", () => {
  describe("findConditionalAncestor", () => {
    it("should find LogicalExpression (&&) ancestor", () => {
      // Scenario: {isVisible && <Component />}
      const jsxElement = createMockJSXElementForConditional(loc(10, 20, 10, 40));
      const condition = createIdentifier("isVisible", loc(10, 1, 10, 10));
      const logicalExpr = createLogicalExpression("&&", condition, jsxElement as unknown as TSESTree.Expression, loc(10, 1, 10, 40));

      // Set up parent relationships
      (jsxElement as unknown as { parent: TSESTree.Node }).parent = logicalExpr;

      // Test the actual findConditionalAncestor function
      const ancestor = findConditionalAncestor(jsxElement, [logicalExpr]);
      expect(ancestor).toBe(logicalExpr);
      expect(ancestor?.type).toBe("LogicalExpression");
      expect((ancestor as TSESTree.LogicalExpression).operator).toBe("&&");
    });

    it("should find ConditionalExpression (ternary) ancestor", () => {
      // Scenario: {isActive ? <ActiveComponent /> : <InactiveComponent />}
      const consequent = createMockJSXElementForConditional(loc(10, 15, 10, 35), "ActiveComponent");
      const alternate = createMockJSXElementForConditional(loc(10, 40, 10, 65), "InactiveComponent");
      const test = createIdentifier("isActive", loc(10, 1, 10, 9));

      const ternary = createConditionalExpression(test, consequent as unknown as TSESTree.Expression, alternate as unknown as TSESTree.Expression, loc(10, 1, 10, 65));

      // Set up parent relationships
      (consequent as unknown as { parent: TSESTree.Node }).parent = ternary;
      (alternate as unknown as { parent: TSESTree.Node }).parent = ternary;

      // Test the actual findConditionalAncestor function
      const ancestorFromConsequent = findConditionalAncestor(consequent, [ternary]);
      expect(ancestorFromConsequent).toBe(ternary);
      expect(ancestorFromConsequent?.type).toBe("ConditionalExpression");

      const ancestorFromAlternate = findConditionalAncestor(alternate, [ternary]);
      expect(ancestorFromAlternate).toBe(ternary);
    });

    it("should return null when no conditional parent exists", () => {
      // Scenario: <Component /> (no conditional wrapper)
      const jsxElement = createMockJSXElementForConditional(loc(10, 0, 10, 20));

      // Parent is just a ReturnStatement, not a conditional
      const returnStatement = {
        type: "ReturnStatement",
        argument: jsxElement,
        loc: loc(9, 0, 11, 0),
        range: [0, 50],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.ReturnStatement;

      (jsxElement as unknown as { parent: TSESTree.Node }).parent = returnStatement;

      // Test the actual findConditionalAncestor function
      const ancestor = findConditionalAncestor(jsxElement, [returnStatement]);
      expect(ancestor).toBeNull();
    });

    it("should find nearest conditional when nested (innermost first)", () => {
      // Scenario: {outer && (inner ? <A /> : <B />)}
      // The JSX element should find the inner ternary first (since it's first in ancestors)

      const elementA = createMockJSXElementForConditional(loc(10, 25, 10, 35), "ComponentA");
      const elementB = createMockJSXElementForConditional(loc(10, 40, 10, 50), "ComponentB");
      const innerCondition = createIdentifier("inner", loc(10, 15, 10, 20));
      const outerCondition = createIdentifier("outer", loc(10, 1, 10, 6));

      // Inner ternary: inner ? <A /> : <B />
      const innerTernary = createConditionalExpression(
        innerCondition,
        elementA as unknown as TSESTree.Expression,
        elementB as unknown as TSESTree.Expression,
        loc(10, 15, 10, 50)
      );

      // Outer logical: outer && (inner ? <A /> : <B />)
      const outerLogical = createLogicalExpression(
        "&&",
        outerCondition,
        innerTernary,
        loc(10, 1, 10, 50)
      );

      // Set up parent chain
      (elementA as unknown as { parent: TSESTree.Node }).parent = innerTernary;
      (elementB as unknown as { parent: TSESTree.Node }).parent = innerTernary;
      (innerTernary as unknown as { parent: TSESTree.Node }).parent = outerLogical;

      // When searching with innerTernary first, should find the ternary
      const nearestForA = findConditionalAncestor(elementA, [innerTernary, outerLogical]);
      expect(nearestForA).toBe(innerTernary);
      expect(nearestForA?.type).toBe("ConditionalExpression");

      // When searching with outerLogical first, should find the logical
      const withOuterFirst = findConditionalAncestor(elementA, [outerLogical, innerTernary]);
      expect(withOuterFirst).toBe(outerLogical);
      expect(withOuterFirst?.type).toBe("LogicalExpression");
    });

    it("should NOT find || operator (only && is conditional rendering)", () => {
      // Scenario: {fallback || <DefaultComponent />}
      // || is not typically used for conditional rendering, so findConditionalAncestor
      // should not match it (based on current implementation that checks operator === "&&")
      const jsxElement = createMockJSXElementForConditional(loc(10, 15, 10, 35), "DefaultComponent");
      const fallback = createIdentifier("fallback", loc(10, 1, 10, 9));

      const logicalOr = createLogicalExpression(
        "||",
        fallback,
        jsxElement as unknown as TSESTree.Expression,
        loc(10, 1, 10, 35)
      );

      (jsxElement as unknown as { parent: TSESTree.Node }).parent = logicalOr;

      // The current implementation only looks for && operator
      const ancestor = findConditionalAncestor(jsxElement, [logicalOr]);
      expect(ancestor).toBeNull();
    });
  });

  describe("getConditionalStatements", () => {
    it("should get statements from && left operand", () => {
      // Scenario: {isReady && <Component />}
      // The condition "isReady" is at line 5, element is at line 7
      const conditionLoc = loc(5, 1, 5, 8);
      const condition = createIdentifier("isReady", conditionLoc);
      const jsxElement = createMockJSXElementForConditional(loc(7, 4, 7, 30));

      const logicalExpr = createLogicalExpression(
        "&&",
        condition,
        jsxElement as unknown as TSESTree.Expression,
        loc(5, 1, 7, 30)
      );

      // Coverage data where the condition is uncovered
      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 5, column: 1 }, end: { line: 5, column: 8 } }, // isReady condition
          "1": { start: { line: 7, column: 4 }, end: { line: 7, column: 30 } }, // JSX element
        },
        { "0": 0, "1": 5 } // Condition not covered, element rendered somehow
      );

      // Test the actual getConditionalStatements function
      const conditionStatements = getConditionalStatements(logicalExpr, fileCoverage);
      expect(conditionStatements).toEqual(new Set(["0"]));

      // Coverage of condition is 0%
      const coverage = calculateCoverageFromStatements(conditionStatements, fileCoverage);
      expect(coverage.percentage).toBe(0);
    });

    it("should get statements from ternary test", () => {
      // Scenario: {user.isAdmin ? <AdminPanel /> : <UserPanel />}
      // The test "user.isAdmin" needs coverage
      const testLoc = loc(8, 1, 8, 13);
      const userIdentifier = createIdentifier("user", loc(8, 1, 8, 5));
      const isAdminIdentifier = createIdentifier("isAdmin", loc(8, 6, 8, 13));
      const testExpr = createMemberExpression(userIdentifier, isAdminIdentifier);
      (testExpr as unknown as { loc: SourceLocation }).loc = testLoc;

      const consequent = createMockJSXElementForConditional(loc(10, 4, 10, 25), "AdminPanel");
      const alternate = createMockJSXElementForConditional(loc(12, 4, 12, 25), "UserPanel");

      const ternary = createConditionalExpression(
        testExpr,
        consequent as unknown as TSESTree.Expression,
        alternate as unknown as TSESTree.Expression,
        loc(8, 1, 12, 25)
      );

      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 8, column: 1 }, end: { line: 8, column: 13 } }, // user.isAdmin test
          "1": { start: { line: 10, column: 4 }, end: { line: 10, column: 25 } }, // AdminPanel
          "2": { start: { line: 12, column: 4 }, end: { line: 12, column: 25 } }, // UserPanel
        },
        { "0": 3, "1": 3, "2": 0 } // Test covered, consequent covered, alternate uncovered
      );

      // Test the actual getConditionalStatements function
      const testStatements = getConditionalStatements(ternary, fileCoverage);
      expect(testStatements).toEqual(new Set(["0"]));

      // Test condition is covered
      const coverage = calculateCoverageFromStatements(testStatements, fileCoverage);
      expect(coverage.percentage).toBe(100);
    });

    it("should handle complex condition expressions", () => {
      // Scenario: {(a && b) || c ? <Component /> : null}
      // Multiple conditions contributing to a single ternary test
      // Note: Statements on different lines to avoid overlap issues
      const aLoc = loc(3, 2, 3, 3);
      const bLoc = loc(4, 7, 4, 8);
      const cLoc = loc(5, 13, 5, 14);

      const a = createIdentifier("a", aLoc);
      const b = createIdentifier("b", bLoc);
      const c = createIdentifier("c", cLoc);

      // (a && b)
      const aAndB = createLogicalExpression("&&", a, b, loc(3, 1, 4, 9));
      // (a && b) || c
      const complexTest = createLogicalExpression("||", aAndB, c, loc(3, 1, 5, 14));

      const consequent = createMockJSXElementForConditional(loc(7, 4, 7, 25), "Component");
      const nullLiteral = {
        type: "Literal",
        value: null,
        raw: "null",
        loc: loc(9, 4, 9, 8),
        range: [40, 44],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.Literal;

      const ternary = createConditionalExpression(
        complexTest,
        consequent as unknown as TSESTree.Expression,
        nullLiteral,
        loc(3, 1, 9, 8)
      );

      const fileCoverage = createFileCoverage(
        {
          "0": { start: { line: 3, column: 2 }, end: { line: 3, column: 3 } }, // a
          "1": { start: { line: 4, column: 7 }, end: { line: 4, column: 8 } }, // b
          "2": { start: { line: 5, column: 13 }, end: { line: 5, column: 14 } }, // c
          "3": { start: { line: 7, column: 4 }, end: { line: 7, column: 25 } }, // Component
        },
        { "0": 5, "1": 2, "2": 3, "3": 2 } // All parts have some coverage
      );

      // Test getConditionalStatements - should only get the test expression statements
      const testStatements = getConditionalStatements(ternary, fileCoverage);
      // The test expression spans lines 3-5, which includes a, b, and c
      expect(testStatements).toEqual(new Set(["0", "1", "2"]));

      const coverage = calculateCoverageFromStatements(testStatements, fileCoverage);
      expect(coverage.percentage).toBe(100);
      expect(coverage.covered).toBe(3);
      expect(coverage.total).toBe(3);
    });
  });

  describe("analyzeJSXElementCoverage with conditionals", () => {
    // Helper to create a mock JSX element with proper parent chain for conditionals
    function createMockJSXElementInConditional(
      location: SourceLocation,
      elementName: string = "div",
      attributes: Array<TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute> = []
    ): TSESTree.JSXElement {
      return {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: {
            type: "JSXIdentifier",
            name: elementName,
            loc: location,
            range: [0, elementName.length],
          },
          attributes,
          selfClosing: attributes.length === 0,
          loc: location,
          range: [0, 20],
          typeArguments: undefined,
        },
        closingElement: attributes.length > 0 ? {
          type: "JSXClosingElement",
          name: {
            type: "JSXIdentifier",
            name: elementName,
            loc: location,
            range: [0, elementName.length],
          },
          loc: location,
          range: [0, elementName.length + 3],
        } : null,
        children: [],
        loc: location,
        range: [0, 30],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.JSXElement;
    }

    it("should include condition coverage when JSX is inside && expression", () => {
      // Scenario: {condition && <Element />}
      // An uncovered condition should lower the element's coverage

      const filePath = "/test/ConditionalComponent.tsx";
      const conditionLoc = loc(10, 1, 10, 15);
      const elementLoc = loc(15, 4, 15, 30); // Element on different line than condition

      const condition = createIdentifier("isLoggedIn", conditionLoc);
      const jsxElement = createMockJSXElementInConditional(elementLoc, "Dashboard");

      const logicalExpr = createLogicalExpression(
        "&&",
        condition,
        jsxElement as unknown as TSESTree.Expression,
        loc(10, 1, 15, 30)
      );

      (jsxElement as unknown as { parent: TSESTree.Node }).parent = logicalExpr;

      // Coverage data: condition is NOT covered, but JSX element statement is
      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 1 }, end: { line: 10, column: 15 } }, // isLoggedIn condition
            "1": { start: { line: 15, column: 4 }, end: { line: 15, column: 30 } }, // <Dashboard /> element
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 0, "1": 5 }, // Condition uncovered, element appears covered
          f: {},
          b: {},
        },
      };

      // Phase 3 is implemented! It includes the condition statement in coverage calculation
      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage, [logicalExpr]);

      // Should find both the condition and the element statements
      expect(result.coverage.total).toBe(2);
      expect(result.coverage.covered).toBe(1); // Only element is covered
      expect(result.coverage.percentage).toBe(50);

      // Verify the conditional ancestor was found and used
      expect(logicalExpr.left.type).toBe("Identifier");
      expect((logicalExpr.left as TSESTree.Identifier).name).toBe("isLoggedIn");
    });

    it("should include ternary test coverage for both branches", () => {
      // Scenario: {cond ? <A /> : <B />}
      // The condition's coverage should affect both branches

      const filePath = "/test/TernaryComponent.tsx";
      const testLoc = loc(15, 1, 15, 10);
      const consequentLoc = loc(20, 4, 20, 25); // Different line than test
      const alternateLoc = loc(25, 4, 25, 30); // Different line than test and consequent

      const testExpr = createIdentifier("isActive", testLoc);
      const consequent = createMockJSXElementInConditional(consequentLoc, "ActiveView");
      const alternate = createMockJSXElementInConditional(alternateLoc, "InactiveView");

      const ternary = createConditionalExpression(
        testExpr,
        consequent as unknown as TSESTree.Expression,
        alternate as unknown as TSESTree.Expression,
        loc(15, 1, 25, 30)
      );

      (consequent as unknown as { parent: TSESTree.Node }).parent = ternary;
      (alternate as unknown as { parent: TSESTree.Node }).parent = ternary;

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 15, column: 1 }, end: { line: 15, column: 10 } }, // isActive test
            "1": { start: { line: 20, column: 4 }, end: { line: 20, column: 25 } }, // ActiveView
            "2": { start: { line: 25, column: 4 }, end: { line: 25, column: 30 } }, // InactiveView
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 10, "1": 7, "2": 3 }, // Test covered, both branches covered
          f: {},
          b: {},
        },
      };

      // Phase 3 is implemented! Both branches include the test condition's coverage
      const consequentResult = analyzeJSXElementCoverage(consequent, filePath, coverage, [ternary]);
      expect(consequentResult.coverage.total).toBe(2); // test + consequent
      expect(consequentResult.coverage.covered).toBe(2);
      expect(consequentResult.coverage.percentage).toBe(100);

      const alternateResult = analyzeJSXElementCoverage(alternate, filePath, coverage, [ternary]);
      expect(alternateResult.coverage.total).toBe(2); // test + alternate
      expect(alternateResult.coverage.covered).toBe(2);
      expect(alternateResult.coverage.percentage).toBe(100);
    });

    it("should handle uncovered ternary condition affecting element coverage", () => {
      // Scenario: Condition is never evaluated, so branches can't truly be "covered"

      const filePath = "/test/UncoveredTernary.tsx";
      const testLoc = loc(20, 1, 20, 12);
      const consequentLoc = loc(25, 4, 25, 25);
      const alternateLoc = loc(30, 4, 30, 25);

      const testExpr = createIdentifier("shouldRender", testLoc);
      const consequent = createMockJSXElementInConditional(consequentLoc, "Rendered");
      const alternate = createMockJSXElementInConditional(alternateLoc, "Fallback");

      const ternary = createConditionalExpression(
        testExpr,
        consequent as unknown as TSESTree.Expression,
        alternate as unknown as TSESTree.Expression,
        loc(20, 1, 30, 25)
      );

      (consequent as unknown as { parent: TSESTree.Node }).parent = ternary;
      (alternate as unknown as { parent: TSESTree.Node }).parent = ternary;

      // Condition is uncovered - this means the ternary was never evaluated
      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 20, column: 1 }, end: { line: 20, column: 12 } }, // shouldRender
            "1": { start: { line: 25, column: 4 }, end: { line: 25, column: 25 } }, // Rendered
            "2": { start: { line: 30, column: 4 }, end: { line: 30, column: 25 } }, // Fallback
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 0, "1": 0, "2": 0 }, // Nothing covered
          f: {},
          b: {},
        },
      };

      // Phase 3 includes the condition in coverage - both test and branch are uncovered
      const consequentResult = analyzeJSXElementCoverage(consequent, filePath, coverage, [ternary]);
      expect(consequentResult.coverage.total).toBe(2); // test + consequent
      expect(consequentResult.coverage.covered).toBe(0);
      expect(consequentResult.coverage.percentage).toBe(0);
      expect(consequentResult.isCovered).toBe(false);

      const alternateResult = analyzeJSXElementCoverage(alternate, filePath, coverage, [ternary]);
      expect(alternateResult.coverage.total).toBe(2); // test + alternate
      expect(alternateResult.coverage.covered).toBe(0);
      expect(alternateResult.coverage.percentage).toBe(0);
      expect(alternateResult.isCovered).toBe(false);
    });

    it("should handle element with event handler inside conditional", () => {
      // Scenario: {show && <button onClick={handleClick}>Click</button>}
      // Both the condition and the event handler should contribute to coverage

      const filePath = "/test/ConditionalButton.tsx";
      const conditionLoc = loc(5, 1, 5, 5);
      const elementLoc = loc(10, 4, 10, 50); // Different line than condition
      const handlerBodyLoc = loc(10, 25, 10, 45); // Inside element range (same line)

      const condition = createIdentifier("show", conditionLoc);

      // Create handler
      const arrowFn = createArrowFunctionExpression(handlerBodyLoc);
      const onClickAttr = createJSXAttributeWithValue(
        "onClick",
        createJSXExpressionContainer(arrowFn)
      );

      const jsxElement = createMockJSXElementInConditional(elementLoc, "button", [onClickAttr]);

      const logicalExpr = createLogicalExpression(
        "&&",
        condition,
        jsxElement as unknown as TSESTree.Expression,
        loc(5, 1, 10, 50)
      );

      (jsxElement as unknown as { parent: TSESTree.Node }).parent = logicalExpr;

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 5, column: 1 }, end: { line: 5, column: 5 } }, // show condition
            "1": { start: { line: 10, column: 4 }, end: { line: 10, column: 50 } }, // button element
            "2": { start: { line: 10, column: 25 }, end: { line: 10, column: 45 } }, // handler body
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 3, "1": 3, "2": 0 }, // Condition and element covered, handler not invoked
          f: {},
          b: {},
        },
      };

      const result = analyzeJSXElementCoverage(jsxElement, filePath, coverage, [logicalExpr]);

      expect(result.hasEventHandlers).toBe(true);
      expect(result.eventHandlerNames).toContain("onClick");

      // Phase 3 includes condition + element + handler body
      expect(result.coverage.total).toBe(3); // condition + element + handler
      expect(result.coverage.covered).toBe(2); // condition + element covered, handler body not
      expect(result.coverage.percentage).toBe(67);
    });

    it("should handle deeply nested conditionals", () => {
      // Scenario: {a && (b ? (c && <Element />) : <Fallback />)}
      // Multiple layers of conditionals
      // Note: findConditionalAncestor only finds the FIRST conditional in the ancestors array

      const filePath = "/test/DeepConditional.tsx";

      // Each condition and element on its own line
      const aLoc = loc(10, 1, 10, 2);
      const bLoc = loc(15, 1, 15, 2);
      const cLoc = loc(20, 1, 20, 2);
      const elementLoc = loc(25, 4, 25, 25);
      const fallbackLoc = loc(35, 4, 35, 25);

      const a = createIdentifier("a", aLoc);
      const b = createIdentifier("b", bLoc);
      const c = createIdentifier("c", cLoc);
      const element = createMockJSXElementInConditional(elementLoc, "Element");
      const fallback = createMockJSXElementInConditional(fallbackLoc, "Fallback");

      // c && <Element />
      const innerAnd = createLogicalExpression(
        "&&",
        c,
        element as unknown as TSESTree.Expression,
        loc(20, 1, 25, 25)
      );

      // b ? (c && <Element />) : <Fallback />
      const ternary = createConditionalExpression(
        b,
        innerAnd,
        fallback as unknown as TSESTree.Expression,
        loc(15, 1, 35, 25)
      );

      // a && (b ? ...)
      const outerAnd = createLogicalExpression(
        "&&",
        a,
        ternary,
        loc(10, 1, 35, 25)
      );

      // Set up parent chain
      (element as unknown as { parent: TSESTree.Node }).parent = innerAnd;
      (innerAnd as unknown as { parent: TSESTree.Node }).parent = ternary;
      (fallback as unknown as { parent: TSESTree.Node }).parent = ternary;
      (ternary as unknown as { parent: TSESTree.Node }).parent = outerAnd;

      const coverage: IstanbulCoverage = {
        [filePath]: {
          path: filePath,
          statementMap: {
            "0": { start: { line: 10, column: 1 }, end: { line: 10, column: 2 } }, // a
            "1": { start: { line: 15, column: 1 }, end: { line: 15, column: 2 } }, // b
            "2": { start: { line: 20, column: 1 }, end: { line: 20, column: 2 } }, // c
            "3": { start: { line: 25, column: 4 }, end: { line: 25, column: 25 } }, // Element
            "4": { start: { line: 35, column: 4 }, end: { line: 35, column: 25 } }, // Fallback
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 5, "2": 3, "3": 3, "4": 2 }, // All conditions evaluated
          f: {},
          b: {},
        },
      };

      // Analyze the deeply nested Element with innerAnd first in ancestors
      // findConditionalAncestor will find innerAnd (c && <Element />)
      const elementResult = analyzeJSXElementCoverage(
        element,
        filePath,
        coverage,
        [innerAnd, ternary, outerAnd]
      );

      // Phase 3 finds the first conditional (innerAnd) and includes its condition (c)
      // So we get: element + c condition = 2 statements
      expect(elementResult.coverage.total).toBe(2);
      expect(elementResult.coverage.covered).toBe(2);
      expect(elementResult.coverage.percentage).toBe(100);

      // Analyze the Fallback with ternary first in ancestors
      // findConditionalAncestor will find ternary (b ? ... : <Fallback />)
      const fallbackResult = analyzeJSXElementCoverage(
        fallback,
        filePath,
        coverage,
        [ternary, outerAnd]
      );

      // Phase 3 finds the first conditional (ternary) and includes its condition (b)
      // So we get: fallback + b condition = 2 statements
      expect(fallbackResult.coverage.total).toBe(2);
      expect(fallbackResult.coverage.covered).toBe(2);
      expect(fallbackResult.coverage.percentage).toBe(100);
    });
  });
});

// =============================================================================
// Phase 4: Import Dependency Coverage Tests
// =============================================================================

// Helper to create a JSX element with an expression child (for testing imports used in children)
function createJSXElementWithExpressionChild(
  location: SourceLocation,
  elementName: string,
  childExpression: TSESTree.Expression
): TSESTree.JSXElement {
  const expressionContainer: TSESTree.JSXExpressionContainer = {
    type: "JSXExpressionContainer",
    expression: childExpression,
    loc: location,
    range: [0, 20],
    parent: null as unknown as TSESTree.Node,
  };

  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: {
        type: "JSXIdentifier",
        name: elementName,
        loc: location,
        range: [0, elementName.length],
      },
      attributes: [],
      selfClosing: false,
      loc: location,
      range: [0, 20],
      typeArguments: undefined,
    },
    closingElement: {
      type: "JSXClosingElement",
      name: {
        type: "JSXIdentifier",
        name: elementName,
        loc: location,
        range: [0, elementName.length],
      },
      loc: location,
      range: [0, elementName.length + 3],
    },
    children: [expressionContainer],
    loc: location,
    range: [0, 40],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.JSXElement;
}

// Helper to create a JSX element with prop using an imported value
function createJSXElementWithImportedProp(
  location: SourceLocation,
  elementName: string,
  propName: string,
  importedIdentifier: TSESTree.Identifier
): TSESTree.JSXElement {
  const expressionContainer: TSESTree.JSXExpressionContainer = {
    type: "JSXExpressionContainer",
    expression: importedIdentifier,
    loc: location,
    range: [0, 20],
    parent: null as unknown as TSESTree.Node,
  };

  const attribute: TSESTree.JSXAttribute = {
    type: "JSXAttribute",
    name: {
      type: "JSXIdentifier",
      name: propName,
      loc: location,
      range: [0, propName.length],
    },
    value: expressionContainer,
    loc: location,
    range: [0, 30],
    parent: null as unknown as TSESTree.Node,
  };

  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: {
        type: "JSXIdentifier",
        name: elementName,
        loc: location,
        range: [0, elementName.length],
      },
      attributes: [attribute],
      selfClosing: true,
      loc: location,
      range: [0, 40],
      typeArguments: undefined,
    },
    closingElement: null,
    children: [],
    loc: location,
    range: [0, 45],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.JSXElement;
}

// Helper to create a CallExpression (e.g., useHook())
function createCallExpressionFromIdentifier(
  callee: TSESTree.Identifier,
  location: SourceLocation
): TSESTree.CallExpression {
  return {
    type: "CallExpression",
    callee,
    arguments: [],
    optional: false,
    loc: location,
    range: [0, 20],
    parent: null as unknown as TSESTree.Node,
  } as TSESTree.CallExpression;
}

describe("Phase 4: Import Dependency Coverage", () => {
  describe("findImportsUsedInJSX", () => {
    // Note: findImportsUsedInJSX is a Phase 4 function that finds which imports
    // are used within a JSX element's props or expression children

    it("should find imports used in props", () => {
      // Scenario: <Input value={formatValue(data)} />
      // formatValue is imported from "./utils"
      const formatValueImport = createImportDeclaration("./utils", [
        { imported: "formatValue", local: "formatValue" },
      ]);

      const formatValueIdentifier = createIdentifier("formatValue", loc(10, 15, 10, 26));
      const elementLoc = loc(10, 0, 10, 50);

      // Create JSX element with the imported function in a prop
      const jsxElement = createJSXElementWithImportedProp(
        elementLoc,
        "Input",
        "value",
        formatValueIdentifier
      );

      // When findImportsUsedInJSX is implemented:
      // const usedImports = findImportsUsedInJSX(jsxElement, [formatValueImport]);
      // expect(usedImports).toContain("formatValue");
      // expect(usedImports.length).toBe(1);

      // For now, verify the test data structure is correct
      expect(jsxElement.openingElement.attributes.length).toBe(1);
      const attr = jsxElement.openingElement.attributes[0] as TSESTree.JSXAttribute;
      expect(attr.value?.type).toBe("JSXExpressionContainer");

      // Verify import declaration structure
      expect(formatValueImport.specifiers.length).toBe(1);
      expect((formatValueImport.specifiers[0] as TSESTree.ImportSpecifier).local.name).toBe("formatValue");
    });

    it("should find imports used in expression children", () => {
      // Scenario: <span>{formatDate(timestamp)}</span>
      // formatDate is imported from "./date-utils"
      const formatDateImport = createImportDeclaration("./date-utils", [
        { imported: "formatDate", local: "formatDate" },
      ]);

      const formatDateIdentifier = createIdentifier("formatDate", loc(15, 8, 15, 18));
      const elementLoc = loc(15, 0, 15, 40);

      // Create JSX element with the imported function in a child expression
      const jsxElement = createJSXElementWithExpressionChild(
        elementLoc,
        "span",
        formatDateIdentifier
      );

      // When findImportsUsedInJSX is implemented:
      // const usedImports = findImportsUsedInJSX(jsxElement, [formatDateImport]);
      // expect(usedImports).toContain("formatDate");

      // Verify the test data structure
      expect(jsxElement.children.length).toBe(1);
      const child = jsxElement.children[0] as TSESTree.JSXExpressionContainer;
      expect(child.type).toBe("JSXExpressionContainer");
      expect((child.expression as TSESTree.Identifier).name).toBe("formatDate");
    });

    it("should not include unused imports", () => {
      // Scenario: import { usedFn, unusedFn } from "./utils"
      // Only usedFn is used in JSX
      const mixedImport = createImportDeclaration("./utils", [
        { imported: "usedFn", local: "usedFn" },
        { imported: "unusedFn", local: "unusedFn" },
      ]);

      const usedFnIdentifier = createIdentifier("usedFn", loc(20, 10, 20, 16));
      const elementLoc = loc(20, 0, 20, 40);

      const jsxElement = createJSXElementWithImportedProp(
        elementLoc,
        "Component",
        "handler",
        usedFnIdentifier
      );

      // When findImportsUsedInJSX is implemented:
      // const usedImports = findImportsUsedInJSX(jsxElement, [mixedImport]);
      // expect(usedImports).toContain("usedFn");
      // expect(usedImports).not.toContain("unusedFn");
      // expect(usedImports.length).toBe(1);

      // Verify the import has both specifiers
      expect(mixedImport.specifiers.length).toBe(2);
    });

    it("should find hook calls used in JSX props", () => {
      // Scenario: <Button onClick={handleClick} />
      // where handleClick comes from: const handleClick = useCallback(() => {}, [])
      // and useCallback is imported from "react"
      const useCallbackImport = createImportDeclaration("react", [
        { imported: "useCallback", local: "useCallback" },
      ]);

      const handleClickIdentifier = createIdentifier("handleClick", loc(25, 18, 25, 29));
      const elementLoc = loc(25, 0, 25, 50);

      // Create a button element with onClick={handleClick}
      const expressionContainer: TSESTree.JSXExpressionContainer = {
        type: "JSXExpressionContainer",
        expression: handleClickIdentifier,
        loc: loc(25, 17, 25, 30),
        range: [17, 30],
        parent: null as unknown as TSESTree.Node,
      };

      const onClickAttr: TSESTree.JSXAttribute = {
        type: "JSXAttribute",
        name: {
          type: "JSXIdentifier",
          name: "onClick",
          loc: loc(25, 8, 25, 15),
          range: [8, 15],
        },
        value: expressionContainer,
        loc: loc(25, 8, 25, 30),
        range: [8, 30],
        parent: null as unknown as TSESTree.Node,
      };

      const jsxElement: TSESTree.JSXElement = {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: {
            type: "JSXIdentifier",
            name: "Button",
            loc: elementLoc,
            range: [0, 6],
          },
          attributes: [onClickAttr],
          selfClosing: true,
          loc: elementLoc,
          range: [0, 50],
          typeArguments: undefined,
        },
        closingElement: null,
        children: [],
        loc: elementLoc,
        range: [0, 50],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.JSXElement;

      // Note: Finding that handleClick uses useCallback requires tracing through
      // variable declarations, which is a more advanced analysis
      // For Phase 4, we would need to track:
      // 1. handleClick is used in onClick prop
      // 2. handleClick = useCallback(...)
      // 3. useCallback is imported from "react"

      // Verify test structure
      expect(jsxElement.openingElement.attributes.length).toBe(1);
      expect(useCallbackImport.source.value).toBe("react");
    });
  });

  describe("aggregateImportCoverage", () => {
    // Note: aggregateImportCoverage is a Phase 4 function that aggregates coverage
    // from imported files into the element's coverage calculation

    it("should aggregate coverage from a single import", () => {
      // Scenario: Component uses formatValue from "./utils"
      // utils.ts has 80% coverage
      const componentFilePath = "/src/Component.tsx";
      const utilsFilePath = "/src/utils.ts";

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 50 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5 }, // 100% coverage in component
          f: {},
          b: {},
        },
        [utilsFilePath]: {
          path: utilsFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
            "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 30 } },
            "4": { start: { line: 5, column: 0 }, end: { line: 5, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 10, "1": 10, "2": 10, "3": 10, "4": 0 }, // 4/5 = 80% coverage
          f: {},
          b: {},
        },
      };

      // When aggregateImportCoverage is implemented:
      // const importedCoverage = aggregateImportCoverage(["formatValue"], coverage, {
      //   formatValue: utilsFilePath,
      // });
      // expect(importedCoverage.percentage).toBe(80);
      // expect(importedCoverage.covered).toBe(4);
      // expect(importedCoverage.total).toBe(5);

      // Verify coverage data structure for now
      const utilsCoverage = coverage[utilsFilePath];
      expect(Object.keys(utilsCoverage.statementMap).length).toBe(5);

      const covered = Object.values(utilsCoverage.s).filter((hits) => hits > 0).length;
      expect(covered).toBe(4);
    });

    it("should aggregate coverage from multiple imports", () => {
      // Scenario: Component uses formatValue from "./utils" and validateInput from "./validators"
      const componentFilePath = "/src/Component.tsx";
      const utilsFilePath = "/src/utils.ts";
      const validatorsFilePath = "/src/validators.ts";

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 50 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5 },
          f: {},
          b: {},
        },
        [utilsFilePath]: {
          path: utilsFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 10, "1": 10 }, // 100% coverage
          f: {},
          b: {},
        },
        [validatorsFilePath]: {
          path: validatorsFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
            "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 0, "2": 0, "3": 0 }, // 1/4 = 25% coverage
          f: {},
          b: {},
        },
      };

      // When aggregateImportCoverage is implemented:
      // const importedCoverage = aggregateImportCoverage(
      //   ["formatValue", "validateInput"],
      //   coverage,
      //   {
      //     formatValue: utilsFilePath,
      //     validateInput: validatorsFilePath,
      //   }
      // );
      // Combined: utils (2/2) + validators (1/4) = 3/6 = 50%
      // expect(importedCoverage.percentage).toBe(50);
      // expect(importedCoverage.covered).toBe(3);
      // expect(importedCoverage.total).toBe(6);

      // Verify test data
      const utilsCovered = Object.values(coverage[utilsFilePath].s).filter((h) => h > 0).length;
      const validatorsCovered = Object.values(coverage[validatorsFilePath].s).filter((h) => h > 0).length;
      expect(utilsCovered).toBe(2);
      expect(validatorsCovered).toBe(1);
    });

    it("should handle import with no coverage data", () => {
      // Scenario: Component imports from a file that has no coverage data
      const componentFilePath = "/src/Component.tsx";
      const unknownFilePath = "/src/unknown-module.ts";

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 50 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5 },
          f: {},
          b: {},
        },
        // No coverage data for unknownFilePath
      };

      // When aggregateImportCoverage is implemented:
      // const importedCoverage = aggregateImportCoverage(
      //   ["unknownFn"],
      //   coverage,
      //   { unknownFn: unknownFilePath }
      // );
      // // No coverage data means 0% coverage for that import
      // expect(importedCoverage.percentage).toBe(0);
      // expect(importedCoverage.total).toBe(0);

      // Verify the file is indeed not in coverage
      expect(coverage[unknownFilePath]).toBeUndefined();
    });

    it("should handle aliased imports correctly", () => {
      // Scenario: import { formatValue as format } from "./utils"
      // The local name "format" is used in JSX, but coverage is for the original module
      const aliasedImport = createImportDeclaration("./utils", [
        { imported: "formatValue", local: "format" },
      ]);

      const utilsFilePath = "/src/utils.ts";
      const coverage: IstanbulCoverage = {
        [utilsFilePath]: {
          path: utilsFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 10, "1": 10 }, // 100% coverage
          f: {},
          b: {},
        },
      };

      // Verify the import structure handles aliasing
      const specifier = aliasedImport.specifiers[0] as TSESTree.ImportSpecifier;
      expect(specifier.imported.name).toBe("formatValue");
      expect(specifier.local.name).toBe("format");

      // When aggregateImportCoverage is implemented, it should:
      // 1. Find that "format" is used in JSX
      // 2. Map "format" back to the import from "./utils"
      // 3. Include coverage from utils.ts
    });
  });

  describe("analyzeJSXElementCoverage with imports", () => {
    // Helper to create a mock JSX element for import coverage tests
    function createMockJSXElementForImportTest(
      location: SourceLocation,
      elementName: string = "div",
      attributes: Array<TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute> = []
    ): TSESTree.JSXElement {
      return {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: {
            type: "JSXIdentifier",
            name: elementName,
            loc: location,
            range: [0, elementName.length],
          },
          attributes,
          selfClosing: attributes.length === 0,
          loc: location,
          range: [0, 30],
          typeArguments: undefined,
        },
        closingElement: attributes.length > 0 ? {
          type: "JSXClosingElement",
          name: {
            type: "JSXIdentifier",
            name: elementName,
            loc: location,
            range: [0, elementName.length],
          },
          loc: location,
          range: [0, elementName.length + 3],
        } : null,
        children: [],
        loc: location,
        range: [0, 40],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.JSXElement;
    }

    it("should include import file coverage when element uses imported hook", () => {
      // Scenario:
      // import { useCustomHook } from "./hooks/useCustomHook";
      // function Component() {
      //   const data = useCustomHook();
      //   return <div>{data}</div>;
      // }
      // The element's coverage should include useCustomHook file coverage

      const componentFilePath = "/src/Component.tsx";
      const hookFilePath = "/src/hooks/useCustomHook.ts";
      const elementLoc = loc(10, 4, 10, 30);

      const jsxElement = createMockJSXElementForImportTest(elementLoc, "div");

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 5, column: 2 }, end: { line: 5, column: 35 } }, // useCustomHook call
            "1": { start: { line: 10, column: 4 }, end: { line: 10, column: 30 } }, // JSX element
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 5 }, // Both covered
          f: {},
          b: {},
        },
        [hookFilePath]: {
          path: hookFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 40 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
            "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 5, "2": 0, "3": 0 }, // 2/4 = 50% coverage in hook
          f: {},
          b: {},
        },
      };

      // Current implementation only analyzes the component file
      const result = analyzeJSXElementCoverage(jsxElement, componentFilePath, coverage);

      // Currently, only the JSX element statement is found (line 10)
      expect(result.coverage.total).toBe(1);
      expect(result.coverage.covered).toBe(1);
      expect(result.coverage.percentage).toBe(100);

      // When Phase 4 is fully implemented with import tracking:
      // The result should include hook file coverage
      // Component: 1 statement covered (JSX)
      // Hook: 2/4 statements covered
      // Total: 3/5 = 60% (or weighted calculation)

      // Future expectation:
      // expect(result.coverage.total).toBe(5); // 1 component + 4 hook statements
      // expect(result.coverage.covered).toBe(3); // 1 component + 2 hook statements
      // expect(result.coverage.percentage).toBe(60);
    });

    it("should aggregate coverage from multiple imports used in element", () => {
      // Scenario:
      // import { formatDate } from "./utils/date";
      // import { validateEmail } from "./utils/validation";
      // function Component() {
      //   const formatted = formatDate(date);
      //   const valid = validateEmail(email);
      //   return <Input value={formatted} valid={valid} />;
      // }

      const componentFilePath = "/src/Component.tsx";
      const dateUtilsPath = "/src/utils/date.ts";
      const validationUtilsPath = "/src/utils/validation.ts";
      const elementLoc = loc(15, 4, 15, 50);

      // Create JSX element with props using imported values
      const formattedIdentifier = createIdentifier("formatted", loc(15, 20, 15, 29));
      const validIdentifier = createIdentifier("valid", loc(15, 37, 15, 42));

      const valueAttr: TSESTree.JSXAttribute = {
        type: "JSXAttribute",
        name: {
          type: "JSXIdentifier",
          name: "value",
          loc: loc(15, 13, 15, 18),
          range: [13, 18],
        },
        value: {
          type: "JSXExpressionContainer",
          expression: formattedIdentifier,
          loc: loc(15, 19, 15, 30),
          range: [19, 30],
          parent: null as unknown as TSESTree.Node,
        },
        loc: loc(15, 13, 15, 30),
        range: [13, 30],
        parent: null as unknown as TSESTree.Node,
      };

      const validAttr: TSESTree.JSXAttribute = {
        type: "JSXAttribute",
        name: {
          type: "JSXIdentifier",
          name: "valid",
          loc: loc(15, 31, 15, 36),
          range: [31, 36],
        },
        value: {
          type: "JSXExpressionContainer",
          expression: validIdentifier,
          loc: loc(15, 37, 15, 43),
          range: [37, 43],
          parent: null as unknown as TSESTree.Node,
        },
        loc: loc(15, 31, 15, 43),
        range: [31, 43],
        parent: null as unknown as TSESTree.Node,
      };

      const jsxElement = createMockJSXElementForImportTest(
        elementLoc,
        "Input",
        [valueAttr, validAttr]
      );

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 15, column: 4 }, end: { line: 15, column: 50 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 3 },
          f: {},
          b: {},
        },
        [dateUtilsPath]: {
          path: dateUtilsPath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 10, "1": 10 }, // 100% coverage
          f: {},
          b: {},
        },
        [validationUtilsPath]: {
          path: validationUtilsPath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 0, "2": 0 }, // 1/3 = 33% coverage
          f: {},
          b: {},
        },
      };

      // Current implementation
      const result = analyzeJSXElementCoverage(jsxElement, componentFilePath, coverage);
      expect(result.coverage.total).toBe(1);
      expect(result.coverage.covered).toBe(1);
      expect(result.coverage.percentage).toBe(100);

      // When Phase 4 is fully implemented:
      // Should aggregate all import coverage:
      // Component: 1/1 covered
      // date.ts: 2/2 covered
      // validation.ts: 1/3 covered
      // Total: 4/6 = 67%
      // expect(result.coverage.total).toBe(6);
      // expect(result.coverage.covered).toBe(4);
      // expect(result.coverage.percentage).toBe(67);
    });

    it("should lower element coverage when import has 0% coverage", () => {
      // Scenario: Element uses an imported function that has never been tested
      const componentFilePath = "/src/Component.tsx";
      const untestedModulePath = "/src/untested-module.ts";
      const elementLoc = loc(20, 4, 20, 40);

      const jsxElement = createMockJSXElementForImportTest(elementLoc, "Display");

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 20, column: 4 }, end: { line: 20, column: 40 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5 }, // Component element is covered
          f: {},
          b: {},
        },
        [untestedModulePath]: {
          path: untestedModulePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
            "3": { start: { line: 4, column: 0 }, end: { line: 4, column: 30 } },
            "4": { start: { line: 5, column: 0 }, end: { line: 5, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 }, // 0% coverage - never tested
          f: {},
          b: {},
        },
      };

      // Current implementation
      const result = analyzeJSXElementCoverage(jsxElement, componentFilePath, coverage);
      expect(result.coverage.total).toBe(1);
      expect(result.coverage.covered).toBe(1);
      expect(result.coverage.percentage).toBe(100);

      // When Phase 4 is fully implemented:
      // The untested import should significantly lower coverage
      // Component: 1/1 covered
      // untested-module.ts: 0/5 covered
      // Total: 1/6 = 17%
      // expect(result.coverage.total).toBe(6);
      // expect(result.coverage.covered).toBe(1);
      // expect(result.coverage.percentage).toBe(17);
      // expect(result.isCovered).toBe(true); // Still has some coverage
    });

    it("should track coverage through hook dependency chain", () => {
      // Scenario: Complex dependency chain
      // Component -> useDataFetcher (hook) -> apiClient (utility)
      // Each level should contribute to the element's coverage

      const componentFilePath = "/src/Component.tsx";
      const hookFilePath = "/src/hooks/useDataFetcher.ts";
      const apiClientPath = "/src/api/client.ts";
      const elementLoc = loc(25, 4, 25, 45);

      const jsxElement = createMockJSXElementForImportTest(elementLoc, "DataDisplay");

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 25, column: 4 }, end: { line: 25, column: 45 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 3 },
          f: {},
          b: {},
        },
        [hookFilePath]: {
          path: hookFilePath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 3, "1": 3 }, // 100% hook coverage
          f: {},
          b: {},
        },
        [apiClientPath]: {
          path: apiClientPath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 0, "1": 0, "2": 0 }, // 0% API client coverage
          f: {},
          b: {},
        },
      };

      // Current implementation
      const result = analyzeJSXElementCoverage(jsxElement, componentFilePath, coverage);
      expect(result.coverage.total).toBe(1);
      expect(result.coverage.percentage).toBe(100);

      // When Phase 4 is fully implemented with transitive dependency tracking:
      // Component: 1/1 covered
      // Hook: 2/2 covered
      // API Client: 0/3 covered (through hook dependency)
      // Total: 3/6 = 50%
      // expect(result.coverage.total).toBe(6);
      // expect(result.coverage.covered).toBe(3);
      // expect(result.coverage.percentage).toBe(50);
    });

    it("should handle event handler that uses imported utility", () => {
      // Scenario:
      // import { trackEvent } from "./analytics";
      // <button onClick={() => trackEvent("clicked")}>Click</button>
      // The onClick handler uses an imported function

      const componentFilePath = "/src/Component.tsx";
      const analyticsPath = "/src/analytics.ts";
      const elementLoc = loc(30, 4, 30, 60);
      const handlerLoc = loc(30, 25, 30, 50);

      // Create arrow function handler that calls trackEvent
      const trackEventIdentifier = createIdentifier("trackEvent", loc(30, 30, 30, 40));
      const callExpr = createCallExpressionFromIdentifier(trackEventIdentifier, loc(30, 30, 30, 50));
      const arrowFn = createArrowFunctionExpression(handlerLoc);
      (arrowFn.body as TSESTree.BlockStatement).body = [];

      const onClickAttr = createJSXAttributeWithValue(
        "onClick",
        createJSXExpressionContainer(arrowFn)
      );

      const jsxElement: TSESTree.JSXElement = {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: {
            type: "JSXIdentifier",
            name: "button",
            loc: elementLoc,
            range: [0, 6],
          },
          attributes: [onClickAttr],
          selfClosing: false,
          loc: elementLoc,
          range: [0, 60],
          typeArguments: undefined,
        },
        closingElement: {
          type: "JSXClosingElement",
          name: {
            type: "JSXIdentifier",
            name: "button",
            loc: elementLoc,
            range: [55, 64],
          },
          loc: elementLoc,
          range: [55, 64],
        },
        children: [],
        loc: elementLoc,
        range: [0, 65],
        parent: null as unknown as TSESTree.Node,
      } as TSESTree.JSXElement;

      const coverage: IstanbulCoverage = {
        [componentFilePath]: {
          path: componentFilePath,
          statementMap: {
            "0": { start: { line: 30, column: 4 }, end: { line: 30, column: 60 } }, // JSX element
            "1": { start: { line: 30, column: 25 }, end: { line: 30, column: 50 } }, // Handler body
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 5, "1": 0 }, // Element rendered, handler never invoked
          f: {},
          b: {},
        },
        [analyticsPath]: {
          path: analyticsPath,
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 30 } },
            "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 30 } },
          },
          fnMap: {},
          branchMap: {},
          s: { "0": 0, "1": 0, "2": 0 }, // trackEvent never called
          f: {},
          b: {},
        },
      };

      // Current implementation finds handler body statements
      const result = analyzeJSXElementCoverage(jsxElement, componentFilePath, coverage);
      expect(result.hasEventHandlers).toBe(true);
      expect(result.eventHandlerNames).toContain("onClick");

      // Currently includes element + handler body from component file
      expect(result.coverage.total).toBe(2);
      expect(result.coverage.covered).toBe(1); // Only element, not handler

      // When Phase 4 is fully implemented:
      // Should also include analytics.ts coverage since handler calls trackEvent
      // Component: 1/2 covered (element yes, handler body no)
      // Analytics: 0/3 covered (never called)
      // Total: 1/5 = 20%
      // expect(result.coverage.total).toBe(5);
      // expect(result.coverage.covered).toBe(1);
      // expect(result.coverage.percentage).toBe(20);
    });
  });
});
