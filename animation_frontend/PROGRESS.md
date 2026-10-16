# Animato frontend v2: progress

Live checklist for branch `feat/frontend-v2`, following `frontendplan.md` section 16. A fresh session reads the
repo-root `CLAUDE.md`, the plan (sections 0–4), `DESIGN_NOTES.md`, then resumes at the first row that is not `done`.
Markers: `todo`, `wip`, `done`, `blocked` (plan 0.3). The F0–F11 checklist of the previous plan is in git history
(`git show d0a4df8:animation_frontend/PROGRESS.md`).

| Phase | Scope | Status | Commit |
|---|---|---|---|
| P0 | Repo and build health: root `CLAUDE.md`, setup hook, `.gitattributes`, rebuilt `editor/media/`, green build from a clean clone | done | `c8e7f9b` |
| P1 | Real backend: mocks off, contract tests (vitest), polling, error mapping, import fallback, `LOCAL_DEV.md` | done | `711f3ce` |
| P2 | Design system and shell: tokens, components, top bar, routes and redirects, Videos home, Settings, system screens | todo | |
| P3 | Landing, pricing, first-run flow, Create, Rendering state, entitlements, analytics seam | todo | |
| P4 | Engine consolidation: workspace, render-engine, Timeline v2, worker merge | todo | |
| P5 | Vello graphics layer: version alignment, `animato-graphics`, `animato-overlay`, `FrameRenderer` | todo | |
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
