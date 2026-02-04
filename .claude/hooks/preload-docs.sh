#!/bin/bash
# Claude hook: Preload architecture documentation into context
# Triggered by UserPromptSubmit
#
# Output: JSON with additionalContext containing architecture docs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH_FILE="$SCRIPT_DIR/../ARCHITECTURE.md"

if [[ -f "$ARCH_FILE" ]]; then
  # Read the architecture docs and output as additionalContext
  content=$(cat "$ARCH_FILE")
  jq -n --arg docs "$content" '{"additionalContext": ("=== CODEBASE ARCHITECTURE ===\n" + $docs + "\n=== END ARCHITECTURE ===")}'
fi
