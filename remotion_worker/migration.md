# remotion.md — Complete Guide: Converting the Manim Worker to a Remotion Worker

**Status:** One-stop implementation guide. Follow it top to bottom, in order. Every code
block is meant to be copy-pasted, not paraphrased. Where a detail matters for correctness
(exact CLI flags, exact file names, exact package versions), it is called out explicitly and
sourced from Remotion's own documentation (remotion.dev/docs) so you don't hit avoidable
runtime errors.

---

## Table of Contents

0. [TL;DR — what's actually changing](#0-tldr)
1. [Prerequisites & system dependencies](#1-prerequisites)
2. [Repository file tree — before and after](#2-file-tree)
3. [Complete file manifest](#3-file-manifest)
4. [New Cargo dependencies](#4-cargo-deps)
5. [Environment variables — complete reference](#5-env-vars)
6. [One-time host setup (run before the worker ever starts)](#6-host-setup)
7. [Remotion project template files (the static scaffolding)](#7-template-files)
8. [Per-file changes to the existing Rust worker](#8-per-file-changes)
   - 8.1 [`Cargo.toml`](#81-cargotoml)
   - 8.2 [`main.rs`](#82-mainrs)
   - 8.3 [`configgemini.rs`](#83-configgeminirs)
   - 8.4 [`generator.rs`](#84-generatorrs)
   - 8.5 [`filesystem.rs`](#85-filesystemrs)
   - 8.6 [`docker.rs` → deleted](#86-dockerrs)
   - 8.7 [`remotion_exec.rs` (new)](#87-remotion-execrs)
   - 8.8 [`renderer.rs`](#88-rendererrs)
   - 8.9 [`processor.rs`](#89-processorrs)
   - 8.10 [Files with zero changes](#810-zero-change-files)
9. [The corrected end-to-end pipeline diagram](#9-pipeline-diagram)
10. [Why the entry point MUST be separate from Root.tsx (a correctness-critical detail)](#10-entry-point)
11. [Why there is no Docker sandbox here, and what actually protects the host](#11-sandbox-note)
12. [Troubleshooting — exact errors and exact fixes](#12-troubleshooting)
13. [Step-by-step validation checklist](#13-validation-checklist)
14. [Implementation order](#14-implementation-order)
15. [Rollback plan](#15-rollback)
16. [Explicitly out of scope for this pass](#16-out-of-scope)
17. [Appendix: full reference table of every changed symbol](#17-appendix)

---

<a id="0-tldr"></a>
## 0. TL;DR — what's actually changing

You are **not** touching:

- The API server (Axum, MongoDB writes for job creation, auth, static file serving).
- The Redis queue name, format, or `BRPOP` semantics.
- The MongoDB schema (`RenderJob`, `JobStatus`, `RenderResult` in `models.rs`).
- The status flow: `Pending → GeneratingCode → Rendering → Completed / Failed`.
- `job_service.rs`, `cleanup.rs`, `mongo.rs`, `redis.rs`, `worker.rs`, `configgemini.rs`.

You **are** changing, inside the worker crate only:

- What Gemini is asked to generate (React/TSX instead of Python/Manim).
- How the generated code is written to disk (a real npm-style Remotion project instead of
  one `scene.py`).
- How it gets turned into an `.mp4` (`npx remotion render` instead of `docker run
  manim-sandbox`).
- Where the final `.mp4` path comes from (deterministic — you choose it — instead of walking
  Manim's unpredictable `media/videos/...` output tree).

The single most common way this integration breaks is treating `Root.tsx` as if it were the
entry point Remotion renders from. **It is not.** Remotion needs a separate file
(`src/index.ts`) that calls `registerRoot()`, and `Root.tsx` only *defines* the list of
compositions. Section 10 explains this in detail because getting it wrong produces a
specific, confusing error (`Root component Timeout` / "entry point does not call
registerRoot()") that otherwise costs real debugging time.

---

<a id="1-prerequisites"></a>
## 1. Prerequisites & system dependencies

Verify every one of these on the actual machine that will run the worker **before** writing
a single line of Rust. Remotion's render step spawns a real headless Chromium instance
under the hood (via `@remotion/renderer`) — this is not optional and not something Rust code
can work around. If these are missing, the render step fails at runtime, not at compile
time, which makes it look like a bug in your Rust code when it's actually a missing system
package.

### 1.1 Node.js

- **Minimum:** Node 16. **Recommended:** Node 18 LTS or Node 20 LTS (Remotion's own CI tests
  against modern LTS lines; older odd-numbered/EOL Node versions are not recommended).
- Confirm: `node --version` and `npm --version` both resolve on the machine/user that will
  run the worker process — not just in your interactive shell. If the worker runs as a
  systemd service under a different user or a stripped-down `PATH`, `which node` can succeed
  for you and fail for the service. This is why `remotion_exec.rs` (§8.7) explicitly resolves
  `NODE_PATH`/`NPX_PATH` from env vars rather than assuming `PATH` is correct.

### 1.2 OS / libc

- **Linux:** glibc ≥ 2.35 is required. **Alpine Linux is explicitly unsupported** by
  Remotion (musl libc, not glibc) — if your production host is Alpine-based, headless
  Chromium will not run correctly; you need a glibc-based distro (Debian/Ubuntu are the
  most tested).
- **macOS:** macOS 15 (Sequoia) or later if you're developing/testing locally on a Mac.

### 1.3 Linux system libraries for headless Chromium (non-Docker path)

Because you're explicitly **not** using Docker for this worker, the host OS itself must have
the shared libraries Chromium needs to launch. Without them you get a `Failed to launch
Chrome` / browser-launch error at render time, on every single job. Install once, on the
host, at deploy/provisioning time:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgbm1 \
  libasound2 \
  libxrandr2 \
  libxkbcommon0 \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libx11-6 \
  libxcb1 \
  libcups2 \
  libpango-1.0-0 \
  libcairo2 \
  libgtk-3-0 \
  fontconfig \
  ca-certificates \
  && sudo rm -rf /var/lib/apt/lists/*
```

If any of these are missing, install them — don't skip based on assumption. Package names
vary slightly by Debian/Ubuntu version; if `apt-get install` reports a package not found,
search `apt-cache search <partial-name>` for the current name on your distro version.

### 1.4 Chrome Headless Shell — do NOT try to install Chrome yourself

Remotion no longer uses your system's Chrome; since Chrome removed classic headless mode
from the desktop browser, Remotion ships/downloads its own **Chrome Headless Shell**
(a Thorium-based build with the video codecs Remotion needs) the first time you render or
run `npx remotion browser ensure`.

- **Do not** pass `--browser-executable` / `browserExecutable` / `setBrowserExecutable()` to
  force a different Chrome — an incompatible version will break rendering.
- **Do** run `npx remotion browser ensure` once, at the same prewarm step where you install
  `node_modules` (§6), so the binary is cached on disk before the worker ever picks up a
  real job. This avoids the first production job silently taking an extra 30–90 seconds (or
  failing outright, if the host has no outbound internet access at job-run time) to download
  the browser.
- The downloaded browser is cached under a Remotion-managed cache directory tied to the
  `HOME` of whichever OS user runs the download. **Run the prewarm step as the same OS user
  that will run the `worker` binary in production** — if you prewarm as `root` and then run
  the worker as an unprivileged `remotion` user, the second user's cache is empty and it will
  try to download again (and may not have permission to write where the download wants to
  go).

### 1.5 Fonts

If your generated compositions render text (they likely will, since Gemini is free to
generate `<div>`/`<span>` text), install at least one general-purpose font family
(`fontconfig` + a default sans-serif) — already covered by the `fontconfig` package above,
but if you see rendered videos with missing/garbled/tofu-box text, install
`fonts-dejavu-core` or similar and confirm with `fc-list`.

---

<a id="2-file-tree"></a>
## 2. Repository file tree — before and after

### 2.1 Before (current Manim worker)

```
worker/
├── Cargo.toml
├── .env
└── src/
    ├── main.rs
    ├── configgemini.rs
    ├── generator.rs          # Gemini → Python/Manim code
    ├── filesystem.rs         # Workspace = one scene.py
    ├── docker.rs             # docker run manim-sandbox
    ├── renderer.rs           # WalkDir search + move to static/
    ├── processor.rs          # orchestrates the above
    ├── models.rs
    ├── mongo.rs
    ├── redis.rs
    ├── worker.rs
    ├── cleanup.rs
    └── services/
        └── job_service.rs
```

### 2.2 After (Remotion worker)

Bold = new or structurally rewritten. Everything else is byte-for-byte unchanged.

```
worker/
├── Cargo.toml                       # EDITED — 3 new deps (§8.1)
├── .env                             # EDITED — new Node/Remotion vars (§5)
└── src/
    ├── main.rs                      # EDITED — mod list only (§8.2)
    ├── configgemini.rs              # unchanged
    ├── generator.rs                 # EDITED — TSX prompt + fence cleanup (§8.4)
    ├── filesystem.rs                # REWRITTEN — scaffolds a Remotion project (§8.5)
    ├── docker.rs                    # ── DELETED ──
    ├── remotion_exec.rs             # ★ NEW — runs `npx remotion render` (§8.7)
    ├── renderer.rs                  # EDITED — drop find_rendered_video (§8.8)
    ├── processor.rs                 # EDITED — reordered pipeline (§8.9)
    ├── models.rs                    # unchanged
    ├── mongo.rs                     # unchanged
    ├── redis.rs                     # unchanged
    ├── worker.rs                    # unchanged
    ├── cleanup.rs                   # unchanged
    └── services/
        └── job_service.rs           # unchanged
```

### 2.3 What gets created per job, at runtime, on disk

This is **not** part of the Rust source tree — it's the temporary Remotion project that
`filesystem.rs::create_workspace()` scaffolds fresh for every job under
`REMOTION_PROJECT_ROOT`, and deletes when the job finishes (or fails):

```
$REMOTION_PROJECT_ROOT/<job_id>/            # tempdir, one per job
├── package.json                            # written by create_workspace() — static template
├── tsconfig.json                           # written by create_workspace() — static template
├── remotion.config.ts                      # written by create_workspace() — static template
├── node_modules -> $REMOTION_PREWARMED_MODULES   # SYMLINK, not a copy — see §6
├── out/
│   └── video.mp4                           # ★ Remotion writes the render HERE, exact path
└── src/
    ├── index.ts                            # written by create_workspace() — calls registerRoot()
    ├── Root.tsx                            # written by create_workspace() — defines <Composition>
    └── compositions/
        └── GeneratedScene.tsx              # written by write_scene_file() — Gemini's output
```

---

<a id="3-file-manifest"></a>
## 3. Complete file manifest

| # | Path | Status | One-line description |
|---|---|---|---|
| 1 | `Cargo.toml` | Edited | add `tempfile`, `which`, `regex` |
| 2 | `.env` | Edited | add `NODE_PATH`, `NPX_PATH`, `REMOTION_PROJECT_ROOT`, `REMOTION_PREWARMED_MODULES`, `RENDER_TIMEOUT_SECS` |
| 3 | `src/main.rs` | Edited | `mod docker;` → `mod remotion_exec;` |
| 4 | `src/configgemini.rs` | Unchanged | — |
| 5 | `src/generator.rs` | Edited | new TSX system prompt, new fence stripper, function renamed `generate_manim_code` → `generate_remotion_code` |
| 6 | `src/filesystem.rs` | Rewritten | `Workspace` now describes a full Remotion project |
| 7 | `src/docker.rs` | **Deleted** | superseded by `remotion_exec.rs` |
| 8 | `src/remotion_exec.rs` | **New** | spawns `npx remotion render`, enforces timeout, kills on drop |
| 9 | `src/renderer.rs` | Edited | delete `find_rendered_video`; keep `move_rendered_video` verbatim |
| 10 | `src/processor.rs` | Edited | reordered pipeline calling the above |
| 11 | `src/models.rs` | Unchanged | — |
| 12 | `src/mongo.rs` | Unchanged | — |
| 13 | `src/redis.rs` | Unchanged | — |
| 14 | `src/worker.rs` | Unchanged | — |
| 15 | `src/cleanup.rs` | Unchanged | — |
| 16 | `src/services/job_service.rs` | Unchanged | — |
| 17 | *(runtime-generated, not in git)* per-job Remotion project | New at runtime | scaffolded by `create_workspace()`, deleted by `cleanup_workspace()` |

---

<a id="4-cargo-deps"></a>
## 4. New Cargo dependencies

Add exactly these three to `Cargo.toml`. Your existing `tokio`, `anyhow`, `serde`,
`reqwest`, `mongodb`, `deadpool-redis`, `walkdir`, `chrono` all stay as-is.

```toml
tempfile = "3.10"   # RAII temp dirs for per-job Remotion projects — auto-deletes on drop
which    = "6"      # locate `node` on PATH/at a configured path before spawning anything
regex    = "1.10"   # extract the ```tsx fenced block out of Gemini's raw text response
```

`walkdir` can stay in the manifest even though `find_rendered_video` (the only thing that
used it) is being deleted — remove it only if nothing else in the crate uses it; check with:

```bash
grep -rn "walkdir" src/
```

---

<a id="5-env-vars"></a>
## 5. Environment variables — complete reference

Everything already in `.env` today (`MONGODB_URI`, `DB_NAME`, `REDIS_URL`, `GEMINI_API_KEY`,
`GEMINI_MODEL`) is untouched. Add:

```env
# ── Node / Remotion ──────────────────────────────────────────────
# Absolute path to the node binary the worker should use. Do not rely on
# PATH resolution alone if the worker runs as a service/different user.
NODE_PATH=/usr/bin/node

# Absolute path to npx. On most installs this sits next to node.
NPX_PATH=/usr/bin/npx

# Root directory under which a fresh subfolder is created per job. Must
# exist and be writable by the worker process BEFORE the worker starts.
REMOTION_PROJECT_ROOT=/tmp/remotion_projects

# Path to the ONE-TIME prewarmed node_modules directory (see §6). Every
# job's project directory gets node_modules symlinked to this path instead
# of running `npm install` per job.
REMOTION_PREWARMED_MODULES=/opt/promptoanime/prewarmed_node_modules

# Hard wall-clock cap (seconds) on the `npx remotion render` step only.
# Does NOT cover the Gemini call or validation — see §11 for why that
# matters.
RENDER_TIMEOUT_SECS=150
```

### 5.1 Full table with defaults and failure modes

| Variable | Required? | Example | If missing/wrong |
|---|---|---|---|
| `NODE_PATH` | Yes (or rely on `PATH`) | `/usr/bin/node` | `which::which()` in `remotion_exec.rs` returns an error before spawning anything — job fails fast with a clear message instead of hanging |
| `NPX_PATH` | Yes (or rely on `PATH`) | `/usr/bin/npx` | `Command::new(npx_path)` fails to spawn — `std::io::Error` "No such file or directory" surfaces as `AppError`/anyhow error |
| `REMOTION_PROJECT_ROOT` | Yes | `/tmp/remotion_projects` | `create_workspace()`'s `tempfile::Builder::new().tempdir_in(...)` fails if the directory doesn't exist — job fails at the "Scaffolding Remotion project" step |
| `REMOTION_PREWARMED_MODULES` | Yes (functionally, even though code treats it as optional) | `/opt/promptoanime/prewarmed_node_modules` | If unset, `create_workspace()` skips the symlink step entirely and the render step will fail with "Cannot find module 'remotion'" since there's no `node_modules` at all in the scaffolded project |
| `RENDER_TIMEOUT_SECS` | No (has a hardcoded fallback of `150`) | `150` | render step falls back to defaulting to 150s in code; not a hard requirement but should be set explicitly for clarity |

---

<a id="6-host-setup"></a>
## 6. One-time host setup (run before the worker ever starts)

This is **not** part of the Rust binary and is **not** re-run per job. Run it once, on the
exact host and as the exact OS user that will later run the `worker` binary in production
(see §1.4 for why the user matters).

```bash
# 1. Create the persistent prewarm source directory.
mkdir -p /opt/promptoanime/prewarm_src && cd /opt/promptoanime/prewarm_src

# 2. Write a package.json that pins EXACT versions (no ^ prefix — Remotion's
#    own docs warn that a `^` here can silently upgrade one @remotion/*
#    package out of sync with another, which breaks at render time with a
#    "version mismatch" error). Check https://www.npmjs.com/package/remotion
#    for the current published version before you pin it — this doc uses
#    4.0.503 as of the time of writing; use whatever is actually current
#    when you do this.
cat > package.json <<'EOF'
{
  "name": "promptoanime-remotion-prewarm",
  "private": true,
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.503",
    "@remotion/cli": "4.0.503",
    "@remotion/bundler": "4.0.503",
    "@remotion/renderer": "4.0.503",
    "typescript": "5.5.4"
  }
}
EOF

# 3. Install once.
npm install --production

# 4. Copy the resulting node_modules to the path every job will symlink to.
#    Copy, not move — keep prewarm_src around so you can re-run step 3 on
#    upgrade without re-authoring package.json from scratch.
rm -rf /opt/promptoanime/prewarmed_node_modules
cp -r node_modules /opt/promptoanime/prewarmed_node_modules

# 5. Pre-download Chrome Headless Shell so no job is the unlucky first one
#    to eat a 30–90s download (or fail outright on a network-restricted
#    production host). This must be run where `npx` can see the installed
#    @remotion/cli — from inside prewarm_src, or from any project that has
#    it in node_modules.
npx remotion browser ensure

# 6. Create the per-job scratch root the worker will scaffold into.
mkdir -p /tmp/remotion_projects
```

### 6.1 Verifying the prewarm worked

```bash
ls /opt/promptoanime/prewarmed_node_modules/.bin/remotion   # must exist
node /opt/promptoanime/prewarmed_node_modules/.bin/remotion --version
```

If the second command errors, the prewarm failed — do not proceed to wiring up the Rust
code until this works standalone.

### 6.2 Re-running after a version bump

Whenever you bump the pinned Remotion version, re-run steps 2–5 in full — mixed
`@remotion/*` package versions across `remotion`, `@remotion/cli`, `@remotion/bundler`, and
`@remotion/renderer` is one of the most common Remotion setup errors and it is silent until
render time.

---

<a id="7-template-files"></a>
## 7. Remotion project template files (the static scaffolding)

These five files are written fresh into every job's tempdir by
`filesystem.rs::create_workspace()` (full Rust code in §8.5). They're shown here on their own
first so you can see exactly what a working Remotion project looks like, independent of the
Rust that generates it.

### 7.1 `package.json`

```json
{
  "name": "remotion-job-project",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.503",
    "@remotion/cli": "4.0.503",
    "@remotion/bundler": "4.0.503",
    "@remotion/renderer": "4.0.503",
    "typescript": "5.5.4"
  }
}
```

**Must match the prewarmed `node_modules`'s versions exactly.** If you change the pinned
version in §6's prewarm step, update this template too — a mismatch between what
`package.json` *claims* and what's actually symlinked in `node_modules` doesn't always error
immediately, but can produce confusing type errors or CLI version-check failures.

### 7.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["dom", "es2020"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 7.3 `remotion.config.ts`

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(true);
```

`setOverwriteOutput(true)` matters: without it, a re-run against the same output path (which
won't normally happen given unique per-job tempdirs, but matters if you ever retry a job into
the same dir) fails instead of overwriting.

### 7.4 `src/index.ts` — **the entry point** (read §10 before touching this)

```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

This file — not `Root.tsx` — is what you pass to `npx remotion render`. This is the single
most important structural detail in this whole migration; see §10 for the full explanation
and the exact error you get if you get it backwards.

### 7.5 `src/Root.tsx` — defines the composition list

```tsx
import { Composition } from "remotion";
import { GeneratedScene } from "./compositions/GeneratedScene";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GeneratedScene"
    component={GeneratedScene}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

`durationInFrames={150}` here is `150` because this guide hard-codes 5 seconds at 30fps for
the minimal v1 (matching §8.4/§8.5's constants). The `id="GeneratedScene"` **must** match the
composition-id argument you pass on the CLI render command (§8.7) — these are matched by
exact string, and a mismatch produces a specific "composition not found" error (§12).

### 7.6 `src/compositions/GeneratedScene.tsx` — Gemini's output goes here

This file is **not** part of the static template — it's written per-job by
`write_scene_file()` with whatever Gemini generated. Shown here just so you can see the
shape the system prompt (§8.4) is designed to produce:

```tsx
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from "remotion";

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, durationInFrames], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "white", opacity }}>
      <div style={{ fontSize: 80, textAlign: "center", marginTop: 400 }}>
        Hello from Remotion
      </div>
    </AbsoluteFill>
  );
};
```

---

<a id="8-per-file-changes"></a>
## 8. Per-file changes to the existing Rust worker

<a id="81-cargotoml"></a>
### 8.1 `Cargo.toml`

```diff
 [dependencies]
 # ...your existing deps stay exactly as they are...
+tempfile = "3.10"
+which    = "6"
+regex    = "1.10"
```

<a id="82-mainrs"></a>
### 8.2 `main.rs`

Only the module declarations change. Everything else — `AppState`, `main()`, Mongo connect,
Redis connect, `worker::start_worker(state).await` — is untouched.

```diff
 mod config;
 mod errors;
 mod models;
 mod mongo;
 mod processor;
 mod redis;
 mod worker;
 mod configgemini;
 mod concurrent;
 mod cleanup;
 mod renderer;
 mod utils;
 mod generator;
 mod filesystem;
-mod docker;
+mod remotion_exec;

 mod services {
     pub mod job_service;
 }
```

(Named the new module `remotion_exec` rather than `remotion` deliberately — Rust module
names shadowing the `remotion` npm package name in comments/strings elsewhere in the file
would be confusing to read; there's no compiler conflict either way since Rust modules and
npm packages live in entirely separate namespaces, but `remotion_exec` is clearer.)

<a id="83-configgeminirs"></a>
### 8.3 `configgemini.rs`

**No change.** `GeminiConfig::from_env()` already loads `GEMINI_API_KEY` and `GEMINI_MODEL`
generically — it has no idea whether the code it's fetching is Python or TypeScript, and
doesn't need to.

<a id="84-generatorrs"></a>
### 8.4 `generator.rs`

Rename the public function `generate_manim_code` → `generate_remotion_code` (update the one
call site in `processor.rs`, §8.9). The HTTP plumbing — `GeminiRequest`/`GeminiContent`/
`GeminiPart` structs, the response structs, `Client::builder().timeout(...)`, the
`client.post(&url).json(&request_body).send()` call, every `println!`/`eprintln!` logging
block, the `GeminiError` handling, `serde_json::from_str` — is **unchanged, byte for byte.**
Only the prompt text and the output-cleaning function change.

#### 8.4.1 New constants (top of file)

```rust
const DURATION_SECONDS: u32 = 5;
const TOTAL_FRAMES: u32 = DURATION_SECONDS * 30; // = 150

// MUST match durationInFrames in Root.tsx (§7.5/§8.5) and RenderResult's
// duration_seconds in processor.rs (§8.9). All three currently hard-coded
// for this minimal v1 rather than threaded through from job.duration_seconds
// (RenderJob has no such field today — see §8.4.3 for the non-breaking way
// to add one later).
```

#### 8.4.2 New system prompt

Replace whatever Manim-specific prompt text is currently built above the
`GEMINI GENERATION START` log line with:

```rust
let system_prompt = format!(
    r#"You are generating a single Remotion (React) video composition.

STRICT OUTPUT CONTRACT — violating any of these makes your output unusable:
1. Output ONLY a single ```tsx fenced code block. No prose before or after it.
2. The file must export exactly one named component `GeneratedScene`:
     export const GeneratedScene: React.FC = () => {{ ... }}
3. You may ONLY import from these two modules — nothing else, ever:
     - "react" (useState, useMemo, useEffect are allowed; no other hooks)
     - "remotion" (useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence,
       interpolate, Easing, spring, Series, Img, staticFile)
4. Do NOT use: eval, the Function constructor, require(), fetch(),
   XMLHttpRequest, WebSocket, localStorage, document.cookie,
   window.location assignment, process.env, process.exit, dynamic
   import(), or any Node built-in ("fs", "path", "child_process", "os",
   "net", "http", "https", "vm").
5. All animation must be a pure function of `useCurrentFrame()` and
   `useVideoConfig()`. No timers (setTimeout/setInterval), no async
   logic, no side effects, no network calls.
6. Total duration is fixed at {duration_seconds} seconds at 30 frames per
   second ({total_frames} frames total). Do not read or rely on any
   duration other than useVideoConfig().durationInFrames.
7. Canvas size is fixed at 1920x1080. Keep all visual elements inside
   this frame — content that overflows will simply be clipped, not
   scaled.

Describe the requested animation using only <AbsoluteFill>, basic HTML
elements (div, span, svg, circle, rect, path, text), inline `style`
props, and the interpolate/spring helpers from "remotion" for motion.
"#,
    duration_seconds = DURATION_SECONDS,
    total_frames = TOTAL_FRAMES,
);

let final_prompt = format!(
    "{}\n\nUSER REQUEST:\n{}",
    system_prompt,
    user_prompt
);
```

This mirrors your existing `final_prompt` construction pattern exactly — no change to how
the request body is assembled afterward.

#### 8.4.3 (Optional, not required for v1) — adding a real `duration_seconds` field later

If you later want per-job durations instead of the hard-coded 5s:

```diff
 // models.rs — RenderJob
+#[serde(default = "default_duration_seconds")]
+pub duration_seconds: u32,
```

```rust
fn default_duration_seconds() -> u32 { 5 }
```

`serde(default = ...)` makes this non-breaking for any existing Mongo documents that predate
the field and for an API server that doesn't send it. Not required to get the v1 pipeline
working — documented here so it's not a mystery later.

#### 8.4.4 New fence-cleanup

```rust
fn clean_gemini_output(raw: &str) -> String {
    raw.replace("```tsx", "")
        .replace("```typescript", "")
        .replace("```", "")
        .trim()
        .to_string()
}
```

Function name stays `clean_gemini_output` (only its body changes) unless you want to rename
it for clarity — not required.

<a id="85-filesystemrs"></a>
### 8.5 `filesystem.rs`

Your current `Workspace` describes a single Manim scene file plus media/output dirs. Replace
the struct and both functions in full:

```rust
use anyhow::{Context, Result};
use std::path::PathBuf;
use tokio::fs;

// MUST match generator.rs's TOTAL_FRAMES constant (§8.4.1).
const TOTAL_FRAMES: u32 = 150; // 5s @ 30fps

#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,             // e.g. /tmp/remotion_projects/<job_id>
    pub entry_point: PathBuf,      // root/src/index.ts — passed to `remotion render`
    pub component_file: PathBuf,   // root/src/compositions/GeneratedScene.tsx
    pub output_file: PathBuf,      // root/out/video.mp4 — Remotion writes exactly here
}

// ======================================================
// Create Workspace (scaffold the Remotion project)
// ======================================================

pub async fn create_workspace(job_id: &str) -> Result<Workspace> {

    let project_root = std::env::var("REMOTION_PROJECT_ROOT")
        .unwrap_or_else(|_| "/tmp/remotion_projects".to_string());

    let root = PathBuf::from(project_root).join(job_id);

    let compositions_dir = root.join("src").join("compositions");
    let output_dir = root.join("out");

    fs::create_dir_all(&compositions_dir).await
        .context("Failed to create src/compositions dir")?;

    fs::create_dir_all(&output_dir).await
        .context("Failed to create out dir")?;

    // ---- package.json (§7.1) ----
    fs::write(
        root.join("package.json"),
        r#"{
  "name": "remotion-job-project",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.503",
    "@remotion/cli": "4.0.503",
    "@remotion/bundler": "4.0.503",
    "@remotion/renderer": "4.0.503",
    "typescript": "5.5.4"
  }
}
"#,
    ).await.context("Failed to write package.json")?;

    // ---- tsconfig.json (§7.2) ----
    fs::write(
        root.join("tsconfig.json"),
        r#"{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["dom", "es2020"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
"#,
    ).await.context("Failed to write tsconfig.json")?;

    // ---- remotion.config.ts (§7.3) ----
    fs::write(
        root.join("remotion.config.ts"),
        r#"import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(true);
"#,
    ).await.context("Failed to write remotion.config.ts")?;

    // ---- src/index.ts — THE ENTRY POINT (§7.4, §10) ----
    fs::write(
        root.join("src").join("index.ts"),
        r#"import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
"#,
    ).await.context("Failed to write src/index.ts")?;

    // ---- src/Root.tsx — composition list (§7.5) ----
    let root_tsx = format!(
        r#"import {{ Composition }} from "remotion";
import {{ GeneratedScene }} from "./compositions/GeneratedScene";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GeneratedScene"
    component={{GeneratedScene}}
    durationInFrames={{{frames}}}
    fps={{30}}
    width={{1920}}
    height={{1080}}
  />
);
"#,
        frames = TOTAL_FRAMES,
    );

    fs::write(root.join("src").join("Root.tsx"), root_tsx).await
        .context("Failed to write Root.tsx")?;

    // ---- symlink pre-warmed node_modules (§6) ----
    let prewarmed = std::env::var("REMOTION_PREWARMED_MODULES")
        .context("REMOTION_PREWARMED_MODULES env var not set — required, see §5/§6")?;

    #[cfg(unix)]
    tokio::fs::symlink(&prewarmed, root.join("node_modules")).await
        .context("Failed to symlink node_modules — check REMOTION_PREWARMED_MODULES path exists")?;

    #[cfg(not(unix))]
    compile_error!("This worker's node_modules symlinking currently only supports Unix hosts.");

    let entry_point = root.join("src").join("index.ts");
    let component_file = compositions_dir.join("GeneratedScene.tsx");
    let output_file = output_dir.join("video.mp4");

    Ok(Workspace { root, entry_point, component_file, output_file })
}

// ======================================================
// Write the Gemini-generated component
// ======================================================

pub async fn write_scene_file(workspace: &Workspace, code: &str) -> Result<()> {
    fs::write(&workspace.component_file, code).await?;
    Ok(())
}

// ======================================================
// Cleanup
// ======================================================

pub async fn cleanup_workspace(workspace: &Workspace) -> Result<()> {
    if fs::try_exists(&workspace.root).await? {
        fs::remove_dir_all(&workspace.root).await?;
    }
    Ok(())
}
```

**Two changes from the earlier informal draft of this migration that matter for
correctness:**

1. `REMOTION_PREWARMED_MODULES` is now treated as **required** (`.context(...)?` instead of
   `if let Ok(...) = ...`) — a scaffolded project with no `node_modules` at all doesn't fail
   at scaffold time, it fails later at render time with a much more confusing "Cannot find
   module 'remotion'" error. Failing fast here, with a clear message, is strictly better.
2. `Workspace` now carries `entry_point` (`src/index.ts`) as its own field, separate from
   `component_file`. `remotion_exec.rs` (§8.7) renders from `entry_point`, never from
   `Root.tsx` and never from `component_file` directly. See §10.

`write_scene_file` keeps its exact name and signature, so the call site in `processor.rs`
doesn't need to change at all — only what happens inside `filesystem.rs` changes.

<a id="86-dockerrs"></a>
### 8.6 `docker.rs` → deleted

Delete the file entirely:

```bash
rm src/docker.rs
```

Its one function, `run_manim_container`, is superseded by `remotion_exec::run_remotion_render`
(§8.7) — same role in the pipeline (turn generated code into an `.mp4`), different mechanism
(no Docker, no `--network none`/`--memory`/`--cpus` flags; a wall-clock timeout plus
`kill_on_drop` instead — see §11 for exactly what protection you keep and lose).

<a id="87-remotion-execrs"></a>
### 8.7 `remotion_exec.rs` (new file)

```rust
use anyhow::{anyhow, Context, Result};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

use crate::filesystem::Workspace;

// ======================================================
// Run Remotion Render
// ======================================================
//
// Equivalent role to the deleted docker.rs::run_manim_container, but:
//   - no container, no --network/--memory/--cpus isolation (see §11)
//   - the composition id passed on the CLI ("GeneratedScene") MUST match
//     the id="GeneratedScene" set in Root.tsx (§7.5) exactly, or this
//     fails with a "composition not found" error (§12)
//   - entry point MUST be workspace.entry_point (src/index.ts), never
//     Root.tsx directly and never the component file directly (§10)
//
pub async fn run_remotion_render(workspace: &Workspace) -> Result<()> {

    println!("\n=====================================");
    println!("STARTING REMOTION RENDER");
    println!("=====================================");

    println!("\nProject Root: {:?}", workspace.root);
    println!("Entry Point:  {:?}", workspace.entry_point);
    println!("Output File:  {:?}", workspace.output_file);

    // ==============================================
    // Verify node exists before spawning anything
    // ==============================================

    let node_path = std::env::var("NODE_PATH").unwrap_or_else(|_| "node".to_string());
    let npx_path = std::env::var("NPX_PATH").unwrap_or_else(|_| "npx".to_string());

    which::which(&node_path)
        .map_err(|_| anyhow!("node not found at '{}' — check NODE_PATH", node_path))?;

    which::which(&npx_path)
        .map_err(|_| anyhow!("npx not found at '{}' — check NPX_PATH", npx_path))?;

    let render_timeout_secs: u64 = std::env::var("RENDER_TIMEOUT_SECS")
        .unwrap_or_else(|_| "150".to_string())
        .parse()
        .unwrap_or(150);

    // ==============================================
    // Spawn with a hard timeout — this REPLACES the
    // `docker run --network none --memory 512m --cpus 1.0`
    // isolation the Manim worker had. See §11 for what
    // this does and does not protect against.
    // ==============================================

    let render_future = spawn_render(&npx_path, workspace);

    match timeout(Duration::from_secs(render_timeout_secs), render_future).await {

        Ok(Ok(())) => {

            if workspace.output_file.exists() {
                println!("\nRemotion render completed successfully");
                Ok(())
            } else {
                Err(anyhow!(
                    "Render process exited with status 0 but no output file was \
                     found at {:?} — this should not happen; check for a composition \
                     id / output path mismatch",
                    workspace.output_file
                ))
            }
        }

        Ok(Err(e)) => Err(e),

        Err(_elapsed) => {

            eprintln!("\nRENDER TIMED OUT after {}s", render_timeout_secs);

            Err(anyhow!("Render timed out after {}s", render_timeout_secs))
        }
    }
}

async fn spawn_render(npx_path: &str, workspace: &Workspace) -> Result<()> {

    // Exact CLI shape per Remotion's own docs:
    //   npx remotion render <entry-point> <composition-id> <output-location>
    // https://www.remotion.dev/docs/cli/render
    let mut child = Command::new(npx_path)
        .arg("remotion")
        .arg("render")
        .arg(&workspace.entry_point)
        .arg("GeneratedScene")            // MUST match Root.tsx's Composition id (§7.5)
        .arg(&workspace.output_file)
        .arg("--concurrency")
        .arg("1")
        .current_dir(&workspace.root)
        // If the timeout branch above wins the race and this future is
        // dropped, kill_on_drop makes sure the underlying OS process (and
        // the Chromium subprocess it spawns) actually dies instead of
        // being orphaned and left eating CPU/memory on the host.
        .kill_on_drop(true)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .context("Failed to spawn `npx remotion render`")?;

    let status = child.wait().await.context("Render process error")?;

    println!("\nREMOTION EXIT STATUS:\n{}", status);

    if !status.success() {

        let mut stderr = String::new();

        if let Some(mut s) = child.stderr.take() {
            use tokio::io::AsyncReadExt;
            let _ = s.read_to_string(&mut stderr).await;
        }

        eprintln!("\nREMOTION STDERR:\n{}", stderr);

        return Err(anyhow!("remotion render exited with {}: {}", status, stderr));
    }

    Ok(())
}
```

**Why `npx remotion render`, and not `npm exec -- remotion render`:** both work, but
`npx remotion render <args>` is the exact invocation shown throughout Remotion's own CLI
docs and GitHub Actions examples — using the documented form reduces the chance of an
argument-parsing edge case that only shows up with one invocation style.

<a id="88-rendererrs"></a>
### 8.8 `renderer.rs`

Manim's `find_rendered_video` exists because Manim buries its final `.mp4` somewhere under
`media/videos/.../<quality>/GeneratedScene.mp4` — the exact path depends on Manim's
internal quality/config settings, so the only reliable way to find it is to walk the
directory tree with `WalkDir` and filter out `partial_movie_files`.

Remotion has no equivalent problem: `remotion_exec.rs` (§8.7) tells `npx remotion render`
**exactly** where to write the file (`workspace.output_file`), and Remotion writes there and
nowhere else. **Delete `find_rendered_video` and the `walkdir` import entirely.** Keep
`move_rendered_video` completely unchanged — it only ever took a `&Path` and a `job_id`, and
never cared how that path was discovered:

```rust
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::fs;

// find_rendered_video: DELETED.
// Remotion writes directly to workspace.output_file — nothing to search for.

pub async fn move_rendered_video(
    rendered_video_path: &Path,
    job_id: &str,
) -> Result<String> {
    // ... exact same body as your current implementation — no changes here ...
}
```

If `find_rendered_video`'s old signature or a stray `use walkdir::WalkDir;` is referenced
anywhere else in the crate, `cargo build` will point you at it — search first to be sure:

```bash
grep -rn "find_rendered_video\|WalkDir" src/
```

<a id="89-processorrs"></a>
### 8.9 `processor.rs`

Full replacement below. Compare against your current file — the skeleton (fetch job → mark
generating → generate code → create workspace → write file → render → move video → mark
completed → cleanup) is preserved; only the render-specific calls change, and the "find
final video" step is removed since the output path is now deterministic.

```rust
use anyhow::Result;

use crate::remotion_exec::run_remotion_render;
use crate::renderer::move_rendered_video;
use crate::{
    generator::generate_remotion_code,
    models::RenderResult,
    filesystem::{
        create_workspace,
        write_scene_file,
        cleanup_workspace,
        Workspace,
    },
    services::job_service::{
        get_render_job_by_id,
        mark_job_completed,
        mark_job_failed,
        mark_job_generating,
    },
    AppState,
};

pub async fn process_render_job(
    state: &AppState,
    job_id: &str,
) -> Result<()> {

    println!("PROCESS_RENDER_JOB (REMOTION) VERSION 1");
    println!("\n=================================================");
    println!("PROCESSING JOB");
    println!("JOB ID: {}", job_id);
    println!("=================================================");

    // ==================================================
    // 1. Fetch Job
    // ==================================================

    println!("\nFetching render job...");

    let job = match get_render_job_by_id(state, job_id).await {
        Ok(job) => job,
        Err(err) => {
            eprintln!("\nFAILED TO FETCH JOB\n{:#?}", err);
            return Err(err.into());
        }
    };

    let Some(job) = job else {
        eprintln!("\nJOB NOT FOUND\nJob ID: {}", job_id);
        return Ok(());
    };

    println!("\nJOB FOUND\nPrompt: {}", job.prompt);

    // ==================================================
    // 2. Mark Generating
    // ==================================================

    println!("\nMarking job as GeneratingCode...");

    if let Err(err) = mark_job_generating(state, job_id).await {
        eprintln!("\nFAILED TO MARK JOB AS GENERATING\n{:#?}", err);
        return Err(err.into());
    }

    // ==================================================
    // 3. Generate Remotion (TSX) Code
    // ==================================================

    println!("\nStarting Gemini generation...");

    let generated_code = match generate_remotion_code(&job.prompt).await {
        Ok(code) => {
            println!("\nGEMINI GENERATION SUCCESS");
            code
        }
        Err(err) => {
            eprintln!("\nGEMINI GENERATION FAILED\n{:#?}", err);

            if let Err(db_err) = mark_job_failed(
                state, job_id, &format!("Gemini generation failed: {}", err),
            ).await {
                eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
            }

            return Err(err);
        }
    };

    println!("\n=================================================");
    println!("GENERATED REMOTION CODE");
    println!("=================================================\n{}", generated_code);

    // ==================================================
    // 4. Scaffold Remotion Project (was: Create Workspace)
    // ==================================================

    println!("\nScaffolding Remotion project...");

    let workspace: Workspace = match create_workspace(job_id).await {
        Ok(ws) => {
            println!("\nPROJECT SCAFFOLDED\nRoot: {:?}", ws.root);
            ws
        }
        Err(err) => {
            eprintln!("\nFAILED TO SCAFFOLD PROJECT\n{:#?}", err);

            if let Err(db_err) = mark_job_failed(
                state, job_id, &format!("Workspace creation failed: {}", err),
            ).await {
                eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
            }

            return Err(err);
        }
    };

    // ==================================================
    // 5. Write GeneratedScene.tsx (was: write scene.py)
    // ==================================================

    println!("\nWriting generated code to GeneratedScene.tsx...");

    if let Err(err) = write_scene_file(&workspace, &generated_code).await {
        eprintln!("\nFAILED TO WRITE COMPONENT FILE\n{:#?}", err);

        let _ = cleanup_workspace(&workspace).await;

        if let Err(db_err) = mark_job_failed(
            state, job_id, &format!("Failed to write component file: {}", err),
        ).await {
            eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
        }

        return Err(err);
    }

    // ==================================================
    // 6. Run Remotion Render (was: Run Docker Render)
    // ==================================================

    println!("\nStarting Remotion render...");

    if let Err(err) = run_remotion_render(&workspace).await {
        eprintln!("\nREMOTION RENDER FAILED\n{:#?}", err);

        let _ = cleanup_workspace(&workspace).await;

        if let Err(db_err) = mark_job_failed(
            state, job_id, &format!("Remotion render failed: {}", err),
        ).await {
            eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
        }

        return Err(err);
    }

    // ==================================================
    // 7. Find Final Rendered Video: REMOVED.
    //    workspace.output_file IS the final video —
    //    Remotion wrote it there directly (§8.7/§8.8).
    // ==================================================

    let rendered_video_path = workspace.output_file.clone();

    // ==================================================
    // 8. Move Final Video To Static Storage
    // ==================================================

    println!("\nMoving rendered video...");

    let public_video_path = match move_rendered_video(&rendered_video_path, job_id).await {
        Ok(path) => {
            println!("\nVIDEO MOVED SUCCESSFULLY\nPublic Path: {}", path);
            path
        }
        Err(err) => {
            eprintln!("\nFAILED TO MOVE VIDEO\n{:#?}", err);

            let _ = cleanup_workspace(&workspace).await;

            if let Err(db_err) = mark_job_failed(
                state, job_id, &format!("Failed to move rendered video: {}", err),
            ).await {
                eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
            }

            return Err(err);
        }
    };

    // ==================================================
    // 9. Get Final File Metadata
    // ==================================================

    let metadata = tokio::fs::metadata(
        format!("./static{}", public_video_path)
    ).await?;

    // ==================================================
    // 10. Render Result
    // ==================================================

    let result = RenderResult {
        video_path: public_video_path,
        duration_seconds: 5.0, // MUST match generator.rs's DURATION_SECONDS (§8.4.1)
        file_size_bytes: metadata.len(),
        render_time_ms: 0,
    };

    // ==================================================
    // 11. Mark Completed
    // ==================================================

    println!("\nMarking job as completed...");

    if let Err(err) = mark_job_completed(state, job_id, result).await {
        eprintln!("\nFAILED TO MARK JOB COMPLETED\n{:#?}", err);

        if let Err(db_err) = mark_job_failed(state, job_id, &err.to_string()).await {
            eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
        }

        return Err(err.into());
    }

    // ==================================================
    // 12. Cleanup Workspace
    // ==================================================

    println!("\nCleaning up workspace...");

    if let Err(err) = cleanup_workspace(&workspace).await {
        eprintln!("\nFAILED TO CLEANUP WORKSPACE\n{:#?}", err);
    } else {
        println!("Workspace cleaned successfully");
    }

    println!("\n=================================================");
    println!("JOB COMPLETED SUCCESSFULLY\nJOB ID: {}", job_id);
    println!("=================================================\n");

    Ok(())
}
```

#### 8.9.1 Explicit diff summary against your current `processor.rs`

- **Removed:** `run_manim_container(&workspace)` call → replaced with
  `run_remotion_render(&workspace)`.
- **Removed:** the entire "Find Final Rendered Video" block that called
  `find_rendered_video(&workspace)` — the path is known ahead of time now
  (`workspace.output_file`).
- **Removed:** `println!("\nScene file exists: {}", workspace.scene_file.exists());` — there
  is no single `scene_file` field anymore. If you want an equivalent sanity check, use
  `workspace.component_file.exists()`.
- **Changed:** `generate_manim_code` → `generate_remotion_code` (§8.4).
- **Unchanged:** fetch job, mark generating, mark failed/completed, metadata read, cleanup,
  overall error-propagation shape and logging verbosity/style.

<a id="810-zero-change-files"></a>
### 8.10 Files with zero changes — verify, don't skip

Confirm each of these still compiles unmodified after the edits above; do not assume:

- **`job_service.rs`** — statuses referenced (`GeneratingCode`, `Completed`, `Failed`) exist
  unchanged in `models.rs::JobStatus`. `RenderResult` shape is unchanged.
- **`cleanup.rs`** — still prunes `./renders` by file age; Remotion's final output lands in
  the same `./static/renders/<job_id>.mp4` location via the unchanged
  `move_rendered_video`, so this keeps working with zero edits.
- **`configgemini.rs`** — same `GEMINI_API_KEY`/`GEMINI_MODEL` env loading, no Remotion
  awareness needed.
- **`models.rs`** — `RenderJob`, `JobStatus`, `RenderResult` untouched, unless you opt into
  §8.4.3's optional `duration_seconds` field.
- **`mongo.rs`, `redis.rs`** — pure infra connections; no rendering-technology awareness.
- **`worker.rs`** — the `BRPOP` + `Semaphore` + `tokio::spawn(process_render_job(...))` loop
  has no idea what `process_render_job` does internally, and doesn't need to change.

---

<a id="9-pipeline-diagram"></a>
## 9. The corrected end-to-end pipeline diagram

```
┌────────────────────────────────────────────────────────────────────┐
│  worker.rs — unchanged BRPOP loop                                  │
│  BRPOP render_queue 0  →  job_id  →  Semaphore permit  →  spawn     │
└──────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│ processor.rs :: process_render_job(state, job_id)                  │
│                                                                     │
│  1. get_render_job_by_id            (job_service.rs — unchanged)   │
│  2. mark_job_generating              (job_service.rs — unchanged)   │
│  3. generate_remotion_code           (generator.rs — EDITED)        │
│         └─ Gemini API → raw text → strip ```tsx fences              │
│  4. create_workspace(job_id)         (filesystem.rs — REWRITTEN)    │
│         └─ scaffold package.json / tsconfig.json /                  │
│            remotion.config.ts / src/index.ts / src/Root.tsx         │
│         └─ symlink node_modules -> REMOTION_PREWARMED_MODULES       │
│  5. write_scene_file(ws, code)       (filesystem.rs — REWRITTEN)    │
│         └─ writes src/compositions/GeneratedScene.tsx               │
│  6. run_remotion_render(&ws)         (remotion_exec.rs — NEW)       │
│         └─ npx remotion render src/index.ts GeneratedScene \        │
│                                     out/video.mp4 --concurrency 1    │
│         └─ hard timeout (RENDER_TIMEOUT_SECS) + kill_on_drop        │
│  7. (REMOVED) find_rendered_video — no longer needed                │
│  8. move_rendered_video(ws.output_file, job_id)  (renderer.rs)      │
│         └─ ./static/renders/<job_id>.mp4                            │
│  9. mark_job_completed               (job_service.rs — unchanged)   │
│ 10. cleanup_workspace(&ws)            (filesystem.rs — REWRITTEN)    │
│         └─ deletes /tmp/remotion_projects/<job_id> entirely          │
└────────────────────────────────────────────────────────────────────┘
```

---

<a id="10-entry-point"></a>
## 10. Why the entry point MUST be separate from Root.tsx (a correctness-critical detail)

This section exists because getting it wrong is the single most likely way to lose an hour
debugging something that looks like a Rust bug but isn't.

**The rule, straight from Remotion's docs:** the file you pass to `npx remotion render` is
the *entry point*, and the entry point's only required job is to call `registerRoot()`
exactly once. `Root.tsx` is not that file — it's the file the entry point imports, and it
defines the list of `<Composition>`s. In virtually every official Remotion template, this
split looks like:

```
src/index.ts    ← entry point, calls registerRoot(RemotionRoot)
src/Root.tsx    ← defines <Composition id="..." component={...} .../>
```

If you instead pass `src/Root.tsx` straight to `npx remotion render` (as an earlier,
incorrect draft of this migration guide did — flagged and fixed here), Remotion's own
"Root component Timeout" troubleshooting page describes exactly this mistake and the error
you'll see: **"You have specified an entry point that does not call registerRoot()."** The
render hangs waiting for a root component that never gets registered, then times out.

This is why, in this guide:

- `filesystem.rs::create_workspace()` (§8.5) writes **two** files —
  `src/index.ts` *and* `src/Root.tsx` — not one merged file.
- `Workspace` has a dedicated `entry_point: PathBuf` field pointing at `src/index.ts`.
- `remotion_exec.rs` (§8.7) renders from `workspace.entry_point`, never from `Root.tsx` and
  never from `component_file` directly.

If you ever refactor this and are tempted to collapse `index.ts` and `Root.tsx` into one
file to "simplify" — don't. Remotion's own docs explicitly recommend keeping them separate,
for a second, unrelated reason: with React Fast Refresh / hot reload during interactive
development, code in a file that gets hot-reloaded re-executes, but `registerRoot()` is only
supposed to run once. Keeping them separate isn't just about avoiding the timeout error, it's
the documented, supported project shape.

---

<a id="11-sandbox-note"></a>
## 11. Why there is no Docker sandbox here, and what actually protects the host

Your Manim worker's `docker.rs` gave you real OS-level isolation:
`--network none`, `--memory 512m`, `--cpus 1.0`, a container filesystem, `--rm` cleanup. None
of that exists in `remotion_exec.rs`. You explicitly asked for this ("no Docker, we'll add
security validation later") — this section just makes precise what you do and don't have in
the meantime, so it's a decision, not an accident:

**What you still have:**

1. **`RENDER_TIMEOUT_SECS` + `kill_on_drop(true)`** (§8.7) — bounds worst-case wall-clock
   runtime of the render step specifically, and guarantees the OS process (and the Chromium
   subprocess it launches) is actually killed, not orphaned, if the timeout fires.
2. **The import allowlist implied by the system prompt** (§8.4.2) — this is a *prompt*
   constraint on Gemini, not a runtime enforcement mechanism. Nothing stops generated code
   from violating it; there's no validator checking the output before it's executed. This is
   the gap you said you'd close later.
3. **Whatever OS-level limits you put on the worker process itself** — e.g. running the
   `worker` binary as an unprivileged user with a restrictive `umask`, filesystem
   permissions scoping write access to `REMOTION_PROJECT_ROOT` only, or wrapping the process
   in `systemd-run --scope -p MemoryMax=... -p CPUQuota=...` at the OS level (not in Rust) if
   you want memory/CPU caps without Docker.

**What you do NOT have, that you had with Docker:**

- No network isolation — generated code executing inside the render's Chromium context runs
  with whatever network access the host process has, since there's no `--network none`
  equivalent.
- No filesystem isolation — no container boundary; the render process can, in principle,
  read/write anything the OS user running the worker can.
- No automatic memory/CPU hard cap per job — `--memory 512m`/`--cpus 1.0` had no equivalent
  applied here; a runaway render competes for host resources with everything else running as
  that user, bounded only by the wall-clock timeout (which stops it eventually, not
  immediately, and doesn't cap memory/CPU while it runs).

If/when you add a `tsx_validator.rs` later (denylist/allowlist static checks on the generated
code, mirroring the "Layer 1" static validator concept from the Manim worker's own
`validator.rs`-equivalent thinking), it slots in right after step 3
(`generate_remotion_code`) in `processor.rs`, before `create_workspace` — nothing else
described in this document needs to change to add it.

---

<a id="12-troubleshooting"></a>
## 12. Troubleshooting — exact errors and exact fixes

| Symptom / exact error text | Root cause | Fix |
|---|---|---|
| `Failed to launch chrome` / browser launch error, every job | Missing Linux shared libraries for headless Chromium | Install the full package list in §1.3 on the actual host running the worker |
| `You have specified an entry point that does not call registerRoot()` | Passed `Root.tsx` (or the component file) as the render entry point instead of `src/index.ts` | Ensure `remotion_exec.rs` renders from `workspace.entry_point`, and `create_workspace()` actually writes a separate `src/index.ts` (§10) |
| `Cannot find module 'remotion'` (or `'react'`, `'@remotion/cli'`) at render time | `node_modules` symlink missing or pointing at a nonexistent/empty directory | Verify `REMOTION_PREWARMED_MODULES` is set and `ls $REMOTION_PREWARMED_MODULES/.bin/remotion` exists (§6.1); re-run the prewarm steps |
| Render "succeeds" (exit code 0) but `workspace.output_file` doesn't exist | Composition id passed on the CLI doesn't match `id="..."` in `Root.tsx`, or output path argument typo | Confirm both say exactly `GeneratedScene` (§7.5, §8.7) — string match, case-sensitive |
| CLI reports a Remotion version mismatch / "please make sure all @remotion packages have the same version" | `package.json` template (§7.1) and the prewarmed `node_modules` (§6) were pinned to different versions, or a stray `^` let one package drift | Re-pin every `remotion`/`@remotion/*` entry in both places to the exact same version string, no `^` prefix, then reinstall/re-copy `node_modules` |
| First production job takes 30–90s longer than expected, or fails on a network-restricted host, only on the very first render | Chrome Headless Shell wasn't prewarmed | Run `npx remotion browser ensure` during the one-time host setup (§1.4, §6 step 5), as the same OS user that runs the worker |
| Render works interactively as your own user but fails when the worker runs as a service | `NODE_PATH`/`NPX_PATH` resolve differently under the service's `PATH`, or the service user's Chrome-Headless-Shell cache is empty | Set `NODE_PATH`/`NPX_PATH` to absolute paths explicitly (§5); re-run the prewarm step (§6) as the *service's* OS user, not your interactive login user |
| Rendered video has missing or garbled text/glyphs | No suitable font installed on the host | Install `fontconfig` + a default sans-serif font (e.g. `fonts-dejavu-core`); confirm with `fc-list` (§1.5) |
| `Render timed out after {N}s` on every job, even simple ones | `RENDER_TIMEOUT_SECS` set too low for the host's CPU/GPU capability, or `--concurrency 1` combined with a slow/oversubscribed host | Raise `RENDER_TIMEOUT_SECS`; confirm the host isn't running far more concurrent Tokio-spawned render jobs than its CPU count can actually support at once |
| `tempdir_in(...)` fails at the "Scaffolding Remotion project" step | `REMOTION_PROJECT_ROOT` directory doesn't exist or isn't writable by the worker's OS user | `mkdir -p` it and check ownership/permissions (§6 step 6) |
| Alpine-based host, any Chromium-related failure | Remotion does not support Alpine (musl libc) | Move the worker to a glibc-based distro (Debian/Ubuntu); this is a hard platform requirement, not a config fix (§1.2) |
| Symlinking `node_modules` fails with a permissions or "operation not supported" error | Non-Unix host, or `REMOTION_PREWARMED_MODULES` path itself doesn't exist yet | Confirm you're on a Unix-like OS (this guide's `filesystem.rs` only supports Unix symlinks, see §8.5); confirm the prewarm step (§6) ran and the path exists before the worker starts |

---

<a id="13-validation-checklist"></a>
## 13. Step-by-step validation checklist

Work through these **in order**. Each step should fully pass before moving to the next —
don't skip ahead if one fails, since later steps assume earlier ones are solid.

1. **Standalone prewarm sanity check** (§6.1) — outside of any Rust code at all:
   ```bash
   node /opt/promptoanime/prewarmed_node_modules/.bin/remotion --version
   ```
   Must print a version, not an error.

2. **Standalone render sanity check** — still no Rust involved. Manually scaffold one test
   project by hand (copy §7.1–§7.6's files into a throwaway directory, symlink
   `node_modules`), then run:
   ```bash
   cd /tmp/manual-test-project
   npx remotion render src/index.ts GeneratedScene out/video.mp4 --concurrency 1
   ```
   Must produce a playable `out/video.mp4`. If this step fails, the problem is 100%
   environmental (Chromium deps, Node version, package versions) — fix it here before
   touching Rust, because the exact same failure will otherwise resurface inside the worker
   with a less obvious stack trace.

3. **`cargo build`** after all §8 edits. Fix any stray references to `docker`,
   `generate_manim_code`, `find_rendered_video`, or `workspace.scene_file` that the compiler
   flags — these are the four symbols that disappear in this migration.

4. **Push one real job onto the Redis queue** for an existing Mongo document (reuse your
   existing test-payload harness), then watch the worker's stdout/stderr for:
   - `JOB FOUND` → `GEMINI GENERATION SUCCESS` → `PROJECT SCAFFOLDED` → `STARTING REMOTION
     RENDER` → `Remotion render completed successfully` → `VIDEO MOVED SUCCESSFULLY` →
     `JOB COMPLETED SUCCESSFULLY`.
   - Any deviation from this sequence tells you exactly which pipeline stage to look at in
     §12's table.

5. **Confirm Mongo state** — the job document's `status` field transitioned
   `Pending → GeneratingCode → Completed` (or, on a deliberate failure test, `Failed` with a
   real, human-readable `error_message` — never a Rust panic or an empty message).

6. **Confirm the tempdir lifecycle** — `watch -n1 'ls /tmp/remotion_projects'` while a job
   runs: the `<job_id>` directory should appear when the job starts and disappear when it
   finishes (success or failure). If it lingers after a failed job, `cleanup_workspace` isn't
   being called on that failure path — check `processor.rs` (§8.9) for a missing `let _ =
   cleanup_workspace(&workspace).await;` before a `return Err(...)`.

7. **Confirm the output file** — `./static/renders/<job_id>.mp4` exists, has a nonzero size,
   and plays in a real video player (not just "the file exists" — actually open it).

8. **Run 3–5 varied prompts back to back**, ideally with `MAX_CONCURRENT_JOBS` set above 1
   (unchanged from your existing `worker.rs`), to confirm:
   - Each job gets its own tempdir under `REMOTION_PROJECT_ROOT` (no collisions).
   - The shared, read-only `node_modules` symlink target isn't mutated by any job (it's
     symlinked, never copied-and-modified, so this should hold by construction — but verify
     `ls -la /opt/promptoanime/prewarmed_node_modules` still looks untouched afterward).
   - No two jobs' Chromium processes visibly starve each other on CPU to the point of
     tripping `RENDER_TIMEOUT_SECS` — if they do, either lower `MAX_CONCURRENT_JOBS` or raise
     `RENDER_TIMEOUT_SECS`.

9. **Deliberately break one thing and confirm graceful failure** — e.g. temporarily rename
   `REMOTION_PREWARMED_MODULES` so the symlink step fails. Confirm the job ends up `Failed`
   in Mongo with a clear `error_message`, the worker process itself does *not* crash or
   panic, and it picks up the next queued job normally afterward.

---

<a id="14-implementation-order"></a>
## 14. Implementation order

1. **Environment first, Rust last.** Complete §1 (system deps) and §6 (prewarm) fully, and
   pass validation-checklist steps 1–2 (§13), *before* writing or editing any `.rs` file.
   This isolates environment problems from code problems.
2. **`Cargo.toml`** (§8.1) — add the three new deps. `cargo build` will fail here (expected —
   the modules referencing them don't exist yet).
3. **`filesystem.rs`** (§8.5) — full rewrite.
4. **Delete `docker.rs`; add `remotion_exec.rs`** (§8.6, §8.7).
5. **`main.rs`** (§8.2) — swap the `mod` line.
6. **`generator.rs`** (§8.4) — new prompt, new cleanup, rename to `generate_remotion_code`.
7. **`renderer.rs`** (§8.8) — delete `find_rendered_video` + the `walkdir` import.
8. **`processor.rs`** (§8.9) — rewire the pipeline.
9. **`cargo build`** — resolve any remaining stray references (§13 step 3).
10. Work through the **full validation checklist** (§13), in order, steps 3 through 9.

---

<a id="15-rollback"></a>
## 15. Rollback plan

Because `docker.rs` is deleted rather than edited in place, and every other change is
confined to files inside the worker crate, rollback is a single operation:

```bash
git checkout <commit-before-this-change> -- worker/
```

Nothing outside the worker crate was touched (API server, Redis queue format, MongoDB
schema), so there is no coordinated rollback needed anywhere else. The one piece of host
state this guide adds — `/opt/promptoanime/prewarmed_node_modules` and
`/tmp/remotion_projects` — is inert once the old Manim worker binary is running again; you
can leave it in place or `rm -rf` it, either is safe.

---

<a id="16-out-of-scope"></a>
## 16. Explicitly out of scope for this pass

By your own stated constraint ("don't add validation yet"), this guide deliberately does
**not** include:

- A `tsx_validator.rs` denylist/allowlist static checker on Gemini's output (see §11 for
  exactly where it would slot in later).
- Any container-level or OS-level sandbox around the `npx remotion render` child process
  beyond the timeout + `kill_on_drop` already described.
- A real `duration_seconds` field threaded end-to-end from the API request through to
  `Root.tsx`'s `durationInFrames` (§8.4.3 documents the non-breaking way to add this later;
  v1 hard-codes 5 seconds in exactly three places, all cross-referenced above).
- Redis Streams / consumer-group-based job acknowledgement, retry-with-backoff, or a dead
  letter queue — none of this changes between the Manim and Remotion workers; whatever your
  Manim worker's `worker.rs`/queue semantics already are, the Remotion worker inherits
  unchanged.

---

<a id="17-appendix"></a>
## 17. Appendix: full reference table of every changed symbol

| Old symbol (Manim worker) | New symbol (Remotion worker) | File |
|---|---|---|
| `generate_manim_code(prompt: &str)` | `generate_remotion_code(prompt: &str)` | `generator.rs` |
| `Workspace { root, scene_file, media_dir, output_dir }` | `Workspace { root, entry_point, component_file, output_file }` | `filesystem.rs` |
| `create_workspace(job_id) -> Workspace` (writes one `scene.py`) | `create_workspace(job_id) -> Workspace` (scaffolds full npm project) | `filesystem.rs` |
| `write_scene_file(ws, code)` (writes `scene.py`) | `write_scene_file(ws, code)` (writes `src/compositions/GeneratedScene.tsx`) — **name unchanged** | `filesystem.rs` |
| `cleanup_workspace(ws)` | `cleanup_workspace(ws)` — **unchanged**, just deletes a bigger directory now | `filesystem.rs` |
| `run_manim_container(ws) -> Result<()>` | `run_remotion_render(ws) -> Result<()>` | `docker.rs` (deleted) → `remotion_exec.rs` (new) |
| `find_rendered_video(ws) -> Result<PathBuf>` | *(deleted — no replacement needed)* | `renderer.rs` |
| `move_rendered_video(path, job_id) -> Result<String>` | `move_rendered_video(path, job_id) -> Result<String>` — **fully unchanged** | `renderer.rs` |
| `mod docker;` | `mod remotion_exec;` | `main.rs` |
| N/A | `TOTAL_FRAMES: u32 = 150` (must match across `generator.rs` and `filesystem.rs`) | both |
| N/A | `NODE_PATH`, `NPX_PATH`, `REMOTION_PROJECT_ROOT`, `REMOTION_PREWARMED_MODULES`, `RENDER_TIMEOUT_SECS` | `.env` |

**End of document.**