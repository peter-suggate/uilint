# uilint

Command-line interface for UILint - AI-powered UI consistency checking.

## Overview

`uilint` provides a powerful command-line interface for analyzing UI consistency, generating style guides, and validating your design system.

## Installation

```bash
# Install globally
npm install -g uilint

# Or use with npx
npx uilint --help
```

## Prerequisites

[Ollama](https://ollama.ai) is required for LLM-powered features:

```bash
# Install Ollama, then pull the default model
ollama pull qwen3-coder:30b
```

The CLI can auto-start Ollama and auto-pull models if needed. On macOS, it can optionally offer to run `brew install ollama` (interactive TTY only).

## Commands

### Creating a style guide

UILint expects a style guide at `.uilint/styleguide.md`.

The recommended way to generate one is via Cursor:

```bash
npx uilint init
```

Then run the Cursor command:

```
/genstyleguide
```

### `uilint scan` - Scan for Issues

Analyze HTML for UI consistency issues:

```bash
# Scan an HTML file
uilint scan --input-file page.html

# Scan with a specific style guide
uilint scan --input-file page.html --styleguide ./design/styleguide.md

# JSON output (for CI/CD)
uilint scan --input-file page.html --output json

# From stdin
curl http://localhost:3000 | uilint scan
```

> **Note:** The model used for LLM-based analysis defaults to the model configured in `uilint-core`. For ESLint-based semantic scanning (real-time linting), configure the model via the `uilint/semantic` rule options in your ESLint config.

**Options:**

| Option                    | Description                     |
| ------------------------- | ------------------------------- |
| `-f, --input-file <path>` | Path to HTML file to scan       |
| `-j, --input-json <json>` | JSON input with html and styles |
| `-s, --styleguide <path>` | Path to style guide file        |
| `-o, --output <format>`   | Output format: `text` or `json` |

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
# Simple queries
uilint query "what colors are allowed?"
uilint query "what fonts should I use?"

# Complex queries (uses LLM)
uilint query "how should I style a primary button?"

# JSON output
uilint query "what colors?" --output json
```

**Options:**

| Option                    | Description                     |
| ------------------------- | ------------------------------- |
| `-s, --styleguide <path>` | Path to style guide file        |
| `-o, --output <format>`   | Output format: `text` or `json` |

### `uilint update` - Update Style Guide

Merge new styles into an existing style guide:

```bash
# Update from HTML file
uilint update --input-file new-page.html

# Use LLM to suggest updates
uilint update --input-file new-page.html --llm
```

## CI/CD Integration

Use UILint in your CI pipeline:

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

      - name: Run UILint
        run: |
          curl http://localhost:3000 | npx uilint scan --output json
```

## Related Packages

- [`uilint-core`](https://www.npmjs.com/package/uilint-core) - Core library
- [`uilint-react`](https://www.npmjs.com/package/uilint-react) - React component
- [`uilint-mcp`](https://www.npmjs.com/package/uilint-mcp) - MCP server

## Documentation

For full documentation, visit the [UILint GitHub repository](https://github.com/peter-suggate/uilint).

## License

MIT
