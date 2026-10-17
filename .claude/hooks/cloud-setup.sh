#!/usr/bin/env bash
# Runs at the start of every Claude Code session. Does real work only in
# cloud sessions; on a local machine it exits straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/animation_frontend"

# --ignore-scripts: onnxruntime-node's postinstall downloads native binaries the
# browser build never uses, and the download fails behind the sandbox proxy.
npm ci --no-audit --no-fund --loglevel=error --ignore-scripts

# Playwright uses the pre-installed Chromium (/opt/pw-browsers); see playwright.config.ts.
echo "cloud-setup: frontend dependencies installed"
