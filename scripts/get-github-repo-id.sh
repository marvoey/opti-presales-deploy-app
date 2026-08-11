#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  exit 1
fi

# Load env vars without exporting them to the current shell
GITHUB_TOKEN=$(grep '^GITHUB_TOKEN=' "$ENV_FILE" | cut -d'=' -f2-)
OWNER="${1:-$(grep '^GITHUB_REPO_OWNER=' "$ENV_FILE" | cut -d'=' -f2-)}"
REPO="${2:-$(grep '^GITHUB_REPO_NAME=' "$ENV_FILE" | cut -d'=' -f2-)}"

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: GITHUB_TOKEN is not set in .env" >&2
  exit 1
fi
if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "Usage: $0 <owner> <repo>" >&2
  echo "  or set GITHUB_REPO_OWNER and GITHUB_REPO_NAME in .env" >&2
  exit 1
fi

curl -sf \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO" \
  | grep '"id"' | head -1
