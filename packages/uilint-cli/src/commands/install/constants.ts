/**
 * Constants for the install command
 *
 * Contains file content templates for hooks, scripts, and commands.
 */

import type { HooksConfig, MCPConfig } from "./types.js";

// ============================================================================
// Default Configurations
// ============================================================================

export const HOOKS_CONFIG: HooksConfig = {
  version: 1,
  hooks: {
    beforeSubmitPrompt: [{ command: ".cursor/hooks/uilint-session-start.sh" }],
    afterFileEdit: [{ command: ".cursor/hooks/uilint-track.sh" }],
    stop: [{ command: ".cursor/hooks/uilint-session-end.sh" }],
  },
};

export const MCP_CONFIG: MCPConfig = {
  mcpServers: {
    uilint: {
      command: "npx",
      args: ["uilint-mcp"],
    },
  },
};

// ============================================================================
// Legacy Hook Commands (for cleanup during upgrade)
// ============================================================================

export const LEGACY_HOOK_COMMANDS = [
  ".cursor/hooks/uilint-validate.sh",
  ".cursor/hooks/uilint-validate.js",
];

// ============================================================================
// Hook Scripts
// ============================================================================

export const SESSION_START_SCRIPT = `#!/bin/bash
# UILint session start hook
# Clears tracked files at the start of each agent turn
#
# IMPORTANT: Cursor hooks communicate over stdio using JSON.
# - stdout must be JSON (Cursor will parse it)
# - stderr is for logs

echo "[UILint] Session start - clearing tracked files" >&2

# Prefer local monorepo build when developing UILint itself.
# Fall back to npx for normal consumers.
uilint() {
  if [ -f "packages/uilint-cli/dist/index.js" ]; then
    node "packages/uilint-cli/dist/index.js" "$@"
  else
    npx uilint-cli "$@"
  fi
}

# Read JSON input from stdin (required by hook protocol)
cat > /dev/null

# Clear session state
result=$(uilint session clear)
status=$?

echo "[UILint] Clear exit: $status" >&2

if [ $status -eq 0 ] && [ -n "$result" ]; then
  echo "$result"
else
  echo '{"cleared":false}'
fi

exit 0
`;

export const TRACK_SCRIPT = `#!/bin/bash
# UILint file tracking hook
# Tracks UI file edits for batch validation on agent stop
#
# IMPORTANT: Cursor hooks communicate over stdio using JSON.
# - stdout must be JSON (Cursor will parse it)
# - stderr is for logs

out='{}'

# Read JSON input from stdin
input=$(cat)

echo "[UILint] afterFileEdit hook triggered" >&2

# Prefer local monorepo build when developing UILint itself.
# Fall back to npx for normal consumers.
uilint() {
  if [ -f "packages/uilint-cli/dist/index.js" ]; then
    node "packages/uilint-cli/dist/index.js" "$@"
  else
    npx uilint-cli "$@"
  fi
}

# Extract file_path using grep/sed (works without jq)
file_path=$(echo "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"file_path"[[:space:]]*:[[:space:]]*"\\([^"]*\\)"/\\1/')

echo "[UILint] Extracted file_path: $file_path" >&2

if [ -z "$file_path" ]; then
  echo "[UILint] No file_path found in input, skipping" >&2
  printf '%s\\n' "$out"
  exit 0
fi

# Track the file (session command filters for UI files internally)
echo "[UILint] Tracking file: $file_path" >&2
result=$(uilint session track "$file_path")
status=$?

echo "[UILint] Track exit: $status" >&2

if [ $status -eq 0 ] && [ -n "$result" ]; then
  out="$result"
fi

printf '%s\\n' "$out"
exit 0
`;

