# uilint-react

React component for AI-powered UI consistency checking in running applications.

## Overview

`uilint-react` provides the `UILintProvider` component that enables element inspection and LLM-powered code analysis in your React/Next.js application.

## Installation

```bash
npm install uilint-react uilint-core
```

Or use the CLI to install everything automatically:

```bash
npx uilint-cli install
```

## Usage in a Running App

Wrap your app with the `UILintProvider` component:

### Next.js Setup

```tsx
// app/layout.tsx
import { UILintProvider } from "uilint-react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <UILintProvider enabled={process.env.NODE_ENV !== "production"}>
          {children}
        </UILintProvider>
      </body>
    </html>
  );
}
```

### Features

- **Alt+Click** on any element to open the inspector sidebar
- View component source location and file path
- Navigate through the component stack (scroll while holding Alt)
- **Open in Cursor** - jump directly to the source file
- **Scan with LLM** - analyze the component for style issues
- **Copy fix prompt** - paste into Cursor agent for automatic fixes

### Props

| Prop      | Type      | Default | Description           |
| --------- | --------- | ------- | --------------------- |
| `enabled` | `boolean` | `true`  | Enable/disable UILint |

### API Routes

The CLI installs these routes automatically, or you can add them manually:

```ts
// app/api/uilint/analyze/route.ts
// Handles LLM analysis of source code

// app/api/dev/source/route.ts
// Dev-only route for fetching source files
```

## Usage in Tests

UILint can run in Vitest/Jest tests with JSDOM:

### Direct JSDOM Adapter

```tsx
import { JSDOMAdapter, runUILintInTest } from "uilint-react/node";
import { render } from "@testing-library/react";

test("detect style inconsistencies", async () => {
  render(<MyComponent />);

  // Run UILint and get issues
  const issues = await runUILintInTest(document.body);

  // Assert on specific issues
  expect(issues).toHaveLength(0); // Fail if any issues found
});

test("custom adapter usage", async () => {
  render(<MyComponent />);

  const adapter = new JSDOMAdapter(".uilint/styleguide.md");
  await adapter.loadStyleGuide();

  const result = await adapter.analyze(document.body);
  adapter.outputWarnings(result.issues);

  expect(result.issues.filter((i) => i.type === "color")).toHaveLength(0);
});
```

## API

### UILintProvider

```tsx
interface UILintProviderProps {
  enabled?: boolean;
  children: React.ReactNode;
}

function UILintProvider(props: UILintProviderProps): JSX.Element;
```

### useUILintContext

```tsx
function useUILintContext(): UILintContextValue;

interface UILintContextValue {
  settings: UILintSettings;
  updateSettings: (settings: Partial<UILintSettings>) => void;
  altKeyHeld: boolean;
  locatorTarget: LocatorTarget | null;
  inspectedElement: InspectedElement | null;
  setInspectedElement: (element: InspectedElement | null) => void;
  // ... additional context values
}
```

### JSDOM Adapter (Node.js)

```typescript
// Import from "uilint-react/node" for test environments
class JSDOMAdapter {
  constructor(styleGuidePath?: string);

  loadStyleGuide(): Promise<void>;
  analyze(element: Element): Promise<{ issues: Issue[] }>;
  outputWarnings(issues: Issue[]): void;
}

function runUILintInTest(element: Element): Promise<Issue[]>;
```

## Prerequisites

For LLM-powered features, you need [Ollama](https://ollama.ai) installed locally:

```bash
# Install Ollama, then pull the default model
ollama pull qwen3-coder:30b
```

## Related Packages

- [`uilint-core`](https://www.npmjs.com/package/uilint-core) - Core library
- [`uilint-cli`](https://www.npmjs.com/package/uilint-cli) - Command-line interface
- [`uilint-mcp`](https://www.npmjs.com/package/uilint-mcp) - MCP server

## Documentation

For full documentation, visit the [UILint GitHub repository](https://github.com/peter-suggate/uilint).

## License

MIT
