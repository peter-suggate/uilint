# uilint-react

React component for AI-powered UI consistency checking in running applications.

## Overview

`uilint-react` provides React components and utilities for analyzing UI consistency at runtime and in tests. It includes a visual overlay for development and a JSDOM adapter for testing.

## Installation

```bash
npm install uilint-react uilint-core
```

## Usage in a Running App

Wrap your app with the `<UILint>` component to get a visual overlay:

### Next.js Setup

```tsx
// app/layout.tsx
import { UILint } from "uilint-react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <UILint
          enabled={process.env.NODE_ENV !== "production"}
          position="bottom-left"
          autoScan={false}
        >
          {children}
        </UILint>
      </body>
    </html>
  );
}
```

### Props

| Prop          | Type                                                           | Default                 | Description                     |
| ------------- | -------------------------------------------------------------- | ----------------------- | ------------------------------- |
| `enabled`     | `boolean`                                                      | `true`                  | Enable/disable UILint           |
| `position`    | `'bottom-left' \| 'bottom-right' \| 'top-left' \| 'top-right'` | `'bottom-left'`         | Overlay position                |
| `autoScan`    | `boolean`                                                      | `false`                 | Automatically scan on page load |
| `apiEndpoint` | `string`                                                       | `'/api/uilint/analyze'` | Custom API endpoint             |

### API Routes

You'll need to add API routes for the React component:

```ts
// app/api/uilint/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { OllamaClient } from "uilint-core";

export async function POST(request: NextRequest) {
  const { styleSummary, styleGuide, generateGuide, model } =
    await request.json();
  const client = new OllamaClient({ model: model || "qwen2.5-coder:7b" });

  if (generateGuide) {
    const styleGuideContent = await client.generateStyleGuide(styleSummary);
    return NextResponse.json({ styleGuide: styleGuideContent });
  } else {
    const result = await client.analyzeStyles(styleSummary, styleGuide);
    return NextResponse.json({ issues: result.issues });
  }
}
```

```ts
// app/api/uilint/styleguide/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  readStyleGuideFromProject,
  writeStyleGuide,
  styleGuideExists,
  getDefaultStyleGuidePath,
} from "uilint-core/node";

export async function GET() {
  const projectPath = process.cwd();
  if (!styleGuideExists(projectPath)) {
    return NextResponse.json({ exists: false, content: null });
  }
  const content = await readStyleGuideFromProject(projectPath);
  return NextResponse.json({ exists: true, content });
}

export async function POST(request: NextRequest) {
  const { content } = await request.json();
  const projectPath = process.cwd();
  const stylePath = getDefaultStyleGuidePath(projectPath);
  await writeStyleGuide(stylePath, content);
  return NextResponse.json({ success: true });
}
```

## Usage in Tests

UILint can run in Vitest/Jest tests with JSDOM:

### Basic Test

```tsx
import { render, screen } from "@testing-library/react";
import { UILint } from "uilint-react";
import { MyComponent } from "./MyComponent";

test("MyComponent has consistent styles", async () => {
  render(
    <UILint enabled={true}>
      <MyComponent />
    </UILint>
  );

  expect(screen.getByRole("button")).toBeInTheDocument();

  // UILint automatically outputs warnings to console:
  // ⚠️ [UILint] Button uses #3B82F6 but style guide specifies #2563EB
});
```

### Direct JSDOM Adapter

For more control, use the `JSDOMAdapter`:

```tsx
import { JSDOMAdapter, runUILintInTest } from "uilint-react";
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

### UILint Component

```tsx
interface UILintProps {
  enabled?: boolean;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  autoScan?: boolean;
  apiEndpoint?: string;
  children: React.ReactNode;
}

function UILint(props: UILintProps): JSX.Element;
```

### JSDOM Adapter

```typescript
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
ollama pull qwen2.5-coder:7b
```

## Related Packages

- [`uilint-core`](https://www.npmjs.com/package/uilint-core) - Core library
- [`uilint-cli`](https://www.npmjs.com/package/uilint-cli) - Command-line interface
- [`uilint-mcp`](https://www.npmjs.com/package/uilint-mcp) - MCP server

## Documentation

For full documentation, visit the [UILint GitHub repository](https://github.com/peter-suggate/uilint).

## License

MIT
