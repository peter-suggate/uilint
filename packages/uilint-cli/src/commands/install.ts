/**
 * Install command - installs Cursor hooks for UILint session scanning
 *
 * Sets up three hooks:
 * - beforeSubmitPrompt: Clear tracked files at start of agent turn
 * - afterFileEdit: Track file edits (UI files only)
 * - stop: Scan tracked markup files and return followup_message for auto-fix
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
  printSuccess,
  printError,
  printWarning,
  printInfo,
} from "../utils/output.js";

export interface InstallOptions {
  force?: boolean;
}

interface HooksConfig {
  version: number;
  hooks: {
    beforeSubmitPrompt?: Array<{ command: string }>;
    afterFileEdit?: Array<{ command: string }>;
    stop?: Array<{ command: string }>;
    [key: string]: unknown;
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

export async function install(options: InstallOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const cursorDir = join(projectPath, ".cursor");
    const hooksDir = join(cursorDir, "hooks");
    const hooksJsonPath = join(cursorDir, "hooks.json");

    // Hook script paths
    const sessionStartPath = join(hooksDir, "uilint-session-start.sh");
    const trackPath = join(hooksDir, "uilint-track.sh");
    const sessionEndPath = join(hooksDir, "uilint-session-end.sh");

    // Legacy paths to clean up
    const oldValidatePath = join(hooksDir, "uilint-validate.sh");
    const oldJsHookPath = join(hooksDir, "uilint-validate.js");
    const oldRulesPath = join(cursorDir, "rules", "uilint.mdc");

    // Check if hooks already exist
    if (
      !options.force &&
      (existsSync(sessionStartPath) ||
        existsSync(trackPath) ||
        existsSync(sessionEndPath))
    ) {
      printWarning("UILint hooks already exist in .cursor/hooks/");
      console.log("Use --force to overwrite the existing installation.");
      process.exit(1);
    }

    // Create .cursor/hooks/ directory if it doesn't exist
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }

    // Handle existing hooks.json - merge or create
    let finalHooksConfig: HooksConfig;

    if (existsSync(hooksJsonPath)) {
      try {
        const existingContent = readFileSync(hooksJsonPath, "utf-8");
        const existingConfig: HooksConfig = JSON.parse(existingContent);

        if (!existingConfig.hooks) {
          existingConfig.hooks = {};
        }

        // Merge our hooks into existing config
        finalHooksConfig = mergeHooksConfig(existingConfig, HOOKS_CONFIG);
        printInfo("Merged UILint hooks into existing hooks.json");
      } catch {
        if (!options.force) {
          printWarning(
            "Existing hooks.json is invalid. Use --force to overwrite."
          );
          process.exit(1);
        }
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

    // Clean up old files
    if (existsSync(oldValidatePath)) {
      unlinkSync(oldValidatePath);
      printInfo("Removed old hook: uilint-validate.sh");
    }
    if (existsSync(oldJsHookPath)) {
      unlinkSync(oldJsHookPath);
      printInfo("Removed old hook: uilint-validate.js");
    }
    if (existsSync(oldRulesPath)) {
      unlinkSync(oldRulesPath);
      printInfo("Removed old Cursor rules file: .cursor/rules/uilint.mdc");
    }

    printSuccess("Cursor hooks installed successfully!");
    console.log("\n  Hook config: .cursor/hooks.json");
    console.log("  Hook scripts:");
    console.log(
      "    - .cursor/hooks/uilint-session-start.sh (beforeSubmitPrompt)"
    );
    console.log("    - .cursor/hooks/uilint-track.sh (afterFileEdit)");
    console.log("    - .cursor/hooks/uilint-session-end.sh (stop)");
    console.log("\nHow it works:");
    console.log(
      "  1. Files are tracked as you edit them during an agent session"
    );
    console.log("  2. When the agent stops, tracked markup files are scanned");
    console.log(
      "  3. If issues are found, a followup message triggers auto-fix"
    );
    console.log("\nNext steps:");
    console.log("  1. Ensure you have a styleguide at .uilint/styleguide.md");
    console.log("     Run 'uilint init' to create one if needed");
    console.log("  2. Restart Cursor to load the new hooks");
  } catch (error) {
    printError(
      error instanceof Error ? error.message : "Failed to install Cursor hooks"
    );
    process.exit(1);
  }
}

// Legacy hook commands to remove during upgrade
const LEGACY_HOOK_COMMANDS = [
  ".cursor/hooks/uilint-validate.sh",
  ".cursor/hooks/uilint-validate.js",
];

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
