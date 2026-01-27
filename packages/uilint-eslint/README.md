# uilint-eslint

ESLint plugin for UILint - AI-powered UI consistency checking.

## Installation

```bash
pnpm add -D uilint-eslint
```

## Usage

Add to your ESLint flat config:

```javascript
// eslint.config.js
import uilint from "uilint-eslint";

export default [
  // Use recommended preset (static rules only)
  uilint.configs.recommended,

  // Or strict preset (includes LLM-powered semantic rule)
  // uilint.configs.strict,

  // Or configure rules individually
  {
    plugins: { uilint: uilint.plugin },
    rules: {
      "uilint/consistent-spacing": [
        "warn",
        { scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16] },
      ],
      "uilint/no-direct-store-import": ["error", { storePattern: "use*Store" }],
      "uilint/no-mixed-component-libraries": [
        "error",
        { libraries: ["shadcn", "mui"] },
      ],
    },
  },
];
```

## Rules

### Static Rules

| Rule                           | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `consistent-spacing`           | Enforce spacing scale (no magic numbers in gap/padding) |
| `no-direct-store-import`       | Forbid direct Zustand store imports (use hooks)         |
| `no-mixed-component-libraries` | Forbid mixing shadcn and MUI components in same file    |

### LLM-Powered Rules

| Rule       | Description                                            |
| ---------- | ------------------------------------------------------ |
| `semantic` | LLM-powered semantic UI analysis using your styleguide |

The `semantic` rule reads `.uilint/styleguide.md` and uses Ollama to analyze your UI code for consistency violations.

## Configuration

### `consistent-spacing`

```javascript
{
  scale: number[]  // Allowed spacing values (default: Tailwind defaults)
}
```

### `no-direct-store-import`

```javascript
{
  storePattern: string; // Glob pattern for store names (default: 'use*Store')
}
```

### `no-mixed-component-libraries`

```javascript
{
  libraries: ('shadcn' | 'mui')[]  // Libraries to check (default: ['shadcn', 'mui'])
}
```

### `semantic`

```javascript
{
  model: string; // Ollama model (default: 'qwen3:8b')
  styleguidePath: string; // Path to styleguide (default: '.uilint/styleguide.md')
}
```

## License

MIT
