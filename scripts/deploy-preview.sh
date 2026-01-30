#!/bin/bash
#
# Deploy the current branch to the preview environment
#
# Usage:
#   ./scripts/deploy-preview.sh           # Deploy current branch (build from source)
#   ./scripts/deploy-preview.sh --npm     # Deploy using published npm packages
#   ./scripts/deploy-preview.sh --watch   # Deploy and wait for completion
#

set -e

# Parse arguments
USE_NPM="false"
WATCH=false

for arg in "$@"; do
  case $arg in
    --npm)
      USE_NPM="true"
      shift
      ;;
    --watch)
      WATCH=true
      shift
      ;;
    --help|-h)
      echo "Deploy the current branch to the preview environment"
      echo ""
      echo "Usage: ./scripts/deploy-preview.sh [options]"
      echo ""
      echo "Options:"
      echo "  --npm     Use published npm packages instead of building from source"
      echo "  --watch   Wait for deployment to complete and show status"
      echo "  --help    Show this help message"
      exit 0
      ;;
  esac
done

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Deploying branch '$BRANCH' to preview..."
echo "  Build mode: $([ "$USE_NPM" = "true" ] && echo "npm packages" || echo "from source")"

# Trigger the workflow
gh workflow run "Preview Deployment" \
  --ref "$BRANCH" \
  -f use_npm="$USE_NPM"

echo ""
echo "Workflow triggered! View progress at:"
echo "  https://github.com/peter-suggate/uilint/actions/workflows/preview.yml"

if [ "$WATCH" = true ]; then
  echo ""
  echo "Waiting for workflow to start..."
  sleep 5

  # Get the latest run ID for this workflow on this branch
  RUN_ID=$(gh run list --workflow="Preview Deployment" --branch="$BRANCH" --limit=1 --json databaseId --jq '.[0].databaseId')

  if [ -n "$RUN_ID" ]; then
    echo "Watching run #$RUN_ID..."
    gh run watch "$RUN_ID"
  else
    echo "Could not find workflow run. Check the Actions tab manually."
  fi
fi
