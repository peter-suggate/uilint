# uilint-semantic

Semantic analysis plugin for UILint. Provides duplicate code detection and semantic similarity analysis.

## Installation

```bash
pnpm add uilint-semantic
```

## Usage

### Plugin System

The semantic plugin auto-registers with the UILint plugin registry:

```typescript
import "uilint-semantic"; // Auto-registers plugin

import { pluginRegistry } from "uilint-core";
const semanticPlugin = pluginRegistry.get("semantic");
```

### Types

```typescript
import type {
  DuplicateMatch,
  DuplicateGroup,
  Chunk,
  IndexStats,
} from "uilint-semantic";
```

## Features

- **Duplicate Detection**: Find semantically similar code patterns
- **Code Indexing**: Build searchable index of code chunks
- **Similarity Scoring**: Configurable similarity thresholds
- **Issue Reporting**: ESLint rule for duplicate detection

## Plugin Definition

The semantic plugin provides:

### Commands
- `semantic:rebuild-index` - Rebuild the duplicates index
- `semantic:clear-filter` - Clear heatmap filter

### Panels
- **Duplicates Panel**: Side-by-side code comparison with diff highlighting
- **Index Status Panel**: Shows indexing progress and statistics

### Rules
- `no-semantic-duplicates` - ESLint rule to detect duplicate code

### State
```typescript
interface SemanticState {
  indexStatus: "idle" | "indexing" | "ready" | "error";
  indexProgress: IndexProgress | null;
  indexStats: IndexStats | null;
  lastIndexError: string | null;
  selectedDuplicate: SelectedDuplicate | null;
}
```

## Types

### DuplicateMatch
```typescript
interface DuplicateMatch {
  sourceDataLoc: string;
  targetDataLoc: string;
  similarity: number;
  sourceCode?: string;
  targetCode?: string;
}
```

### IndexStats
```typescript
interface IndexStats {
  totalChunks: number;
  added: number;
  modified: number;
  deleted: number;
  duration: number;
}
```

### Chunk
```typescript
interface Chunk {
  id: string;
  kind: ChunkKind;
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  hash: string;
}
```

## Configuration

The `no-semantic-duplicates` rule accepts options:

```javascript
// .eslintrc.js
{
  rules: {
    "uilint/no-semantic-duplicates": ["warn", {
      threshold: 0.75, // Similarity threshold (0-1)
    }]
  }
}
```

## WebSocket Messages

The plugin handles these WebSocket message types:

| Message | Direction | Description |
|---------|-----------|-------------|
| `duplicates:index` | Client→Server | Request indexing |
| `duplicates:indexing:start` | Server→Client | Indexing started |
| `duplicates:indexing:progress` | Server→Client | Progress update |
| `duplicates:indexing:complete` | Server→Client | Indexing finished |
| `duplicates:indexing:error` | Server→Client | Indexing error |

## License

MIT
