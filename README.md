# UILint

AI-powered UI consistency checker for React and Next.js applications.

UILint scans your UI for design inconsistencies, auto-generates a style guide from your existing code, and helps maintain a consistent design system across your application.

## Features

- **Automatic style detection** - Extracts colors, typography, spacing, and component patterns from your UI
- **AI-powered analysis** - Uses local LLMs (via Ollama) to identify subtle inconsistencies
- **Style guide generation** - Auto-generates a Markdown style guide from your existing styles
- **Multiple integration points** - Use in tests, at runtime, via CLI, or in your editor via MCP

## Getting Started (Minimal)

```bash
# 1) Install Cursor integration (pick MCP when prompted)
npx uilint-cli@latest install

# 2) Generate `.uilint/styleguide.md` inside Cursor
# Run: /genstyleguide

# 3) Ask your agent to apply the guide to your code
# "Update this Button to match our style guide (size, colors, spacing)."
```

**Example agentic workflow:**

```
You: "Scan this component and fix any style inconsistencies"

AI uses MCP tools:
  1. scan_file → analyzes your component markup
  2. Suggests fixes → "Change #3575E2 to #3B82F6 (primary blue)"
  3. Updates your code automatically
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         uilint-core                             │
│  Types, Ollama Client, Prompts, Style Extraction, Validation   │
└─────────────────────────────────────────────────────────────────┘
              ▲                    ▲                    ▲
              │                    │                    │
    ┌─────────┴────────┐  ┌────────┴───────┐  ┌────────┴───────┐
    │   uilint-react   │  │   uilint-cli   │  │   uilint-mcp   │
    │  React Component │  │  CLI Commands  │  │   MCP Server   │
    └──────────────────┘  └────────────────┘  └────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.ai) installed locally (the CLI can auto-start it and auto-pull the model):

```bash
# Install Ollama, then pull the default model:
ollama pull qwen3-coder:30b
```

If Ollama isn’t installed, the CLI will print install instructions; on macOS it can optionally offer to run `brew install ollama` (interactive TTY only).

### Installation

```bash
# Install the CLI globally
npm install -g uilint-cli

# Or add to your project
npm install uilint-react uilint-core
```

You can also run the CLI without installing globally:

```bash
# If published to npm:
npx uilint-cli --help
```

---

## Using UILint in a Running App

Wrap your app with `<UILintProvider>` to enable the element inspector overlay:

### Setup

```tsx
// app/layout.tsx (Next.js)
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

### Usage

- **Alt+Click** on any element to open the inspector sidebar
- View component source location and navigate to parent components
- **Scan with LLM** to analyze the component for style issues
- Copy the generated fix prompt and paste it into Cursor to auto-fix issues

### Props

| Prop      | Type      | Default | Description           |
| --------- | --------- | ------- | --------------------- |
| `enabled` | `boolean` | `true`  | Enable/disable UILint |

### Automatic Installation

The easiest way to set up UILint in your Next.js app:

```bash
npx uilint-cli install
```

This will:

- Install the required dependencies (`uilint-react`, `uilint-core`)
- Add the necessary API routes
- Inject `<UILintProvider>` into your layout

---

## Using UILint in Tests

UILint can run in Vitest/Jest tests with JSDOM to catch UI inconsistencies during development:

### Setup

```ts
// vitest.setup.ts
import "@testing-library/jest-dom";
```

### Direct JSDOM Adapter

Use the `JSDOMAdapter` for testing:

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

---

## CLI Usage

The CLI provides powerful commands for analyzing HTML, managing style guides, and validating code.

### Commands Overview

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `uilint scan`    | Scan HTML for UI consistency issues               |
| `uilint query`   | Query the style guide for specific rules          |
| `uilint update`  | Update existing style guide with new styles       |
| `uilint install` | Install Cursor integration (MCP + commands/hooks) |

---

### `uilint scan` - Scan for Issues

Analyze HTML for UI consistency issues:

```bash
# Scan an HTML file
uilint scan --input-file page.html

# Scan with a specific style guide
uilint scan --input-file page.html --styleguide ./design/styleguide.md

# JSON output (for CI/CD)
uilint scan --input-file page.html --output json

# Scan from stdin
curl http://localhost:3000 | uilint scan

# Use a different model
uilint scan --input-file page.html --model llama3.2

# Pre-extracted styles (from browser)
uilint scan --input-json '{"html":"<button class=\"bg-blue-500\">","styles":{"colors":{"#3B82F6":5}}}'
```

**Options:**

| Option                    | Description                               |
| ------------------------- | ----------------------------------------- |
| `-f, --input-file <path>` | Path to HTML file to scan                 |
| `-j, --input-json <json>` | JSON input with html and styles           |
| `-s, --styleguide <path>` | Path to style guide file                  |
| `-o, --output <format>`   | Output format: `text` or `json`           |
| `-m, --model <name>`      | Ollama model (default: `qwen3-coder:30b`) |

**Example output:**