export const SESSION_END_SCRIPT = `#!/bin/bash
# UILint session end hook
# Scans tracked markup files and returns followup_message for auto-fix
#
# IMPORTANT: Cursor hooks communicate over stdio using JSON.
# - stdout must be JSON (Cursor will parse it)
# - stderr is for logs

echo "[UILint] Session end hook triggered" >&2

# Read JSON input from stdin (contains status, loop_count)
input=$(cat)

echo "[UILint] Stop input: $input" >&2

# Prefer local monorepo build when developing UILint itself.
# Fall back to npx for normal consumers.
uilint() {
  if [ -f "packages/uilint-cli/dist/index.js" ]; then
    node "packages/uilint-cli/dist/index.js" "$@"
  else
    npx uilint-cli "$@"
  fi
}

# Extract loop_count to prevent infinite loops
loop_count=$(echo "$input" | grep -o '"loop_count"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
loop_count=\${loop_count:-0}

echo "[UILint] Loop count: $loop_count" >&2

# Don't trigger followup if we've already looped 3+ times
if [ "$loop_count" -ge 3 ]; then
  echo "[UILint] Max loops reached, skipping scan" >&2
  echo '{}' 
  exit 0
fi

# First check what files are tracked
echo "[UILint] Checking tracked files..." >&2
tracked=$(uilint session list)
echo "[UILint] Tracked files: $tracked" >&2

# Run scan with --hook flag for direct JSON output
echo "[UILint] Running scan..." >&2
result=$(uilint session scan --hook)
status=$?

echo "[UILint] Scan exit: $status" >&2

if [ $status -eq 0 ] && [ -n "$result" ]; then
  echo "$result"
else
  echo '{}'
fi

exit 0
`;

// ============================================================================
// Cursor Commands
// ============================================================================

export const GENSTYLEGUIDE_COMMAND_MD = `# React Style Guide Generator

Analyze the React UI codebase to produce a **prescriptive, semantic** style guide. Focus on consistency, intent, and relationships—not specific values.

## Philosophy

1. **Identify the intended architecture** from the best patterns in use
2. **Prescribe semantic rules** — about consistency and relationships, not pixels
3. **Stay general** — "primary buttons should be visually consistent" not "buttons use px-4"
4. **Focus on intent** — what should FEEL the same, not what values to use

## Analysis Steps

### 1. Detect the Stack
- Framework: Next.js (App Router? Pages?), Vite, CRA
- Component system: shadcn, MUI, Chakra, Radix, custom
- Styling: Tailwind, CSS Modules, styled-components
- Forms: react-hook-form, Formik, native
- State: React context, Zustand, Redux, Jotai

### 2. Identify Best Patterns
Examine the **best-written** components. Look at:
- \`components/ui/*\` — the design system
- Recently modified files — current standards
- Shared layouts — structural patterns

### 3. Infer Visual Hierarchy & Intent
Understand the design language:
- What distinguishes primary vs secondary actions?
- How is visual hierarchy established?
- What creates consistency across similar elements?

## Output Format

Generate at \`<nextjs app root>/.uilint/styleguide.md\`:
\`\`\`yaml
# Stack
framework: 
styling: 
components: 
component_path: 
forms: 

# Component Usage (MUST use these)
use:
  buttons: 
  inputs: 
  modals: 
  cards: 
  feedback: 
  icons: 
  links: 

# Semantic Rules (consistency & relationships)
semantics:
  hierarchy:
    - <e.g., "primary actions must be visually distinct from secondary">
    - <e.g., "destructive actions should be visually cautionary">
    - <e.g., "page titles should be visually heavier than section titles">
  consistency:
    - <e.g., "all primary buttons should share the same visual weight">
    - <e.g., "form inputs should have uniform height and padding">
    - <e.g., "card padding should be consistent across the app">
    - <e.g., "interactive elements should have consistent hover/focus states">
  spacing:
    - <e.g., "use the spacing scale — no arbitrary values">
    - <e.g., "related elements should be closer than unrelated">
    - <e.g., "section spacing should be larger than element spacing">
  layout:
    - <e.g., "use gap for sibling spacing, not margin">
    - <e.g., "containers should have consistent max-width and padding">

# Patterns (structural, not values)
patterns:
  forms: <e.g., "FormField + Controller + zod schema">
  conditionals: <e.g., "cn() for class merging">
  loading: <e.g., "Skeleton for content, Spinner for actions">
  errors: <e.g., "ErrorBoundary at route, inline for forms">
  responsive: <e.g., "mobile-first, standard breakpoints only">

# Component Authoring
authoring:
  - <e.g., "forwardRef for interactive components">
  - <e.g., "variants via CVA or component props, not className overrides">
  - <e.g., "extract when used 2+ times">
  - <e.g., "'use client' only when needed">

# Forbidden
forbidden:
  - <e.g., "inline style={{}}">
  - <e.g., "raw HTML elements when component exists">
  - <e.g., "arbitrary values — use scale">
  - <e.g., "className overrides that break visual consistency">
  - <e.g., "one-off spacing that doesn't match siblings">

# Legacy (if migration in progress)
legacy:
  - <e.g., "old: CSS modules → new: Tailwind">
  - <e.g., "old: Formik → new: react-hook-form">

# Conventions
conventions:
  - 
  - 
  - 
\`\`\`

## Rules

- **Semantic over specific**: "consistent padding" not "p-4"
- **Relationships over absolutes**: "heavier than" not "font-bold"
- **Intent over implementation**: "visually distinct" not "blue background"
- **Prescriptive**: Define target state, not current state
- **Terse**: No prose. Fragments and short phrases only.
- **Actionable**: Every rule should be human-verifiable
- **Omit if N/A**: Skip sections that don't apply
- **Max 5 items** per section — highest impact only
`;

