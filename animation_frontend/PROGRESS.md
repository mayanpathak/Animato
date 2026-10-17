# Animato frontend v2: progress

Live checklist for branch `feat/frontend-v2`, following `frontendplan.md` section 16. A fresh session reads the
repo-root `CLAUDE.md`, the plan (sections 0–4), `DESIGN_NOTES.md`, then resumes at the first row that is not `done`.
Markers: `todo`, `wip`, `done`, `blocked` (plan 0.3). The F0–F11 checklist of the previous plan is in git history
(`git show d0a4df8:animation_frontend/PROGRESS.md`).

| Phase | Scope | Status | Commit |
|---|---|---|---|
| P0 | Repo and build health: root `CLAUDE.md`, setup hook, `.gitattributes`, rebuilt `editor/media/`, green build from a clean clone | done | `c8e7f9b` |
| P1 | Real backend: mocks off, contract tests (vitest), polling, error mapping, import fallback, `LOCAL_DEV.md` | done | `711f3ce` |
| P2 | Design system and shell: tokens, components, top bar, routes and redirects, Videos home, Settings, system screens | done | `c0f202c` |
| P3 | Landing, pricing, first-run flow, Create, Rendering state, entitlements, analytics seam | done | `64b2a9f` |
| P4 | Engine consolidation: workspace, render-engine, Timeline v2, worker merge | done | `c4c447a` |
| P5 | Vello graphics layer: version alignment, `animato-graphics`, `animato-overlay`, `FrameRenderer` | done | `0cb6229` |
| P6 | Finish, simple mode, export | done | `a39a85c`, `db9c3fa`, `c14b2e5` |
| P7 | Voice and captions | done | `6ee1c99` |
| P8 | Fine-tune mode and assets | done | `9811762` |
| P9 | AI editor seams | done | `3f04571` |
| P10 | Growth polish | done | `545d446` |
| P11 | Hardening | todo | |

