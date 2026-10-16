# Animato Studio: design notes

Animato is a prompt-to-animation studio with a real, private, in-browser video and voice editor. The product is one
loop: **Prompt → Generate (existing backend) → Edit video and voice (client-side) → Export (client-side) → Reuse.**

This file records the architecture, the decisions behind it, the Rust crates audit, what is mocked and what is real,
and what is deferred. `PROGRESS.md` is the resumable checklist.

## 1. Architecture before the redesign (study phase)

`animation_frontend/` was the F0–F8 skeleton from `frontendplan.md`:

- **Stack and tooling:**
  - React 19, Vite 8 and TypeScript 6 with `verbatimModuleSyntax` and `erasableSyntaxOnly` (so no `enum`).
  - Tailwind v4 through `@tailwindcss/vite`, with no tokens: zinc utilities on a light theme.
  - react-router v7 `<Routes>` and oxlint.
- **API client:** `src/lib/api.ts` held the only `fetch`. It never threw, called same-origin `/api`, used a 15 s timeout and read `Retry-After` on 429.
- **Stores:**
  - `authStore` was the only caller of `/api/auth`.
  - `studioStore` was the only caller of `/api/jobs`. It polled every 2.5 s and kept jobs in `localStorage`.
- **Pages:** Landing, Login, Signup, VerifyEmail (6-box OTP), ForgotPassword, ResetPassword and Studio.
- **Guards:** PublicOnly, Verify and Protected.
- **Not yet used:** GSAP was installed but never imported. There was no Framer Motion, no tests and no mocks.

The real API, read from `api_server/src` and not modified, is the only server surface the app uses:

| Call | Shape |
|---|---|
| `POST /api/auth/signup` `{username,email,password}` | 201 `{success,message,user:{email,username,is_verified}}`, 409 exists |
| `POST /api/auth/login` `{email,password}` | 200 `{user}`, 401 "Invalid credentials" |
| `POST /api/auth/logout` | 200 |
| `POST /api/auth/verify-email` `{code}` | 200 `{user}`, 400 invalid code |
| `POST /api/auth/resend-verification` | 200, 429 |
| `POST /api/auth/forgot-password` `{email}` | 200, always the same message |
| `POST /api/auth/reset-password/:token` `{password}` | 200 |
| `GET /api/auth/check-auth` | 200 `{user + last_login, created_at}`, 401 |
| `POST /api/jobs` `{prompt (10..2000), library}` | 200 `{data:{job_id,library,status}}`, 403 unverified, 429 quota (5/h, 15/day) |
| `GET /api/jobs/:id` | `{data:{job_id,library,status,video_path,duration_seconds,file_size_bytes,render_time_ms,error_message}}` |
| `GET /api/jobs/:id/video` | 302 to a presigned URL |

`status` is one of `Pending`, `GeneratingCode`, `Rendering`, `Uploading`, `Completed` or `Failed`.

## 2. Architecture now

```
src/
  app/            router (lazy routes), AppShell (sidebar, top bar), CommandPalette, guards, ErrorBoundary, 404, OfflineBanner
  components/ui/  Button, IconButton, Field/Input/Textarea/Select, Tabs (sliding indicator), Dialog/Drawer, Menu,
                  Tooltip, Toaster, Badge/StatusChip/Tag/Kbd/Avatar/Skeleton/Progress/Ring/Switch/Slider/EmptyState
  styles/         tokens.css (Tailwind v4 @theme), base.css (fonts, utilities: glass, text-gradient, skeleton…)
  lib/api/        http.ts (fetch + zod + ApiError), auth.ts, jobs.ts, schemas.ts: the ONLY server calls
  lib/local/      IndexedDB tables (projects, media, brand kits, exports, job history) and OPFS helpers
  mocks/          MSW handlers for the real endpoints only (VITE_USE_MOCKS=true)
  stores/         session (persisted profile, revalidated), preferences, toasts
  wasm/           pkg/ (built Rust module), engine.ts (main-thread core), fallback.ts (TS twin of timeline math), stats.ts
  features/
    landing/ auth/ home/ create/ jobs/ projects/ templates/ brand/ settings/
    editor/
      model/timeline.ts      the document (tracks, media/text/caption clips, caption style, ducking)
      store.ts               zustand + undo/redo command stack (slider drags coalesce)
      engine/                workers and engine glue:
        media.worker.ts      import: OPFS, SHA-256, demux, thumbnails, PCM cache, waveform
        render.worker.ts     preview compositing + export
        stt.worker.ts        on-device Whisper
        audio.worklet.ts     real-time mixer (Rust audio engine)
        demux.ts decode.ts compositor.ts compose.ts export.ts sources.ts rpc.ts
      ui/                    Preview, Timeline, Inspector, Media/Text/Captions/Voice panels, ExportDialog…
```