```
⚠️  Color inconsistency
   Similar blue colors should be consolidated
   Current: #3575E2  Expected: #3B82F6
   Suggestion: Use the primary blue #3B82F6 consistently

⚠️  Spacing issue
   Button padding doesn't follow 4px grid
   Current: 18px  Expected: 16px or 20px
   Suggestion: Use p-4 (16px) or p-5 (20px)

Analysis completed in 1234ms
```

### `uilint query` - Query Style Guide

Ask questions about your style guide:

```bash
# Simple queries (answered without LLM)
uilint query "what colors are allowed?"
uilint query "what fonts should I use?"
uilint query "what spacing values are available?"

# Complex queries (uses LLM)
uilint query "how should I style a primary button?"
uilint query "what's the difference between primary and secondary colors?"

# JSON output
uilint query "what colors are allowed?" --output json

# With specific style guide
uilint query "what fonts?" --styleguide ./design/styleguide.md
```

**Options:**

| Option                    | Description                               |
| ------------------------- | ----------------------------------------- |
| `-s, --styleguide <path>` | Path to style guide file                  |
| `-o, --output <format>`   | Output format: `text` or `json`           |
| `-m, --model <name>`      | Ollama model (default: `qwen3-coder:30b`) |

**Example output:**

```
Colors in the style guide:
  Primary: #3B82F6 (used in buttons, links, accents)
  Secondary: #6B7280 (used in muted text, secondary actions)
  Success: #10B981 (used in success states)
  Warning: #F59E0B (used in warning states)
  Error: #EF4444 (used in error states)
```

---

### `uilint update` - Update Style Guide

Merge new styles into an existing style guide:

```bash
# Update from HTML file
uilint update --input-file new-page.html

# Use LLM to suggest updates
uilint update --input-file new-page.html --llm

# Specify style guide path
uilint update --input-file page.html --styleguide ./my-styleguide.md
```

---

## CI/CD Integration

Use UILint in your CI pipeline to catch inconsistencies before they reach production:

```yaml
# .github/workflows/uilint.yml
name: UILint Check

on: [push, pull_request]

jobs:
  uilint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Ollama
        run: |
          curl -fsSL https://ollama.ai/install.sh | sh
          ollama pull qwen3-coder:30b

      - name: Start Ollama
        run: ollama serve &

      - name: Install dependencies
        run: npm ci

      - name: Build app
        run: npm run build

      - name: Start app
        run: npm start &

      - name: Run UILint
        run: |
          curl http://localhost:3000 | npx uilint-cli scan --output json
```

---

## MCP Server

UILint includes an MCP (Model Context Protocol) server for editor integration:

### Setup with Cursor

Add to your Cursor settings:

```json
{
  "mcpServers": {
    "uilint": {
      "command": "node",
      "args": ["/path/to/uilint-mcp/dist/server.js"]
    }
  }
}
```

### Available Tools

| Tool           | Description                         |
| -------------- | ----------------------------------- |
| `scan_file`    | Scan a component file for UI issues |
| `scan_snippet` | Scan a markup snippet for UI issues |

---

## Style Guide Format

UILint uses a simple Markdown format for style guides:

```markdown
# UI Style Guide

## Colors

- **Primary**: #3B82F6 (used in buttons, links, accents)
- **Secondary**: #6B7280 (used in muted text)
- **Error**: #EF4444 (used in error states)

## Typography

- **Font Family**: system-ui, -apple-system, sans-serif
- **Font Sizes**: 12px, 14px, 16px, 18px, 24px, 32px
- **Font Weights**: 400 (normal), 600 (semibold), 700 (bold)

## Spacing

- **Base unit**: 4px
- **Common values**: 4px, 8px, 16px, 24px, 32px

## Components

- **Buttons**: rounded-lg, px-4 py-2, font-medium
- **Cards**: rounded-xl, shadow-sm, p-6
```

---

## Packages

| Package        | Description                                              |
| -------------- | -------------------------------------------------------- |
| `uilint-core`  | Core library with types, Ollama client, style extraction |
| `uilint-react` | React component for runtime UI analysis                  |
| `uilint-cli`   | Command-line interface                                   |
| `uilint-mcp`   | MCP server for editor integration                        |

---

## Development

```bash
# Clone and install
git clone https://github.com/peter-suggate/uilint.git
cd uilint
pnpm install

# Build all packages
pnpm build

# Run the test app
pnpm dev

# Run tests
pnpm test
```

---

## Publishing to npm (Maintainers)

This repo is a pnpm workspace. Publish the packages in dependency order:

```bash
# 1. Bump versions (choose one)
pnpm version:patch   # 0.1.0 → 0.1.1 (bug fixes)
pnpm version:minor   # 0.1.0 → 0.2.0 (new features)
pnpm version:major   # 0.1.0 → 1.0.0 (breaking changes)

# 2. Sanity check what would be published
pnpm publish:dry

# 3. Publish (public)
pnpm publish:packages
```

Notes:

- You must be logged in to npm (`npm whoami`) and have rights to publish the package names.
- The `version:*` scripts bump all packages and the root in sync automatically, and also sync internal dependency ranges (e.g. `uilint-cli` → `uilint-core`).
- `publish:*` runs `sync:workspace` + `build:packages` before publishing, so the published `package.json` metadata is always consistent.

---

## License

MIT
