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

`crates/Cargo.toml` is a workspace; `npm run wasm:build` (`scripts/build-wasm.sh`) builds one crate, **`animato-wasm`**,
that links every crate below into one module at `src/wasm/pkg` (committed, lazy-loaded only by the editor, its workers
and the landing demo).

### 4.1 Versions after P5 (plan 8.2, measured)

| | Before P5 | After P5 |
|---|---|---|
| wgpu | 24.0.5 (compositor, with glyphon 0.8 / cosmic-text 0.12) | **30.0.1**, one copy, shared by the compositor and Vello |
| Vello | not linked (`offcut-render` needed ≥ 0.6) | **0.11.0** (newest on crates.io): `offcut-render`'s Vello backend compiled with **no edits** |
| parley | not linked | **0.12.0**; two one-line API edits (`NormalizedCoord::to_bits`, `Run::font_metrics`) |
| peniko / skrifa / kurbo | – | 0.6.1 / 0.44.0 / 0.13.1 (one skrifa for Vello and parley) |
| wasm-bindgen / js-sys / web-sys | =0.2.100 / =0.3.77 / =0.3.77 | =0.2.129 / =0.3.106 / =0.3.106 (wgpu 30 needs js-sys ≥ 0.3.85; CLI pinned to match in `build-wasm.sh`) |
| `animato_wasm_bg.wasm` | 8,129,390 B raw, **2,499,923 B gzip -9** | 5,508,437 B raw / 1,390,167 B gzip before wasm-opt; **3,403,744 B raw / 1,205,321 B gzip -9** after `wasm-opt -Oz` (binaryen 132, budget 4.5 MB) |

Step 1 of 8.2 found W = 30 without trying older Vello releases: the newest one already compiled the backend, so no
release had to be ruled out and decision D1 never arose. The module got smaller because glyphon's text stack and
wgpu's WebGL backend left; Vello, parley and the graphics crates cost less than that. Fonts are not in the module.

### 4.2 Crates

| Crate | What it does | Used where | Status |
|---|---|---|---|
| `animato-wasm` | The one browser module: timecode, snap, SRT, `captions_from_words`, `waveform_peaks`, `Mp4Demuxer`, `register_font`, `GraphicsScene`, `FrameRenderer`, `parse_graphics_doc` | Everywhere in the editor | **Wired**. P5 removed `split_clip`, `trim_clip`, `ripple_delete`, `keyframe_value` (unused since edits moved to render-engine in P4) |
| `animato-graphics` (new, from `offcut-scene`) | Graphics document → scene → `frame_at(t)` → `{under, over}` display lists; parley layout; runtime font registry; caption chunking and highlight; safe area | Preview and export (both backends) | **Wired**. 16 tests: JSON round trip, determinism, 540 vs 1080 scaling, safe-area containment in three formats, snapshots per format (`snapshots/*.json`), budgets |
| `animato-overlay` (new, from `offcut-render/src/vello_backend.rs`) | Draws a display list with Vello into a texture | `FrameRenderer` | **Wired**: fills (solid, linear, radial), paths, strokes, glyph runs, images, blurred rounded rects, clip/opacity layers |
| `tooscut-compositor` | Video layers: transforms, opacity, colour grading, crop, transitions, shapes, lines | `FrameRenderer` | **Ported to wgpu 30.** No surface, no text (glyphon, cosmic-text and `text.rs` removed), draws Vello's `under`/`over` textures; device and queue are passed in. `RenderFrame.text_layers` is still accepted (render-engine's contract) and not drawn |
| `tooscut-audio-engine` | Mixer: clips, fades, keyframed volume, EQ, gate, compressor, reverb, speed | AudioWorklet preview, export mix | **Wired** (unchanged) |
| `tooscut-keyframe` / `tooscut-types` | Keyframes, shared types | Audio engine, compositor | **Wired** (a types test fixture was missing a field and did not compile; fixed) |
| `offcut-mp4`, `offcut-wasm-core`, `offcut-dsp`, `offcut-text`, `offcut-types` | Demux, OPFS, resampling, transcript normalisation | Import, waveforms, auto-captions | **Wired** (unchanged) |
| `offcut-scene`, `offcut-render`, `offcut-wasm-render` | Source material | – | **Not members.** Animato's graphics crates descend from them (plan 8.3) |
| `offcut-detect`, `offcut-entitlement`, `offcut-api-types` | Offcut product code | – | **Not used** |

### 4.3 Licences

