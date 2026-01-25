#!/bin/bash
# Claude hook: Run ESLint on edited files
# Triggered by PostToolUse on Edit|Write
#
# Output: JSON with additionalContext for Claude to see lint errors

# Read JSON input from stdin
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Exit if no file path
if [[ -z "$file_path" ]]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # Find the package directory (look for eslint.config.ts or package.json)
  dir=$(dirname "$file_path")
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/eslint.config.ts" ]] || [[ -f "$dir/eslint.config.js" ]]; then
      break
    fi
    dir=$(dirname "$dir")
  done

  # If no config found, exit
  if [[ "$dir" == "/" ]]; then
    exit 0
  fi

  # Run ESLint with --fix first (auto-fix what we can), suppress output
  (cd "$dir" && pnpm eslint "$file_path" --fix >/dev/null 2>&1) || true

  # Then report ALL remaining issues
  remaining=$( (cd "$dir" && pnpm eslint "$file_path" --format stylish 2>/dev/null) | grep -E "^\s+[0-9]+:[0-9]+" | head -10)

  if [[ -n "$remaining" ]]; then
    # Output JSON so Claude sees the lint errors via additionalContext
    jq -n --arg issues "$remaining" '{"additionalContext": ("ESLint errors - fix these:\n" + $issues)}'
  fi
fi
