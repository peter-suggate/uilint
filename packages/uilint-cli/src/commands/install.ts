/**
 * Install command - interactive setup wizard for UILint
 *
 * Offers two integration modes:
 * - MCP Server (stdio): Registers uilint-mcp in .cursor/mcp.json
 * - Cursor Hooks: Sets up beforeSubmitPrompt, afterFileEdit, and stop hooks
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  chmodSync,
} from "fs";
import { join } from "path";
import {
  intro,
  outro,
  confirm,
  select,
  multiselect,
  withSpinner,
  note,
  logSuccess,
  logInfo,
  logWarning,
  pc,
} from "../utils/prompts.js";
import {
  detectNextAppRouter,
  findNextAppRouterProjects,
} from "../utils/next-detect.js";
import {
  detectPackageManager,
  installDependencies,
} from "../utils/package-manager.js";
import { installNextUILintRoutes } from "../utils/next-routes.js";
import { installReactUILintOverlay } from "../utils/react-inject.js";
import { installJsxLocPlugin } from "../utils/next-config-inject.js";
import {
  installEslintPlugin,
  findEslintConfigFile,
} from "../utils/eslint-config-inject.js";
import { findWorkspaceRoot } from "uilint-core/node";
import {
  findPackages,
  formatPackageOption,
  type PackageInfo,
} from "../utils/package-detect.js";
import { ruleRegistry, type RuleMetadata } from "uilint-eslint";

export interface InstallOptions {
  force?: boolean;
  mode?: "mcp" | "hooks" | "both";
  // Non-interactive selections
  mcp?: boolean;
  hooks?: boolean;
  genstyleguide?: boolean;
  /**
   * Back-compat aliases for the combined Next.js overlay install.
   * If either is selected, we install routes + deps + inject.
   */
  routes?: boolean;
  react?: boolean;
  genrules?: boolean;
  eslint?: boolean;
}

type IntegrationMode = "mcp" | "hooks" | "both";
type InstallItem =
  | "mcp"
  | "hooks"
  | "genstyleguide"
  | "genrules"
  | "next"
  | "eslint";

interface HooksConfig {
  version: number;
  hooks: {
    beforeSubmitPrompt?: Array<{ command: string }>;
    afterFileEdit?: Array<{ command: string }>;
    stop?: Array<{ command: string }>;
    [key: string]: unknown;
  };
}

interface MCPConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
    };
  };
}

const HOOKS_CONFIG: HooksConfig = {
  version: 1,
  hooks: {
    beforeSubmitPrompt: [{ command: ".cursor/hooks/uilint-session-start.sh" }],
    afterFileEdit: [{ command: ".cursor/hooks/uilint-track.sh" }],
    stop: [{ command: ".cursor/hooks/uilint-session-end.sh" }],
  },
};

const MCP_CONFIG: MCPConfig = {
  mcpServers: {
    uilint: {
      command: "npx",
      args: ["uilint-mcp"],
    },
  },
};

// Cursor command: /genstyleguide - generates a prescriptive semantic React style guide prompt
const GENSTYLEGUIDE_COMMAND_MD = `# React Style Guide Generator

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

// Cursor command: /genrules - generates ESLint rules from styleguide
const GENRULES_COMMAND_MD = `# ESLint Rule Generator

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

// Hook 1: beforeSubmitPrompt - clear tracked files
const SESSION_START_SCRIPT = `#!/bin/bash
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

// Hook 2: afterFileEdit - track file edits
const TRACK_SCRIPT = `#!/bin/bash
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

