#!/bin/bash

# Setup test app with static mode for local preview testing
# Simulates what the Vercel deployment workflow does:
# 1. Creates test-app from template
# 2. Runs uilint init --react
# 3. Configures static mode in providers.tsx
# 4. Generates lint manifest
# 5. Optionally builds and starts the app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$ROOT_DIR/apps/test-app-template"
TEST_APP_DIR="$ROOT_DIR/apps/test-app"
UILINT_CLI="$ROOT_DIR/packages/uilint/dist/index.js"

# Parse arguments
BUILD_AND_START=false
if [ "$1" = "--start" ] || [ "$1" = "-s" ]; then
    BUILD_AND_START=true
fi

echo "🚀 Setting up test app with static mode..."
echo ""

# Step 1: Remove existing test-app and create fresh
if [ -d "$TEST_APP_DIR" ]; then
    echo "📦 Removing existing test-app..."
    rm -rf "$TEST_APP_DIR"
fi

echo "📦 Creating test-app from template..."
mkdir -p "$TEST_APP_DIR"

# Copy template contents, excluding build artifacts
cd "$TEMPLATE_DIR"
for item in *; do
    case "$item" in
        node_modules|.next|coverage) ;;
        *) cp -R "$item" "$TEST_APP_DIR/" ;;
    esac
done

# Copy hidden files
for item in .*; do
    case "$item" in
        .|..|.DS_Store|.uilint|.next) ;;
        *) cp -R "$item" "$TEST_APP_DIR/" 2>/dev/null || true ;;
    esac
done

# Update package name
sed 's/"name": "[^"]*"/"name": "test-app"/' "$TEST_APP_DIR/package.json" > "$TEST_APP_DIR/package.json.tmp" && mv "$TEST_APP_DIR/package.json.tmp" "$TEST_APP_DIR/package.json"

echo "📦 Building packages..."
cd "$ROOT_DIR" && pnpm build:packages

echo ""
echo "📦 Installing dependencies..."
cd "$ROOT_DIR" && pnpm install

# Step 2: Run uilint init --react (non-interactive)
echo ""
echo "🔧 Running uilint init --react..."
cd "$TEST_APP_DIR" && node "$UILINT_CLI" init --react

# Step 3: Configure static mode in providers.tsx
echo ""
echo "🔧 Configuring static mode..."
PROVIDERS_FILE=""
if [ -f "$TEST_APP_DIR/app/providers.tsx" ]; then
    PROVIDERS_FILE="$TEST_APP_DIR/app/providers.tsx"
elif [ -f "$TEST_APP_DIR/src/app/providers.tsx" ]; then
    PROVIDERS_FILE="$TEST_APP_DIR/src/app/providers.tsx"
fi

if [ -n "$PROVIDERS_FILE" ]; then
    # Use temp file for cross-platform compatibility (macOS sed -i differs from Linux)
    sed 's/<uilint-devtools \/>/<uilint-devtools mode="static" manifest-url="\/.uilint\/manifest.json" \/>/g' "$PROVIDERS_FILE" > "$PROVIDERS_FILE.tmp" && mv "$PROVIDERS_FILE.tmp" "$PROVIDERS_FILE"
    echo "   ✓ Updated $PROVIDERS_FILE with static mode"
else
    echo "   ⚠ Could not find providers.tsx - you may need to configure static mode manually"
fi

# Step 4: Generate lint manifest
echo ""
echo "📝 Generating lint manifest..."
mkdir -p "$TEST_APP_DIR/public/.uilint"
cd "$TEST_APP_DIR" && node "$UILINT_CLI" build-manifest -o public/.uilint/manifest.json --pretty
echo "   ✓ Generated manifest at public/.uilint/manifest.json"

echo ""
echo "✅ Static mode setup complete!"
echo ""
echo "Test app is ready at: apps/test-app"
echo ""

# Step 5: Optionally build and start
if [ "$BUILD_AND_START" = true ]; then
    echo "🏗️  Building and starting..."
    cd "$TEST_APP_DIR"
    pnpm build
    echo ""
    echo "🌐 Starting server at http://localhost:3000"
    echo "   (Lint issues will load from static manifest)"
    echo ""
    pnpm start
else
    echo "To build and preview:"
    echo "  cd apps/test-app && pnpm build && pnpm start"
    echo ""
    echo "Or run with --start flag:"
    echo "  pnpm setup-static-preview --start"
fi