## P0 notes

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm run test:e2e`: 22/22 pass (the voice test failed before the worklet fix in `4d1b3ad`).
- `cargo test -p animato-wasm -p tooscut-audio-engine -p offcut-mp4`: 86 tests pass (4 + 24 + 12 + 46).
- Clean clone of the pushed branch (`edce842`): `npm ci --ignore-scripts && npm run build` passes.
- vitest does not exist yet; it arrives in P1 with the contract tests.

## P1 notes

- `npm run typecheck`, `npm run lint`, `npm run build`: pass. `dist/` contains no MSW code.
- `npm test` (vitest): 26 tests (contract fixtures, polling schedule, error mapping).
- `npm run test:e2e`: 27/27 pass, including `e2e/errors.spec.ts` (500, 422, 429 countdown, worker timeout, unknown
  job, import failure with a playing fallback).
- No Rust changed in P1, so no cargo run.
- **Not verified here:** J1 and J2 against the real stack. That is the owner's run, `LOCAL_DEV.md` section 6.
- Job page screenshots (failure, import failure) were reviewed at 1440×900 and 390×844 for the new states only; the page
  itself is restyled in P2 and becomes the video page in P6.

## P2 notes

- typecheck, lint (now including the token gate), build: pass. vitest 28. Playwright e2e 30/30, including axe
  (`e2e/a11y.spec.ts`: no serious or critical violations on Videos, video page, Settings, Create, 404).
- Screenshots in `screenshots/` at 1440×900 and 390×844 were reviewed. Fixes made from the review: a fake "Time left"
  estimate and progress bar removed from the job page, quieter storage prompt, vertical-video posters on a blurred
  backdrop, a stray hairline in Settings, white-on-blue contrast.
- Landing, pricing and auth only inherit the tokens (their gradient blobs now render nothing); they are rebuilt in P3.
- The job page is restyled to tokens only; its render view is P3 and Finish is P6.

## P3 notes

- typecheck, lint (token gate), build: pass. vitest 33. Playwright e2e 37/37, including `first-run.spec.ts` (J1 timed
  in the mocked build: landing → sheet signup → verify → auto-start → Ready in about 9 s, well under the 3-minute
  budget; the real render time is the server's), cancel of the auto-start, remix link + sheet login, and the truth check.
  axe: no serious or critical violations on landing, pricing, login, signup, forgot, the auth sheet and the app screens.
- Screenshots reviewed at both sizes. Fixed from the review: three-line hero headline, mobile overflow, headings that
  orphaned a word, starter cards whose text was centred vertically.
- **Not met / not measured:** landing initial JS ≈ 194 KB gzip vs 170 KB (P11); Lighthouse not runnable in the sandbox.
- **Owner:** render the starters on the real stack and fill `SITE_MEDIA` (`src/features/landing/content.ts`) and
  `STARTERS[].video`, since there are no real Animato renders in the repo yet. Set `VITE_CONTACT_EMAIL` for the footer.

## Verification commands

```bash
npm ci --ignore-scripts   # in the cloud sandbox (onnxruntime-node postinstall cannot download)
npm run typecheck   # tsc -b
npm test            # vitest (pure TS units)
npm run lint        # eslint (0 warnings) + oxlint (deny warnings) + prettier --check
npm run build       # tsc -b && vite build
npm run test:e2e    # Playwright (builds with mocks, serves on :4173)
npm run screenshots # screenshots/<page>-{desktop,mobile}.png
cargo test --manifest-path crates/Cargo.toml -p animato-wasm -p tooscut-audio-engine -p offcut-mp4
```

## P4 notes

- typecheck, lint (token gate), build: pass. vitest 140 (render-engine package tests included, Timeline v2 ops,
  migration, transcript chunking). Playwright e2e 42/42, including the new `migrate.spec.ts` (a seeded v1 project opens,
  is stored as v2 with a v1 backup, and plays) and the editor and voice suites on Timeline v2.
- cargo `-p animato-wasm -p tooscut-audio-engine -p offcut-mp4`: 86 tests pass. No Rust changed in P4.
- Engine decisions and their measurements: `DESIGN_NOTES.md` P4 entries, raw numbers in `docs/engine-bench-p4.json`.
- `src/workers/` is gone; nothing references it.
- Editor screenshots reviewed at 1440×900 and 390×844 (lanes: Titles, Video, Voice, Music & audio; no overflow).
- Left for P5: the Rust `split_clip`, `trim_clip` and `ripple_delete` exports are unused since edits moved to
  render-engine; they go when the WASM is rebuilt. Titles and captions still draw as compositor text layers.

## P5 notes

- Version alignment (plan 8.2): Vello 0.11.0 / wgpu 30.0.1 / parley 0.12.0; D1 did not arise. WASM 2,499,923 →
  1,205,321 B gzip (`wasm-opt -Oz`, binaryen 132, added after the phase commit). Details and the budgets in `DESIGN_NOTES.md` section 4 and the P5 entries.
- typecheck, lint, build: pass. vitest 145 (adds `graphics.test.ts`: fixture round trip TS → Rust → TS, buildGraphics,
  display lists and timings from the real WASM module in Node). Playwright 43/43, including `e2e/graphics.spec.ts`
  (a title drawn by Vello on WebGPU/SwiftShader and by Canvas2D agree within 3% / 15%) and the WebGPU export.
- cargo: animato-graphics 16, tooscut-compositor 10, tooscut-types 30, animato-wasm 3, audio-engine 46, offcut-mp4 24,
  plus 12 more in the workspace. Clippy is clean on the crates P5 touched; audio-engine's warnings predate it.
- Screenshots reviewed: `screenshots/graphics-title-webgpu.png`, `graphics-title-canvas2d.png`, editor at both sizes.
- **Not verified here:** the GPU budgets on a real mid-range GPU; presenting to an OffscreenCanvas on wgpu 30 (still
  readback); colour emoji (Noto Emoji is monochrome, as planned); preview/export parity by pixel hash (both paths call
  the same `FrameRenderer` with the same document at their own size; no hash test yet).

## P6 notes

- typecheck, lint (token gate), build: pass. vitest 167 (looks × formats through the real WASM scene, Finish undo,
  share helpers, font magic bytes). Playwright: `npm run test:e2e` 44/44; `npm run test:e2e:slow` 2/2 (the 1080×1920
  Finish export: title, logo and watermark drawn by WebGPU + Vello, 6.1 min on SwiftShader; an uploaded font and the
  logo reaching the brand preview and an export).
- Acceptance 6.6: Ready → 9:16 → Export gives a 1080×1920 MP4 with defaults only (e2e). Three format switches undo to
  the original exactly (unit + e2e). **Not measured:** "every inspector change previews in under 50 ms on a mid-range
  GPU" (SwiftShader only here).
- Acceptance 6.7: **not met here / not measured**: the 18 s 1080×1920 export under 60 s needs a real GPU (SwiftShader
  ran the 6 s video in about 6 min); QuickTime and Android playback not checkable in the sandbox; no pixel-identity
  snapshot between preview and export yet (both use the same `FrameRenderer` and graphics document at their own
  size).
- Acceptance 6.8: an uploaded font appears in the preview and in an export, and the logo on the end card (e2e @slow).
- Screenshots reviewed at both sizes: Finish (`video-ready-*`), `finish-9x16-preview.png`, `brand-graphics-preview.png`.
  Fixed from review: black first frame and thumbnails, uneven Format control, perf badge in simple mode, missing logo,
  brand copy that named the wrong default colours, low-contrast title card.
- Known weak spot: the plan's title rule (first clause, 6 words, 32 characters) can stop mid-phrase ("Gradient Descent
  Finds"); the title is editable and the rule is as specified.

## P7 notes

- Voice (9.1): record (count-in, level meter, Space stops) or upload; the take lands on the Voice track, is
  normalised to −16 dB RMS from its measured loudness and gated; music ducks under it (timeline default); EQ is
  under "More". Captions then run on their own unless the transcript was edited by hand.
- Transcript and captions (9.2, 9.3): one `autoCaption` run (Whisper tiny on this device, word timestamps, sentence
  ends from the Rust normalizer) shared by Voice, Captions and Finish; captions imported or edited while it runs win.
  Three caption styles (P6), SRT import/export kept. `captions_generated` is now tracked.
- Edits became serialisable commands (`model/commands.ts`, plan 13.1, groundwork for P8/P9): `applyCommands` is pure
  and every undo step records its commands; replaying the log from JSON reproduces the document (unit test).
- typecheck, lint, build: pass. vitest 171. Playwright `npm run test:e2e` 44/44; `e2e/voice.spec.ts`
  now records a take, stops it with Space, waits for the automatic captions, edits a caption word and sees the
  graphics scene rebuilt within 1 s, and runs Whisper on the speech fixture.
- **Not measured:** the 80 ms active-word accuracy against real speech (no labelled 30 s fixture; see DESIGN_NOTES).


## P8 notes

- Commands (plan 13.1) landed with P7; every timeline operation is a JSON command recorded with its undo step.
- Assets rail "In this video": Main, B-roll slots ("Clip 1", "Clip 2", …) with a note and "Insert at playhead",
  "Generate a clip" (a render that lands in the next slot when ready), Music, Voice. Library items can be made B-roll.
- Timeline: Graphics lane (Finish title card, end card, titles) and a B-roll lane above the main video.
- "Import a clip" on the Videos composer strip: a new video with the user's own file as the main clip, opened in Finish.
- Fixed: the editor replaced its open document (and undo) from IndexedDB on a mode switch or any record change.
- Acceptance: `e2e/assets.spec.ts` generates a B-roll render from Finish, waits for it in slot "Clip 1", inserts it at
  the playhead, undoes and redoes the insert, and finds the note after a reload; unit tests cover labels, slots and
  the silent cutaway on the B-roll track.

## P9 notes

- `plan/schema.ts` (EditPlanV0, zod), `plan/compile.ts` (`compileEditPlan`, pure), `plan/DevHarness.tsx` (`?dev=plan`).
- Acceptance 13.4: 13 fixture plans in `plan/compile.test.ts` (insert at word, cutaway at time with fade, overlay,
  music with ducking and removal, keep ranges with anchors mapped through the cut, unknown label, out-of-range times,
  empty plan, bad word index, titles, format/look/captions, unbuilt features as warnings, schema errors) plus one
  through the store: one Undo restores the timeline exactly.
- typecheck, lint, build: pass. vitest 188. Playwright `npm run test:e2e` 47/47 (P8 and P9 together).
- Acceptance 13.5: `e2e/plan.spec.ts` pastes an invalid plan (refused with reasons), then a valid one (look, format and
  an unknown label: applied with a warning), and one Undo reverts it.
- G6 in plan section 17 now carries the endpoint shape from 13.7.

## P10 notes

- Open Graph and Twitter tags in `index.html`; `public/og.png` (1200×630, 66 KB) is a capture of the real landing
  hero (`npm run og:image`), not a render frame: the repo has none (see DESIGN_NOTES). Title fixed ("myanimate").
- Post text, remix analytics events, first-video and first-export tips and the storage prompt were built in P3/P6;
  checked, not rebuilt.
- e2e: `routes.spec.ts` checks the title, the tags and that the image is served.

## P11 notes

- Budgets (15.1), production build, Chromium, gzip: landing 207 KB, login 197 KB, pricing 180 KB (`npm run
  measure:js`); app shell 232 KB in the e2e build (MSW included; not measured on production, needs a backend
  session). **Not met:** landing 170 KB (react-dom + router 93 KB and motion 49 KB alone are 142 KB). Done: zod/mini
  for API and form schemas, lazy app shell and redirects (landing 231 → 207 KB). `e2e/budgets.spec.ts` guards today's
  sizes. **Not measured:** LCP on fast 4G, route-change paint, export memory (no Lighthouse or real device here).
- Reliability (15.2): autosave 500 ms plus a flush when the tab is hidden; saves serialised (fixed a P8 race that could
  restore an older timeline); storage-full toast to Settings → Storage with the five largest files.
- Tests (15.3): degrade paths (no WebCodecs, no WebGPU), storage full, edit plans, budgets; `npm run test:e2e:real`
  for the local stack (not run here: no backend in the sandbox).
- Degrade (15.5): without WebCodecs the take view plays the render, offers the original and says why Finish is
  missing; the export sheet no longer throws when WebCodecs is absent.
- README rewritten for the current app; LOCAL_DEV.md section 8 (real-stack e2e). Light theme (optional) not built.
  Windowed audio preview for hour-long sources (recorded in P4) not done.
- typecheck, lint, build: pass. vitest 190. Playwright `npm run test:e2e` 52/52, `npm run test:e2e:slow` 2/2 (the
  1080×1920 Finish export failed once in the run before the save fix and passed after it; the cause of that one
  failure was not confirmed). cargo: animato-graphics 16, animato-wasm 3, offcut-mp4 24 + 12 (mux round trip),
  audio-engine 46, tooscut-compositor 10, tooscut-types 30.

