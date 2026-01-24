#!/bin/bash

# Setup test app from template
# If the test-app directory doesn't exist, copy from template
# If it exists with uilint installed, perform an upgrade
# If it exists without uilint, perform an install

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$ROOT_DIR/apps/test-app-template"
TEST_APP_DIR="$ROOT_DIR/apps/test-app"

echo "Setting up test app..."

if [ ! -d "$TEST_APP_DIR" ]; then
    echo "Creating test-app from template..."

    # Copy template to test-app, excluding build artifacts and uilint files
    rsync -a \
        --exclude 'node_modules' \
        --exclude '.next' \
        --exclude '.uilint' \
        --exclude '.DS_Store' \
        --exclude 'coverage' \
        "$TEMPLATE_DIR/" "$TEST_APP_DIR/"

    # Update package name
    sed -i '' 's/"name": "test-app-template"/"name": "test-app"/' "$TEST_APP_DIR/package.json"

    echo "Installing dependencies..."
    cd "$ROOT_DIR" && pnpm install

    echo "Running uilint install..."
    cd "$TEST_APP_DIR" && pnpm uilint install
else
    echo "test-app directory already exists"

    if [ -d "$TEST_APP_DIR/.uilint" ]; then
        echo "UILint detected, running upgrade..."
        cd "$TEST_APP_DIR" && pnpm uilint upgrade
    else
        echo "No UILint installation found, running install..."
        cd "$TEST_APP_DIR" && pnpm uilint install
    fi
fi

echo "Done! Test app is ready at apps/test-app"