// Hook 3: stop - scan all tracked files
const SESSION_END_SCRIPT = `#!/bin/bash
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

// Legacy hook commands to remove during upgrade
const LEGACY_HOOK_COMMANDS = [
  ".cursor/hooks/uilint-validate.sh",
  ".cursor/hooks/uilint-validate.js",
];

export async function install(options: InstallOptions): Promise<void> {
  const projectPath = process.cwd();
  const cursorDir = join(projectPath, ".cursor");

  intro("Setup Wizard");

  // Determine install items
  const hasExplicitFlags =
    options.mcp !== undefined ||
    options.hooks !== undefined ||
    options.genstyleguide !== undefined ||
    options.genrules !== undefined ||
    options.routes !== undefined ||
    options.react !== undefined;

  let items: InstallItem[] = [];

  if (hasExplicitFlags || options.eslint) {
    if (options.mcp) items.push("mcp");
    if (options.hooks) items.push("hooks");
    if (options.genstyleguide) items.push("genstyleguide");
    if (options.genrules) items.push("genrules");
    if (options.routes || options.react) items.push("next");
    if (options.eslint) items.push("eslint");
  } else if (options.mode) {
    const mode: IntegrationMode = options.mode;
    logInfo(`Using ${mode} mode (from --mode flag)`);
    if (mode === "mcp" || mode === "both") items.push("mcp");
    if (mode === "hooks" || mode === "both") items.push("hooks");
    // Preserve previous behavior: install /genstyleguide by default when using mode.
    items.push("genstyleguide");
  } else {
    items = await multiselect<InstallItem>({
      message: "What would you like to install?",
      options: [
        {
          value: "mcp",
          label: "MCP Server",
          hint: "Recommended - works with any MCP-compatible agent",
        },
        {
          value: "hooks",
          label: "Cursor Hooks",
          hint: "Auto-validates UI files when the agent stops",
        },
        {
          value: "genstyleguide",
          label: "/genstyleguide command",
          hint: "Adds .cursor/commands/genstyleguide.md",
        },
        {
          value: "genrules",
          label: "/genrules command",
          hint: "Adds .cursor/commands/genrules.md for ESLint rule generation",
        },
        {
          value: "next",
          label: "UI overlay",
          hint: "Installs routes + UILintProvider (Alt+Click to inspect)",
        },
        {
          value: "eslint",
          label: "ESLint plugin",
          hint: "Installs uilint-eslint and configures eslint.config.js",
        },
      ],
      required: true,
      initialValues: ["mcp", "hooks", "genstyleguide", "genrules", "next"],
    });
  }

  const installMCP = items.includes("mcp");
  const installHooks = items.includes("hooks");
  const installGenStyleguide = items.includes("genstyleguide");
  const installGenRules = items.includes("genrules");
  const installNextOverlay = items.includes("next");
  const installESLint = items.includes("eslint");

  // Check for existing installations
  const mcpJsonPath = join(cursorDir, "mcp.json");
  const hooksJsonPath = join(cursorDir, "hooks.json");

  const mcpExists = existsSync(mcpJsonPath);
  const hooksExist = existsSync(hooksJsonPath);

  if (!options.force) {
    if (installMCP && mcpExists) {
      const mcpOverwrite = await confirm({
        message: `${pc.dim(
          ".cursor/mcp.json"
        )} already exists. Merge UILint config?`,
        initialValue: true,
      });
      if (!mcpOverwrite) {
        logWarning("Skipping MCP installation");
      }
    }
  }

  // Create .cursor directory if needed
  if (
    (installMCP || installHooks || installGenStyleguide || installGenRules) &&
    !existsSync(cursorDir)
  ) {
    mkdirSync(cursorDir, { recursive: true });
  }

  // Install MCP Server
  if (installMCP) {
    await withSpinner("Installing MCP server configuration", async () => {
      await installMCPServer(cursorDir, options.force);
    });
  }

  // Install Cursor Hooks
  if (installHooks) {
    await withSpinner("Installing Cursor hooks", async () => {
      await installCursorHooks(cursorDir, options.force);
    });
  }

  // Install /genstyleguide command
  if (installGenStyleguide) {
    await withSpinner("Installing /genstyleguide command", async () => {
      await installGenStyleguideCommand(cursorDir);
    });
  }

  // Install /genrules command
  if (installGenRules) {
    await withSpinner("Installing /genrules command", async () => {
      await installGenRulesCommand(cursorDir);
    });
  }

  // Next.js app router detection (needed for routes/react)
  let nextApp: ReturnType<typeof detectNextAppRouter> | null = null;
  let nextProjectPath = projectPath;
  if (installNextOverlay) {
    nextApp = detectNextAppRouter(projectPath);
    if (!nextApp) {
      const workspaceRoot = findWorkspaceRoot(projectPath);
      const matches = findNextAppRouterProjects(workspaceRoot, { maxDepth: 5 });

      if (matches.length === 1) {
        nextProjectPath = matches[0].projectPath;
        nextApp = matches[0].detection;
      } else if (matches.length > 1) {
        const chosen = await select<string>({
          message:
            "Which Next.js App Router project should UILint install into?",
          options: matches.map((m) => ({
            value: m.projectPath,
            label: m.projectPath,
          })),
          initialValue: matches[0].projectPath,
        });
        const picked =
          matches.find((m) => m.projectPath === chosen) || matches[0];
        nextProjectPath = picked.projectPath;
        nextApp = picked.detection;
      } else {
        throw new Error(
          "Could not find a Next.js App Router app root (expected app/ or src/app/). Run this from your Next.js project root."
        );
      }
    }
  }

  // Install Next overlay (routes + deps + injection)
  if (installNextOverlay && nextApp) {
    await withSpinner("Installing Next.js API routes", async () => {
      await installNextUILintRoutes({
        projectPath: nextProjectPath,
        appRoot: nextApp.appRoot,
        force: options.force,
        confirmOverwrite: async (path) =>
          confirm({
            message: `${pc.dim(path)} already exists. Overwrite?`,
            initialValue: false,
          }),
      });
    });

    await withSpinner("Installing React overlay dependencies", async () => {
      const pm = detectPackageManager(nextProjectPath);
      await installDependencies(pm, nextProjectPath, [
        "uilint-react",
        "uilint-core",
        "jsx-loc-plugin",
      ]);
    });

    // IMPORTANT: do not wrap prompts (confirm/select) in a spinner; it can look
    // like the CLI is "stuck" because the spinner keeps rendering.
    logInfo("Finding a place in your app to inject <UILintProvider>...");
    const result = await installReactUILintOverlay({
      projectPath: nextProjectPath,
      appRoot: nextApp!.appRoot,
      force: options.force,
      confirmFileChoice: async (choices) =>
        select<string>({
          message:
            choices.length === 1
              ? `Confirm injection target: ${choices[0]}`
              : "Which file should we inject <UILintProvider> into?",
          options: choices.map((c) => ({ value: c, label: c })),
          initialValue: choices[0],
        }),
      confirmOverwrite: async (path) =>
        confirm({
          message: `${pc.dim(
            path
          )} already contains UILintProvider. Re-apply anyway?`,
          initialValue: false,
        }),
    });
    logSuccess(`Injected <UILintProvider> in ${pc.dim(result.targetFile)}`);

    // Inject jsx-loc-plugin into next.config
    logInfo("Configuring jsx-loc-plugin in next.config...");
    const jsxLocResult = await installJsxLocPlugin({
      projectPath: nextProjectPath,
      force: options.force,
      confirmOverwrite: async (path) =>
        confirm({
          message: `${pc.dim(path)} already has withJsxLoc. Re-apply anyway?`,
          initialValue: false,
        }),
    });

    if (jsxLocResult.modified && jsxLocResult.configFile) {
      logSuccess(
        `Wrapped export with withJsxLoc in ${pc.dim(jsxLocResult.configFile)}`
      );
    } else if (jsxLocResult.configFile) {
      logInfo(`${pc.dim(jsxLocResult.configFile)} already configured`);
    } else {
      logWarning("No next.config file found - please add withJsxLoc manually");
    }
  }

  // Install ESLint plugin
  let eslintInstalledPaths: string[] = [];
  if (installESLint) {
    // Find all packages in the workspace
    const workspaceRoot = findWorkspaceRoot(projectPath);
    const packages = findPackages(workspaceRoot);

    if (packages.length === 0) {
      logWarning("No packages with package.json found");
    } else {
      // Filter to only packages that have an eslint.config file
      const packagesWithEslint = packages.filter((p) => {
        const hasConfig = findEslintConfigFile(p.path) !== null;
        return hasConfig;
      });

      if (packagesWithEslint.length === 0) {
        logWarning(
          "No packages with eslint.config.{mjs,js,cjs} found. Create an ESLint config first."
        );
      } else {
        // Let user select which packages to install ESLint plugin into
        let selectedPaths: string[];

        if (packagesWithEslint.length === 1) {
          // Single package - just confirm
          const confirmed = await confirm({
            message: `Install ESLint plugin in ${pc.cyan(
              packagesWithEslint[0].displayPath
            )}?`,
            initialValue: true,
          });
          selectedPaths = confirmed ? [packagesWithEslint[0].path] : [];
        } else {
          // Multiple packages - multiselect
          // Pre-select frontend packages
          const initialValues = packagesWithEslint
            .filter((p) => p.isFrontend)
            .map((p) => p.path);

          selectedPaths = await multiselect<string>({
            message: "Which packages should have ESLint plugin installed?",
            options: packagesWithEslint.map(formatPackageOption),
            required: false,
            initialValues:
              initialValues.length > 0
                ? initialValues
                : [packagesWithEslint[0].path],
          });
        }

        if (selectedPaths.length === 0) {
          logInfo("No packages selected for ESLint installation");
        } else {
          // Ask which rules to enable (once for all packages)
          logInfo("\nSelect which ESLint rules to enable:");

          const selectedRuleIds = await multiselect<string>({
            message: "Which rules would you like to enable?",
            options: ruleRegistry.map((rule: RuleMetadata) => ({
              value: rule.id,
              label: rule.name,
              hint: rule.description,
            })),
            required: false,
            initialValues: ruleRegistry
              .filter(
                (r: RuleMetadata) =>
                  r.category === "static" || !r.requiresStyleguide
              )
              .map((r: RuleMetadata) => r.id),
          });

          if (selectedRuleIds.length === 0) {
            logWarning("No rules selected - skipping ESLint configuration");
          } else {
            let selectedRules = ruleRegistry.filter((r: RuleMetadata) =>
              selectedRuleIds.includes(r.id)
            );

            // Check if no-mixed-component-libraries is selected and prompt for preferred library
            const mixedLibrariesRule = selectedRules.find(
              (r) => r.id === "no-mixed-component-libraries"
            );
            if (mixedLibrariesRule) {
              const setPreferred = await confirm({
                message:
                  "Set a preferred component library? (If set, the rule will warn when non-preferred libraries are used)",
                initialValue: false,
              });

              if (setPreferred) {
                const preferredLib = await select<"shadcn" | "mui">({
                  message: "Which library should be preferred?",
                  options: [
                    { value: "shadcn", label: "shadcn/ui" },
                    { value: "mui", label: "MUI (Material-UI)" },
                  ],
                });

                // Update the rule's defaultOptions to include preferred
                selectedRules = selectedRules.map((rule) => {
                  if (rule.id === "no-mixed-component-libraries") {
                    return {
                      ...rule,
                      defaultOptions: [
                        {
                          libraries: ["shadcn", "mui"],
                          preferred: preferredLib,
                        },
                      ],
                    };
                  }
                  return rule;
                });
              }
            }

            // Install to each selected package
            for (const pkgPath of selectedPaths) {
              const pkgInfo = packagesWithEslint.find(
                (p) => p.path === pkgPath
              );
              const displayName = pkgInfo?.displayPath || pkgPath;

              await withSpinner(
                `Installing ESLint plugin in ${pc.dim(displayName)}`,
                async () => {
                  const pm = detectPackageManager(pkgPath);
                  await installDependencies(pm, pkgPath, ["uilint-eslint"]);
                }
              );

              // Inject rules into existing eslint.config
              const result = await installEslintPlugin({
                projectPath: pkgPath,
                selectedRules,
                force: options.force,
                confirmAddMissingRules: async (path, missingRules) =>
                  confirm({
                    message:
                      `${pc.dim(path)} is missing ${pc.cyan(
                        String(missingRules.length)
                      )} UILint rule(s):\n` +
                      missingRules
                        .map((r) => `  ${pc.dim("•")} uilint/${r.id}`)
                        .join("\n") +
                      `\n\nAdd the missing rules now?`,
                    initialValue: true,
                  }),
                confirmOverwrite: async (path) =>
                  confirm({
                    message: `${pc.dim(
                      path
                    )} already has uilint rules. Overwrite?`,
                    initialValue: false,
                  }),
              });

              if (result.modified && result.configFile) {
                logSuccess(
                  `Configured ${pc.dim(result.configFile)} in ${pc.dim(
                    displayName
                  )}`
                );
              } else if (
                result.configFile &&
                result.missingRuleIds.length > 0
              ) {
                logWarning(
                  `${pc.dim(result.configFile)} in ${pc.dim(
                    displayName
                  )} is missing ${pc.cyan(
                    String(result.missingRuleIds.length)
                  )} UILint rule(s): ${result.missingRuleIds
                    .map((id) => pc.cyan(`uilint/${id}`))
                    .join(", ")}`
                );
              } else if (result.configFile) {
                logInfo(
                  `${pc.dim(result.configFile)} in ${pc.dim(
                    displayName
                  )} already configured`
                );
              } else {
                logWarning(`No eslint.config found in ${pc.dim(displayName)}`);
              }

              eslintInstalledPaths.push(displayName);
            }
          }
        }
      }

      // Add .uilint/.cache to .gitignore (at workspace root)
      const gitignorePath = join(workspaceRoot, ".gitignore");
      const cacheIgnoreLine = ".uilint/.cache";

      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, "utf-8");
        if (!content.includes(cacheIgnoreLine)) {
          writeFileSync(
            gitignorePath,
            content + `\n# UILint cache\n${cacheIgnoreLine}\n`,
            "utf-8"
          );
          logInfo("Added .uilint/.cache to .gitignore");
        }
      }
    }
  }

  // Show summary
  const installedItems: string[] = [];

  if (installMCP) {
    installedItems.push(`${pc.cyan("MCP Server")} → .cursor/mcp.json`);
  }

  if (installHooks) {
    installedItems.push(`${pc.cyan("Hooks")} → .cursor/hooks.json`);
    installedItems.push(`  ${pc.dim("├")} uilint-session-start.sh`);
    installedItems.push(`  ${pc.dim("├")} uilint-track.sh`);
    installedItems.push(`  ${pc.dim("└")} uilint-session-end.sh`);
  }

  if (installGenStyleguide) {
    installedItems.push(
      `${pc.cyan("Command")} → .cursor/commands/genstyleguide.md`
    );
  }

  if (installGenRules) {
    installedItems.push(`${pc.cyan("Command")} → .cursor/commands/genrules.md`);
  }

  if (installNextOverlay && nextApp) {
    installedItems.push(
      `${pc.cyan("Next Routes")} → ${pc.dim(
        join(nextApp.appRoot, "api/.uilint")
      )}`
    );
  }

  if (installNextOverlay) {
    installedItems.push(
      `${pc.cyan("Next Overlay")} → ${pc.dim("<UILintProvider> injected")}`
    );
    installedItems.push(
      `${pc.cyan("JSX Loc Plugin")} → ${pc.dim(
        "next.config wrapped with withJsxLoc"
      )}`
    );
  }

  if (installESLint && eslintInstalledPaths.length > 0) {
    installedItems.push(
      `${pc.cyan("ESLint Plugin")} → installed in ${
        eslintInstalledPaths.length
      } package(s)`
    );
    for (let i = 0; i < eslintInstalledPaths.length; i++) {
      const isLast = i === eslintInstalledPaths.length - 1;
      const prefix = isLast ? "└" : "├";
      installedItems.push(
        `  ${pc.dim(prefix)} ${eslintInstalledPaths[i]}/eslint.config.js`
      );
    }
    installedItems.push(`${pc.cyan("Available Rules")}:`);
    installedItems.push(`  ${pc.dim("├")} uilint/no-arbitrary-tailwind`);
    installedItems.push(`  ${pc.dim("├")} uilint/consistent-spacing`);
    installedItems.push(`  ${pc.dim("├")} uilint/no-direct-store-import`);
    installedItems.push(`  ${pc.dim("├")} uilint/no-mixed-component-libraries`);
    installedItems.push(`  ${pc.dim("└")} uilint/semantic (LLM-powered)`);
  }

  note(installedItems.join("\n"), "Installed");

  // Next steps
  const steps: string[] = [];

  if (!existsSync(join(projectPath, ".uilint", "styleguide.md"))) {
    steps.push(`Create a styleguide: ${pc.cyan("/genstyleguide")}`);
  }

  if (installMCP || installHooks || installGenStyleguide) {
    steps.push("Restart Cursor to load the new configuration");
  }

  if (installMCP) {
    steps.push(`The MCP server exposes: ${pc.dim("scan_file, scan_snippet")}`);
  }

  if (installHooks) {
    steps.push("Hooks will auto-validate UI files when the agent stops");
  }

  if (installNextOverlay) {
    steps.push(
      "Run your Next.js dev server - use Alt+Click on any element to inspect"
    );
  }

  if (installESLint) {
    steps.push(`Run ${pc.cyan("npx eslint src/")} to check for issues`);
    steps.push(
      `For real-time overlay integration, run ${pc.cyan(
        "uilint serve"
      )} alongside your dev server`
    );
  }

  note(steps.join("\n"), "Next Steps");

  outro("UILint installed successfully!");
}

