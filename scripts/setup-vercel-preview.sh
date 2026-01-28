#!/bin/bash
set -e

echo "=== UILint Preview Deployment Setup ==="
echo ""

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel@latest
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "Please log in to Vercel:"
    vercel login
fi

echo ""
echo "Creating preview project from test-app-template..."

# Navigate to template directory
cd "$(dirname "$0")/../apps/test-app-template"

# Create/link Vercel project
# --yes to accept defaults, project name will be based on directory
vercel link --yes 2>/dev/null || vercel link

# Get project info
echo ""
echo "Fetching project configuration..."

# The .vercel/project.json contains orgId and projectId
if [ -f ".vercel/project.json" ]; then
    ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*"' | cut -d'"' -f4)
    PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
else
    echo "Error: .vercel/project.json not found. Run 'vercel link' manually."
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Add these secrets to your GitHub repository:"
echo "  Settings > Secrets and variables > Actions > New repository secret"
echo ""
echo "┌─────────────────────┬──────────────────────────────────────┐"
echo "│ Secret Name         │ Value                                │"
echo "├─────────────────────┼──────────────────────────────────────┤"
echo "│ VERCEL_ORG_ID       │ $ORG_ID"
echo "│ VERCEL_PROJECT_ID   │ $PROJECT_ID"
echo "└─────────────────────┴──────────────────────────────────────┘"
echo ""
echo "For VERCEL_TOKEN:"
echo "  1. Go to https://vercel.com/account/tokens"
echo "  2. Create a new token with a descriptive name (e.g., 'uilint-github-actions')"
echo "  3. Add it as VERCEL_TOKEN secret in GitHub"
echo ""
echo "Or create token via CLI and copy it:"
echo "  vercel tokens create uilint-github-actions"
echo ""

# Cleanup - remove .vercel from template (it shouldn't be committed)
rm -rf .vercel

echo "Done! After adding secrets, PR preview deployments will be enabled."