Server state comes from TanStack Query. That covers the two job endpoints, and it also wraps the local IndexedDB
reads so every screen gets loading and error states for free. Client state lives in zustand.

### The editor pipeline (all in the browser)

| Stage | What runs | Where |
|---|---|---|
| Import | File streamed into **OPFS** (`media/<id>/…`), never fully in memory | UI → OPFS |
| Hash | `Sha256Stream` (Rust, `offcut-wasm-core`) over a sync access handle, used to dedupe imports | media worker |
| Demux | MP4/MOV/M4A: **Rust `offcut-mp4`** (`Mp4Demuxer`, reads OPFS through `FileSystemSyncAccessHandle`). WebM/MP3/WAV or anything the Rust demuxer refuses: **mediabunny** | media / render worker |
| Decode | **WebCodecs** `VideoDecoder` (keyframe seek + decode-forward) / `AudioDecoder` | workers |
| Thumbnails | Real frames, evenly spaced, JPEG data URLs on the asset | media worker |
| Audio cache | Decoded to interleaved stereo 48 kHz (`resample` from **offcut-dsp** when needed), stored in OPFS `pcm/<id>.f32` | media worker |
| Waveform | Mono → **offcut-dsp** resample to 8 kHz → **Rust `waveform_peaks`** (100 peaks/s) | media worker |
| Timeline ops | split / trim / ripple delete / snap / timecode in **Rust** (`animato-wasm`) | UI thread (µs-scale) |
| Fades + text animation | Keyframes evaluated by **`tooscut-keyframe`** | workers |
| Compositing | **`tooscut-compositor`** (Rust, wgpu → WebGPU) or a **Canvas2D compositor** with the same interface | render worker |
| Preview audio | **`tooscut-audio-engine`** in an **AudioWorklet**: volume, fades, EQ, noise gate, ducking keyframes, speed | AudioWorklet |
| Captions | Timeline mixed offline by the audio engine → 16 kHz → **Whisper** (transformers.js, ONNX/WASM) → **`offcut-text` `normalize_transcript`** groups words into sentence cues | STT worker |
| Export | Composite each frame → **WebCodecs `VideoEncoder`** (H.264 / VP9 / AV1) + offline audio mix → **`AudioEncoder`** (AAC / Opus) → **mediabunny** mux (MP4 / WebM) streamed into OPFS → download | export worker |

The `Rust/WASM · WebGPU · 4 ms` badge in the editor shows the active compositor and the timing of the last engine
operation. `window.__animatoEngineCalls` counts calls by category (`demux`, `decode`, `composite`, `audio`,
`encode`, `timeline`, `captions`, `dsp`), and the e2e suite asserts on those counts.

## 3. Design system

- **Tokens:** they live in `src/styles/tokens.css` (`@theme`) and only tokens are used. Tailwind's default palette is reset with `--color-*: initial`.
  - **Colours:**
    - Layers: `canvas` `#07070A`, `surface-1..4`, `glass`, `glass-strong`, `overlay`.
    - Lines: `line`, `line-strong`.
    - Text tiers: `fg`, `fg-muted`, `fg-subtle`, `fg-faint`.
    - Signature accent: violet `#8B5CF6`, cyan `#22D3EE`, magenta `#E879F9`, also available as `bg-gradient-accent` and `text-gradient`.
    - Job status: queued, planning, rendering, succeeded, failed.
  - **Type and shape:** Inter (UI), Geist (display) and JetBrains Mono (timecodes), all self-hosted via `@fontsource-variable`. There is a type scale from `2xs` to `6xl`, plus tracking, radii, shadow and glow tokens.
  - **Motion:** z-index scale, easing tokens and duration tokens.
- **Motion:** easing and duration values are mirrored in `src/lib/motion.ts` for both Framer Motion and GSAP.
  - GSAP handles the landing choreography: hero, ScrollTrigger pinned "how it works", counters, marquee and magnetic CTA.
  - Framer Motion handles UI state: route transitions, `layoutId` shared elements (create → job, gallery → dialog), tabs, dialogs, drawers, toasts and the sidebar indicator.
  - Reduced motion is respected from both the OS setting and the in-app preference (`data-reduced-motion` on `<html>`).

## 4. Crates audit

`crates/` had no workspace manifest, so nothing compiled. `crates/Cargo.toml` is now a workspace, and
`npm run wasm:build` (`scripts/build-wasm.sh`) builds a single crate, **`animato-wasm`**, that links every crate below
into one module at `src/wasm/pkg` (committed, 7.8 MB raw / 2.5 MB gzip, lazy-loaded only by the editor, its workers and
the landing demo).