export const GENRULES_COMMAND_MD = `# ESLint Rule Generator

Generate custom ESLint rules from your UILint styleguide (\`.uilint/styleguide.md\`).

## Purpose

Transform your semantic styleguide rules into concrete, enforceable ESLint rules that:
- Run automatically during development
- Integrate with your editor
- Catch issues before commit
- Provide actionable error messages

## Analysis Steps

### 1. Read the Styleguide

Look at \`.uilint/styleguide.md\` for:
- **Component Usage** (\`use:\` section) - which components should be used
- **Forbidden** patterns - what to disallow
- **Semantic Rules** - spacing, consistency, hierarchy
- **Patterns** - form handling, conditionals, state management

### 2. Identify Rule Candidates

Focus on rules that can be statically analyzed:
- Import patterns (e.g., "use Button from shadcn, not raw HTML button")
- Forbidden patterns (e.g., "no inline style={{}}")
- Component library mixing (e.g., "don't mix MUI and shadcn")
- Tailwind patterns (e.g., "no arbitrary values")

### 3. Generate Rule Files

Create TypeScript ESLint rules in \`.uilint/rules/\`:

\`\`\`typescript
// .uilint/rules/prefer-shadcn-button.ts
import { createRule } from 'uilint-eslint';

export default createRule({
  name: 'prefer-shadcn-button',
  meta: {
    type: 'problem',
    docs: { description: 'Use Button from shadcn instead of raw <button>' },
    messages: {
      preferButton: 'Use <Button> from @/components/ui/button instead of raw <button>',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'button') {
          context.report({ node, messageId: 'preferButton' });
        }
      },
    };
  },
});
\`\`\`

### 4. Generate ESLint Config

Create or update \`eslint.config.js\` to include the generated rules:

\`\`\`javascript
import uilint from 'uilint-eslint';
import preferShadcnButton from './.uilint/rules/prefer-shadcn-button.js';

export default [
  uilint.configs.recommended,
  {
    plugins: {
      'uilint-custom': {
        rules: {
          'prefer-shadcn-button': preferShadcnButton,
        },
      },
    },
    rules: {
      'uilint-custom/prefer-shadcn-button': 'error',
    },
  },
];
\`\`\`

## Output

Generate in \`.uilint/rules/\`:
- One TypeScript file per rule
- An \`index.ts\` that exports all rules
- Update instructions for \`eslint.config.js\`

## Guidelines

- **Focus on static analysis** - rules must work without runtime info
- **Clear error messages** - tell devs exactly what to do
- **No false positives** - better to miss issues than over-report
- **Performance** - rules run on every file, keep them fast
- **Minimal rules** - generate 3-5 high-impact rules, not dozens
`;
