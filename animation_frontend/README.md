# Animato frontend

Prompt-to-animation studio with a real, private, in-browser video and voice editor. The backend (`api_server`)
renders animations from prompts with Manim or Remotion. Everything after that happens in this app, on the user's
machine:
- **Edit:** a multi-track timeline, voiceover, auto-captions and colour.
- **Export:** encoded to MP4 or WebM locally.

Architecture, decisions and the Rust crates audit are in [`DESIGN_NOTES.md`](./DESIGN_NOTES.md). Status is in
[`PROGRESS.md`](./PROGRESS.md).

## Run it with mocks (no backend needed)

```bash
cd animation_frontend
npm install            # offline/CI without NuGet access: npm install --ignore-scripts
npm run dev            # http://localhost:5173
```

`.env.development` sets `VITE_USE_MOCKS=true`, so [MSW](https://mswjs.io) answers the real API endpoints in the
browser. Only `/api/auth/*` and `/api/jobs/*` are mocked, with the server's messages, codes and quotas.
- **Demo account:** `demo@animato.dev` / `animato-demo`.
- **New sign-ups:** the verification code is `123456`.
- **Finished jobs:** they redirect to real sample videos in `public/media/renders/`.
- **Failure path:** a prompt containing the word "fail" fails, so you can see the error state.

Projects, media, brand kits, templates and export history are local-first: IndexedDB plus the Origin Private File
System. They are never mocked server features.

## Use the real backend

1. Start `api_server` (see its README), by default on `http://localhost:5000`.
2. Create `animation_frontend/.env.development.local`:
   ```
   VITE_USE_MOCKS=false
   VITE_API_TARGET=http://localhost:5000
   ```
3. Run `npm run dev`. The Vite proxy keeps `/api` same-origin, so the HttpOnly session cookie works unchanged.

A production build (`npm run build`) talks to the real API unless `VITE_USE_MOCKS=true` is set at build time.

## Rust / WebAssembly

The editor's engine is Rust compiled to WebAssembly. The crates live in `crates/`, and `crates/animato-wasm` links them
into one module.

```bash
npm run wasm:build     # installs the wasm32 target + wasm-bindgen-cli 0.2.100 on first run
```

This writes `src/wasm/pkg/`, which is committed so the app runs without Rust installed.

Rust tests:
```bash
cargo test --manifest-path crates/Cargo.toml -p animato-wasm -p tooscut-audio-engine -p offcut-mp4
```

## Media fixtures

`scripts/make-media.sh` regenerates every media file with ffmpeg, and espeak-ng for the speech clip. The output is committed:
- the e2e fixtures (`e2e/fixtures/`)
- the sample renders and posters (`public/media/renders/`)
- the compositor fonts (`public/fonts/`)

## Quality checks

```bash
npm run typecheck      # TypeScript, strict
npm run lint           # ESLint + oxlint + Prettier, zero warnings
npm run build          # production build
npm run test:e2e       # Playwright: builds with mocks and serves on :4173
npm run screenshots    # full-page screenshots of every page into screenshots/
```

The e2e suite uses Playwright's Chromium with these flags:
- SwiftShader WebGPU, so the Rust compositor runs headless
- autoplay
- a fake microphone

It imports real media, edits it, exports it, and then probes the downloaded file for codec, size and duration.

One test downloads the Whisper model once (about 40 MB) from Hugging Face. Set `SKIP_STT=1` to skip that step offline.

To use a different Chromium binary, set `PW_CHROMIUM_PATH=/path/to/chrome`.

## Browser support

- **Chromium-based browsers:** the full experience. WebGPU compositing, WebCodecs, OPFS sync access handles and the AudioWorklet mixer.
- **Other browsers with WebCodecs:** the Canvas2D compositor. Export codecs depend on the browser's encoders: H.264/AAC where available, VP9/AV1 + Opus otherwise.
- **The editor badge:** it always shows the backend actually in use.