| Crate | What it does | Exported API used | Used where | Status |
|---|---|---|---|---|
| `animato-wasm` (new) | Glue + editor core | `seconds_to_timecode`, `timecode_to_seconds`, `snap`, `split_clip`, `trim_clip`, `ripple_delete`, `parse_srt`, `to_srt`, `captions_from_words`, `waveform_peaks`, `keyframe_value`, `Mp4Demuxer` | Timeline, captions panel, waveforms, fades and text animation, MP4 import, landing demo | **Wired** |
| `tooscut-compositor` | wgpu GPU compositor: layers, transforms, opacity, colour, crop, glyphon text | `Compositor.from_offscreen_canvas`, `upload_bitmap`, `render_to_pixels`, `load_font`, `clear_texture` | Preview and export compositing (WebGPU) | **Wired** (wgpu 24, glyphon 0.8) |
| `tooscut-audio-engine` | Mixer: clips, tracks, fades, keyframed volume, EQ, compressor, noise gate, reverb, pitch-preserving speed | `AudioEngine` (`upload_audio`, `set_timeline`, `render`, `seek`, `set_playing`) | AudioWorklet preview, offline export mix, offline mix for captions | **Wired**. **Fixed:** `src/clip.rs` was a byte-for-byte copy of `effects/reverb.rs`; `AudioClip` reconstructed from its uses and tests (46 tests pass) |
| `tooscut-keyframe` / `tooscut-types` | Keyframe interpolation and shared types | `evaluate_keyframes` (via `keyframe_value`), `KeyframeTracks` in audio clips | Fades, text animation presets, ducking envelopes | **Wired** |
| `offcut-mp4` | MP4 demux, mux, probe | `Demuxer`, `probe` | MP4/MOV/M4A import, preview and export decode | **Wired**. **Fixed:** it only read `avcC`; it now reads `vpcC` and `av1C` and builds full VP9/AV1 codec strings (24 tests pass) |
| `offcut-wasm-core` | OPFS demuxer handle, resample, transcript, SHA-256 | `Sha256Stream`, `resample`, `normalize_transcript`, `probe_and_validate` | Import hashing (dedupe), all resampling | **Wired** (made `rlib`; start function gated) |
| `offcut-dsp` | FFT resampling (rubato) | `resample_mono` | 44.1→48 kHz, 48→8 kHz waveform, 48→16 kHz for Whisper | **Wired** (needs rubato 5; 1.x/2.x lack the API it uses) |
| `offcut-text` / `offcut-types` | Transcript normalisation, sentence segmentation | `normalize_transcript` | Auto-captions: Whisper words → sentence cues | **Wired** |
| `offcut-render`, `offcut-wasm-render`, `offcut-scene` | vello/parley caption renderer + render session | – | – | **Not linked.** Built against vello ≥ 0.6 / parley ≥ 0.7 (wgpu 26+). `tooscut-compositor` is on wgpu 24, and two wgpu copies in one module would roughly double its size. Text and captions are drawn by the compositor's glyphon renderer instead. Next step: port the compositor to wgpu 26, then link these |
| `offcut-detect` | Visual-event detection from transcripts | – | – | **Not used:** specific to the Offcut product |
| `offcut-entitlement`, `offcut-api-types` | ed25519 licence tokens, SaaS API types | – | – | **Not used:** unrelated to this app |

Other workspace fixes:
- Per-crate `#[wasm_bindgen(start)]` functions are gated behind a `start` feature, so the crates link into one module.
- `wasm-bindgen` is pinned to `=0.2.100`.

TypeScript fallback (allowed only for timeline math and compositing):
- `src/wasm/fallback.ts` mirrors the timeline functions in case the module fails to load.
- The Canvas2D compositor stands in when WebGPU is unavailable.
- There is no fallback for decode, encode, demux of MP4 (mediabunny is a real demuxer, not a fake), audio mixing or captions.

## 5. Decisions (one line each)

