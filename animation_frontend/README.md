# Animato frontend

Prompt-to-animation studio. The backend (`api_server` and the Manim and Remotion workers) renders an animation from a
prompt. Everything after that happens in this app, on the user's machine:
- **Finish:** formats (16:9, 9:16, 1:1), looks, a title, captions, brand kit, music, end card and watermark, drawn by
  Vello over the GPU-composited video.
- **Fine-tune:** a multi-track timeline (Graphics, B-roll, Video, Captions, Voice, Music), voiceover recording,
  on-device captions (Whisper), B-roll slots with notes, and serialisable edit commands with undo.
- **Export:** MP4 or WebM encoded locally with WebCodecs, every format in one go.

Architecture, decisions and measurements are in [`DESIGN_NOTES.md`](./DESIGN_NOTES.md); the build spec is
[`frontendplan.md`](./frontendplan.md); status per phase is in [`PROGRESS.md`](./PROGRESS.md).

## Run it

The dev run talks to the real backend; there are no mocks in it. Start the stack as described in
[`../LOCAL_DEV.md`](../LOCAL_DEV.md), then:

```bash
cd animation_frontend
npm ci --ignore-scripts   # onnxruntime-node's postinstall is not needed by the browser build
npm run dev               # http://localhost:5173, /api proxied to VITE_API_TARGET (default http://localhost:5000)
```

Environment variable names (values go in your own local env files, never committed): `VITE_API_TARGET`,
`VITE_SITE_URL` (absolute Open Graph URLs and remix links; optional).

Projects, media, brand kits, transcripts and export history are local-first: IndexedDB plus the Origin Private File
System. The backend has no "list jobs" endpoint, so job history is per browser.

## Tests

```bash
npm run typecheck         # TypeScript, strict
npm run lint              # ESLint + oxlint + Prettier + the design-token check, zero warnings
npm run build             # production build
npm test                  # vitest: contracts, models, looks, edit-plan compiler, WASM in Node
npm run test:e2e          # Playwright against `npm run build:mocks` (MSW answers the real endpoints)
npm run test:e2e:slow     # full-size exports through SwiftShader (about 12 minutes)
npm run test:e2e:real     # one flow against your local stack; needs E2E_EMAIL and E2E_PASSWORD (LOCAL_DEV.md)
npm run screenshots       # full-page screenshots of every page into screenshots/
```

MSW exists only in the e2e build. Its demo account is `demo@animato.dev` / `animato-demo`, the verification code is
`123456`, and a prompt containing "fail" fails. Finished mock jobs redirect to ffmpeg test-pattern clips in
`public/media/renders/` (not Animato renders).

The e2e suite runs Chromium with SwiftShader WebGPU (so the Rust compositor and Vello run headless), autoplay and a
fake microphone. One test downloads the Whisper model once (about 40 MB); set `SKIP_STT=1` offline. In the cloud
sandbox Chromium is at `/opt/pw-browsers/chromium`; set `PW_CHROMIUM_PATH` to use another binary.

Rust:

```bash
cargo test --manifest-path crates/Cargo.toml -p animato-wasm -p tooscut-audio-engine -p offcut-mp4 \
  -p animato-graphics -p tooscut-compositor -p tooscut-types
```

## Rust / WebAssembly

The engine is Rust compiled to one WebAssembly module (`crates/animato-wasm`): the wgpu compositor, Vello graphics,
parley text layout, captions, audio and MP4 helpers.

```bash
npm run wasm:build        # installs the wasm32 target and the pinned wasm-bindgen CLI on first run
```

This writes `src/wasm/pkg/`, which is committed so the app builds without Rust. wasm-pack style output folders get a
`.gitignore` containing `*`; delete it after a build or the output is not committed.

## Other scripts

```bash
npm run measure:js        # gzip size of the JS each public page loads (after npm run build)
npm run og:image          # recaptures public/og.png from the landing hero (after npm run build)
```

`scripts/make-media.sh` regenerates the media fixtures with ffmpeg (and espeak-ng for the speech clip).

## Browser support

- **Chrome and Edge:** everything. WebGPU compositing with Vello graphics, WebCodecs, OPFS and the AudioWorklet mixer.
- **No WebGPU:** the Canvas2D compositor and a Canvas2D drawing of the same graphics display lists; the editor badge
  says which one is in use.
- **No WebCodecs** (older Safari and Firefox): the render plays and the original downloads; Finish says it needs
  Chrome, Edge or another browser with WebCodecs.
