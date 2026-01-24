#!/bin/bash

# Setup test app from template
# - If test-app doesn't exist: copy from template, install uilint
# - If test-app exists with .uilint: run uilint upgrade
# - If test-app exists without .uilint: overwrite and install

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$ROOT_DIR/apps/test-app-template"
TEST_APP_DIR="$ROOT_DIR/apps/test-app"
UILINT_CLI="$ROOT_DIR/packages/uilint/dist/index.js"

echo "Setting up test app..."

# Check if we should upgrade (test-app exists with .uilint)
if [ -d "$TEST_APP_DIR/.uilint" ]; then
    echo "UILint detected in existing test-app, running upgrade..."
    cd "$TEST_APP_DIR" && node "$UILINT_CLI" upgrade
    echo "Done! Test app upgraded at apps/test-app"
    exit 0
fi

# Otherwise, create fresh from template (overwrite if exists)
if [ -d "$TEST_APP_DIR" ]; then
    echo "Removing existing test-app (no uilint installation found)..."
    rm -rf "$TEST_APP_DIR"
fi

echo "Creating test-app from template..."
mkdir -p "$TEST_APP_DIR"

# Copy template contents, excluding build artifacts
cd "$TEMPLATE_DIR"
for item in *; do
    case "$item" in
        node_modules|.next|coverage) ;;
        *) cp -R "$item" "$TEST_APP_DIR/" ;;
    esac
done

# Copy hidden files (except .DS_Store, .uilint, .next)
for item in .*; do
    case "$item" in
        .|..|.DS_Store|.uilint|.next) ;;
        *) cp -R "$item" "$TEST_APP_DIR/" ;;
    esac
done

echo "Installing dependencies..."
cd "$ROOT_DIR" && pnpm install

echo "Running uilint init..."
cd "$TEST_APP_DIR" && node "$UILINT_CLI" init

echo "Done! Test app is ready at apps/test-app"