- **Backend frozen.** Only the auth and job endpoints are called. Everything else is local-first, in IndexedDB plus OPFS.
- **Removed:** team, billing, API keys, share links, review comments, server-side projects and server-side version history. Settings says "Team workspaces and billing are coming soon."
- **No storyboard step.** The backend takes only `{prompt, library}`. Prompt Studio options (aspect, length, style, brand kit) are folded into the prompt text, and the UI shows exactly what is sent.
- **"Enhance prompt" is a deterministic local rewrite** with a word diff. It is labelled as local; there is no server AI.
- **Job history** is a local list of job ids; each one is polled with `GET /api/jobs/:id`. The "Status feed" shows status transitions the page observed. It is not server logs, and it is labelled that way.
- **MSW mocks only the real endpoints**, with their messages, status codes, quota and the 302 video redirect. Completed jobs redirect to real VP9/Opus WebM renders in `public/media/renders/`, generated by `scripts/make-media.sh` (ffmpeg).
- **Mock switch.** Mocks are on only when `VITE_USE_MOCKS=true` (committed in `.env.development`). A plain production build talks to the real API.
- **The session cookie stays HttpOnly.** The persisted session holds only the profile, and `check-auth` revalidates it on every start.
- **WebGPU preview renders to a texture and reads back** (`render_to_pixels`). Presenting to an OffscreenCanvas surface from a worker loses the wgpu 24 device after the first frame, found and reproduced in this environment. Readback costs about 250 ms per frame under SwiftShader and a few ms on real GPUs.
- **Pixel upload:** `upload_bitmap` (copyExternalImageToTexture) is used for frames. `upload_rgba` was tried and dropped once the surface was out of the picture.
- **Export codecs.** MP4 tries H.264 first, then VP9, then AV1 (whatever WebCodecs offers), with AAC audio if encodable, else Opus. WebM uses VP9 (or AV1/VP8) with Opus. Muxing is done by mediabunny.
- **Whisper model.** `onnx-community/whisper-tiny.en_timestamped` (q8) is used because word timestamps need the cross-attention export.
- **AudioWorklet glue.** The worklet scope has no `TextDecoder`, so a tiny UTF-8 polyfill loads before the wasm-bindgen glue. The compiled `WebAssembly.Module` is posted from the page.
- **Colour token renamed.** The colour token is called `canvas`, not `base`, because `text-base` would otherwise also set a colour.
- **Route transitions** use `AnimatePresence mode="popLayout"` so cross-route `layoutId` morphs work.
- **Linting.** oxlint is kept and ESLint and Prettier are added; `npm run lint` runs all three with zero warnings allowed.
- **Playwright browser.** Playwright uses its own Chromium (`channel: 'chromium'`), started with flags for SwiftShader WebGPU, autoplay and a fake microphone. `PW_CHROMIUM_PATH` overrides the binary.
- **Long screenshots** (landing, pricing on phones) are saved in parts, because headless Chromium repeats tiles past about 8k px.
- **Pricing on phones** shows tier tabs and a list instead of the wide table: Chromium's mobile layout viewport grew to fit the table even inside `overflow-x: auto`.
- **`npm install` and onnxruntime-node.** `@huggingface/transformers` pulls in `onnxruntime-node`, whose postinstall downloads binaries. The browser build does not need them. In an offline environment, use `npm install --ignore-scripts`.

## 6. Mock vs real

| Area | Real | Mocked / local |
|---|---|---|
| Auth | Real endpoint shapes and messages | MSW answers them in mock mode; verification code is `123456`; demo account `demo@animato.dev` / `animato-demo` |
| Jobs | Real endpoints, polling, 302 video | MSW simulates the pipeline timing (`animato:mock-speed` in localStorage speeds it up for tests); prompts containing the word "fail" fail |
| Videos from jobs | Real files (VP9/Opus WebM) | Pre-rendered samples stand in for Manim/Remotion output |
| Editor, voice, captions, export | 100% real, in the browser | – |
| Projects, media, brand kits, templates, export history | Local-first (IndexedDB, OPFS, bundled JSON) | Nothing on a server |

Switch to the real backend: set `VITE_USE_MOCKS=false` (e.g. in `.env.development.local`) and run `api_server` on
`VITE_API_TARGET` (default `http://localhost:5000`). The Vite proxy keeps `/api` same-origin.

## 7. Deferred / next steps

- **Link `offcut-render` / `offcut-scene`:** after porting `tooscut-compositor` to wgpu 26 so both share one wgpu.
- **Optimise the WASM module:** run `wasm-opt -Oz`. The installed binaryen is older than the features Rust 1.97 emits; with a current binaryen this should cut the module substantially.
- **Long sources:** whole-file PCM is cached per asset, which is fine for clips of minutes, not hours. The audio engine already supports windowed sources (`create_windowed_source`) for streaming.
- **More WebGPU outputs:** zero-copy WebGPU preview (surface present) once the worker/OffscreenCanvas device loss is fixed upstream, and true multi-video-track compositing tests on real GPUs.
- **Text-to-speech voiceover** (Piper/Kokoro): not shipped.
- **Transcript-based editing** (delete words → cut media): not shipped. Captions are editable cues only.
- **More import formats:** MKV/MOV with codecs the browser cannot decode are rejected with a clear error; there is no software decoder.
- **Shared-element morph:** the create → job morph depends on both cards being mounted during `popLayout`. On slow networks it falls back to a fade.
