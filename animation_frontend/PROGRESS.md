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
| P6 | Finish, simple mode, export | todo | |
| P7 | Voice and captions | todo | |
| P8 | Fine-tune mode and assets | todo | |
| P9 | AI editor seams | todo | |
| P10 | Growth polish | todo | |
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
  1,390,167 B gzip. Details and the budgets in `DESIGN_NOTES.md` section 4 and the P5 entries.
- typecheck, lint, build: pass. vitest 145 (adds `graphics.test.ts`: fixture round trip TS → Rust → TS, buildGraphics,
  display lists and timings from the real WASM module in Node). Playwright 43/43, including `e2e/graphics.spec.ts`
  (a title drawn by Vello on WebGPU/SwiftShader and by Canvas2D agree within 3% / 15%) and the WebGPU export.
- cargo: animato-graphics 16, tooscut-compositor 10, tooscut-types 30, animato-wasm 3, audio-engine 46, offcut-mp4 24,
  plus 12 more in the workspace. Clippy is clean on the crates P5 touched; audio-engine's warnings predate it.
- Screenshots reviewed: `screenshots/graphics-title-webgpu.png`, `graphics-title-canvas2d.png`, editor at both sizes.
- **Not verified here:** the GPU budgets on a real mid-range GPU; presenting to an OffscreenCanvas on wgpu 30 (still
  readback); colour emoji (Noto Emoji is monochrome, as planned); preview/export parity by pixel hash (both paths call
  the same `FrameRenderer` with the same document at their own size; no hash test yet).

