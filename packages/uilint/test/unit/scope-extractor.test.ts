/**
 * Tests for: scope-extractor utility
 *
 * Tests extraction of enclosing scope information from source code positions.
 */

import { describe, it, expect } from "vitest";
import {
  findEnclosingScope,
  findEnclosingScopeBatch,
  type ScopeInfo,
} from "../../src/scope-extractor.js";

describe("findEnclosingScope", () => {
  describe("regular functions", () => {
    it("identifies a regular function declaration", () => {
      const source = `
function handleClick() {
  console.log('clicked');
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("handleClick");
      expect(result?.scopeType).toBe("function");
    });

    it("identifies a named function expression", () => {
      const source = `
const handler = function processData() {
  return data;
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("processData");
      expect(result?.scopeType).toBe("function");
    });

    it("identifies function with variable name when anonymous", () => {
      const source = `
const handleSubmit = function() {
  submit();
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("handleSubmit");
      expect(result?.scopeType).toBe("function");
    });
  });

  describe("arrow functions", () => {
    it("identifies an arrow function with variable name", () => {
      const source = `
const fetchData = () => {
  return fetch('/api');
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("fetchData");
      expect(result?.scopeType).toBe("arrow-function");
    });

    it("identifies an arrow function with implicit return", () => {
      const source = `
const double = (x) => x * 2;
`;
      const result = findEnclosingScope(source, 2, 20);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("double");
      expect(result?.scopeType).toBe("arrow-function");
    });

    it("identifies anonymous arrow function", () => {
      const source = `
items.map((item) => {
  return item.id;
});
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("anonymous");
      expect(result?.scopeType).toBe("arrow-function");
    });
  });

  describe("React components", () => {
    it("identifies a function component (PascalCase + JSX return)", () => {
      const source = `
function Button({ children }) {
  return <button>{children}</button>;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("Button");
      expect(result?.scopeType).toBe("component");
    });

    it("identifies an arrow function component", () => {
      const source = `
const Card = ({ title }) => {
  return (
    <div className="card">
      <h2>{title}</h2>
    </div>
  );
};
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("Card");
      expect(result?.scopeType).toBe("component");
    });

    it("identifies component with conditional JSX return", () => {
      const source = `
function UserProfile({ user }) {
  if (!user) {
    return null;
  }
  return user.isAdmin ? <AdminBadge /> : <UserBadge />;
}
`;
      const result = findEnclosingScope(source, 5, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("UserProfile");
      expect(result?.scopeType).toBe("component");
    });

    it("does not mark lowercase function as component even with JSX", () => {
      const source = `
function renderItem(item) {
  return <li>{item.name}</li>;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("renderItem");
      // lowercase functions returning JSX are just functions, not components
      expect(result?.scopeType).toBe("function");
    });
  });

  describe("React hooks", () => {
    it("identifies a custom hook (useXxx pattern)", () => {
      const source = `
function useCounter(initialValue) {
  const [count, setCount] = useState(initialValue);
  return { count, increment: () => setCount(c => c + 1) };
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("useCounter");
      expect(result?.scopeType).toBe("hook");
    });

    it("identifies an arrow function hook", () => {
      const source = `
const useLocalStorage = (key) => {
  const [value, setValue] = useState(null);
  return [value, setValue];
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("useLocalStorage");
      expect(result?.scopeType).toBe("hook");
    });

    it("identifies useEffect callback as anonymous arrow function", () => {
      const source = `
function MyComponent() {
  useEffect(() => {
    fetchData();
  }, []);
  return <div />;
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("anonymous");
      expect(result?.scopeType).toBe("arrow-function");
      expect(result?.parentScope).toBe("MyComponent");
    });
  });

  describe("class methods", () => {
    it("identifies a class method", () => {
      const source = `
class Calculator {
  add(a, b) {
    return a + b;
  }
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("add");
      expect(result?.scopeType).toBe("method");
    });

    it("identifies a class constructor", () => {
      const source = `
class Person {
  constructor(name) {
    this.name = name;
  }
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("constructor");
      expect(result?.scopeType).toBe("method");
    });

    it("identifies a static method", () => {
      const source = `
class Utils {
  static formatDate(date) {
    return date.toISOString();
  }
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("formatDate");
      expect(result?.scopeType).toBe("method");
    });

    it("identifies getter/setter methods", () => {
      const source = `
class Rectangle {
  get area() {
    return this.width * this.height;
  }
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("area");
      expect(result?.scopeType).toBe("method");
    });
  });

  describe("classes", () => {
    it("identifies class declaration", () => {
      const source = `
class MyComponent extends React.Component {
  state = { count: 0 };
}
`;
      // Position in class body but not in a method
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("MyComponent");
      expect(result?.scopeType).toBe("class");
    });

    it("identifies class expression", () => {
      const source = `
const Animal = class {
  speak() {}
};
`;
      const result = findEnclosingScope(source, 2, 20);
      expect(result).not.toBeNull();
      // Anonymous class expression
      expect(result?.scopeType).toBe("class");
    });
  });

  describe("nested functions", () => {
    it("identifies nested function with parent scope", () => {
      const source = `
function outer() {
  function inner() {
    console.log('inner');
  }
  inner();
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("inner");
      expect(result?.scopeType).toBe("function");
      expect(result?.parentScope).toBe("outer");
    });

    it("identifies arrow function nested in component", () => {
      const source = `
function TodoList({ items }) {
  const handleDelete = (id) => {
    deleteItem(id);
  };
  return <ul>{items.map(renderItem)}</ul>;
}
`;
      const result = findEnclosingScope(source, 4, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("handleDelete");
      expect(result?.scopeType).toBe("arrow-function");
      expect(result?.parentScope).toBe("TodoList");
    });

    it("identifies deeply nested functions", () => {
      const source = `
function level1() {
  function level2() {
    function level3() {
      return true;
    }
  }
}
`;
      const result = findEnclosingScope(source, 5, 6);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("level3");
      expect(result?.scopeType).toBe("function");
      expect(result?.parentScope).toBe("level2");
    });
  });

  describe("JSX context", () => {
    it("identifies JSX element type when inside JSX", () => {
      const source = `
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
      // Inside the Button element
      const result = findEnclosingScope(source, 6, 8);
      expect(result).not.toBeNull();
      expect(result?.jsxElementType).toBe("Button");
    });

    it("identifies nested JSX element", () => {
      const source = `
function Layout() {
  return (
    <main>
      <header>
        <nav>Links</nav>
      </header>
    </main>
  );
}
`;
      // Inside nav element
      const result = findEnclosingScope(source, 6, 12);
      expect(result).not.toBeNull();
      expect(result?.jsxElementType).toBe("nav");
    });

    it("identifies JSX member expression element", () => {
      const source = `
function Form() {
  return (
    <Form.Group>
      <Form.Label>Name</Form.Label>
    </Form.Group>
  );
}
`;
      const result = findEnclosingScope(source, 5, 6);
      expect(result).not.toBeNull();
      expect(result?.jsxElementType).toBe("Form.Label");
    });
  });

  describe("module level", () => {
    it("returns module scope for top-level code", () => {
      const source = `
const API_URL = 'https://api.example.com';
console.log('Module loaded');
`;
      const result = findEnclosingScope(source, 2, 0);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBeNull();
      expect(result?.scopeType).toBe("module");
    });

    it("returns module scope for import statements", () => {
      const source = `
import React from 'react';
import { useState } from 'react';
`;
      const result = findEnclosingScope(source, 2, 0);
      expect(result).not.toBeNull();
      expect(result?.scopeType).toBe("module");
    });

    it("returns module scope for export statements", () => {
      const source = `
export const API_KEY = 'secret';
`;
      const result = findEnclosingScope(source, 2, 7);
      expect(result).not.toBeNull();
      expect(result?.scopeType).toBe("module");
    });
  });

  describe("TypeScript syntax", () => {
    it("handles TypeScript function with type annotations", () => {
      const source = `
function greet(name: string): string {
  return \`Hello, \${name}\`;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("greet");
      expect(result?.scopeType).toBe("function");
    });

    it("handles TypeScript arrow function with generics", () => {
      // Note: In TSX, generic arrow functions need trailing comma to disambiguate from JSX
      const source = `
const identity = <T,>(value: T): T => {
  return value;
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("identity");
      expect(result?.scopeType).toBe("arrow-function");
    });

    it("handles TypeScript interface methods", () => {
      const source = `
interface Calculator {
  add(a: number, b: number): number;
}

class CalcImpl implements Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
`;
      const result = findEnclosingScope(source, 8, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("add");
      expect(result?.scopeType).toBe("method");
    });

    it("handles TSX component with typed props", () => {
      const source = `
interface ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
`;
      const result = findEnclosingScope(source, 8, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("Button");
      expect(result?.scopeType).toBe("component");
    });
  });

  describe("decorators", () => {
    it("handles class with decorators", () => {
      const source = `
@Component({ selector: 'app-root' })
class AppComponent {
  title = 'app';
}
`;
      const result = findEnclosingScope(source, 4, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("AppComponent");
      expect(result?.scopeType).toBe("class");
    });

    it("handles method with decorators", () => {
      const source = `
class Service {
  @Log()
  getData() {
    return this.data;
  }
}
`;
      const result = findEnclosingScope(source, 5, 4);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("getData");
      expect(result?.scopeType).toBe("method");
    });
  });

  describe("export default", () => {
    it("handles export default function declaration", () => {
      const source = `
export default function MyComponent() {
  return <div>Hello</div>;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("MyComponent");
      expect(result?.scopeType).toBe("component");
    });

    it("handles export default anonymous function", () => {
      const source = `
export default function() {
  return <div>Anonymous</div>;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("default");
      expect(result?.scopeType).toBe("component");
    });

    it("handles export default arrow function", () => {
      const source = `
export default () => {
  return <span>Arrow</span>;
};
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("default");
      expect(result?.scopeType).toBe("component");
    });

    it("handles export default class", () => {
      const source = `
export default class Counter {
  count = 0;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("Counter");
      expect(result?.scopeType).toBe("class");
    });
  });

  describe("edge cases", () => {
    it("returns null for invalid source code", () => {
      const source = `
function broken( {
  this is not valid
}
`;
      const result = findEnclosingScope(source, 2, 0);
      expect(result).toBeNull();
    });

    it("handles empty source", () => {
      const result = findEnclosingScope("", 1, 0);
      expect(result).not.toBeNull();
      expect(result?.scopeType).toBe("module");
    });

    it("handles position beyond file end", () => {
      const source = "const x = 1;";
      const result = findEnclosingScope(source, 100, 0);
      expect(result).not.toBeNull();
      expect(result?.scopeType).toBe("module");
    });

    it("handles IIFE (immediately invoked function expression)", () => {
      const source = `
(function() {
  console.log('IIFE');
})();
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("anonymous");
      expect(result?.scopeType).toBe("function");
    });

    it("handles async functions", () => {
      const source = `
async function fetchUser(id) {
  const response = await fetch('/api/users/' + id);
  return response.json();
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("fetchUser");
      expect(result?.scopeType).toBe("function");
    });

    it("handles generator functions", () => {
      const source = `
function* generateIds() {
  let id = 0;
  while (true) yield id++;
}
`;
      const result = findEnclosingScope(source, 3, 2);
      expect(result).not.toBeNull();
      expect(result?.enclosingScope).toBe("generateIds");
      expect(result?.scopeType).toBe("function");
    });
  });
});

describe("findEnclosingScopeBatch", () => {
  it("processes multiple positions efficiently", () => {
    const source = `
function outer() {
  function inner() {
    console.log('inner');
  }
  console.log('outer');
}

const standalone = () => {
  return true;
};
`;
    const positions = [
      { line: 4, column: 4 }, // inside inner
      { line: 6, column: 2 }, // inside outer but outside inner
      { line: 10, column: 2 }, // inside standalone
      { line: 1, column: 0 }, // module level
    ];

    const results = findEnclosingScopeBatch(source, positions);

    expect(results).toHaveLength(4);

    expect(results[0]?.enclosingScope).toBe("inner");
    expect(results[0]?.parentScope).toBe("outer");

    expect(results[1]?.enclosingScope).toBe("outer");
    expect(results[1]?.parentScope).toBeUndefined();

    expect(results[2]?.enclosingScope).toBe("standalone");
    expect(results[2]?.scopeType).toBe("arrow-function");

    expect(results[3]?.scopeType).toBe("module");
  });

  it("returns nulls for invalid source", () => {
    const source = "invalid { syntax";
    const positions = [
      { line: 1, column: 0 },
      { line: 1, column: 5 },
    ];

    const results = findEnclosingScopeBatch(source, positions);

    expect(results).toHaveLength(2);
    expect(results[0]).toBeNull();
    expect(results[1]).toBeNull();
  });

  it("handles empty positions array", () => {
    const source = "const x = 1;";
    const results = findEnclosingScopeBatch(source, []);
    expect(results).toHaveLength(0);
  });
});