/**
 * Install MCP server configuration
 */
async function installMCPServer(
  cursorDir: string,
  force?: boolean
): Promise<void> {
  const mcpJsonPath = join(cursorDir, "mcp.json");

  let config: MCPConfig;

  if (existsSync(mcpJsonPath) && !force) {
    // Merge with existing config
    try {
      const existing = JSON.parse(
        readFileSync(mcpJsonPath, "utf-8")
      ) as MCPConfig;
      config = {
        mcpServers: {
          ...existing.mcpServers,
          ...MCP_CONFIG.mcpServers,
        },
      };
    } catch {
      config = MCP_CONFIG;
    }
  } else {
    config = MCP_CONFIG;
  }

  writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Install Cursor hooks
 */
async function installCursorHooks(
  cursorDir: string,
  force?: boolean
): Promise<void> {
  const hooksDir = join(cursorDir, "hooks");
  const hooksJsonPath = join(cursorDir, "hooks.json");

  // Create hooks directory
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Hook script paths
  const sessionStartPath = join(hooksDir, "uilint-session-start.sh");
  const trackPath = join(hooksDir, "uilint-track.sh");
  const sessionEndPath = join(hooksDir, "uilint-session-end.sh");

  // Legacy paths to clean up
  const oldValidatePath = join(hooksDir, "uilint-validate.sh");
  const oldJsHookPath = join(hooksDir, "uilint-validate.js");

  // Clean up legacy files
  if (existsSync(oldValidatePath)) {
    unlinkSync(oldValidatePath);
  }
  if (existsSync(oldJsHookPath)) {
    unlinkSync(oldJsHookPath);
  }

  // Handle existing hooks.json - merge or create
  let finalHooksConfig: HooksConfig;

  if (existsSync(hooksJsonPath) && !force) {
    try {
      const existingContent = readFileSync(hooksJsonPath, "utf-8");
      const existingConfig: HooksConfig = JSON.parse(existingContent);
      finalHooksConfig = mergeHooksConfig(existingConfig, HOOKS_CONFIG);
    } catch {
      finalHooksConfig = HOOKS_CONFIG;
    }
  } else {
    finalHooksConfig = HOOKS_CONFIG;
  }

  // Write hooks.json
  writeFileSync(
    hooksJsonPath,
    JSON.stringify(finalHooksConfig, null, 2),
    "utf-8"
  );

  // Write hook scripts
  writeFileSync(sessionStartPath, SESSION_START_SCRIPT, "utf-8");
  writeFileSync(trackPath, TRACK_SCRIPT, "utf-8");
  writeFileSync(sessionEndPath, SESSION_END_SCRIPT, "utf-8");

  // Make scripts executable
  chmodSync(sessionStartPath, 0o755);
  chmodSync(trackPath, 0o755);
  chmodSync(sessionEndPath, 0o755);
}

/**
 * Install /genstyleguide Cursor command
 */
async function installGenStyleguideCommand(cursorDir: string): Promise<void> {
  const commandsDir = join(cursorDir, "commands");
  const genstyleguideCommandPath = join(commandsDir, "genstyleguide.md");

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
  }

  writeFileSync(genstyleguideCommandPath, GENSTYLEGUIDE_COMMAND_MD, "utf-8");
}

