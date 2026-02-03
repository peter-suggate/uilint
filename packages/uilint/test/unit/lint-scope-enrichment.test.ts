/**
 * Tests for: lint scope enrichment
 *
 * Tests that ESLint issues are enriched with scope information from the
 * scope-extractor utility. This integration ensures that each lint issue
 * includes context about where it occurs in the code (function, component,
 * hook, etc.).
 */

import { describe, it, expect } from "vitest";
import type { ScopeInfo } from "../../src/scope-extractor.js";
import {
  enrichIssuesWithScopeInfo,
  type LintIssue,
} from "../../src/utils/eslint-utils.js";

describe("lint scope enrichment", () => {
  describe("enrichIssuesWithScopeInfo", () => {
    it("returns issues with scopeInfo populated for functions", () => {
      const code = `
function handleClick() {
  console.log('clicked');
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 3,
          message: "Unexpected console statement",
          ruleId: "no-console",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("handleClick");
      expect(enriched[0].scopeInfo?.scopeType).toBe("function");
    });

    it("identifies issues inside React components", () => {
      const code = `
function Button({ children }) {
  const handleClick = () => {};
  return <button onClick={handleClick}>{children}</button>;
}
`;
      const issues: LintIssue[] = [
        {
          line: 4,
          column: 10,
          message: "Missing button type",
          ruleId: "uilint/button-type",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("Button");
      expect(enriched[0].scopeInfo?.scopeType).toBe("component");
    });

    it("identifies issues inside React hooks", () => {
      const code = `
function useCounter(initial) {
  const [count, setCount] = useState(initial);
  return { count, increment: () => setCount(c => c + 1) };
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 3,
          message: "Some hook issue",
          ruleId: "react-hooks/rules-of-hooks",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("useCounter");
      expect(enriched[0].scopeInfo?.scopeType).toBe("hook");
    });

    it("identifies issues at module level with scopeType module", () => {
      const code = `
const API_URL = 'https://api.example.com';
console.log('Module loaded');

function Component() {
  return <div />;
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 1,
          message: "Unexpected console statement",
          ruleId: "no-console",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.scopeType).toBe("module");
      expect(enriched[0].scopeInfo?.enclosingScope).toBeNull();
    });

    it("includes parentScope for nested functions", () => {
      const code = `
function TodoList({ items }) {
  const handleDelete = (id) => {
    deleteItem(id);
  };
  return <ul>{items.map(renderItem)}</ul>;
}
`;
      const issues: LintIssue[] = [
        {
          line: 4,
          column: 5,
          message: "deleteItem is not defined",
          ruleId: "no-undef",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("handleDelete");
      expect(enriched[0].scopeInfo?.scopeType).toBe("arrow-function");
      expect(enriched[0].scopeInfo?.parentScope).toBe("TodoList");
    });

    it("includes jsxElementType when issue is inside JSX", () => {
      const code = `
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
      const issues: LintIssue[] = [
        {
          line: 6,
          column: 9,
          message: "Some JSX issue",
          ruleId: "some-jsx-rule",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.jsxElementType).toBe("Button");
    });
  });

  describe("graceful degradation", () => {
    it("returns issues without scopeInfo when parsing fails", () => {
      // Invalid TypeScript/JSX that can't be parsed
      const code = `
function broken( {
  this is not valid JavaScript
}
`;
      const issues: LintIssue[] = [
        {
          line: 2,
          column: 1,
          message: "Parsing error",
          ruleId: undefined,
        },
      ];

      // Should not throw - should return issues without scopeInfo
      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      // scopeInfo should be undefined (graceful degradation)
      expect(enriched[0].scopeInfo).toBeUndefined();
      // But the issue itself should still be present
      expect(enriched[0].message).toBe("Parsing error");
      expect(enriched[0].line).toBe(2);
    });

    it("handles issues with missing column gracefully", () => {
      const code = `
function handleClick() {
  console.log('clicked');
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          // No column provided
          message: "Unexpected console statement",
          ruleId: "no-console",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("handleClick");
    });

    it("handles empty issues array", () => {
      const code = `function test() {}`;
      const issues: LintIssue[] = [];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(0);
    });

    it("handles empty code gracefully", () => {
      const code = "";
      const issues: LintIssue[] = [
        {
          line: 1,
          column: 1,
          message: "Some issue",
          ruleId: "some-rule",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      // Module-level scope for empty file
      expect(enriched[0].scopeInfo?.scopeType).toBe("module");
    });
  });

  describe("multiple issues in same file", () => {
    it("enriches all issues with correct scope info", () => {
      const code = `
function Component() {
  console.log('component');

  const handler = () => {
    console.log('handler');
  };

  return <div />;
}

function useHook() {
  console.log('hook');
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 3,
          message: "Console in component",
          ruleId: "no-console",
        },
        {
          line: 6,
          column: 5,
          message: "Console in handler",
          ruleId: "no-console",
        },
        {
          line: 13,
          column: 3,
          message: "Console in hook",
          ruleId: "no-console",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(3);

      // First issue - in Component
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("Component");
      expect(enriched[0].scopeInfo?.scopeType).toBe("component");

      // Second issue - in handler (nested in Component)
      expect(enriched[1].scopeInfo?.enclosingScope).toBe("handler");
      expect(enriched[1].scopeInfo?.scopeType).toBe("arrow-function");
      expect(enriched[1].scopeInfo?.parentScope).toBe("Component");

      // Third issue - in useHook
      expect(enriched[2].scopeInfo?.enclosingScope).toBe("useHook");
      expect(enriched[2].scopeInfo?.scopeType).toBe("hook");
    });
  });

  describe("class methods", () => {
    it("identifies issues inside class methods", () => {
      const code = `
class Calculator {
  add(a, b) {
    console.log('adding');
    return a + b;
  }
}
`;
      const issues: LintIssue[] = [
        {
          line: 4,
          column: 5,
          message: "Unexpected console statement",
          ruleId: "no-console",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo).toBeDefined();
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("add");
      expect(enriched[0].scopeInfo?.scopeType).toBe("method");
    });
  });

  describe("arrow function components", () => {
    it("identifies arrow function components", () => {
      const code = `
const Card = ({ title }) => {
  return (
    <div className="card">
      <h2>{title}</h2>
    </div>
  );
};
`;
      const issues: LintIssue[] = [
        {
          line: 4,
          column: 5,
          message: "Some issue",
          ruleId: "some-rule",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("Card");
      expect(enriched[0].scopeInfo?.scopeType).toBe("component");
    });
  });

  describe("export default", () => {
    it("handles export default function component", () => {
      const code = `
export default function MyComponent() {
  return <div>Hello</div>;
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 10,
          message: "Some issue",
          ruleId: "some-rule",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("MyComponent");
      expect(enriched[0].scopeInfo?.scopeType).toBe("component");
    });

    it("handles anonymous export default returning JSX", () => {
      const code = `
export default function() {
  return <div>Anonymous</div>;
}
`;
      const issues: LintIssue[] = [
        {
          line: 3,
          column: 10,
          message: "Some issue",
          ruleId: "some-rule",
        },
      ];

      const enriched = enrichIssuesWithScopeInfo(issues, code);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].scopeInfo?.enclosingScope).toBe("default");
      expect(enriched[0].scopeInfo?.scopeType).toBe("component");
    });
  });
});
