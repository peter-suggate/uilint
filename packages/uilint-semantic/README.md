# uilint-semantic

LLM-powered styleguide checking plugin for UILint. Enforces design system consistency using local AI models.

## Installation

```bash
pnpm add uilint-semantic
```

## Usage

### Plugin System

The styleguide plugin auto-registers with the UILint plugin registry:

```typescript
import "uilint-semantic"; // Auto-registers plugin

import { pluginRegistry } from "uilint-core";
const styleguidePlugin = pluginRegistry.get("styleguide");
```

### Types

```typescript
import type { StyleguideState } from "uilint-semantic";
```

## Features

- **LLM-Powered Analysis**: Uses local Ollama models to check code against your styleguide
- **Styleguide Enforcement**: Validates components match your design system rules
- **Progress Tracking**: Real-time analysis progress and status

## Plugin Definition

The styleguide plugin provides:

### Commands
- `styleguide:check-status` - Check styleguide and model availability
- `styleguide:reload` - Reload styleguide from disk

### Panels
- **Styleguide Status Panel**: Shows model availability, styleguide status, and analysis progress

### Rules
- `semantic` - LLM-powered styleguide analysis rule (category: `styleguide`)

### State
```typescript
interface StyleguideState {
  styleguideLoaded: boolean;
  styleguidePath: string | null;
  modelAvailable: boolean;
  modelName: string | null;
  analysisStatus: "idle" | "analyzing" | "complete" | "error";
  analysisProgress: { current: number; total: number } | null;
  lastAnalysisError: string | null;
  analyzedFileCount: number;
  issueCount: number;
}
```

## Configuration

The `semantic` rule requires:
1. A local Ollama instance running
2. A styleguide file at `.uilint/styleguide.md`

```javascript
// eslint.config.mjs
{
  rules: {
    "uilint/semantic": ["warn"]
  }
}
```

## WebSocket Messages

The plugin handles these WebSocket message types:

| Message | Direction | Description |
|---------|-----------|-------------|
| `styleguide:check` | Client→Server | Check styleguide status |
| `styleguide:status` | Server→Client | Styleguide/model availability |
| `styleguide:analysis:progress` | Server→Client | Analysis progress update |
| `styleguide:analysis:complete` | Server→Client | Analysis finished |
| `styleguide:analysis:error` | Server→Client | Analysis error |

## License

MIT