/**
 * Install /genrules Cursor command
 */
async function installGenRulesCommand(cursorDir: string): Promise<void> {
  const commandsDir = join(cursorDir, "commands");
  const genrulesCommandPath = join(commandsDir, "genrules.md");

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
  }

  writeFileSync(genrulesCommandPath, GENRULES_COMMAND_MD, "utf-8");
}

/**
 * Merge our hooks into existing config without duplicating
 * Also removes legacy UILint hooks that are no longer used
 */
function mergeHooksConfig(
  existing: HooksConfig,
  ours: HooksConfig
): HooksConfig {
  const result = { ...existing };

  // First, remove any legacy UILint hooks from all hook arrays
  for (const [hookName, hookArray] of Object.entries(result.hooks)) {
    if (!Array.isArray(hookArray)) continue;

    result.hooks[hookName] = hookArray.filter(
      (h) => !LEGACY_HOOK_COMMANDS.includes(h.command)
    );
  }

  // Then merge our new hooks
  for (const [hookName, ourHooks] of Object.entries(ours.hooks)) {
    if (!Array.isArray(ourHooks)) continue;

    const existingHooks =
      (result.hooks[hookName] as Array<{ command: string }>) || [];

    for (const ourHook of ourHooks) {
      const alreadyExists = existingHooks.some(
        (h) => h.command === ourHook.command
      );
      if (!alreadyExists) {
        existingHooks.push(ourHook);
      }
    }

    result.hooks[hookName] = existingHooks;
  }

  return result;
}
