#!/bin/bash
# Cursor hook: Run ESLint on edited files
# Triggered by afterFileEdit

# Read JSON input from stdin
input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path // empty')

# Exit if no file path
if [[ -z "$file_path" ]]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # Run ESLint on the specific file (fast, single file)
  # Use --fix to auto-fix issues, suppress errors for cleaner output
  pnpm eslint "$file_path" --fix 2>/dev/null || true
fi
