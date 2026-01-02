# uilint-mcp

MCP (Model Context Protocol) server for UILint - enables AI agents to validate UI code.

## Overview

`uilint-mcp` provides an MCP server that allows AI coding assistants (like Claude in Cursor) to check UI consistency, query style guides, and scan markup snippets directly from your editor.

## Installation

```bash
npm install -g uilint-mcp
```

## Setup with Cursor

Add to your Cursor MCP settings (`.cursor/config.json` or global settings):

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

Or if installed globally:

```json
{
  "mcpServers": {
    "uilint": {
      "command": "uilint-mcp"
    }
  }
}
```

## Available Tools

Once configured, your AI assistant has access to these tools:

### `query_styleguide`

Query specific style rules from your project's style guide.

**Example prompts:**
- "What colors are allowed in my style guide?"
- "What fonts should I use for buttons?"
- "Query the style guide for spacing values"

**Parameters:**
- `query` (string) - The question to ask about the style guide
- `projectPath` (string, optional) - Path to project root (defaults to cwd)

### `scan_snippet`

Scan a markup snippet for UI consistency issues.

**Example prompts:**
- "Check this JSX for UI issues: `<button className='bg-blue-600'>Click</button>`"
- "Scan this HTML snippet for consistency"

**Parameters:**
- `markup` (string) - The HTML/JSX markup to scan
- `projectPath` (string, optional) - Path to project root (defaults to cwd)
- `model` (string, optional) - Ollama model to use

### `scan_file`

Scan an entire file for UI consistency issues.

**Example prompts:**
- "Scan src/components/Button.tsx for UI issues"
- "Check app/page.tsx against the style guide"

**Parameters:**
- `filePath` (string) - Path to file to scan
- `projectPath` (string, optional) - Path to project root (defaults to cwd)
- `model` (string, optional) - Ollama model to use

## Usage Examples

Once configured in Cursor, you can use natural language:

```
You: Check this button for UI consistency issues:
<button className="bg-blue-600 text-white px-3 py-2 rounded">Click Me</button>

AI: [Uses scan_snippet tool]
Found 1 issue:
⚠️ Color #2563EB (blue-600) is not in the style guide.
   Expected: #3B82F6 (primary blue)
```

```
You: What spacing values should I use?

AI: [Uses query_styleguide tool]
The style guide specifies these spacing values:
- Base unit: 4px
- Common values: 4px, 8px, 16px, 24px, 32px
```

## Prerequisites

For LLM-powered features, you need [Ollama](https://ollama.ai) installed locally:

```bash
# Install Ollama, then pull the default model
ollama pull qwen2.5-coder:7b
```

## Direct Usage

You can also run the MCP server directly:

```bash
# Start the server
uilint-mcp

# Or with custom path
node /path/to/uilint-mcp/dist/server.js
```

## Related Packages

- [`uilint-core`](https://www.npmjs.com/package/uilint-core) - Core library
- [`uilint-cli`](https://www.npmjs.com/package/uilint-cli) - Command-line interface
- [`uilint-react`](https://www.npmjs.com/package/uilint-react) - React component

## Documentation

For full documentation, visit the [UILint GitHub repository](https://github.com/peter-suggate/uilint).

## License

MIT
