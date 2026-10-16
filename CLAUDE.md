# Animato monorepo

## Layout
- api_server/        Rust (axum). Routes nested at /api/auth/* and /api/jobs/*. PORT 5000.
- remotion_worker/   Rust worker. Pulls jobs from Redis :6379, renders, uploads to S3, writes status to MongoDB.
- manim_worker/      Rust worker. Same, Redis :6380.
- animation_frontend/  Vite + React 19 + TS. Dev server :5173, proxies /api -> :5000.
  - frontendplan.md   The build spec (source of truth). PROGRESS.md says which phase is next.
  - crates/           Rust workspace compiled to WASM.
  - src/wasm/pkg/     Committed output of `npm run wasm:build` (animato-wasm).
  - packages/render-engine/  @tooscut/render-engine (timeline model, frame builder). Wired in Phase P4.
  - src/workers/      Orphaned Tooscut workers; merged into src/features/editor/engine/ and removed in Phase P4.
    Until then they are excluded from tsc, ESLint, oxlint and Prettier.

## Rules for frontend sessions
- Never modify api_server/, remotion_worker/ or manim_worker/. They are the source of truth: read them, don't change them.
  Gaps go to frontendplan.md section 17.
- Never read, print, or create .env files. Use names-only examples in docs.
- Never log secrets, tokens, codes, presigned URLs or passwords.
- MSW mocks are for the Playwright e2e build only (`npm run build:mocks`), never the dev run.
- No invented facts in the product (testimonials, logos, counts, ETAs, features that don't exist).
- The backend has no "list jobs" endpoint. Job history lives in IndexedDB per user.
- GET /api/jobs/:id/video answers 302 to a presigned S3 URL.

## .gitignore traps (these have already lost files once)
- The root .gitignore ignores media/, dist/, build/, out/ everywhere. Any new source folder with one of those
  names must be re-included in animation_frontend/.gitignore (src/features/editor/media/ and public/media/ are).
- wasm-pack writes a `.gitignore` containing `*` into its output folder. Delete it after every build, or the
  output never gets committed.
- crates/build.sh calls `wasm-pack build compositor` relative to the current directory: run it from crates/.
- Before finishing, prove nothing is missing: clone the pushed branch into a temp dir, `npm ci && npm run build`.

## Install in the cloud sandbox
- `npm ci --ignore-scripts`: onnxruntime-node's postinstall downloads binaries the browser build never uses and
  fails behind the proxy.
- Playwright: never `playwright install`. Chromium is at /opt/pw-browsers/chromium; playwright.config.ts picks it
  up automatically (or set PW_CHROMIUM_PATH).

## Verify
cd animation_frontend && npm run typecheck && npm run lint && npm run build && npm test && npm run test:e2e
Before finishing a phase also run `npm run test:e2e:slow` (full-size exports through SwiftShader, ~12 min).
cargo test --manifest-path animation_frontend/crates/Cargo.toml -p animato-wasm -p tooscut-audio-engine -p offcut-mp4 -p animato-graphics -p tooscut-compositor -p tooscut-types
