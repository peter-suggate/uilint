#!/bin/bash

# Setup test app from template
# Always removes existing test-app and creates fresh from template

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$ROOT_DIR/apps/test-app-template"
TEST_APP_DIR="$ROOT_DIR/apps/test-app"
UILINT_CLI="$ROOT_DIR/packages/uilint/dist/index.js"

echo "Setting up test app..."

# Always remove existing test-app and create fresh
if [ -d "$TEST_APP_DIR" ]; then
    echo "Removing existing test-app..."
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

# Update package name to test-app
echo "Updating package name to test-app..."
sed 's/"name": "[^"]*"/"name": "test-app"/' "$TEST_APP_DIR/package.json" > "$TEST_APP_DIR/package.json.tmp" && mv "$TEST_APP_DIR/package.json.tmp" "$TEST_APP_DIR/package.json"

echo "Installing dependencies..."
cd "$ROOT_DIR" && pnpm install

echo "Running uilint init --eslint --react..."
cd "$TEST_APP_DIR" && node "$UILINT_CLI" init --eslint --react

echo "Done! Test app is ready at apps/test-app"
