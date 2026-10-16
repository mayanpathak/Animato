# Animato Studio redesign: progress

Live checklist for branch `feat/ui-redesign-studio`. A fresh session resumes from here: read `DESIGN_NOTES.md`
first, then pick up the first row that is not done.

| # | Feature | Status | Commit |
|---|---------|--------|--------|
| 0 | Study phase, architecture summary, crates audit | done | `30f6320` |
| 1 | Tooling: deps, ESLint + oxlint + Prettier, env flags, MSW init | done | `30f6320` |
| 2 | Rust workspace; `animato-wasm` links compositor, audio engine, keyframe, offcut-mp4/wasm-core/dsp/text; `npm run wasm:build` | done | `f9cfb4c` |
| 3 | Design tokens, UI primitives, app shell, command palette, guards, error boundary, 404, offline banner | done | `a15c505` |
| 4 | Typed zod API client (auth + jobs only), MSW mock of exactly those endpoints, local-first IndexedDB/OPFS stores | done | `a15c505` |
| 5 | Real media fixtures + sample renders (`scripts/make-media.sh`) | done | `0ff50f4` |
| 6 | Media engine: OPFS import, Rust/mediabunny demux, WebCodecs decode, thumbnails, waveform, PCM cache | done | `0ff50f4` |
| 7 | Landing (GSAP storytelling, live WASM demo) + pricing | done | `ba56a2f` |
| 8 | Auth (login, signup, verify, forgot, reset) | done | `ba56a2f` |
| 9 | Home dashboard | done | `ba56a2f` |
| 10 | Prompt Studio (engine, options folded into prompt, local enhance + diff) | done | `ba56a2f` |
| 11 | Job page (pipeline, status feed, ETA, retry, player, Open in Editor / Add to project) | done | `ba56a2f` |
| 12 | Library (projects, media, exports; search, tags, bulk, import/export project file) | done | `ba56a2f` |
| 13 | Templates, Brand Kit, Settings (preferences, storage manager) | done | `ba56a2f` |
| 14 | Editor: timeline, trims/splits/ripple/speed/fades/transform/crop/colour/text, undo/redo, shortcuts, autosave + restore | done | `ba56a2f` |
| 15 | Compositor: Rust WebGPU + Canvas2D fallback, perf badge | done | `df5497d` |
| 16 | Audio: AudioWorklet mixer (Rust audio engine), normalize, gate, EQ, ducking | done | `ba56a2f` |
| 17 | Voice: voiceover recording, SRT import/export, on-device Whisper captions | done | `df5497d` |
| 18 | Local export: WebCodecs + mediabunny, MP4/WebM, presets, progress/ETA/cancel, history | done | `ba56a2f` |
| 19 | Playwright e2e (22 tests, real media, file probing) | done | `f3fdb88` |
| 20 | Screenshots (every page, 1440×900 + 390×844) reviewed; visual fixes | done | `10f42df` |
| 21 | README, DESIGN_NOTES, PROGRESS | done | (this commit) |

## Verification commands

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint (0 warnings) + oxlint (deny warnings) + prettier --check
npm run build       # tsc -b && vite build
npm run test:e2e    # 22 Playwright tests (builds with mocks, serves on :4173)
npm run screenshots # screenshots/<page>-{desktop,mobile}.png
cargo test --manifest-path crates/Cargo.toml -p animato-wasm -p tooscut-audio-engine -p offcut-mp4
```
