# Remotion worker: KaTeX, code highlighting and the repair loop

Two changes, both inside `remotion_worker/` only. The API server, the frontend,
the Manim worker, the Redis queue and the MongoDB schema are untouched.

1. Generated scenes can now show real equations (KaTeX) and syntax-highlighted
   code snippets (prism-react-renderer).
2. A failed scene is sent back to Gemini with its error and retried, instead of
   failing the job on the first error.

Nothing here has been compiled or rendered yet. See "Verify before relying on
it" at the bottom.

---

## You must rebuild the sandbox image

The two new libraries live in the Docker image, not on the host, because the
render container runs with `--network none` and cannot download anything.

```
docker build -t remotion-sandbox:latest remotion_worker/docker/remotion-sandbox
```

Rebuild **before** starting the new worker. With the old image, a scene that
uses an equation or a code snippet fails to bundle ("Module not found"), the
repair loop retries it, and the job fails after spending extra Gemini calls.
Scenes that use neither keep working on the old image.

---

## 1. KaTeX and code highlighting

| File | Change |
|---|---|
| `docker/remotion-sandbox/package.json` | Added `katex` 0.16.21 and `prism-react-renderer` 2.4.1, pinned exactly like the other dependencies. The Dockerfile is unchanged: its existing `npm install` picks them up. |
| `src/filesystem.rs` | The per-job `package.json` template lists the same two packages, so it stays identical to the image's. Nothing is installed from it. |
| `src/generator.rs` | Prompt rule 3 allows the new imports. Rule 9 no longer bans LaTeX outright. A new **MATH AND CODE** section shows the model exactly how to use both. The startup log line now says `GENERATOR VERSION 4`. |

What the model is told to write:

- **Equations**: `katex.renderToString(...)` into a `dangerouslySetInnerHTML`
  wrapper, with `import "katex/dist/katex.min.css"` alongside it. The
  stylesheet pulls in KaTeX's own fonts from the image, so no network is used.
- **Code**: the `<Highlight>` component with a built-in theme. Languages bundled
  by the library: javascript, jsx, typescript, tsx, python, rust, go, cpp, c,
  json, yaml, css, markup (HTML), markdown, swift, kotlin, graphql. Anything
  else (Java, SQL, Bash) renders as uncoloured text rather than failing.

Both are for use only when the request needs them. Ordinary scenes are still
plain HTML/SVG, so existing prompts should produce the same kind of output.

---

## 2. Repair loop

Ported from `manim_worker/src/processor.rs`.

| File | Change |
|---|---|
| `src/generator.rs` | New `RepairContext { previous_code, error }`. `generate_remotion_code` takes a third argument, `Option<RepairContext>`. With `Some`, the prompt gains the failed code, the real error and an instruction to return the whole corrected file. |
| `src/validator.rs` | Was empty and unused. Now holds `validate_generated_code`, with unit tests. |
| `src/main.rs` | Added `mod validator;`. |
| `src/services/job_service.rs` | Added `set_retry_count` (copied from the Manim worker). It writes the existing `retry_count` field. |
| `src/processor.rs` | The generate, scaffold, write and render steps moved into `generate_and_render` / `run_attempts`, which loop. Everything after the render (move, upload, mark completed, cleanup) is unchanged. |
| `src/e2e_test.rs` | Passes `None` for the new argument. |

### How one job runs now

1. Gemini generates the scene.
2. Static validation. On failure, go to step 5 without rendering.
3. Scaffold the project and write `GeneratedScene.tsx`.
4. Render in Docker. On success the job continues exactly as before.
5. On any failure, the code and the error text go back to Gemini, and the loop
   returns to step 2 with the corrected code.
6. After the last attempt fails, the job is marked `Failed` with the last error.

Default is 2 repairs, so at most 3 tries per job.

### Setting

| Variable | Default | Meaning |
|---|---|---|
| `REMOTION_MAX_REPAIRS` | `2` | Repairs after the first attempt. `0` gives the old single-attempt behaviour. |

### Cost

A job that keeps failing now makes up to 3 Gemini calls instead of 1, and up to
3 renders. That includes failures no rewrite can fix, such as Docker not
running, because the loop does not tell them apart (the Manim worker behaves
the same way). Set `REMOTION_MAX_REPAIRS=0` if that matters more than the
reliability gain.

### What the validator checks, and what it deliberately does not

It checks two things the render would not report clearly:

- the file exports `GeneratedScene` (any named-export form);
- if `katex` is imported, the stylesheet is imported too. Without it the
  equation is unreadable but the render still succeeds, so nothing else would
  catch it.

It does **not** block `fetch`, `eval`, `require` or unknown imports, unlike the
Manim validator. Scenes can now contain code snippets as on-screen text, so a
lesson about Python legitimately contains `import os`, and a substring filter
would reject working scenes. The Docker sandbox in `docker_exec.rs` remains the
security boundary, and a wrong import already fails the bundle with a clear
error that the repair loop handles.

### Behaviour that changed slightly

- **Error messages.** A failed job's `error_message` now reads
  `Remotion render failed after 3 attempt(s) (1 generation + 2 repair(s)). Last error: ...`
  instead of `Remotion render failed: ...`. Nothing in the API server or
  frontend matches on that text.
- **Status during a repair.** The job goes back to `GeneratingCode`, then
  `Rendering` again. `retry_count` holds the number of repairs used.
- **`started_at` restarts on each repair**, because `mark_job_generating` sets
  it. This keeps the watchdog's 1800s stuck-job limit applying per attempt, so
  a slow but healthy three-attempt job is not marked Failed.
- **`./static/generated/<job_id>.tsx`** is overwritten by each attempt, so it
  holds the latest code, which is the code that was rendered when the job
  succeeds. The `e2etesting` crate reads this file and still gets the right
  one. Earlier failed attempts are only in the worker log.
- **`render_time_ms`** still measures only the render that succeeded.

---

## Verify before relying on it

Run these from `remotion_worker/`, in order.

```
cargo check
cargo test
```

`cargo test` includes the new validator tests. Then, with Docker running and
the image rebuilt:

```
cargo test docker_exec -- --ignored --nocapture
cargo test e2e_prompt_to_video -- --ignored --nocapture
```

The second one makes one real Gemini call.

Then restart the worker and try one prompt of each kind, for example "explain
the quadratic formula step by step" and "walk through a Python for loop line by
line". Open both videos and check that the equation is typeset properly and the
code is coloured.

Things that are assumptions until those runs pass:

- The two pinned npm versions were written from memory. If `docker build`
  reports that a version does not exist, change it in **both**
  `docker/remotion-sandbox/package.json` and the template in
  `src/filesystem.rs`.
- Remotion's bundler is expected to handle the KaTeX stylesheet and its font
  files without extra configuration. If the bundle step complains about
  `.css` or `.woff2`, that assumption is wrong.

## Rolling back

Set `REMOTION_MAX_REPAIRS=0` to turn the repair loop off without a rebuild. The
KaTeX and highlighting support has no switch: revert the prompt edits in
`src/generator.rs` to stop the model using them. The extra packages in the
image are harmless if unused.
