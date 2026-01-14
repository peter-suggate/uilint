---
name: Fix ESLint rule copy
overview: Restore copying of selected ESLint rule source/test files into per-package `.uilint/rules/` during install, and update the unit/integration tests to match the new per-package layout and verify rule/test copying.
todos:
  - id: planner-no-silent-skip
    content: Update `createPlan` ESLint rule-copy logic to stop silently skipping copy when rule loading fails; surface a clear error instead.
    status: pending
  - id: rule-loader-js-copy
    content: Verify/fix `rule-loader` behavior for JS-only projects to load from `uilint-eslint/dist/rules/*.js` and produce actionable errors when missing.
    status: pending
  - id: update-integration-tests
    content: Update `install-eslint` integration tests (especially monorepo cases) to assert per-package `.uilint/rules/` outputs; add assertion for copying `.test.ts` when present.
    status: pending
    dependencies:
      - planner-no-silent-skip
  - id: update-unit-tests
    content: Update/add `plan.test.ts` assertions to cover TS/JS copy paths and `.test.ts` copying for a rule that has an upstream test file.
    status: pending
    dependencies:
      - planner-no-silent-skip
      - rule-loader-js-copy
---

# Fix ESLint rule copying + update tests

## Goal

Ensure `uilint --eslint` reliably **copies selected rules into each selected package at `<package>/.uilint/rules/`**, including **`.test.ts` files when present**, and keep **JavaScript-only packages** working by copying **compiled `.js` rule files**. Update tests to reflect the per-package copy behavior.

## Key findings

- The planner (`createPlan`) _intends_ to copy rules into `<pkgPath>/.uilint/rules/`, but it currently **swallows rule-loader failures** and continues, which can result in **no rule files being copied** while the install still “succeeds”. See the try/catch around `loadSelectedRules` in [`packages/uilint/src/commands/install/plan.ts`](packages/uilint/src/commands/install/plan.ts).
- Monorepo integration tests currently have at least one expectation that rules are copied to workspace root; with the chosen behavior (**per-package**), those assertions need to be updated.
- JS-only packages rely on `uilint-eslint/dist/rules/*.js` for copying. `uilint-eslint` is configured to emit these via tsup (see [`packages/uilint-eslint/tsup.config.ts`](packages/uilint-eslint/tsup.config.ts)), so tests should validate that path is used.

## Implementation plan

### 1) Make rule copying failures visible (no silent success)

- Update [`packages/uilint/src/commands/install/plan.ts`](packages/uilint/src/commands/install/plan.ts) ESLint section:
- Remove/adjust the broad `try { loadSelectedRules(...) } catch { ... }` so that when rule files can’t be loaded, the plan either:
- **throws** with a clear, actionable error (preferred), or
- collects errors and causes `execute()` to report failure (if you prefer non-throw planning).
- Keep the **per-package** copy destination: `<pkgPath>/.uilint/rules/`.
- Keep copying **`.test.ts`** for TS packages when `ruleFile.test` exists.

### 2) Ensure JS-only packages copy `.js` rule implementations

- Validate/update [`packages/uilint/src/utils/rule-loader.ts`](packages/uilint/src/utils/rule-loader.ts):
- In `typescript: false` mode, ensure rules are loaded from `uilint-eslint/dist/rules/<ruleId>.js`.
- Improve the thrown error message when the compiled JS rule file is missing (point to `uilint-eslint` build/publish expectations).

### 3) Update integration tests to match per-package behavior

- Update [`packages/uilint/test/integration/install-eslint.test.ts`](packages/uilint/test/integration/install-eslint.test.ts):
- In the monorepo test that currently asserts workspace-root copies, change expectations to check:
- `<pkgRelPath>/.uilint/rules/<rule>.ts` (TS packages)
- `<pkgRelPath>/.uilint/rules/<rule>.js` (JS packages)
- Add a focused assertion that a rule with an existing upstream test (e.g. `consistent-dark-mode.test.ts`) is copied into `.uilint/rules/` for TS packages.

### 4) Update/extend unit tests for the plan output (fast feedback)

- Update/add assertions in [`packages/uilint/test/unit/plan.test.ts`](packages/uilint/test/unit/plan.test.ts) to verify:
- For a TS package, `createPlan` includes `create_file` actions for `<pkgPath>/.uilint/rules/<ruleId>.ts`.
- For a JS-only package, `createPlan` includes `create_file` actions for `<pkgPath>/.uilint/rules/<ruleId>.js`.
- For a TS rule with a `.test.ts` upstream, `createPlan` includes a `create_file` action for `<ruleId>.test.ts`.

## Validation

- Run the existing test suite portions:
- `packages/uilint/test/unit/plan.test.ts`
- `packages/uilint/test/integration/install-eslint.test.ts`
- Confirm the install summary includes created rule files under each selected package’s `.uilint/rules/`.

## Notes

- This plan keeps your confirmed behavior: **per-package rule copies** and **JS-only support** via **compiled `.js` rule files**.