- Vello, parley, peniko, kurbo, fontique, skrifa, wgpu: Apache-2.0 OR MIT; harfrust (parley's shaper): MIT (read
  from each crate's `Cargo.toml`).
- Fonts: `public/fonts/LICENSES.md`. Inter, JetBrains Mono, Noto Emoji, Geist: SIL OFL 1.1; DejaVu Serif: Bitstream
  Vera licence with public-domain DejaVu changes. The repo's earlier DejaVu Serif file had no recorded source and did
  not match upstream 2.37; it was replaced by the npm `dejavu-fonts-ttf@2.37.3` copy. The static Inter OTFs left.
- **`tooscut-*` crates, `offcut-*` crates and `packages/render-engine`: no licence.** None has a `license` field, a
  `repository` field or a LICENSE file, and the repo does not record where they came from. That is a blocker for a
  commercial launch until the owner confirms their origin and terms (plan 18.1, D4; building continues meanwhile).

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


### Plan v2 decisions

- **P0 · Root CLAUDE.md.** Renamed `claude.md` to `CLAUDE.md`, because Claude Code only auto-loads the upper-case name on case-sensitive file systems.
- **P0 · Branch.** Work happens on `feat/frontend-v2` as the owner's prompt asks; one draft PR into `main`.
- **P0 · Media import path.** Rebuilt imports write originals to `media/<id>.<ext>` (flat), because `removeFile` deletes single files and the Settings purge clears the `media` directory as a whole.
- **P0 · Import dedupe.** A re-import with the same owner and SHA-256 deletes the new copy and returns the existing asset (keeping a job link if the new import has one), because the worker hashes after the copy.
- **P0 · Worklet WASM hand-off.** The host posts the compiled `WebAssembly.Module`; on `messageerror` it re-sends the raw bytes and the worklet compiles them, because the sandbox Chromium (build 1194) refuses to clone a module into an AudioWorklet and the mixer silently never started.
- **P0 · Worklet errors.** Init failures are posted back as `{ type: 'error' }` and reject at once instead of waiting for the 8 s timeout.
- **P0 · Unwired modules excluded.** `packages/` and `src/workers/` are excluded from tsc, ESLint, oxlint and Prettier until P4 wires or deletes them, because they cannot compile before the workspace exists. One oxlint warning in `video-frame-loader.ts` was fixed since its nested `.oxlintrc.json` ignores the root ignore list.
- **P0 · Sandbox install.** The setup hook runs `npm ci --ignore-scripts` and never `playwright install`; `playwright.config.ts` uses `/opt/pw-browsers/chromium` when present.
- **P1 · Mocks off.** `.env.development` sets `VITE_USE_MOCKS=false`; only `npm run build:mocks` (now `cross-env`) turns MSW on, and `dist/` from `npm run build` contains no MSW code (grepped).
- **P1 · vitest.** Added with its own `vitest.config.ts` (node environment, `src/**/*.test.ts`), because the pure units need no browser and the Vite config carries app-only plugins.
- **P1 · Contract fixtures.** `contract.test.ts` holds literal bodies from the Rust handlers, plus `request()` error-envelope cases with a stubbed `fetch`; stubbing in a unit test is not a dev-run mock.
- **P1 · Error mapping.** `lib/api/errors.ts` is pure and owns every user-facing failure string from plan 11.4; the 400 prompt-length text is the only server message shown verbatim, because other 4xx texts (axum rejections) mean nothing to a user.
- **P1 · Polling.** `lib/api/polling.ts` holds the schedule; `useJob` keeps one poll state per job id in a module map so every screen shares the counters, uses `refetchIntervalInBackground` so the 15 s hidden-tab interval actually runs, and sets `retry: false` so failures count once per poll.
- **P1 · Lost track.** `lost` is computed inside the query function after each poll (not during render, which would make the hook impure); the poll that crosses the 8-failure or 45-minute limit re-renders with it.
- **P1 · Observed statuses.** Each status change is appended to the job record (`observed: { status, at }[]`, ms epoch), the data the P3 render view needs for stage timings and the "fixing" stage.
- **P1 · 429 wait.** The `Retry-After` deadline lives in a small zustand store mirrored to localStorage, so Generate stays disabled with a countdown across reloads.
- **P1 · 401/403 on create.** 401 sends the user to `/login?next=…`; 403 re-runs check-auth and goes to `/verify-email`.
- **P1 · Import failure.** A failed OPFS import keeps the `<video>` player (it needs no CORS), shows "Couldn't load the video for finishing.", Retry import, and a dev-only hint pointing at `LOCAL_DEV.md`. The full `ready-remote` state lands with the video page in P6.
- **P1 · Mock fidelity.** MSW messages now match the server (`Unauthorized`, `Not authenticated`, the forgot-password text). `[e2e:500]`, `[e2e:422]`, `[e2e:timeout]` and `[e2e:importfail]` markers in a prompt reach the 11.4 rows; the import failure keys on `request.mode !== 'no-cors'`, which is exactly the request S3 CORS governs.
- **P1 · Free SMTP.** `LOCAL_DEV.md` recommends Mailpit (the mailer's no-credentials mode), with Gmail app passwords or a free transactional tier as real-inbox options.
- **P2 · D3 accent.** Owner chose calm blue `#2F7BF6` (accent for text, focus, selection, progress: 4.98:1 on canvas). Primary button fills use deeper steps of the same hue (`accent-fill #2A6FE0`, hover `#2668D6`, pressed `#2160CC`), because white on `#2F7BF6` is 3.97:1 and fails AA for 14 px labels.
- **P2 · D2 brand.** Owner chose "Animato" with a `SITE_URL` constant (defaults to the current origin until a domain exists); the constant lands with remix links in P3.
- **P2 · Legacy look removed at the token level.** The violet/cyan/magenta tokens, `--gradient-accent`, `glass`, `grid-bg`, `text-gradient` and the glow shadows no longer exist, so any leftover class renders nothing. App code was swept; landing and auth are rebuilt in P3.
- **P2 · Translucency.** Only the top bar after scroll (`bar-blur`: 72% surface + `saturate(180%) blur(20px)`); dialogs, menus, palette and toasts are solid surfaces.
- **P2 · Status chips.** Dot + label in the status colour, no fill; the live dot pulses softly instead of pinging. Status colours desaturated about 15%.
- **P2 · Status words.** Chip and stage labels say what the server state means: Writing (GeneratingCode), Rendering, Finishing (Uploading), replacing "Planning scenes" and "Encoding", which described work the worker does not report separately.
- **P2 · No estimate.** The job page's "Time left ≈" and its progress bar were removed: the numbers came from fixed guesses (`TYPICAL_SECONDS`), not the server. The card now shows real elapsed time; the median-based hint arrives with the P3 render view.
- **P2 · Timeline lanes.** Four low-chroma lane tokens (`track-video/audio/voice/text`) replace the accent colours on clips; the playhead uses the accent.
- **P2 · Token gate.** `scripts/check-tokens.mjs` (part of `npm run lint`) fails on hex/rgb/hsl literals outside `tokens.css`, `features/brand/` (the user's colours) and `features/editor/` (colours drawn into the video).
- **P2 · Video = Project.** `Project` gains optional `takes`, `selectedTake`, `format`; the IndexedDB store keeps its name. Every created job creates or extends a video; another take goes to the same video and the page follows the selected take.
- **P2 · Routes.** `/app` Videos, `/app/new` Create, `/app/v/:id` (simple mode, `?mode=timeline` opens the editor on the same record), redirects for every old route; `/app/jobs/:id` finds or creates the owning video.
- **P2 · Removed screens.** Projects (search, tags, bulk actions, project-file import/export) and Templates pages are gone, because the plan has one object and starters inside Create. Media and export clean-up moved to Settings → Storage. Project-file import/export is not in the plan and was dropped.
- **P2 · Starters without video.** The bundled `public/media/renders` clips are ffmpeg test patterns (`scripts/make-media.sh`), not Animato renders, so starters show the prompt only. `starters.ts` has an optional `video` field for real renders once the owner makes them.
- **P2 · Card posters.** Ready videos without a stored thumbnail load the render at 1 s (`preload="metadata"`) and capture a 384 px JPEG into the record when the canvas is not tainted (needs the S3 CORS rule); otherwise the paused `<video>` is the poster. 9:16 and 1:1 videos sit on a blurred, dimmed copy of their own frame inside a 16:9 tile, so the grid keeps one rhythm.
- **P2 · Grid virtualisation.** Cards past 60 get `content-visibility: auto` with an intrinsic size, which skips off-screen layout and paint without a windowing library.
- **P2 · Finished takes are not polled.** A take's terminal status is stored on the video (`take.status`), so the grid polls only running jobs.
- **P2 · Cross-tab.** Video writes post to a `BroadcastChannel('animato:videos')`; the grid refetches on any message (e2e: a video created in another tab appears within 2 s).
- **P2 · Server banner.** `request()` fires `server-unreachable`/`server-reachable` window events; the banner checks `check-auth` every 5 s and refreshes all queries once any JSON answer arrives.
- **P2 · Error boundary.** "Copy details" copies only `name: message` and the stack.
- **P2 · 404.** One line and a link home, as specified; no illustration.
- **P2 · Preferences.** Density, sidebar and editor-fps preferences were removed (no sidebar; the editor never read fps). Added default format (9:16 for first-time users), default look and notifications.
- **P2 · Own clip.** The command palette's "Start from my own clip" creates an empty video and opens its timeline: the honest entry point until P8's "Import a clip".
- **P2 · Title derivation.** `titleFromPrompt` drops a leading verb and article, keeps the first clause, caps at 6 words and 32 characters, trims a dangling connector, and uses Title Case with small words lower-case. Unit-tested; P6 reuses it.
- **P2 · Toasts** sit bottom centre and dismiss after 4 s (errors 7 s so they can be read).
- **P2 · axe.** `@axe-core/playwright` runs on Videos (empty and filled), the video page, Settings, Create and 404 with reduced motion emulated, so contrast is measured on settled content. No serious or critical violations.
- **P3 · Landing rebuilt** to plan 6.1's ten sections. Removed: testimonials, logo strip, use cases, editor spotlight, showcase, comparison table, the WASM demo (not in the plan's section list) and the $49/$2,000/Enterprise tiers.
- **P3 · No fake renders.** The bundled sample clips are ffmpeg test patterns, so the landing shows product illustrations drawn in the page (a sine scene re-laid out 16:9 → 9:16 → 1:1 with a title and word-highlighted captions, the stage list, a caption line) and labels the hero figure as an illustration. `content.ts` has `SITE_MEDIA` slots for real Animato renders.
- **P3 · Old auth brand panel removed.** It played an ffmpeg clip captioned as a Manim render ("mandelbrot_zoom.py · Manim · Rendered"), an invented fact.
- **P3 · OAuth buttons removed.** "Continue with Google/GitHub (coming soon)" advertised something that does not exist.
- **P3 · GSAP removed.** Framer Motion's `whileInView` covers the landing's reveals, so GSAP (and its non-OSI licence) is gone. Reveals render statically under reduced motion.
- **P3 · Claims audit.** The landing claims export formats, local captions and voice, which the shipped editor does. It does not claim watermark, end card, looks or one-click formats until P6 ships them. An e2e test bans "testimonial", "4K", "ETA", "trusted by", old prices and "annual" on `/` and `/pricing`.
- **P3 · Footer.** Terms read "published before launch". The contact email comes from `VITE_CONTACT_EMAIL` and is hidden when unset, so no address is invented.
- **P3 · Auth layout.** One centred 400 px card, wordmark above, a legal line below. The same `SignupForm`/`LoginForm` render in the page and in the landing sheet (`AuthSheet`). Switching between them carries the typed email.
- **P3 · Password rule.** A quiet "8 to 72 characters" line ticks green once met. The strength meter is gone, because the server has no strength rule.
- **P3 · Verify.** Resend starts on a 60 s countdown (a code was just sent), "Check your spam folder" appears after 30 s, and 5 wrong codes show "This code is locked. Send a new one."
- **P3 · Reset.** A malformed token shows "This link is not valid" with no request. Success replaces history with `/login` and shows the toast from the plan.
- **P3 · Pending prompt** is JSON `{ prompt, engine }` in sessionStorage. After signup+verify or login it becomes a drafting video. Only the first one in a browser auto-starts (3 s Cancel); later ones wait for Generate (flag `animato:auto-started:<email>`).
- **P3 · Draft state.** A refused job keeps the draft with its mapped error, and a 429 also blocks Generate with the countdown.
- **P3 · Create.** Options are Length (Short ~10 s, Medium ~20 s, Long ~45 s) and Style (Clean, Bold, Playful, Technical), remembered in localStorage, plus "Use my brand colours" shown only when a kit exists. The server prompt carries no aspect. "Tidy up my prompt" rewrites inline with Undo; the diff dialog is gone. Starters are horizontal cards and fill the prompt and engine.
- **P3 · Engine reason.** Auto's choice is explained in a line under the control ("Picked Explainer because you mentioned 'derivative'") instead of a tooltip, so it works on touch.
- **P3 · Render view.** Stages with real elapsed time per stage, a shimmer on the active one only, and "Fixing a render error" when `GeneratingCode` follows `Rendering`. "Usually takes about N min" appears only after 3 renders of that engine watched from Pending to Completed (median). There is no percentage.
- **P3 · Wait actions.** Inline brand kit (logo and two colours) and "Draft your next idea", which starts another video without leaving the page.
- **P3 · Notifications.** Offered once, after a render has started, as a text button. A system notification fires only if the tab is hidden, the preference is on and permission is granted. Tab titles: "Rendering… · Animato", "✓ Ready · Animato", "Didn’t render · Animato".
- **P3 · Prefetch.** On Completed the render is imported into OPFS and placed on the video's timeline, so Open in editor is instant. A failed import shows the ready-remote fallback.
- **P3 · Ready video** autoplays muted, with the player's mute state matching.
- **P3 · Entitlements and SITE_URL.** `getEntitlements()` returns the early-access free plan. `SITE_URL` is `VITE_SITE_URL` or the current origin (D2).
- **P3 · Analytics seam.** `track()` writes to an in-memory ring buffer (and `console.debug` in dev). Props never include prompt text or email.
- **P3 · Remix links.** `?prompt=` and `?engine=` are sanitised (trim, 2,000 cap, control characters stripped, engine allow-list) on the landing page and in Create.
- **P3 · Budgets (measured, not met).** Landing initial JS is about 194 KB gzip (index 42.6 + react 96.2 + motion 50.3 + page 5.4) against a 170 KB budget. Motion is the lever (lazy `LazyMotion` or CSS-only reveals); recorded for P11. Lighthouse cannot run in the sandbox (not installed, no download), so LCP/CLS/score are unmeasured.
- **P4 · Workspace.** `animation_frontend` is an npm workspace root (`packages/*`). `@tooscut/render-engine` exports its TypeScript source (`./src/index.ts`, compiled by Vite and `tsc -b`, no `dist/`) and is covered by the app's lint, Prettier and vitest. `pnpm`/`catalog:` specifiers, tsdown and oxfmt are gone.
- **P4 · One WASM build.** The package imports `animato-wasm`, a Vite/TS alias for `src/wasm/pkg/animato_wasm.js`, so no second compositor or audio-engine build exists (plan 18.2). `crates/build.sh` and the package's `wasm/` are no longer needed for the app.
- **P4 · Measured (docs/engine-bench-p4.json, Chromium 156, SwiftShader, sandbox CPU).** 20 seeded random seeks and 30 sequential frames per file, plus 2 waveforms and a 60 s mix of a 300 s source:
  | Responsibility | Editor engine | render-engine / src/workers | Winner |
  |---|---|---|---|
  | Frame loading, clip.mp4 | random median 10.3 ms (p95 76.3), sequential 0.8 ms | random 12.6 ms (p95 22.4), sequential 14.6 ms, **fails at t=0** | editor (`decode.ts`), 18× faster on the sequential (export and playback) pattern |
  | Frame loading, clip.webm | random 10.3 ms (p95 49), sequential 0.7 ms | random 12.8 ms (p95 26.1), sequential 12.2 ms | editor |
  | Waveform, speech.webm / tone.wav | 86 / 32 ms, 100 peaks/s, PCM cached as a by-product | 104 / 63 ms, ~37 bars/s | editor media worker |
  | Export audio, 60 s from a 300 s source | 1,664 ms, 115 MB decoded PCM (heap +338 MB) | 794 ms, 30 s windowed buffer (11.5 MB) | **audio-render worker** (merged as `engine/audioRender.ts`, used by export) |
- **P4 · Audio playback.** The editor's AudioWorklet host (`audio-preview.ts`) is kept, so there is one worklet and the same Rust engine. Render-engine's `BrowserAudioEngine` and worklet duplicated it and were deleted. Known cost from the measurement above: preview uploads a source's full cached PCM (≈ 23 MB per minute of stereo), which is fine for clips of minutes but not hours. Switching preview to windowed sources (the engine supports `create_windowed_source`) is recorded for P11.
- **P4 · Removed** (nothing left orphaned): `src/workers/` (compositor, frame-renderer, audio-render, waveform workers and their APIs). From the package: `compositor.ts`, `audio-engine.ts`, `worklet/`, `video-frame-loader.ts`, the vitest-browser `testing/` utilities, the browser tests and their 16 MB of screenshots. The bench harness ran at `31fdc72` and was removed with the losers. `comlink` was installed for the bench only.
- **P4 · Package tests.** `clip-operations`, `cst` and `frame-rate` (node) run under the app's vitest; three fixtures were completed with the `CrossTransitionRef` fields the type now requires. Browser pixel tests move to Playwright against animato-wasm in P5 (plan 8.10), instead of the package's vitest-browser harness, which needed its own WASM build.
- **P4 · Timeline v2 document.** Tracks are render-engine track pairs (main video+music, voice video+voice) with a `role` and `hidden`; media clips are render-engine `EditableClip`s in integer frames at the timeline fps, so the engine's sorted-clip ops (add, split, trims, move, move-to-track) are used directly. `inPoint` is corrected for clip speed in `model/ops.ts`, since the engine assumes speed 1.
- **P4 · Titles and captions are graphics items, not clips** (plan 8.4): titles are timed in seconds in `extraGraphics`; the captions item has only a style and reads the Video's transcript. They draw as temporary compositor text layers until Vello takes them over in P5.
- **P4 · Transcript on the Video** (plan 9.2). Whisper word timestamps go straight in; the Rust normalizer (`captions_from_words`) marks sentence ends with `breakAfter`. SRT cues become words spread across each cue, with a break after each cue, so an SRT round trip keeps its lines. Chunking (`chunkRanges`) is max words per line or a break, whichever comes first; editing a line with a different word count re-spreads only that line.
- **P4 · v1 migration.** Opening a v1 project migrates it (`migrateTimeline`), saves it as v2, and keeps the v1 document in `timelineV1Backup`; text clips become titles, caption clips become a transcript plus the captions item. `e2e/migrate.spec.ts` seeds a real v1 record, then checks the lanes, the stored v2, the backup and playback.
- **P4 · Timeline lanes.** Top to bottom: Titles, video tracks, Captions (read-only chunks: clicking seeks, edits go through the Captions panel so word times stay intact), Voice, Music & audio. The voice pair's empty video half is not drawn.
- **P4 · Export no longer re-fps's the timeline.** v1 export spread `{...timeline, fps}` to set the output rate; with frame-based clips that would shift every clip, so the output fps is passed separately.
- **P5 · One device, two renderers** (plan 8.1). `FrameRenderer` (animato-wasm) owns one WebGPU device: Vello draws `under` and `over` into two textures, the compositor clears to the background, draws `under`, the video layers, then `over` (premultiplied blend of Vello's straight-alpha output), and the frame is read back. A list with nothing in it is not drawn. Preview and export use the same renderer at their own size.
- **P5 · Readback kept** for preview and export. The worker no longer has a surface at all; presenting to an OffscreenCanvas was not re-tried on wgpu 30 (plan 8.2 step 4 asks for it): recorded as not verified.
- **P5 · Readback latency.** The old readback waited through ten `setTimeout` yields per frame; it now awaits the map callback, which WebGPU resolves itself. The readback buffer is also re-made on resize (it was made once, at the first size).
- **P5 · Calls into the renderer are queued** in `GpuCompositor`: `render` holds the Rust object across an await, and a `set_graphics` or `resize` arriving meanwhile made wasm-bindgen throw "recursive use of an object" (seen in the WebGPU e2e).
- **P5 · Units of the graphics document.** Times in seconds; boxes as fractions of the canvas; lengths in design pixels where the short side is 1080, so one document draws the same at 1280×720 preview and 1920×1080 export. The document's canvas is the size frames are drawn at, not the timeline's (a 1920 document on a 1280 preview drew the title 1.5× off, caught by `e2e/graphics.spec.ts`). Title sizes are now short-side pixels; a 9:16 title is 1.78× smaller than under P4's height-based rule, which made vertical titles overflow.
- **P5 · Fonts load at run time**, not embedded: the app fetches `public/fonts/*.ttf`, registers each with animato-graphics and with `FontFace` under the family name the file reports. Inter is always loaded; Noto Emoji (2 MB) only when some text has a pictograph. A family is matched exactly or without its "Variable" suffix. Inter, Geist, JetBrains Mono and DejaVu Serif all render in video now; "System serif" draws as DejaVu Serif.
- **P5 · Captions chunk like the app's list**: at most `maxWords` words and a break after a `breakAfter` word; Rust also ends a chunk before a third line. The highlight colour (`#ffd60a`) is applied when the captions item asks for word highlight.
- **P5 · Safe area.** Titles, captions and the watermark are clamped into it: on a vertical canvas the insets of offcut-scene's layout (250 top, 420 bottom, 60 left, 120 right at 1080×1920), elsewhere 5% each side.
- **P5 · Canvas2D fallback draws the same display lists** (`graphics/draw2d.ts`) from a GPU-free `GraphicsScene`. Glyph runs are drawn as text at parley's positions, so words land where Vello puts them; inside a word the browser's own advance applies, and word gaps can look slightly wider than Vello's (see `screenshots/graphics-title-*.png`). Group opacity is approximated per draw. `e2e/graphics.spec.ts` holds the two within 3% of the canvas in position and 15% in size.
- **P5 · Device loss** switches the worker to Canvas2D and rebuilds the graphics, instead of showing an error.
- **P5 · Removed** with nothing left orphaned: glyphon, cosmic-text and the compositor's `text.rs`; its unused colour-grading shader module and helpers; the surface constructors and wasm-bindgen API of `Compositor` (it is a Rust type inside `FrameRenderer` now); the static Inter OTFs; `captionAt` (Rust draws captions); the TS text-layer path in `compose.ts`.
- **P9 · Edit plans compile to the same commands the UI uses** (plan 13.3–13.5). `plan/schema.ts` validates EditPlanV0 with zod (strict objects: unknown keys are errors, so a model's typo is caught, not ignored). `plan/compile.ts` is pure: labels match without case; word anchors read the transcript; times clamp to the media; "keep" ranges rebuild the main clip and later anchors are mapped through the cut; cutaways go on the B-roll track silent with the main clip's framing, overlays small in a corner. What is not built yet (zoom transitions, word emphasis, looks before Finish) is a warning, never a guess. The store runs the result as one step, "AI edit: <summary>", so one Undo reverts it (unit and e2e).
- **P9 · The harness ships only where it is needed:** `?dev=plan` mounts it in development and in the e2e build; the production bundle does not contain it (checked by grepping `dist/`). No Assistant tab placeholder is rendered (plan 13.6).
- **P8 · Asset roles live on the Video, outside undo** (plan 3.3, 13.2): `Project.assets` holds `{assetId, role, label, note}`. Labels are given once ("Main", "Clip 1", "Clip 2", "Music", "Voice") and never renumbered, because the user and later the assistant name clips by them. The store keeps them in step with the timeline after every edit (`syncAssetRefs`); B-roll slots and anything with a note stay even when not on the timeline. Notes save on their own (500 ms after a change).
- **P8 · B-roll is a track pair above the main video** (`trk_v_broll`, index 2; its audio half stays empty and hidden). "Insert at playhead" places the clip there with its sound off (a cutaway keeps the main audio) and the main clip's transform, so it sits where the look puts the video. Older timelines get the pair on open (`withDefaultTracks`).
- **P8 · "Generate a clip" is not a take:** the job is recorded on `Project.broll`, polled in the rail, and imported into the next slot when it completes; it never changes the selected take or the page state. If the render turns out to be the same file as media already in the video (content hash), the user is told which label it already has instead of getting a duplicate slot. The plan's composer sheet does not exist yet; the rail has an inline prompt with the same job path (`useStartVideo`, errors and quota mapped the same way).
- **P8 · The editor no longer reloads its document from IndexedDB when the record changes or the mode switches.** Before, toggling Finish ↔ Timeline within the 700 ms autosave window, or any write to the record (a B-roll job, a take status), replaced the open document and dropped undo. Saves now merge over the stored record, so takes and B-roll added elsewhere are kept.
- **P8 · Graphics lane:** the top lane shows Finish's title card and end card (drag the end to change their length; they stay at the start and the end) and hand-added titles (move and trim). Captions keep their own lane under the video, as word-timed chunks.
- **P8 · Own clip as main:** "Import a clip" on the Videos composer strip makes a new video whose main track is the file and opens it in Finish (no title until the user writes one).
- **P7 · A voice take is cleaned and captioned on its own** (plan 9.1, J5): recorded or uploaded voice lands on the Voice track at the playhead, its loudness is measured from the real PCM and normalised to −16 dB RMS, the noise gate is on, and music already ducks under voice (timeline default). Captions then run (Whisper tiny on this device) unless the transcript was edited by hand; those are kept and the user is told how to regenerate. EQ sits under "More".
- **P7 · One captioning run, shown everywhere:** the STT call moved out of the Captions panel into `engine/voice.ts` (`autoCaption`, progress in a small store), so Voice, Captions and Finish show the same run and a second click cannot start a second model. Captions imported or edited while it ran are not overwritten.
- **P7 · Space stops a take** (capture-phase listener while recording), so it never toggles playback mid-take.
- **P7 · Acceptance 9.3:** editing a caption word rebuilds the graphics scene within 1 s in the browser (e2e, measured through `graphics:scene-build`); word edits with the same word count keep every time (SRT round trip in e2e). The active word switches exactly at the transcript word's start (Rust test `exactly_the_spoken_word_is_in_the_active_colour`). **Not measured:** "within 80 ms of the spoken word" needs a 30 s fixture with hand-labelled word times; the repo's speech fixture is 6 s and unlabelled, so Whisper's timing error against real speech is unverified.
- **P6 · Finish is the editor in simple mode** (`EditorPage mode="finish"`), not a second app. The video page opens it once the selected take is Completed and its render is in the timeline; until then the take views (rendering, failed, import fallback) show. `T` or the Timeline button switches to fine-tune on the same document and undo history is per visit.
- **P6 · Finish settings live on Timeline v2** (`timeline.finish`): look, title, captions, brand kit id and toggles, end card, watermark. Every change is one `apply`, so it undoes; three format switches undo back to the exact original (unit and e2e tested).
- **P6 · Looks are pure functions** (`graphics/looks.ts`) from (format, the main video's box, Finish, brand, duration) to graphics items. The video's box comes from the main clip's real aspect and transform, so titles sit above a 16:9 render in 9:16 rather than over it.
- **P6 · Captions stay one item.** A look or caption style writes its preset (font, size, weight, stroke, case, highlight colour, position, words per line) into the timeline's captions item; Finish and the fine-tune inspector edit the same captions. Presets are clamped so captions end above the watermark corner in every look and format (tested for all 12).
- **P6 · The end card is added after the content** (`outputDuration`), not drawn over its last seconds. Preview, playback and export all play the extra seconds.
- **P6 · Backdrop** (Clean, Bold off-format) is a second media layer drawing the main layer's decoded frame, dimmed, scaled to cover. No blur: the compositor's blur is 169 taps per pixel, and at full canvas it made the first frame take seconds even before SwiftShader.
- **P6 · The brand logo shows in every look** when Logo is on (small, top-right of the video; the Brand look places it in its band or above the title), so "title, brand and watermark" holds with the default Clean look.
- **P6 · Brand data reaches the renderer beside the timeline**, not in it: a snapshot (colours, heading font, uploaded fonts, logo id and size) plus the logo data URL, registered once per worker as an image. Logos can be large; the timeline stays small for undo and IndexedDB.
- **P6 · Look thumbnails are real**: each is the look's graphics document laid out by animato-graphics (WASM, main thread) and painted with the display lists over a poster frame. Not the GPU path, but the same layout and fonts.
- **P6 · Finish opens on a poster time** (1.2 s, or a third of a short video) and thumbnails use a frame a third in: renders often start dark and the title is still entering at 0 s.
- **P6 · The preview shows "Preparing the preview" until its first frame.** The first WebGPU frame waits for Vello's pipelines to compile (about 10 s on SwiftShader; much less on a GPU, not measured here). Found because Finish screenshots were black.
- **P6 · Worker graphics race fixed:** a second `setProject` with the same document returned before the first had loaded its fonts, so a frame could draw without graphics. Frames and repeat calls now wait for the pending layout.
- **P6 · Export sheet** (plan 6.7) replaces the dialog: presets switch the video's format, Standard/Small file, "Export all formats" runs 9:16, 16:9, 1:1 one after another from per-format copies of the timeline (the user's own format is not changed), ETA only from measured speed after 2 s, title `Exporting 43% · Animato`, files named `<title-slug>-<format>.mp4`, remix link and post text (`lib/share.ts`, tested). Each finished output downloads by itself.
- **P6 · Last-used format and look** are remembered (preferences) and a new Finish opens with them (J2); Brand falls back to Clean without a kit.
- **P6 · Brand kit page** is one kit in the UI (older multi-kit data keeps a switcher), uploads TTF/OTF fonts to OPFS (WOFF/WOFF2 refused by their magic bytes, with the reason), registers them with parley/Vello and with `FontFace` under the family the file reports, and previews a title card, a caption and an end card through the graphics pipeline. The CSS mock preview was removed.
- **P6 · Slow tests:** the 1080×1920 Finish export (~6 min on SwiftShader) and the brand export are tagged `@slow`, skipped by `npm run test:e2e` and run by `npm run test:e2e:slow` (one worker: two SwiftShader exports in parallel starve each other).
- **P5 · `wasm-opt -Oz`** runs in `build-wasm.sh` from the pinned npm package `binaryen@132.0.0` (via `npx`, so `npm ci` does not install it), with only the wasm features rustc enables by default. −38% raw, −13% gzip; vitest (WASM in Node) and the WASM-heavy e2e specs pass on the optimised module.
- **P5 · Budgets (plan 8.9), measured here:** module 1,205,321 B gzip after `wasm-opt -Oz` (≤ 4.5 MB) ✓. Scene build for the fixture (9 items, 13 caption words): 0.33 ms native release, 1.82 ms WASM in Node (≤ 8 ms) ✓. `frame_at`: 0.0015 ms native, 0.062 ms WASM in Node including JSON (≤ 1 ms) ✓. **Not measured:** the Vello draw at 1080×1920 (≤ 4 ms), the preview frame total (≤ 12 ms), scrub latency (≤ 100 ms) and the 18 s export (≤ 60 s) need a real mid-range GPU; this sandbox has SwiftShader only. The perf badge records `graphics:scene-build`, `graphics:frame-at` and `composite:*` timings in the browser.

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

- **Long sources:** whole-file PCM is cached per asset, which is fine for clips of minutes, not hours. The audio engine already supports windowed sources (`create_windowed_source`) for streaming.
- **More WebGPU outputs:** zero-copy WebGPU preview (surface present) once the worker/OffscreenCanvas device loss is fixed upstream, and true multi-video-track compositing tests on real GPUs.
- **Text-to-speech voiceover** (Piper/Kokoro): not shipped.
- **Transcript-based editing** (delete words → cut media): not shipped. Captions are editable cues only.
- **More import formats:** MKV/MOV with codecs the browser cannot decode are rejected with a clear error; there is no software decoder.
- **Shared-element morph:** the create → job morph depends on both cards being mounted during `popLayout`. On slow networks it falls back to a fade.
