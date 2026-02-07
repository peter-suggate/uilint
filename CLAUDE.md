# Claude Code Instructions

## Build & Test Commands
- `pnpm build:packages` — build all workspace packages
- `pnpm --filter uilint-react lint:strict` — lint with zero warnings allowed
- `pnpm --filter uilint-react typecheck` — run TypeScript type checking (uses `tsc --noEmit`)
- `pnpm --filter uilint-react test -- --run` — run tests (add `--coverage` to update coverage data)
- Pre-commit hook runs lint:strict + typecheck automatically

## Critical: Pre-commit Hook
The `.husky/pre-commit` hook MUST include `set -o pipefail`. This prevents `| tee` from masking lint/typecheck exit codes. Without it, failures are silently ignored and the hook always reports success. Do not remove it.

## Code Style
- Use Tailwind classes (`className`) instead of inline `style={{}}` attributes. The project uses Tailwind v4 with `@theme inline` mappings in `globals.css`. Use mapped utilities like `text-muted-foreground`, `bg-surface`, `text-text-primary`, or bracket notation `bg-[var(--uilint-token)]` for unmapped tokens.
- Do not add `eslint-disable` directives to suppress lint warnings — fix the underlying issues instead.
- Use `useComposedStore((s) => s.property)` with selectors, never `useComposedStore()` without one.
