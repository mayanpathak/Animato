# Animato monorepo

## Layout
- api_server/        Rust (axum). Routes nested at /api/auth/* and /api/jobs/*. PORT 5000.
- remotion_worker/   Rust worker. Pulls jobs from Redis :6379, renders, uploads to S3, writes status to MongoDB.
- manim_worker/      Rust worker. Same, Redis :6380.
- animation_frontend/  Vite + React 19 + TS. Dev server :5173, proxies /api -> :5000.
  - crates/           Rust workspace compiled to WASM.
  - src/wasm/pkg/     Committed output of `npm run wasm:build` (animato-wasm).
  - packages/render-engine/  @tooscut/render-engine (TS + WASM from crates/compositor, crates/audio-engine).
  - src/workers/      Web workers that use @tooscut/render-engine.

## Rules for frontend sessions
- Never modify api_server/, remotion_worker/ or manim_worker/. They are the source of truth: read them, don't change them.
- Never read, print, or create .env files. Use names-only examples in docs.
- The backend has no "list jobs" endpoint. Job history lives in IndexedDB per user.
- GET /api/jobs/:id/video answers 302 to a presigned S3 URL.

## .gitignore traps (these have already lost files once)
- The root .gitignore ignores media/, dist/, build/, out/ everywhere. Any new source folder with one of those
  names must be re-included in animation_frontend/.gitignore.
- wasm-pack writes a `.gitignore` containing `*` into its output folder. Delete it after every build, or the
  output never gets committed.
- crates/build.sh calls `wasm-pack build compositor` relative to the current directory: run it from crates/.
- Before finishing, prove nothing is missing: clone the pushed branch into a temp dir, `npm ci && npm run build`.

## Verify
cd animation_frontend && npm run typecheck && npm run lint && npm run build && npm run test:e2e
