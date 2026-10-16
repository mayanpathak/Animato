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
