# uilint-core

Core library for UILint - AI-powered UI consistency checking for React and Next.js applications.

## Overview

`uilint-core` provides the foundational functionality for UILint, including:

- **Style extraction** - Parses HTML/CSS to extract colors, typography, spacing, and component patterns
- **Ollama integration** - Client for local LLM analysis via Ollama
- **Style guide management** - Read, write, and generate style guides
- **Tailwind support** - Extract and validate Tailwind CSS class usage
- **Validation** - Core validation logic for detecting UI inconsistencies

This package is typically used as a dependency by `uilint-cli`, `uilint-react`, or `uilint-mcp`.

## Installation

```bash
npm install uilint-core
```

## Usage

### Ollama Client

```typescript
import { OllamaClient, UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";

const client = new OllamaClient({ model: UILINT_DEFAULT_OLLAMA_MODEL });

// Generate a style guide from extracted styles
const styleGuide = await client.generateStyleGuide({
  colors: { "#3B82F6": 10, "#1E40AF": 5 },
  fontSizes: ["14px", "16px", "18px"],
  spacing: ["8px", "16px", "24px"],
});

// Analyze UI for inconsistencies
const result = await client.analyzeStyles(styleSummary, styleGuide);
console.log(result.issues);
```

### Style Extraction

```typescript
import { extractStylesFromHTML } from "uilint-core";

const html = `<div style="color: #3B82F6; font-size: 16px;">Hello</div>`;
const styles = extractStylesFromHTML(html);

console.log(styles.colors); // { "#3B82F6": 1 }
console.log(styles.fontSizes); // ["16px"]
```

### Style Guide Management (Node.js)

```typescript
import {
  readStyleGuideFromProject,
  writeStyleGuide,
  styleGuideExists,
  getDefaultStyleGuidePath,
} from "uilint-core/node";

const projectPath = process.cwd();

// Check if style guide exists
if (styleGuideExists(projectPath)) {
  // Read the style guide
  const content = await readStyleGuideFromProject(projectPath);
  console.log(content);
}

// Write a new style guide
const guidePath = getDefaultStyleGuidePath(projectPath);
await writeStyleGuide(guidePath, "# My Style Guide\n...");
```

## API

### OllamaClient

```typescript
class OllamaClient {
  constructor(options: { model?: string; baseUrl?: string });

  generateStyleGuide(styleSummary: StyleSummary): Promise<string>;
  analyzeStyles(
    styleSummary: StyleSummary,
    styleGuide: string
  ): Promise<AnalysisResult>;
  queryStyleGuide(styleGuide: string, query: string): Promise<string>;
}
```

### Style Extraction

```typescript
function extractStylesFromHTML(html: string): StyleSummary;

interface StyleSummary {
  colors: Record<string, number>;
  fontSizes: string[];
  fontFamilies: string[];
  spacing: string[];
  borderRadius: string[];
  shadows: string[];
  tailwindClasses?: Record<string, number>;
}
```

### Style Guide Management

```typescript
function readStyleGuideFromProject(projectPath: string): Promise<string>;
function writeStyleGuide(path: string, content: string): Promise<void>;
function styleGuideExists(projectPath: string): boolean;
function getDefaultStyleGuidePath(projectPath: string): string;
```

## Prerequisites

For LLM-powered features, you need [Ollama](https://ollama.ai) installed locally:

```bash
# Install Ollama, then pull the default model
ollama pull qwen3-coder:30b
```

## Related Packages

- [`uilint-cli`](https://www.npmjs.com/package/uilint-cli) - Command-line interface
- [`uilint-react`](https://www.npmjs.com/package/uilint-react) - React component for runtime analysis
- [`uilint-mcp`](https://www.npmjs.com/package/uilint-mcp) - MCP server for editor integration

## Documentation

For full documentation, visit the [UILint GitHub repository](https://github.com/peter-suggate/uilint).

## License

MIT
