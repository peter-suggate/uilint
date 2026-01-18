#!/bin/bash
# Claude hook: Run tests and linting at task completion
# Triggered by Stop event

echo "=== Running tests ==="
pnpm test 2>&1 | head -100

echo ""
echo "=== Running lint ==="
pnpm lint 2>&1 | head -50
