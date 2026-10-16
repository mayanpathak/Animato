#!/usr/bin/env bash
# Runs at the start of every Claude Code session. Does real work only in
# cloud sessions; on a local machine it exits straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/animation_frontend"

npm ci --no-audit --no-fund --loglevel=error

# Browser for the Playwright e2e suite. Non-fatal: the network policy may block it.
npx playwright install --with-deps chromium >/dev/null 2>&1 \
  || echo "cloud-setup: Playwright browser install failed; e2e tests will not run"

echo "cloud-setup: frontend dependencies installed"
