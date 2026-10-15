# Animato Studio: design notes

## 1. Architecture before the redesign (study phase summary)

`animation_frontend/` was the F0–F8 skeleton from `frontendplan.md`:

- React 19 + Vite 8 + TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`: no `enum`), Tailwind v4 through
  `@tailwindcss/vite` with no tokens (zinc utilities, light theme), react-router v7 `<Routes>`, oxlint.
- `src/lib/api.ts`: the only `fetch`; never throws; same-origin `/api`, 15 s timeout, reads `Retry-After` on 429.
- `src/store/authStore.ts` (the only caller of `/api/auth`) and `src/store/studioStore.ts` (the only caller of
  `/api/jobs`, polling every 2.5 s, jobs kept in `localStorage` per user because the API has no list endpoint).
- Pages: Landing, Login, Signup, VerifyEmail (6-box OTP), ForgotPassword, ResetPassword, Studio (chat + current
  video + asset bin). Guards: PublicOnly / Verify / Protected.
- GSAP was installed but unused; no Framer Motion, no tests, no mocks.

The real API (read from `api_server/src`, not modified):

| Call | Shape |
|---|---|
| `POST /api/auth/signup` `{username,email,password}` | 201 `{success,message,user:{email,username,is_verified}}`, 409 exists |
| `POST /api/auth/login` `{email,password}` | 200 `{success,message,user}`, 401 "Invalid credentials" |
| `POST /api/auth/logout` | 200 |
| `POST /api/auth/verify-email` `{code}` | 200 `{user}` |
| `POST /api/auth/resend-verification` | 200, 429 |
| `POST /api/auth/forgot-password` `{email}` | 200, same message always |
| `POST /api/auth/reset-password/:token` `{password}` | 200 |
| `GET /api/auth/check-auth` | 200 `{user + last_login, created_at}`, 401 |
| `POST /api/jobs` `{prompt (10..2000), library}` | 200 `{data:{job_id,library,status}}`, 403 unverified, 429 quota |
| `GET /api/jobs/:id` | `{data:{job_id,library,status,video_path,duration_seconds,file_size_bytes,render_time_ms,error_message}}` |
| `GET /api/jobs/:id/video` | 302 to a presigned S3 URL |

`status` ∈ `Pending | GeneratingCode | Rendering | Uploading | Completed | Failed`.

## 2. Crates audit

`crates/` had no workspace manifest, so none of it compiled. A workspace (`crates/Cargo.toml`) now builds the
subset the app uses, and one new crate, `animato-wasm`, is the single module the app loads.

| Crate | What it does | Exported API (wasm-bindgen) | Used by | Decision |
|---|---|---|---|---|
| `animato-wasm` (new) | Editor core: timecode, snapping, split/trim/ripple on a JSON timeline, SRT parse/write, captions from timed words, waveform peaks, resampling, keyframe values, GIF encoder | `seconds_to_timecode`, `timecode_to_seconds`, `snap`, `split_clip`, `trim_clip`, `ripple_delete`, `parse_srt`, `to_srt`, `captions_from_words`, `waveform_peaks`, `resample`, `keyframe_value`, `GifWriter`, `engine_version` | Editor (timeline, captions, inspector fades, export), landing WASM demo | **Wired** |
| `types` (tooscut-types) | Shared types: easing, keyframes, colors, transforms | `Color`, `CubicBezier`, easing enums | Through `keyframe` | **Wired** (dependency) |
| `keyframe` (tooscut-keyframe) | Keyframe interpolation (linear/step/bezier easing) | `evaluate_track`, `KeyframeEvaluator` | `keyframe_value` → clip fade in/out and overlay animation in preview and export | **Wired** |
| `offcut-types` | Offcut domain types (units, transcript, ids) | none | Through `offcut-text`, `offcut-dsp` | **Wired** (dependency) |
| `offcut-text` | Transcript normalization + sentence segmentation | none (pure Rust) | `captions_from_words` → editor "Auto-caption" | **Wired** |
| `offcut-dsp` | FFT resampling (rubato) | none (pure Rust) | `resample` → waveform generation for the audio track | **Wired** (needed rubato 5; see decisions) |
| `compositor` (tooscut) | wgpu GPU compositor (layers, text, LUTs) | `Compositor` | – | **Deferred**: needs WebGPU; headless CI and many browsers lack it. The 2D canvas compositor in `src/features/editor/render.ts` covers the editor's needs |
| `audio-engine` (tooscut) | Real-time mixer with effects and time-stretch | `AudioEngine` | – | **Deferred**: needs an AudioWorklet host and real audio sources; generated videos are silent in the mock. Volume/fades live in the timeline model |
| `offcut-mp4` | MP4 demux/mux/probe | none | – | **Deferred**: only useful with WebCodecs encode; GIF export ships first |
| `offcut-wasm-core` | OPFS demuxer, resample, transcript, sha256 | many | – | **Deferred**: built around `FileSystemSyncAccessHandle` for user-uploaded footage, which this product does not take yet. Its resample + transcript functions are reused through `animato-wasm` |
| `offcut-wasm-render`, `offcut-render`, `offcut-scene` | vello/wgpu captions renderer + render session | many | – | **Deferred**: WebGPU, plus a pipeline for talking-head footage, not generated animation |
| `offcut-detect` | Visual-event detection in transcripts | none | – | **Deferred**: product-specific to Offcut |
| `offcut-entitlement`, `offcut-api-types` | ed25519 licence tokens, SaaS API types | – | – | **Not used**: unrelated to this app |

Real vs fallback: `src/wasm/engine.ts` loads `src/wasm/pkg` (the real build, committed). If it fails to load,
`src/wasm/fallback.ts` implements the same interface in TypeScript and the UI badge says "TS fallback" instead of
"Rust/WASM". Heavy work (export, waveform) runs in `src/wasm/engine.worker.ts`.

## 3. Decisions (one line each)

- Branch `feat/ui-redesign-studio`, as asked.
- `crates/Cargo.toml` workspace added; `rubato` pinned to 5 because `offcut-dsp` uses its newer `audioadapter` API.
- `wasm-bindgen --target web` output needs no Vite plugin (Vite resolves `new URL('*.wasm', import.meta.url)`), so
  `vite-plugin-wasm`/top-level-await were not added.
- `src/wasm/pkg` is committed so `npm install && npm run dev` works without Rust.
- Mocks are on only when `VITE_USE_MOCKS=true` (set in the committed `.env.development`); a plain production build
  talks to the real API. The nested `.gitignore` re-includes `.env.development` and `.env.example`, which the repo
  root ignores.
- Kept oxlint (already used) and added ESLint + Prettier, all run by `npm run lint`.
- Playwright uses the preinstalled Chromium at `/opt/pw-browsers` instead of downloading browsers.
