# Animato frontend plan v2

The build spec for `animation_frontend/`. It is written for the Claude Code cloud sessions that build the
frontend, and for the owner who reviews their work. It replaces the F0–F11 plan (still in git history:
`git show HEAD~1:animation_frontend/frontendplan.md` once this file is committed).

Read sections 0 to 4 before writing any code. Sections 5 to 15 are the specification. Section 16 is the order of
work. Section 17 lists what the backend does not provide yet.

---

## 0. How to use this document

### 0.1 Reading order for a new session

1. Repo-root `CLAUDE.md` (layout, rules, `.gitignore` traps). If it does not exist, do Phase P0 first.
2. This file, sections 0 to 4.
3. `animation_frontend/DESIGN_NOTES.md` (architecture as built, crates audit, decisions).
4. `animation_frontend/PROGRESS.md` (which phase is next).
5. The backend files listed in section 2.1, read-only, whenever a task touches an endpoint.

### 0.2 Hard rules

1. **Never modify `api_server/`, `remotion_worker/` or `manim_worker/`.** They are the source of truth. When the
   frontend needs something they do not provide, design around it and add a row to section 17.
2. **No mocks in the normal dev run.** MSW exists only for the Playwright e2e build (`npm run build:mocks`).
3. **No invented facts in the product.** No fake testimonials, fake logos, fake usage numbers, fake ETAs, or
   features that do not exist. Every claim on the landing and pricing pages must be true in the build that ships.
4. **The final video is the product.** Every screen either helps make the video, finish the video or get the video
   out. A screen that does none of these is cut.
5. **Vello draws every 2D graphic** (text, captions, titles, shapes, logos, cards, progress bars, watermark). Video
   frames are composited by the GPU compositor. Nothing else draws graphics into the output video.
6. **One session, one phase.** Finish a phase (section 16), commit it in small commits, update `PROGRESS.md`, then
   stop and report, unless the prompt says to continue.
7. **Never print or log secrets**, tokens, verification codes, reset tokens, presigned URLs or passwords. Never read
   `.env` files.
8. **Do not claim what you did not run.** If a service cannot run in the sandbox, say so in the report.

### 0.3 Status markers used in PROGRESS.md

| Marker | Meaning |
|---|---|
| `todo` | Not started |
| `wip` | Started, not passing its acceptance checks |
| `done` | Acceptance checks pass; commit hash recorded |
| `blocked` | Needs a backend change (section 17) or an owner decision (section 18) |

### 0.4 Decision records

Every decision that picks one approach over another gets one line in `DESIGN_NOTES.md` section 5, in the form
"**Topic.** Decision, because reason." Decisions this plan already makes are in section 18.2; do not re-litigate
them in code review, change them only with the owner.

---

## 1. Product north star

### 1.1 One sentence

**Describe an idea. Animato animates it. Finish it for any feed in one click.**

### 1.2 The story the whole product tells

Creators need visuals: the explainer diagram, the animated chart, the kinetic quote, the B-roll that makes a
talking-head video watchable. Making them by hand takes hours in After Effects or Manim. Animato makes them from a
sentence, then turns them into a post-ready video (format, title, captions, brand, music) in the browser, with no
upload and no render bill for edits.

There is one object in the product: **a video**. A video starts as a prompt, becomes a render, gets finished, and is
exported. The user never feels they moved between "the generator", "the editor" and "the library". They are three
states of the same thing.

```
 Describe ──▶ Render ──▶ Finish ──▶ Export
 (Create)     (server)   (browser)   (browser)
    ▲                                   │
    └──────── Remix / another take ─────┘
```

### 1.3 Who it is for

Primary: **short-form explainer creators** who publish weekly on YouTube Shorts, TikTok, Instagram Reels and
LinkedIn: science, maths, tech, finance and "how it works" accounts, teachers and course creators.

Secondary: indie founders and marketers who need a product teaser, an animated stat or a launch clip.

What they share: they already make videos, they are time-poor, they pay for tools that save hours every week, and
they live or die by retention in the first two seconds of a post.

### 1.4 Jobs to be done

1. "When I explain an idea, give me an animation of it without learning motion design."
2. "When I have the animation, make it postable as a Short, a YouTube video or a square post without re-editing."
3. "When I post, make it look like my brand and keep people watching (hook title, captions, end card)."
4. "When I record my voice over it, caption it for me, privately."
5. Later: "When I have a talking-head clip, drop my animations in as B-roll where I say so."

### 1.5 What Animato is not

- Not a general-purpose video editor. The timeline exists for fine-tuning, behind one click, never as the default.
- Not a stock-footage or stock-music library.
- Not four products stacked together. There is no separate "Templates app", "Brand app" or "Editor app" in the
  navigation; those are panels inside the flow.

### 1.6 Business goal and what it implies for the frontend

Goal: **500 paying users at $20/month within 5 months of launch** ($10,000 MRR).

Rough funnel, with every number an assumption to replace with real data after launch:

| Stage | Assumption | Needed |
|---|---|---|
| Paying users | target | 500 |
| Free → paid | 4% of activated users | ~12,500 activated |
| Signup → activated (first video finished and exported) | 40% | ~31,000 signups |
| Visitor → signup | 4% (strong hero, prompt-first) | ~780,000 visitors over 5 months |

780,000 visitors from a standing start is only plausible if **every exported video markets the product**. So the
frontend must build in, from day one:

1. **Time to first result under 3 minutes** from landing to a playing video (section 5.1). Activation is the lever
   that moves every later number.
2. **A built-in viral loop**: a tasteful "Made with Animato" mark and end card on free exports, and remix links that
   open the same prompt for anyone (section 12).
3. **Output people want to post**: formats for every feed, hook titles, captions, brand. A raw 480p landscape clip
   does not get posted; a finished vertical Short does.
4. **Retention through habit**: the second video must be faster than the first (brand kit remembered, last format
   remembered, starters, remix of own past videos).

### 1.7 Experience principles

Use these to settle any design question not answered elsewhere.

1. **Time to first result beats everything.** Every screen between "I have an idea" and "I see my video" must
   justify its existence. Default every option; ask nothing that can be inferred.
2. **The video is the colour.** The interface is quiet and neutral so the user's video is the most vivid thing on
   screen.
3. **One primary action per screen.** It is obvious, it is the same colour everywhere, and it is where the eye lands.
4. **Progressive disclosure.** Simple first; power is one click away (Fine-tune, Advanced), never in the way.
5. **Honest system status.** Show what the server is really doing, in plain words. Never fake progress or an ETA.
6. **Nothing is lost.** Autosave everything, undo everything, and say where things are stored.
7. **Fast feels premium.** Instant feedback (under 100 ms) for every click, optimistic UI where safe, no layout
   shift, no spinners where a skeleton or a real preview can show.

---

## 2. Ground truth: what exists today

Everything in this section was read from the code on 2026-10-16. Re-verify anything a task depends on.

### 2.1 Backend files to read (read-only)

| Topic | File |
|---|---|
| Route table | `api_server/src/routes/routes.rs`, `api_server/src/routes/jobroutes.rs`, `api_server/src/main.rs` |
| Auth handlers and messages | `api_server/src/controller/authcontroller.rs` |
| Job handlers and response shapes | `api_server/src/controller/jobcontroller.rs` |
| Request validation | `api_server/src/schema/types.rs` |
| Job model and statuses | `api_server/src/models/jobmodel.rs` |
| Session and verified gates | `api_server/src/middleware/authmiddleware.rs`, `verifiedmiddleware.rs` |
| Rate limits | `api_server/src/middleware/ratelimit.rs` |
| Cookie | `api_server/src/utils/setcookie.rs` |
| Reset email link | `api_server/src/utils/mailer.rs` |
| Remotion output facts | `remotion_worker/src/generator.rs`, `filesystem.rs`, `processor.rs` |
| Manim output facts | `manim_worker/src/docker.rs`, `processor.rs`, `services/job_service.rs` |

### 2.2 The API contract

All responses are JSON `{ success: boolean, message?: string, ... }`. The session is an HttpOnly cookie set by
signup and login; JavaScript never sees it. In development, Vite proxies `/api` to `http://localhost:5000`, so every
call is same-origin.

| Call | Request | Success | Failures |
|---|---|---|---|
| `POST /api/auth/signup` | `{ username (3–30), email, password (8–72) }` | 201 `{ user: { email, username, is_verified } }` + cookie | 400 validation message; 409 "User already exists"; 429 (5/hour/IP) |
| `POST /api/auth/login` | `{ email, password (non-empty) }` | 200 `{ user }` + cookie | 401 "Invalid credentials" (same for unknown email and wrong password); 429 (20/15 min/IP, failed attempts per email) |
| `POST /api/auth/logout` | none | 200, cookie cleared | none expected |
| `POST /api/auth/verify-email` (session) | `{ code }` | 200 `{ user }` (also 200 with `user` when already verified) | 400 invalid or expired code; 401 |
| `POST /api/auth/resend-verification` (session) | none | 200 "Verification code sent"; 200 "Email already verified" **without** `user` | 429 (cooldown and daily cap); 401 |
| `POST /api/auth/forgot-password` | `{ email }` | 200, always the same neutral message | 400; 429 (3/hour/email, 10/hour/IP) |
| `POST /api/auth/reset-password/{token}` | `{ password (8–72) }` | 200 "Password reset successful" | 400 "Invalid or expired reset token"; 429 (10/hour/IP) |
| `GET /api/auth/check-auth` | none | 200 `{ user + created_at, last_login }` | 401 "Not authenticated" or "Invalid or expired token" |
| `POST /api/jobs` (session + verified) | `{ prompt (10–2000 chars), library: "manim" \| "remotion" }` | 200 `{ data: { job_id, library, status } }` | 400 "Prompt must be between 10 and 2000 characters"; 4xx "Invalid request body" (axum rejection, e.g. unknown library); 401; 403 (unverified); 429 quota with `Retry-After`; 500 "Internal server error" (also when the quota store is down: the job is refused) |
| `GET /api/jobs/{uuid}` (session + verified) | none | 200 `{ data: { job_id, library, status, video_path, duration_seconds, file_size_bytes, render_time_ms, error_message } }` | 400 "Invalid job id"; 404 "Render job not found" (also for another user's job); 401; 403 |
| `GET /api/jobs/{uuid}/video` (session + verified) | none | **302** to a presigned S3 URL valid for 1 hour, `Cache-Control: no-store` | 404 "Video not available" (not completed, or a legacy local path) |

Every 429 carries `Retry-After` in seconds and the message "Too many requests, try again later".

The reset email links to `FRONTEND_URL/reset-password/<token>`; the frontend route `/reset-password/:token` must keep
that exact shape.

### 2.3 What the render workers produce

| Fact | Remotion worker | Manim worker |
|---|---|---|
| Code author | Gemini writes a Remotion TSX scene | Gemini writes a Manim scene |
| Canvas | Designed at 1920×1080, rendered at **854×480** | Manim `-ql` preset (480p; verify the frame rate in `docker.rs`) |
| Frame rate | **20 fps** | Manim low-quality preset |
| Duration | Chosen by the model, clamped to **5–60 s** (default 15 s) | Chosen by the scene |
| Aspect | **Always 16:9** | **Always 16:9** |
| Audio | None expected | None expected |
| Storage | S3 key `renders/<job_id>.mp4`, private bucket | same |
| Retries | On a render error the worker asks Gemini for a fix; status goes **back** to `GeneratingCode` | similar retry handling; verify in `processor.rs` |

Status sequence: `Pending → GeneratingCode → Rendering → Uploading → Completed`, or `Failed` at any point.
`GeneratingCode` can reappear after `Rendering` (an automatic fix attempt).

Consequences for the frontend:

1. **Aspect ratio cannot be requested from the server.** The current Create page folds "Format: 9:16 vertical"
   into the prompt, which contradicts the worker's fixed 16:9 stage. Remove aspect from the prompt. Formats are a
   Finish-step feature (section 7).
2. **Generated videos are silent.** Captions come from the user's own voice (section 9), never from the render.
3. **Generated videos are 480p.** Exports are 1080p canvases; Vello graphics are drawn at full output resolution, so
   text stays crisp, but the animation itself is upscaled. Section 17 row G1 asks the backend for 1080p renders.
   Until then, never claim "1080p/4K animations"; claim "1080p export".
4. **`GET /api/jobs/{id}` does not return the prompt or created time,** and there is no list endpoint. Prompts and
   history live in IndexedDB (they already do: `jobsTable`).
5. **`error_message` is raw worker output** (can contain Docker stderr). Show a friendly message; raw text only
   behind "Technical details", truncated, as plain text.

### 2.4 The frontend today

Stack: React 19, Vite 8, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`: no `enum`), Tailwind v4 with
tokens only, react-router 7 data router, TanStack Query, zustand, Framer Motion (`motion`), GSAP (landing only),
zod, react-hook-form, mediabunny, `@huggingface/transformers` (Whisper), Playwright, ESLint + oxlint + Prettier.

| Area | State | Problems to fix |
|---|---|---|
| API layer `src/lib/api/` | Real endpoints, zod validated, `ApiError` with `retryAfter` | Mocks on by default (`.env.development`); contract not re-checked against code since the last backend changes |
| Mocks `src/mocks/` | MSW for every endpoint | Must be e2e-only |
| Auth pages | Login, signup, verify (OTP), forgot, reset | `VerifyEmailPage` has a mock-only branch |
| Home, Create, Job page | Working against mocks | Create folds aspect into the prompt (wrong, see 2.3); Job page is a separate place from the editor |
| Projects, Templates, Brand, Settings | Separate nav entries | Product feels like several apps; Templates is a page instead of starters inside Create |
| Editor `src/features/editor/` | Timeline, compositor, audio worklet, Whisper, export | `media/client.ts` and `media/library.ts` are **missing** (dropped by the root `.gitignore` rule `media/`); text and captions drawn by glyphon/Canvas2D, not Vello |
| Landing `src/features/landing/` | GSAP storytelling, live WASM demo | **Invented testimonials** (`TESTIMONIALS`), a logo strip to verify, a $2,000 "Studio" tier, "4K" claims, "ETA" claims |
| `src/wasm/pkg` | Built `animato-wasm` (committed) | Fine |
| `packages/render-engine` (`@tooscut/render-engine`) | Copied in | **Orphaned**: not a dependency, `wasm/` missing, `dist/` gitignored, `package.json` uses pnpm `catalog:` specifiers and a `pnpm` script that break npm workspaces |
| `src/workers/` | Tooscut workers (compositor, frame renderer, audio render, waveform) | **Orphaned**: nothing imports them; they import `@tooscut/render-engine` |
| `crates/offcut-scene`, `offcut-render`, `offcut-wasm-render` | Vello/parley graphics pipeline | **Not built**: not workspace members, `vello`/`parley` not in workspace dependencies, need a newer wgpu than the compositor's wgpu 24 |
| `crates/offcut-detect`, `offcut-entitlement`, `offcut-api-types` | From another product | Not used. `offcut-entitlement` (ed25519 licence tokens) may help in the billing phase; leave it |

### 2.5 The Vello pipeline already in `crates/`

This is the foundation for every graphic in the product. Understand it before Phase P5.

- `offcut-scene` turns inputs into a `Scene`, built once. `Scene::frame_at(t)` is a **pure function** of the scene
  and a time that returns a `DisplayList`. No GPU, no clock, no decoder.
- `DisplayList` (`offcut-scene/src/display_list.rs`) is a backend-neutral list of `DrawCmd`: `FillRect` (with
  radius), `FillPath`, `GlyphRun` (font id, size, positioned glyphs, fill, optional stroke, affine transform, and the
  plain `text` kept as a Canvas2D seam), `PushLayer { opacity, clip }`, `PopLayer`. Lengths are output pixels.
- Layout uses **parley**; fonts are embedded (`assets/fonts/`: Inter variable, JetBrains Mono variable, Noto Emoji
  variable, with `LICENSES.md`).
- `offcut-render` owns one wgpu device: a video pass (frame, crop, rotation), an `Overlay` that draws a
  `DisplayList` with **Vello** into an `Rgba8Unorm` storage texture (`vello_backend.rs`), and a composite pass.
- `offcut-scene` also has `anim.rs`, `easing.rs`, `captions.rs` (word-timed caption chunks with an active-word
  colour), `safe_area.rs`, `framing.rs` and `events/number_reveal.rs`.
- Tests already prove determinism (two builds draw identical frames), safe-area containment and resolution scaling.

What it lacks for Animato: images (logos), gradients, stroked paths, soft shadows, a "below the video" layer, and an
input model that is not Offcut's transcript/event types. Section 8 specifies the changes.

---

## 3. Product shape

### 3.1 Information architecture

The app has **two places** and a few panels.

```
/                      Landing (marketing, prompt-first hero)
/pricing               Pricing
/login /signup /verify-email /forgot-password /reset-password/:token
/app                   Videos (home): every video, newest first, plus the composer on top
/app/new               Create (full-screen composer); also opened as a sheet from anywhere
/app/v/:videoId        The video: Rendering → Ready → Finish → Export, one page, four states
/app/brand             Brand kit (also reachable as a panel inside Finish)
/app/settings          Settings (account, preferences, storage)
```

Redirects for old routes, so no link breaks:

| Old | New |
|---|---|
| `/app/create` (with `?prompt=`) | `/app/new` (keep the query) |
| `/app/jobs/:jobId` | `/app/v/:videoId` of the video that owns that job (create one if this browser has none) |
| `/app/projects` | `/app` |
| `/app/projects/:id/edit` | `/app/v/:id?mode=timeline` |
| `/app/templates` | `/app/new` (starters are inside Create) |

### 3.2 Navigation

A slim top bar, not a sidebar (more canvas, calmer):

```
[Animato]   Videos                                [ + New video ]   (avatar ▾)
```

- `+ New video` is the primary action everywhere in the app. Keyboard: `N`, and `⌘K → New video`.
- The avatar menu holds Brand kit, Settings, Pricing, Keyboard shortcuts, Log out.
- On the video page the top bar becomes the video's own bar (section 6.6).

### 3.3 The one object: Video

A **Video** is the local record the user sees (stored in IndexedDB, today's `Project`, renamed in the UI only; keep
the table name to avoid a migration of the store name). It holds:

| Field | Meaning |
|---|---|
| `title` | Editable; defaults to a short title derived from the prompt ("Title derivation" in Phase P6) |
| `takes` | The generations: each is a job id, its prompt, engine, options and observed status. One is `selectedTake` |
| `assets` | Media in this video with a role: `main`, `broll`, `music`, `voice`, `logo` (section 10.4) |
| `timeline` | The edit (Timeline v2, section 10.2) |
| `graphics` | Titles, captions, cards, watermark (Graphics document, section 8.4) |
| `transcript` | Word-timed transcript of the voice, if any (section 9) |
| `format` | `16:9`, `9:16` or `1:1`; remembered per user as the default for the next video |
| `look` | The layout preset (section 7.3) |
| `exports` | Export history (existing `exportsTable`) |

Creating a job **always** creates or updates a Video. A user never sees a job without its video.

### 3.4 Video states and what the video page shows

| State | Trigger | The page shows |
|---|---|---|
| `drafting` | Video created from Create, job not yet accepted | Prompt card with a 3-second "Starting…" and Cancel (first run only, section 5.1) |
| `rendering` | Job accepted, status not terminal | Render view (section 6.5) |
| `failed` | Status `Failed` | Friendly failure, "Try again" (new take), "Edit prompt", technical details collapsed |
| `ready` | Status `Completed` and video imported to OPFS | Finish view, simple mode (section 6.6) |
| `ready-remote` | `Completed` but import failed (CORS, network, expired) | Plain `<video>` player from `/api/jobs/:id/video`, Download, and a clear note why Finish is unavailable, with Retry import |
| `expired` | Video URL 404 after completion | "This render has expired" and "Render again" |

---

## 4. Current problems, in priority order

1. The app talks to mocks in development (`VITE_USE_MOCKS=true`).
2. The editor does not build: `src/features/editor/media/` is missing.
3. The new modules (`packages/render-engine`, `src/workers`, the Vello crates) are not wired.
4. Create promises aspect ratios the server cannot produce.
5. The landing page has invented testimonials and logos, a $2,000 tier and 4K claims.
6. The product reads as five apps (Create, Projects, Templates, Brand, Editor) instead of one flow.
7. Text and captions in exports are not drawn by Vello.
8. No viral loop: no watermark, no end card, no remix link.
9. The design leans "AI startup" (tri-colour gradients, glass, glow) rather than quiet and premium.
10. No seam for the future AI editor: edits are not a serialisable command list, there is no transcript store and no
    asset roles.

---

## 5. Key journeys and their budgets

Times are wall-clock targets on a mid-range 2022 laptop on home broadband. Render time is the server's; measure it
from `render_time_ms` and the observed status timestamps, and show the real number once known.

### 5.1 J1: first visit to first video (activation)

Budget: **under 3 minutes to a playing video**, excluding server render time; under 6 minutes including it.

| Step | What the user does | What the product does | Budget |
|---|---|---|---|
| 1 | Lands on `/` | Hero shows a prompt box with a rotating real example and a real render playing beside it | LCP < 2.0 s |
| 2 | Types an idea (or taps a starter chip) and presses Generate | Saves it as the pending prompt; opens signup as a sheet over the landing page (not a new page), with the prompt visible above the form | < 100 ms |
| 3 | Fills username, email, password | Inline validation as they type, using the server's exact rules | 30 s |
| 4 | Gets the 6-digit email | Verify screen says which address, supports paste and `autocomplete="one-time-code"`, shows "Check spam" after 30 s, resend with countdown | 60 s |
| 5 | Enters the code | On success: goes straight to `/app/v/<new>` in `drafting`, shows the prompt, "Starting your first video…" with a 3-second Cancel, then posts the job | 3 s |
| 6 | Waits | Render view: plain-language stages, real elapsed time, what happens next, a muted looping sample of a similar video, an offer to set up the brand kit (two fields) | render time |
| 7 | Video is ready | Title/tab badge flips to "Ready", optional system notification, the video autoplays muted in the Finish view in the user's last-used format (default 9:16 for first-time users, see 18.2) | < 1.5 s after import |

Rules:
- The pending prompt survives the whole signup (already `src/features/auth/pendingPrompt.ts`, `sessionStorage`).
  Extend it to keep the engine choice and to survive a login of an existing user.
- If the visitor already has an account, the sheet offers "Log in instead" with the email prefilled; after login the
  same auto-start applies.
- The 3-second Cancel applies only to the very first auto-started video. Every later video is started explicitly.
- If the job is refused (429, 500), the video stays in `drafting` with the prompt intact and a clear message.

### 5.2 J2: returning creator, idea to posted Short

Budget: **under 5 minutes plus render time.**

1. `N` or `+ New video` → composer (last engine, length and style remembered).
2. Generate → render view → Ready.
3. Finish opens in the last-used format and look, with the brand kit applied and a hook title already set.
4. Optional: record a voiceover (one button), captions appear automatically.
5. Export → "Shorts / Reels / TikTok" preset is preselected → Download.

### 5.3 J3: a render fails

1. The video page shows "That one didn't render" with one sentence of likely cause (section 11.4), never raw stderr.
2. Primary action "Try again" starts a new take with the same prompt. Secondary "Edit prompt" opens the composer
   with the prompt. The quota cost is stated: "Uses 1 of your renders."
3. Earlier takes stay in the takes strip.

### 5.4 J4: one video, every feed

On Ready, the format control switches 16:9 / 9:16 / 1:1 instantly (graphics re-layout via Vello, no re-render on the
server). Export can produce all three in one go ("Export all formats"), one after another, with one progress list.

### 5.5 J5: voice and captions

1. "Add voice" → record (with the video playing, count-in 3-2-1) or upload an audio file.
2. Audio is cleaned (normalize, gate) with defaults on.
3. Whisper runs on device (first time: "Downloading the speech model (about 40 MB), once"). Word timestamps arrive.
4. Captions appear with the look's caption style, active word highlighted. Click a word to fix it.

### 5.6 J6 (later): AI edit (not built now; seams in section 13)

The user has a main clip, B-roll clips with notes, a music track and a transcript. They type "put clip 1 when I say
'derivative' and clip 2 at the end, music low". The assistant returns an edit plan, the Finish preview updates, and
"Undo AI edit" reverts it in one step.

---

## 6. Screen specifications

Each screen lists purpose, layout, content, states, data and acceptance checks. Copy in quotes is the intended
wording; refine it, but keep its meaning and length.

### 6.1 Landing `/`

Purpose: get a visitor to type an idea. The prompt box is the hero; the product proves itself with real renders.

Layout, top to bottom, at 1440 px wide:

1. **Top bar**: wordmark left; "Pricing", "Log in" and a "Start free" pill right. Transparent until scroll, then a
   solid surface with a hairline bottom border.
2. **Hero** (100 vh max, 720 px min):
   - Eyebrow: "Text to animated video".
   - Headline (display, 72–80 px, tight tracking, two lines max): "Explain anything. In motion."
   - Sub (20 px, muted, one sentence): "Describe an idea. Animato animates it, then makes it ready for Shorts,
     Reels and YouTube."
   - **Prompt box**: 2-line textarea, placeholder cycles through real example prompts every 4 s (stops on focus),
     engine pill "Auto" inside the box, "Generate" button inside the box (primary). Enter submits, Shift+Enter
     newline. Under it: four starter chips ("Fourier epicycles", "Binary search", "Kinetic quote", "Stat reveal").
   - Beside or below the box: a **real render** in a device-free frame, 16:9 morphing to 9:16 with a Vello title and
     captions (pre-rendered WebM in `public/media/`, made by the product itself once Phase P6 exists; until then the
     existing sample renders).
3. **How it works** (three steps, each with a real looping clip): "Describe" → "Animate" → "Finish".
4. **Two engines, plainly**: two cards. "Explainers" (Manim: maths, science, algorithms, exact diagrams) and "Motion
   graphics" (Remotion: titles, stats, product teasers, kinetic type). Each with one real render and its prompt.
5. **Every feed**: one render shown as 16:9, 9:16 and 1:1 side by side, with the copy "One render. Every format.
   Re-laid out in your browser."
6. **Your voice, captioned privately**: a clip with captions; copy "Record a voiceover. Captions are made on your
   device. Your audio never leaves it."
7. **Pricing preview**: the two plans (section 14), "See pricing".
8. **FAQ**: six questions max, all true (reuse `FAQS`, fix answers that mention removed features).
9. **Final CTA**: the prompt box again.
10. **Footer**: product, pricing, privacy note, terms placeholder, contact email.

Remove: `Testimonials` section and `TESTIMONIALS` data (invented); `LogoStrip` unless every logo is a real customer
with permission (there are none yet, so remove); command palette as a marketing feature; 4K claims; "ETA" claims;
`EditorSpotlight` copy about features that are not in the shipped build.

Behaviour:
- Generate while logged out → signup sheet (J1). Logged in → `/app/new?prompt=…`: the composer opens with the prompt
  filled and Generate focused; the user starts the job explicitly.
- `?prompt=` and `?engine=` in the landing URL prefill the box (remix links, section 12.2). Sanitize: trim, cap at
  2,000 chars, strip control characters; never render as HTML.
- GSAP is loaded only on the landing page; the WASM demo loads only when its section is near the viewport.

Acceptance:
- No section claims a feature the build does not have (checklist in section 15.6).
- Lighthouse on the production build: Performance ≥ 90, Accessibility ≥ 95, CLS < 0.05.
- At 390 px wide, no horizontal scroll; the prompt box is fully usable with the on-screen keyboard open.

### 6.2 Auth screens

All auth screens share one centred card (max 400 px) on the quiet canvas, wordmark above, legal line below. As a
sheet over the landing page when opened from the hero (same component).

| Screen | Fields | Specific rules |
|---|---|---|
| Sign up | username, email, password | Client rules = server rules (2.2). Show password rules as a quiet line that ticks as they are met. 409 → "That email already has an account" + "Log in" link with the email carried over |
| Log in | email, password | 401 → server message + "No account yet? Sign up" with the email carried over (no account enumeration). "Forgot password?" link |
| Verify email | 6 boxes | Auto-advance, paste fills all, auto-submit on the sixth digit, `inputmode="numeric"`, `autocomplete="one-time-code"`. Shows the address. Resend: 60 s countdown, 429 uses `Retry-After`. "Use a different account" logs out. After 5 wrong codes: "This code is locked. Send a new one." |
| Forgot password | email | Always the same neutral confirmation |
| Reset password | password, confirm | Token must be 40 hex characters or show "This link is not valid" without a request; success replaces history with `/login` and a toast "Password changed. Log in with your new password." |

Remove `VerifyEmailPage`'s `MOCKS` branch from the dev path (the e2e build may keep a test hook, behind
`import.meta.env.VITE_USE_MOCKS === 'true'` only in the e2e bundle).

Acceptance: every row of the auth table in 2.2 has a visible, correct UI response; a full J1 runs against the real
API locally.

### 6.3 Videos (home) `/app`

Purpose: start a new video in one keystroke and get back to recent ones.

Layout:
1. **Composer strip** at the top: the same prompt box as the landing hero, compact (one line, expands on focus),
   with the engine pill and Generate. Placeholder: "What should we animate next?"
2. **Videos grid**: cards newest first. Each card: poster frame (real frame or live status), title, relative time,
   a status chip only when not ready (Rendering 2:14, Failed), format badge. Hover: plays the video muted (ready ones).
   Card menu: Rename, Duplicate, Remix (opens composer with the prompt), Delete (confirm; says what is deleted: the
   local edit and exports, not the server render).
3. **Empty state** (first visit after J1 or a cleared browser): one sentence, three starter cards with real renders,
   and a note: "Your videos are stored in this browser."

Data: `projectsTable` (videos), `jobsTable`, TanStack Query for each running job's status (one poller per job, shared
with the video page).

States: skeleton grid on first load (no spinner); a banner when storage persistence is not granted ("Keep my videos:
allow storage" button calling `navigator.storage.persist()`).

Acceptance: the grid renders 100 videos without jank (virtualize beyond 60); running jobs update live; a video
created in another tab appears within 2 s (BroadcastChannel).

### 6.4 Create `/app/new` (and the composer sheet)

Purpose: turn an idea into a good prompt fast, with smart defaults.

Layout (full screen on `/app/new`; a bottom sheet elsewhere):

1. **Prompt** textarea, auto-growing, with a live character counter that only appears past 1,600 characters.
2. **Engine**: segmented control "Auto · Explainer (Manim) · Motion (Remotion)". Auto uses `pickEngine` and shows
   the reason in a tooltip ("Picked Explainer because you mentioned 'derivative'"). Default Auto.
3. **Options row** (all optional, all remembered): Length "Short ~10 s · Medium ~20 s · Long ~45 s" (a hint in the
   prompt, see below); Style "Clean · Bold · Playful · Technical" (a hint); "Use my brand colours" toggle (only when a
   brand kit exists).
4. **Starters**: a horizontal row of 8 starter cards (real render loop, title, engine). Tapping fills the prompt.
   These replace the Templates page. Data: `src/features/templates/data.ts` reduced to the starters that have real
   renders.
5. **Improve** text button: applies the deterministic local rewrite (`enhancePrompt`) inline, with Undo. No diff
   dialog. Label it honestly: "Tidy up my prompt".
6. **Primary**: "Generate" (`⌘↵`). Under it, the honest quota line: "Up to 5 renders an hour and 15 a day during
   early access." (constants in `src/lib/entitlements.ts`, must match `api_server` defaults; see 14.3).
7. A collapsed "What we send" disclosure that shows the exact server prompt (`buildServerPrompt`).

Server prompt rules (change `src/features/create/prompt.ts`):
- **Remove aspect** from the server prompt (2.3). Keep length and style hints. Keep brand colours, fonts and tone
  when the toggle is on.
- Never exceed 2,000 characters; show the existing over-length message.

Submit:
1. Create the Video (local) with a take in `drafting`.
2. `POST /api/jobs`. On success, store the job id on the take and navigate to `/app/v/:videoId`.
3. On failure, keep the composer open with the prompt and show the mapped error (section 11.4). 403 → re-check auth
   (the guard moves an unverified user to verify).

Acceptance: from `N` to a posted job in two interactions (type, ⌘↵); options persist across reloads; the server
prompt never contains an aspect ratio.

### 6.5 Video page: Rendering state

Purpose: make the wait feel short and honest, and get the user ready to finish.

Layout:
- Centre: a card at the size of the final preview. Inside: the prompt (quoted, two lines, expandable), the engine
  icon, and a **stage list**:

| Status | Stage label | Detail line |
|---|---|---|
| `Pending` | "Queued" | "Waiting for a renderer." |
| `GeneratingCode` | "Writing the animation" | "Turning your idea into an animation script." |
| `GeneratingCode` after `Rendering` | "Fixing a render error" | "The first attempt failed to render. Trying a corrected version." |
| `Rendering` | "Rendering frames" | "Drawing every frame." |
| `Uploading` | "Finishing" | "Saving your video." |
| `Completed` | "Ready" | (page switches to Finish) |
| `Failed` | "Didn't render" | (page switches to failed state) |

- Each stage shows real elapsed time once reached. No percentage (the server provides none). An indeterminate
  shimmer on the active stage only.
- "Usually takes about N min": only when this browser has at least 3 completed renders for the engine; N is their
  median. Otherwise no estimate.
- Below the card: two quiet, optional actions that use the wait: "Set up your brand kit" (inline: logo and two
  colours) and "Draft your next idea" (opens the composer sheet; does not leave the page).
- Tab title becomes "Rendering… · Animato"; on completion "✓ Ready · Animato". Offer browser notifications once,
  after the first render starts ("Notify me when it's ready"), never before.

Polling (section 11.3) runs on this page and keeps running in the background from the Videos grid.

Prefetch: the moment status is `Completed`, start importing the video into OPFS (section 11.5) so Finish opens
instantly.

Acceptance: refreshing mid-render resumes; closing the tab and coming back later shows the right state; a backward
transition to `GeneratingCode` shows the fixing stage.

### 6.6 Video page: Ready and Finish (the editor, simple mode)

Purpose: the generated video becomes a postable video in one click; deeper control is one click away.

Desktop layout (≥ 1280 px):

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Videos   Title (editable)        Takes ▾       Undo Redo   [ Export ]    │
├──────────┬───────────────────────────────────────────────┬─────────────────┤
│ Assets   │                                               │ Format          │
│ (rail,   │              PREVIEW (WebGPU)                 │ Look            │
│ collaps- │         format frame, safe-area guides        │ Title           │
│ ible)    │                                               │ Captions        │
│          │   ▶  00:04 / 00:18   ───────●───────────      │ Brand           │
│          │                                               │ Music           │
│          │                                               │ End card        │
├──────────┴───────────────────────────────────────────────┴─────────────────┤
│ Takes strip (simple)  ·  or Timeline (fine-tune, toggled with T)           │
└────────────────────────────────────────────────────────────────────────────┘
```

Inspector sections (right, 340 px, one scrolling column, each a quiet header with the control below):

1. **Format**: segmented 16:9 / 9:16 / 1:1. Switching re-lays out instantly (Vello), keeps the user's edits.
2. **Look**: four presets as small live thumbnails rendered by the real Vello pipeline (section 7.3).
3. **Title**: text field (hook title), on/off, position (top/centre), duration (first 3 s by default).
4. **Captions**: shown when a transcript exists; style picker (3 styles), on/off, position. When no transcript:
   "Add your voice to get captions" button (J5).
5. **Brand**: logo on/off, use brand colours on/off; "Edit brand kit" opens the brand panel.
6. **Music**: "Add music" (file import); volume; "Lower under voice" (ducking) on by default.
7. **End card**: on/off; headline ("Follow for more"), sub line (handle), logo; 2 s default.
8. **Watermark**: shown as "Made with Animato" with a lock-free toggle during early access (section 14).

Bottom:
- **Takes strip** (simple mode): thumbnails of every take with status; click selects the take as the main clip;
  "+ Another take" starts a new job with the same prompt (states the quota cost).
- **Timeline** (fine-tune mode, `T` or "Timeline" button): the multi-track timeline from the current editor,
  restyled (section 7) and driven by Timeline v2 (section 10). A Graphics lane shows titles, captions and cards as
  clips that can be moved and trimmed.

Left rail **Assets** (collapsed by default to icons; expands to 260 px):
- **Main**: the selected take (or the user's own clip).
- **B-roll**: list of slots "Clip 1, Clip 2, …"; each holds an imported file or another Animato render; optional
  note field ("What is this clip?"), stored for later (section 13). "Insert at playhead" places it on the video
  track above the main clip. "Generate a clip" opens the composer sheet; the new render lands in the next slot when
  ready.
- **Music**, **Voice**: the audio assets.
- The rail is where the future **Assistant** tab will live (section 13.6); leave a tab header slot, render nothing.

Phone and small tablet (< 900 px): Finish shows the preview, Format, Look, Title, Export and Download. Timeline,
voice recording and assets are desktop-only with the line "Open on a computer to fine-tune."

Ready actions always visible: Export (primary), and in the Export menu "Download original render" (the raw 480p file).

Acceptance:
- From Ready, choosing 9:16 and pressing Export → a 1080×1920 MP4 with title, brand and watermark drawn by Vello,
  downloaded, with no other interaction (defaults only).
- Every inspector change previews in under 50 ms on a mid-range GPU and is undoable.
- Switching format three times and undoing three times restores the original exactly.

### 6.7 Export (sheet over the video page)

Layout: a sheet (480 px) with:
1. **Preset** list (one selected): "Shorts · Reels · TikTok — 1080×1920", "YouTube — 1920×1080", "Square post —
   1080×1080". Selecting a preset switches the video's format if different (with a note).
2. **Quality**: "Standard" (default bitrate) / "Small file" (lower bitrate). Hidden under "More" with container
   (MP4 default, WebM) and codec info.
3. **Export all formats** checkbox.
4. Primary "Export". Then a progress row per output: real frames encoded / total, elapsed, measured ETA (computed
   from actual encode speed after 2 s, which is real data, not a guess), Cancel.
5. Done: "Download", "Show in Videos", "Copy remix link", and the file size.

Rules:
- The export renders through the same frame pipeline as the preview (section 8.6). What you see is what you get.
- Exports are kept in OPFS and listed in the video's export history; the Settings storage manager can delete them.
- If the tab is hidden, export continues; the title shows "Exporting 43% · Animato".

Acceptance: 18 s, 1080×1920 export completes on a mid-range laptop in under 60 s; output plays in QuickTime, Chrome
and on an Android phone; captions and title are pixel-identical to the preview at the same frame (snapshot test,
section 15.3).

### 6.8 Brand kit `/app/brand` and panel

Fields: name, logo (PNG/SVG/JPEG, stored in OPFS, drawn by Vello as an image), up to 5 colours (primary, accent,
background, text, extra), heading font and body font (built-in list: Inter, Geist, JetBrains Mono, plus "Upload a
font": TTF or OTF only, stored in OPFS, loaded into Vello and parley), "Add brand colours to prompts" toggle, tone
line. A live preview renders a title card, a caption and an end card with Vello.

One brand kit per user in the UI (the store supports many; keep the data model, simplify the UI).

Acceptance: an uploaded font appears in the Vello preview and in an export; a logo appears in the end card and
watermark-free corner position.

### 6.9 Settings `/app/settings`

Sections: Account (username, email, verified, member since, last login from `check-auth`; Log out), Preferences
(reduced motion, default format, default look, notifications), Storage (usage via `navigator.storage.estimate()`,
persistence state, delete exports, delete media, delete everything local), Privacy (plain list of what leaves the
device: prompts and account data to Animato's server; generated videos come from Animato's storage; voice, captions,
edits and exports never leave the device), About (version, licences of bundled fonts and crates).

### 6.10 Pricing `/pricing`

Two plans side by side (section 14.1), a short comparison list (not a giant table), the FAQ items marked `pricing`,
and the honest note "Billing is not live yet. Everyone is on Free during early access."

### 6.11 System screens

- **404**: one line, link home.
- **Offline banner**: existing component; copy "You're offline. Editing keeps working; new renders need a
  connection."
- **Server unreachable** (status 0 from `request`): a non-blocking banner "Can't reach Animato's server. Retrying…"
  with automatic retry every 5 s on idempotent reads; forms show the error inline.
- **Error boundary**: "Something broke on this screen." Reload button, and a "Copy details" button that copies the
  error name and stack (no user data).
- **Unsupported browser** (no WebCodecs): everything except Finish/Export works; Finish shows "Finishing needs Chrome,
  Edge or another browser with WebCodecs" and offers Download original.

---

## 7. Design system: quiet premium

### 7.1 Direction

Calm, precise, confident. Think of the restraint of Apple's product pages and Final Cut Pro's dark UI: neutral
surfaces, one accent, large type, generous space, crisp hairlines, motion that explains rather than decorates. The
video is the only vivid thing on screen.

Move away from the current look: tri-colour violet/cyan/magenta gradients, glass panels, glows and gradient text.
Keep the token architecture (`src/styles/tokens.css`, `@theme`, Tailwind default palette reset).

### 7.2 Tokens (replace values, keep names where they exist)

Colour, dark theme (default for the app and the marketing site; a light theme is P11, optional):

| Token | Value | Use |
|---|---|---|
| `canvas` | `#0A0A0B` | Page background |
| `surface-1` | `#111113` | Cards, bars |
| `surface-2` | `#18181B` | Raised controls, inputs |
| `surface-3` | `#202024` | Hover |
| `surface-4` | `#2A2A2F` | Pressed, selected |
| `line` | `rgb(255 255 255 / 0.08)` | Hairlines |
| `line-strong` | `rgb(255 255 255 / 0.14)` | Focus-adjacent borders |
| `fg` | `#F5F5F7` | Primary text |
| `fg-muted` | `#A1A1AA` | Secondary text |
| `fg-subtle` | `#8B8B94` | Tertiary text (must still pass 4.5:1 on `canvas` for body sizes) |
| `fg-faint` | `#5E5E66` | Disabled, placeholders (not for essential text) |
| `accent` | one colour, chosen by the session; suggestion `#2F7BF6` (calm blue) | Primary buttons, focus ring, selection, progress |
| `accent-soft` | accent at 14% | Selected backgrounds |
| `status-*` | keep the existing set, desaturated 10–15% | Status chips |

Rules: one accent only. No gradients in UI chrome (gradients are allowed inside rendered videos and brand content).
No glass blur except the top bar on scroll (`backdrop-filter: saturate(180%) blur(20px)` over a 72% surface).
No glow shadows; use the elevation shadows only.

Typography: Geist (display) for headlines and numbers, Inter (UI), JetBrains Mono (timecodes). Display sizes use
tight tracking (`-0.03em` to `-0.045em`); UI text uses normal tracking. Body text 15 px / 24 px. Never more than three
sizes on one screen apart from the hero.

Spacing: 4 px base; section spacing on marketing pages 120–160 px desktop, 72–96 px mobile; app panels 16/24 px.

Radii: controls 10 px, cards 16 px, sheets and dialogs 20 px, primary CTA pills fully round.

Elevation: three shadows (`sm`, `md`, `lg`), all low-opacity black; surfaces also get a 1 px inner top highlight
(`shadow-inner-highlight`).

Motion (mirror in `src/lib/motion.ts`):

| Token | Value | Use |
|---|---|---|
| `duration-instant` | 90 ms | Press feedback |
| `duration-fast` | 160 ms | Hover, toggles |
| `duration-base` | 240 ms | Panels, sheets |
| `duration-slow` | 420 ms | Page transitions, layout morphs |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances |
| `spring` | Framer Motion `{ type: 'spring', stiffness: 380, damping: 32 }` | Shared-element morphs |

Motion rules: animate opacity and transform only; never animate layout properties except through Framer Motion
`layout`; respect reduced motion (OS and in-app preference); no motion on scroll except the landing page.

### 7.3 Looks (layout presets for the rendered video)

Looks are deterministic functions from (format, video rect, title, captions, brand, duration) to a Graphics
document (section 8.4). They are drawn by Vello. Four at launch:

| Look | 16:9 | 9:16 | 1:1 | Captions |
|---|---|---|---|---|
| **Clean** | Video full frame; title lower-left for 3 s | Video centred, background a dimmed, scaled copy of the video; title above; captions below | Video centred, title above | Sentence case, white with dark stroke, active word in accent |
| **Bold** | Hook title large and centred for 2 s with a spring entrance, then video | Big hook title top third, video middle, captions bottom third | Title over top band | Upper case, 2–3 words at a time, pop on each word |
| **Minimal** | No title; thin progress bar at the bottom | Video centred on plain background, small title, progress bar | Same | Small, lower third, no highlight |
| **Brand** | Brand colour band with logo, title in brand heading font | Brand background colour, logo top, title, video, captions in brand colours | Same | Brand colours, active word in brand accent |

All looks keep text inside the platform safe areas (9:16: avoid the bottom 20% and right 15% where platform UI
sits; constants in the graphics crate, tested).

### 7.4 Components (restyle the existing ones in `src/components/ui/`)

| Component | Spec |
|---|---|
| Button | Heights 32/36/44. Primary: accent fill, white text, round pill for marketing CTAs, 10 px radius in app. Secondary: `surface-2` fill, hairline. Ghost: text only. Press: scale 0.98 for 90 ms. Loading: label stays, spinner replaces the icon, width does not change |
| Input / Textarea | `surface-2`, hairline, 10 px radius, 44 px tall on touch; focus: 2 px accent ring offset 2 px |
| Segmented control | One pill track, sliding selected pill (Framer `layoutId`) |
| Card | `surface-1`, 16 px radius, hairline, inner highlight; hover lifts 1 px with `shadow-md` (only on clickable cards) |
| Sheet / Dialog | 20 px radius, `shadow-lg`, backdrop `overlay`; Esc closes; focus trapped; returns focus |
| Toast | Bottom centre, one line, auto-dismiss 4 s, action optional |
| Status chip | Dot + label, status colour, no background fill |
| Skeleton | `surface-2` with a subtle shimmer; matches the final layout exactly |
| Tooltip | 300 ms delay, `surface-4`, 12 px text, shortcut shown as `Kbd` |
| Video card | 16:9 poster area at the video's format aspect, 12 px radius on the media, title below (not overlaid) |

### 7.5 Iconography and imagery

Lucide icons at 1.5 px stroke, 16/20 px. No emoji in UI chrome. Every image on the marketing site is a real render
made by Animato. No stock photos, no 3D blobs, no device mockups.

### 7.6 Accessibility

WCAG 2.2 AA: contrast, focus visible on everything, full keyboard use (including timeline with arrow keys and
shortcuts), labels on all controls, `aria-live="polite"` for render status changes, captions on any marketing video
that has speech (none today), reduced motion honoured. Hit targets ≥ 44 px on touch.

---

## 8. Rendering architecture: GPU video plus Vello graphics

### 8.1 Principle

Two renderers, **one wgpu device**, one frame pipeline used by both preview and export:

```
 Timeline v2 + Graphics document + time t
        │                         │
        ▼                         ▼
 frame-builder (TS, render-engine)   graphics scene (Rust, WASM): frame_at(t)
 → video layers (RenderFrame)        → FrameGraphics { under: DisplayList, over: DisplayList }
        │                         │
        ▼                         ▼
 ┌──────────────────────── one wgpu device (WebGPU) ───────────────────────┐
 │ 1. Vello draws `under` into texture U (backgrounds, cards behind video) │
 │ 2. Compositor draws video layers over U into texture V                  │
 │ 3. Vello draws `over` into texture O (titles, captions, logo, end card) │
 │ 4. Composite pass: V then O → output                                    │
 └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
 preview canvas (readback or present)  /  VideoEncoder (export)
```

Vello never decodes or draws video frames. The compositor never draws text or shapes (its glyphon text path is
retired).

### 8.2 Version alignment (the first task of Phase P5)

Facts: the workspace pins `wgpu = 24` (`crates/Cargo.toml`), used by `tooscut-compositor` (with `glyphon 0.8`,
`cosmic-text 0.12`). `offcut-render`'s Vello code uses `vello::RendererOptions { use_cpu, antialiasing_support,
num_init_threads, pipeline_cache }`, `peniko::{Blob, Color, Fill, FontData, Mix}`, `Color::from_rgba8`,
`Scene::draw_glyphs(&FontData)` and `Renderer::render_to_texture`. `DESIGN_NOTES.md` records that this needs
Vello ≥ 0.6 / parley ≥ 0.7 and a newer wgpu.

Steps:
1. Find the newest Vello release that compiles `offcut-render/src/vello_backend.rs` with at most small API edits.
   Record its wgpu major version **W** and its parley/peniko/skrifa versions (`cargo tree -i wgpu`).
2. Add `vello`, `parley` and their versions to `[workspace.dependencies]`; set `wgpu = W` there.
3. Port `tooscut-compositor` to wgpu W. Remove `glyphon` and `cosmic-text` from it (text moves to Vello), which
   removes most of the port's risk. Keep its layer, transform, crop, colour and transition shaders.
4. Re-run the compositor's tests and the editor's preview and export e2e tests. Re-check the worker device-loss issue
   in `DESIGN_NOTES.md` ("WebGPU preview renders to a texture and reads back"); if presenting to an
   `OffscreenCanvas` now works in W, switch preview to present and keep readback for export.
5. Record the versions and results in `DESIGN_NOTES.md` section 4.

If no Vello version shares a wgpu with a reasonable compositor port, stop and report with the two options (section
18.1, D1).

### 8.3 Crates after Phase P5

| Crate | Role | Change |
|---|---|---|
| `animato-graphics` (new, from `offcut-scene`) | Graphics document → `Scene` → `frame_at(t)` → `FrameGraphics` | Copy `offcut-scene`, replace its Offcut inputs (`Transcript`, `DetectedEvent`, `EditState`, `ClipInfo`, `ExportProfile`) with Animato's Graphics document (8.4). Keep `display_list.rs`, `layout.rs` (parley), `fonts.rs`, `easing.rs`, `anim.rs`, `safe_area.rs`, `captions.rs` (word chunking and highlight) |
| `animato-overlay` (new, from `offcut-render/src/vello_backend.rs`) | Draws a `DisplayList` with Vello into a texture | Extend for the new commands (8.5) |
| `tooscut-compositor` | Video layers | Port to wgpu W, drop glyphon |
| `animato-wasm` | The one browser module | Link `animato-graphics` and `animato-overlay`; expose a `FrameRenderer` that runs steps 1–4 of 8.1 on a shared device; keep existing exports |
| `offcut-scene`, `offcut-render`, `offcut-wasm-render` | Source material | Leave in place, not workspace members; note in `DESIGN_NOTES.md` that Animato's crates descend from them |

Licence check before linking: `crates/offcut-scene/assets/fonts/LICENSES.md` for fonts; the crate licences of
vello, parley (Apache-2.0/MIT, verify), and the origin licence of the `tooscut-*` and `offcut-*` crates (no LICENSE
file is present in this repo; record the upstream source and licence, or flag it to the owner as a blocker for a
commercial launch).

### 8.4 Graphics document (the data Vello draws)

Shared shape: Rust `serde` structs in `animato-graphics`, mirrored by zod schemas in
`src/features/editor/graphics/schema.ts`. Round-trip test: TS → JSON → Rust → JSON → TS is identity.

```ts
type Seconds = number

interface GraphicsDoc {
  version: 1
  canvas: { width: number; height: number }        // output pixels, e.g. 1080×1920
  videoRect: { x: number; y: number; w: number; h: number }  // where the main video sits (from the look)
  fonts: FontRef[]                                 // built-in ids or OPFS font asset ids
  images: ImageRef[]                               // OPFS image asset ids (logos)
  items: GraphicItem[]
}

type Layer = 'under' | 'over'

type GraphicItem =
  | { kind: 'title'; id: string; start: Seconds; end: Seconds; text: string; style: TextStyle;
      box: Box; enter: Motion; exit: Motion; layer: 'over' }
  | { kind: 'captions'; id: string; style: CaptionStyle; box: Box; maxWords: number; maxLines: number;
      highlight: 'word' | 'none'; layer: 'over' }              // reads the transcript passed alongside
  | { kind: 'shape'; id: string; start: Seconds; end: Seconds; shape: 'rect' | 'roundRect' | 'ellipse';
      box: Box; radius?: number; fill: Paint; stroke?: StrokeSpec; shadow?: ShadowSpec; layer: Layer }
  | { kind: 'image'; id: string; start: Seconds; end: Seconds; imageId: string; box: Box;
      fit: 'contain' | 'cover'; opacity: number; layer: Layer }
  | { kind: 'progress'; id: string; box: Box; color: Rgba; track: Rgba; layer: 'over' }
  | { kind: 'endCard'; id: string; duration: Seconds; headline: string; sub: string; logo: boolean;
      background: Paint; layer: 'over' }
  | { kind: 'watermark'; id: string; corner: 'br' | 'bl' | 'tr' | 'tl'; layer: 'over' }

type Paint = { solid: Rgba } | { linear: { from: Point; to: Point; stops: Stop[] } }
            | { radial: { center: Point; radius: number; stops: Stop[] } }
type Motion = { kind: 'none' | 'fade' | 'rise' | 'pop' | 'typewriter'; duration: Seconds; easing: EasingId }
```

The transcript (section 9.2) is passed to `build_scene` next to the document; it is not copied into it.

`buildGraphics(look, format, video, brand, title, transcriptPresent, entitlements): GraphicsDoc` is a pure TS
function per look (section 7.3), unit-tested with fixtures. The user's manual edits (moved title, changed text) are
stored as overrides on item ids, so changing the look keeps them where it can.

### 8.5 Display list changes

Extend `DrawCmd` (keep existing variants and their order; append new ones):

| Command | Vello call | Canvas2D fallback |
|---|---|---|
| `FillRect { rect, radius, paint }` (paint replaces colour) | `fill` with `RoundedRect` and a solid or gradient brush | `fillRect`/`roundRect` with `CanvasGradient` |
| `FillPath { path, paint }` | `fill` | `Path2D` + `fill` |
| `StrokePath { path, width, paint, join, cap }` | `stroke` | `stroke` |
| `GlyphRun { … }` (unchanged; stroke-then-fill per D-68) | `draw_glyphs` | `fillText`/`strokeText` with `text` |
| `Image { image_id, rect, opacity }` | `draw_image` with a cached `peniko::Image` | `drawImage` |
| `BlurredRoundedRect { rect, radius, std_dev, color }` (soft shadows) | `draw_blurred_rounded_rect` | `shadowBlur` on a filled round rect |
| `PushLayer { opacity, clip, clip_path? }` | `push_layer` with a rect or path clip | `save`, `globalAlpha`, `clip` |
| `PopLayer` | `pop_layer` | `restore` |

Images: logos are decoded in TS (`createImageBitmap` → RGBA), uploaded once to WASM by id, cached by `peniko::Image`.
Gradients: `peniko::Gradient` (linear, radial). Luminance masks (text-as-mask, shape transitions) are not in the
first version; add as `PushMaskLayer` later.

### 8.6 One frame pipeline for preview and export

- Preview: the render worker owns the device. For each displayed frame: decode video frames (existing decode path or
  render-engine `VideoFrameLoader`, see 10.5), build the video `RenderFrame`, call `animato-wasm`
  `FrameRenderer.render(t, frame, layers)` which calls `frame_at(t)` for graphics, runs 8.1 steps 1–4, then readback
  or present.
- Export: the export worker uses the same `FrameRenderer` at the export size and feeds `VideoEncoder`.
- Graphics scene is rebuilt only when the document, transcript, fonts or canvas size change (debounced 16 ms while
  dragging a slider). `frame_at` per frame must stay under 1 ms for typical documents (benchmark in Rust).

### 8.7 Fallback without WebGPU

Compositor: the existing Canvas2D compositor. Graphics: a TS `drawDisplayList(ctx, list)` that implements the
fallback column of 8.5, using the browser's fonts (the same font files registered with `FontFace` from OPFS or bundle)
so the look stays close. Label the fallback in the perf badge ("Canvas2D"). Exports in fallback mode are allowed;
they may differ in text antialiasing only.

### 8.8 Fonts and emoji

- Built in: Inter (UI and captions), Geist (titles; add the variable TTF to `animato-graphics/assets/fonts` and update
  `LICENSES.md`, OFL), JetBrains Mono, Noto Emoji (monochrome).
- User fonts: TTF/OTF from the brand kit; registered by OPFS asset id with parley and Vello; WOFF/WOFF2 rejected with
  a clear message.
- Colour emoji: not confirmed for Vello; test COLR fonts in Phase P5. Until proven, emoji render monochrome.

### 8.9 Performance budgets

| Measure | Budget |
|---|---|
| `animato-wasm` download (gzip, after `wasm-opt -Oz`) | ≤ 4.5 MB; lazy-loaded only on the video page and landing demo |
| Graphics scene build (document change) | ≤ 8 ms |
| `frame_at(t)` | ≤ 1 ms |
| Vello overlay draw at 1080×1920 | ≤ 4 ms on a mid-range GPU |
| Preview frame total (decode excluded) | ≤ 12 ms (60 fps target, 30 fps floor) |
| Scrub latency (pointer move → frame shown) | ≤ 100 ms |
| Export 18 s at 1080×1920 30 fps | ≤ 60 s on a mid-range laptop |

### 8.10 Determinism and tests

- Rust: snapshot tests of `DisplayList`s per look and format at fixed times (JSON snapshots); safe-area containment
  for every command of every frame (adapt the existing test); scaling test (540 vs 1080 widths).
- Browser: pixel snapshot tests with the render-engine `testing/` utilities (WebGPU in Playwright Chromium via
  SwiftShader): a title card, a caption frame, an end card per look; tolerance small, documented.
- Preview/export parity: render frame N in preview and in export, compare hashes of the readback.

---

## 9. Voice, transcript and captions

### 9.1 Voice

- Record with `MediaRecorder` while the video plays (count-in 3-2-1, level meter, stop with Space). Store in OPFS as
  an asset with role `voice`.
- Upload: any audio the existing import handles.
- Clean: loudness normalization and noise gate on by default (existing audio engine), EQ hidden under "More".
- Music ducks under voice by default (existing ducking).

### 9.2 Transcript

```ts
interface Transcript {
  version: 1
  source: { assetId: string; model: string }      // e.g. onnx-community/whisper-tiny.en_timestamped
  language: string
  words: { text: string; start: Seconds; end: Seconds; confidence: number }[]
  edited: boolean
}
```

- Produced by the existing `stt.worker.ts` (Whisper, word timestamps), normalised by `offcut-text`
  `normalize_transcript` (already wired).
- Stored on the Video. Word edits update `text` only; times stay.
- The transcript is the anchor for captions now and for the AI editor later (section 13).

### 9.3 Captions

Captions are a `captions` graphic item; the graphics crate chunks words into lines (existing `captions.rs`: max
words, max lines, max characters per line) and highlights the active word. Three caption styles at launch (Clean,
Bold, Minimal), plus brand colours when the Brand look is on. SRT import/export stays (existing Rust functions).

Acceptance: a 30 s voiceover produces captions whose active word is within 80 ms of the spoken word on the test
fixture; editing a word updates the preview immediately.

---

## 10. Engine consolidation: render-engine, workers and Timeline v2

### 10.1 Goal

One timeline model, one frame builder, one set of workers. Use `@tooscut/render-engine` and `src/workers/` where they
are better; delete duplicates; leave nothing orphaned.

### 10.2 Timeline v2

Based on the render-engine types (`packages/render-engine/src/types.ts`, `frame-builder.ts`, `clip-operations.ts`):

```ts
interface TimelineV2 {
  version: 2
  width: number; height: number; fps: number        // from the format
  tracks: EditableTrack[]                            // render-engine track pairs (video + audio)
  clips: EditableClip[]                              // render-engine clips, sorted by start (invariant)
  crossTransitions: CrossTransition[]
  graphicsOverrides: Record<string, Partial<GraphicItem>>   // user edits to look-generated items
  extraGraphics: GraphicItem[]                       // items the user added by hand
  audio: { ducking: { enabled: boolean; amountDb: number } }
}
```

Graphics are not render-engine layers; they are the Graphics document built from look + overrides + extras
(section 8.4). The timeline UI shows them on a Graphics lane.

Migration v1 → v2 (run on load, once, keep a backup copy of v1 in the record):

| v1 | v2 |
|---|---|
| media clips on `video` track | clips on the first video track (keep start, duration, offset→inPoint, speed, transform, colour, crop, fades as keyframes or transitions) |
| media clips on `audio`/`voice` tracks | clips on audio tracks; `audio` effects map to the audio engine params |
| `text` clips | `extraGraphics` title items |
| `caption` clips | transcript built from cue text (words spread evenly within each cue, `edited: true`) and a `captions` item |
| `captionStyle`, `ducking` | caption style id nearest match; `audio.ducking` |

Unit tests: migrate every fixture in `tests/` and the e2e projects; the migrated timeline renders the same frames for
media (graphics may differ, since they move to Vello).

### 10.3 Wiring the package

1. Make `animation_frontend` an npm workspace root: `"workspaces": ["packages/*"]`.
2. Fix `packages/render-engine/package.json`: replace every `catalog:` version with the real version used by the app
   (`vite`, `oxlint`, etc.) or remove dev dependencies the app already has; replace `pnpm build:worklet` with
   `npm run build:worklet`; align TypeScript to the app's version; remove `oxfmt`/`oxlint-tsgolint` if unused.
3. Prefer source imports: point the package `exports` at `src/` for development and let Vite compile it, or add a
   `prepare` build. Never rely on a committed `dist/`.
4. WASM: if the render-engine's own compositor/audio WASM is still needed after 10.4, build it with `crates/build.sh`
   (run from `crates/`; it calls `wasm-pack build compositor` relative to the current directory), delete the
   `.gitignore` that wasm-pack writes into each output folder, and commit `packages/render-engine/wasm/`. Better: have
   the package import from `animato-wasm` instead, so there is exactly one compositor build (preferred; see 18.2).
5. `tsc -b` covers the package; `npm run lint` covers it.

### 10.4 Which module wins, per responsibility

Decide with a short benchmark or test where the table says "measure". Record each result in `DESIGN_NOTES.md`.

| Responsibility | Today in the editor | In render-engine / src/workers | Decision |
|---|---|---|---|
| Timeline data model | `model/timeline.ts` v1 | `types.ts`, `EditableClip/Track`, track pairs, linked clips, cross transitions | **render-engine** (Timeline v2) |
| Clip operations (split, trim, move, ripple) | Rust `animato-wasm` + TS fallback | `clip-operations.ts` (binary search, sorted invariant) | **render-engine** for data ops; keep Rust snap/timecode utilities where they are faster and tested |
| Keyframes | `tooscut-keyframe` via `keyframe_value` | `keyframe-evaluator.ts` (pure TS, temporal cache) | **render-engine** in workers (no WASM call per property); keep Rust for audio |
| Frame building | `engine/compose.ts` | `frame-builder.ts` (`buildRenderFrame`, visibility by binary search) | **render-engine** |
| Video frame loading | `engine/decode.ts`, `sources.ts`, offcut-mp4 demux | `video-frame-loader.ts` | **measure** (seek latency, memory); keep the OPFS + offcut-mp4 demux path either way |
| Compositor | `tooscut-compositor` via `animato-wasm` | same crate via its own WASM build | **animato-wasm** (one build, ported to wgpu W) |
| Audio playback | `audio.worklet.ts` + Rust audio engine | `BrowserAudioEngine`, `worklet/` | **measure**; keep one; same Rust crate underneath |
| Waveforms | media worker (Rust `waveform_peaks`) | `src/workers/waveform.worker.ts` | keep **media worker** unless the waveform worker is faster on long files |
| Export audio | offline mix in export worker | `src/workers/audio-render.worker.ts` | **measure**; keep one |
| Workers in `src/workers/` | – | compositor, frame-renderer, audio-render, waveform | Merge the winners into `src/features/editor/engine/`; delete the losers; `src/workers/` ends empty and is removed |

### 10.5 Acceptance

`tsc -b`, lint and build pass; no file imports a deleted module; `grep -r "src/workers"` finds nothing; the editor
e2e suite passes on Timeline v2; an old v1 project opens and plays.

---

## 11. API layer and real backend wiring

### 11.1 Switch off mocks

- `.env.development`: `VITE_USE_MOCKS=false`, with the comment updated.
- `build:mocks` stays for Playwright. Use `cross-env` (add as a dev dependency) so the script works on Windows:
  `cross-env VITE_USE_MOCKS=true vite build`.
- `main.tsx` keeps the dynamic import guarded by the flag, so production bundles never include MSW (verify with the
  bundle analyzer or by grepping `dist/`).

### 11.2 Contract checks

For every row of 2.2, check `src/lib/api/schemas.ts`, `auth.ts`, `jobs.ts` against the Rust handler:

- Field names and casing (`is_verified`, `created_at`, `last_login`, `job_id`, `video_path`, …).
- Optional fields: `resend-verification` "already verified" has **no** `user`; `check-auth` adds two fields.
- `library` values lowercase; `status` values PascalCase.
- Error envelope `{ success: false, message }`, with axum rejections (`Invalid request body`) handled like any 4xx.

Add `src/lib/api/contract.test.ts` (vitest) with fixtures copied from the Rust handlers' JSON (literal examples) that
must parse with the zod schemas. A comment on each fixture names the Rust file and function.

### 11.3 Polling

- One TanStack Query per running job, key `['job', id]`, shared by every screen.
- Interval: 2 s for the first minute, 4 s until 5 minutes, then 8 s; 15 s when the tab is hidden; stop on
  `Completed`/`Failed`.
- Stop after 8 consecutive network failures or 45 minutes; show "Lost track of this render. Check again." (manual
  refetch resets the counters).
- Record each observed status with a timestamp on the take (`observed: { status, at }[]`); this powers the stage
  timings and the "fixing" detection (a `GeneratingCode` after `Rendering`).
- On 401: the session store logs the UI out (existing `SESSION_LOST_EVENT`). On 403: re-check auth. On 404: mark the
  take as gone ("This render is no longer available").

### 11.4 Error mapping

| Source | Status | User sees | Action |
|---|---|---|---|
| any | 0 (unreachable) | "Can't reach Animato's server." | Retry; banner on reads |
| any | 500 | "Something went wrong on our side. Please try again." | Retry |
| create job | 400 | Server message (prompt length) | Inline under the prompt |
| create job | 401 | (logged out) | Redirect to login with `next` |
| create job | 403 | (unverified) | Redirect to verify |
| create job | 429 | "You've reached the render limit. Next render in 23 min." (from `Retry-After`) | Disable Generate until then, show countdown |
| create job | other 4xx | "We couldn't send that. Please refresh and try again." | – |
| get job | 404 | "This render is no longer available." | Offer "Render again" |
| worker `Failed` | – | "That one didn't render." + likely cause (below) | Try again / Edit prompt |
| video URL | 404 | "This render has expired." | Render again |
| import fetch | CORS/network | "Couldn't load the video for finishing." | Retry import; Download original; dev hint about S3 CORS in `LOCAL_DEV.md` |

Likely cause line for failures (keyword match on `error_message`, case-insensitive; never show the raw text here):
`timeout` → "The animation took too long to render. Try a shorter or simpler idea."; `syntax|compile|validation` →
"The generated animation had an error we couldn't fix automatically. Try rephrasing."; otherwise "The renderer hit an
error. Trying again usually works." Raw text: behind "Technical details", truncated to 600 characters, plain text.

### 11.5 Getting the video into the browser

1. `fetch('/api/jobs/:id/video', { credentials: 'same-origin' })` follows the 302 to S3. This requires the S3 bucket
   CORS rule for the app origin (documented in `LOCAL_DEV.md`; the owner configures it).
2. Stream into OPFS via the existing `importFile` (rebuilt `media/client.ts`), with progress.
3. Dedupe by job id and SHA-256 (existing).
4. If the import fails, the video page falls back to `ready-remote` (3.4): `<video src="/api/jobs/:id/video">`
   plays without CORS.
5. Never store or log the presigned URL; always go through the API route (it re-signs for 1 hour each time).

### 11.6 Session

- `check-auth` on boot; the persisted profile is only a hint until confirmed.
- Logout clears local UI state only after the server confirms.
- Local data is keyed by the user's email (existing `owner` field); another user on the same browser sees nothing of
  the first.

---

## 12. Growth mechanics built into the product

All of these work without any backend change.

### 12.1 Watermark and end card

- Free exports carry a small "Made with Animato" mark (wordmark + icon, 70% opacity, safe-area corner, Vello) and,
  if the end card is on, "Made with Animato" in its footer.
- During early access (no billing), the watermark toggle is available to everyone, default **on**, with the line
  "Free while in early access. Creator plan removes it automatically." Controlled by `entitlements.watermark`
  (section 14.2).
- The mark must look premium: small, crisp, never covering captions (safe-area tested).

### 12.2 Remix links

- On every ready video: "Copy remix link" → `https://<site>/?prompt=<encoded prompt>&engine=<library>`.
- Landing and Create read these parameters (sanitised, 6.1). A visitor who opens a remix link sees the prompt in the
  hero box and one click away from signing up and generating.
- The link carries the prompt only, never the video or any user data. Tell the user that in the copy confirmation:
  "Link copied. It shares your prompt, not your video."

### 12.3 Share-ready exports

- File names: `<title-slug>-<format>.mp4` (e.g. `fourier-epicycles-9x16.mp4`).
- After export: "Copy post text" with the title and two suggested hashtags derived from the prompt keywords (local,
  deterministic). Optional; one click.

### 12.4 Activation moments

- First video ready: a one-time, quiet celebration (the preview card scales in, 400 ms, no confetti) and a single tip:
  "Switch to 9:16 for Shorts."
- First export: tip "Add your voice next time for automatic captions."
- Tips are dismissible and never repeat.

### 12.5 Measurement seam

`src/lib/analytics.ts`: `track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>)`. Today it
writes to an in-memory ring buffer (and `console.debug` in dev). No third-party scripts. Events: `landing_prompt_submit`,
`signup_complete`, `verify_complete`, `job_create`, `job_complete`, `job_fail`, `finish_open`, `format_change`,
`look_change`, `voice_record`, `captions_generated`, `export_start`, `export_complete`, `remix_link_copy`,
`remix_link_open`. A backend endpoint is a gap (section 17).

---

## 13. AI editor readiness (seams only; no AI feature in this plan)

The future feature: transcript + assets with notes + chat instructions → an LLM returns an edit plan → the browser
compiles it into timeline edits → preview → the user says what to change → repeat. Build the seams now so that
feature is a backend endpoint plus a chat panel, not a refactor.

### 13.1 Every edit is a command

- The editor store (`src/features/editor/store.ts`) already has an undo/redo command stack. Make every mutation a
  **serialisable** command object (`{ type: 'clip.insert', … }`), not a closure. Group commands into transactions with
  a label ("Change format", "AI edit").
- `applyCommands(state, commands): state` is pure and unit-tested.

### 13.2 Asset roles and notes

`assets: { assetId, role: 'main' | 'broll' | 'music' | 'voice' | 'logo', label: string, note: string }[]` on the
Video. Labels are stable ("Clip 1", "Clip 2", "Music") because the user will refer to them by name in chat.

### 13.3 Edit plan schema (versioned, zod, in `src/features/editor/plan/schema.ts`)

```ts
type Anchor = { t: Seconds } | { word: number; edge: 'start' | 'end' }   // transcript word index

interface EditPlanV0 {
  version: 0
  summary: string                                  // shown to the user, plain language
  format?: '16:9' | '9:16' | '1:1'
  look?: LookId
  keep?: { from: Anchor; to: Anchor }[]            // ranges of the main clip to keep, in order
  inserts?: { asset: string /* label, e.g. "Clip 1" */; at: Anchor; duration: Seconds;
              inPoint?: Seconds; mode: 'cutaway' | 'overlay'; transition?: 'cut' | 'fade' | 'zoom' }[]
  music?: { asset: string; volume: number; duck: boolean } | null
  title?: { text: string; start: Seconds; end: Seconds } | null
  captions?: { style: CaptionStyleId } | null
  emphasis?: { word: number; kind: 'color' | 'pop' | 'zoom' }[]
}
```

### 13.4 Plan compiler

`compileEditPlan(plan, video): { commands: Command[]; warnings: string[] }`, pure:
- Resolves labels to asset ids; unknown labels become warnings, not crashes.
- Resolves anchors with the transcript; clamps times to media bounds; never deletes assets.
- Produces one transaction "AI edit: <summary>" so one Undo reverts it.
- Fixture tests: at least 10 plans (insert at word, cutaway at time, music duck, keep ranges, invalid label, out of
  range time, empty plan).

### 13.5 Developer harness

Behind `?dev=plan` on the video page in development builds only: a textarea to paste an `EditPlanV0` JSON, "Apply",
and the warnings list. This proves the seam end to end without an LLM.

### 13.6 Layout slot

The Assets rail has a tab header area. The future "Assistant" tab goes there: a chat thread, the plan summary as an
assistant message with "Undo" and "Keep", and the composer. Do not render a placeholder tab now.

### 13.7 What the LLM call will need from the backend (gap G6)

`POST /api/edit-plans` with `{ transcript, assets: [{label, role, duration, note}], instructions, previousPlan? }` →
`{ plan }`. The LLM key stays on the server. Record in section 17.

---

## 14. Pricing and entitlements (no billing yet)

### 14.1 Plans shown

| | Free | Creator |
|---|---|---|
| Price | $0 | $20 per month |
| Status | Available now | "Coming soon" badge |
| Renders | "Up to 5 an hour, 15 a day during early access" | "More renders (limits announced at launch)" |
| Finish and export | All formats, 1080p, looks, captions, brand kit | Same |
| Watermark | "Made with Animato" (removable during early access) | No watermark |
| Custom fonts | Yes during early access | Yes |
| CTA | "Start free" | "Start free, upgrade at launch" |

Remove the Pro $49, Studio $2,000 and Enterprise tiers, the comparison table rows for features that do not exist
(seats, onboarding, invoicing, priority queue) and annual billing copy.

### 14.2 Entitlements module

`src/lib/entitlements.ts`:

```ts
interface Entitlements {
  plan: 'free' | 'creator'
  watermark: 'forced' | 'default-on' | 'off'     // early access: 'default-on'
  maxExportHeight: number                        // 1920 (for 9:16) / 1080 (for 16:9)
  customFonts: boolean
  renderLimits: { perHour: number; perDay: number }   // must match api_server defaults (5, 15)
}
export function getEntitlements(user: User | null): Entitlements
```

Every gated UI reads this function and nothing else. The billing phase replaces its body.

### 14.3 Limits shown in the UI

The frontend cannot read the server's `JOB_LIMIT_PER_HOUR/DAY`. Show the defaults from `entitlements.renderLimits`
with a comment pointing to `api_server/.env.example`. After any 429, trust `Retry-After` over the constants. Gap G4
asks for `GET /api/usage`.

---

## 15. Quality bars

### 15.1 Performance

| Measure | Budget |
|---|---|
| Landing initial JS (gzip) | ≤ 170 KB (GSAP and WASM demo lazy) |
| App shell initial JS (gzip) | ≤ 230 KB |
| Landing LCP (fast 4G, mid laptop) | ≤ 2.0 s |
| Route change in app | ≤ 150 ms to first paint of the new screen (skeletons allowed) |
| Video page Ready → interactive preview | ≤ 1.5 s after import completes |
| Memory during a 60 s 1080×1920 export | ≤ 1.2 GB tab memory |

### 15.2 Reliability

- Autosave: every committed command persists within 500 ms (debounced), plus on `visibilitychange`.
- Crash recovery: on reopen after a crash, "Restored your last changes" if the autosave is newer than the last clean
  save.
- Storage full: catch `QuotaExceededError`, show Settings → Storage with the biggest items.

### 15.3 Testing

| Layer | Tool | What |
|---|---|---|
| Pure TS | vitest (add) | prompt building, entitlements, error mapping, polling schedule, looks (`buildGraphics`), plan compiler, Timeline v1→v2 migration, zod contract fixtures |
| Rust | `cargo test` | graphics crate snapshots, safe areas, scaling, determinism; compositor after the port; overlay command coverage |
| Browser render | Playwright + render-engine `testing/` | pixel snapshots per look and format; preview/export parity |
| Flows (mocked) | Playwright with MSW build | J1–J5, every error row of 11.4, offline, storage full |
| Flows (real) | Playwright, `E2E_REAL=1`, skipped by default | Against the local stack: signup with a test inbox is manual, so start from an existing verified test account (`E2E_EMAIL`, `E2E_PASSWORD` env, never committed): create job, wait for Completed, import, export |
| Manual | `LOCAL_DEV.md` checklist | The owner's end-to-end run |

### 15.4 Security and privacy

Keep every rule from the previous plan: no token handling in JS, same-origin `/api` only, zod on every response,
UUID check before putting a job id in a URL, no `dangerouslySetInnerHTML`, passwords only in component state, reset
token out of history and referrer (`<meta name="referrer" content="no-referrer">`), no account enumeration, local data
keyed by user, honest logout. Add: sanitise URL-provided prompts (remix links); never log presigned URLs; the
analytics buffer never contains prompt text or email.

### 15.5 Browser support

Chrome/Edge (latest two) fully. Safari 17+ and Firefox: everything except features that need WebCodecs or WebGPU,
which degrade as in 6.11 and 8.7. Test the degrade paths.

### 15.6 Truth checklist for marketing copy (run before every release)

- [ ] Every feature on the landing page works in this build.
- [ ] No testimonial, logo, user count or rating that is not real and permitted.
- [ ] Resolution claims say "1080p export", not "1080p/4K animation".
- [ ] Prices and plan contents match `entitlements.ts` and section 14.
- [ ] Privacy claims match Settings → Privacy.
- [ ] Every sample video was made by Animato, and its prompt is shown as it was sent.

---

## 16. Phases

Each phase: tasks, files, acceptance. Commit in small, focused commits; update `PROGRESS.md` with the commit hash.
Phases P0–P3 make the product usable end to end against the real backend; P4–P8 make it great; P9–P11 prepare growth
and the future AI editor.

### P0. Repo and build health

Tasks:
1. If missing: repo-root `CLAUDE.md`, `.claude/settings.json` SessionStart hook, `.claude/hooks/cloud-setup.sh`,
   `.gitattributes` (`*.sh text eol=lf`), `animation_frontend/.gitignore` re-include `!/src/features/editor/media/`.
2. Rebuild `src/features/editor/media/client.ts` (`importFile`, `ImportProgress`, `ImportStage`, `measureLoudness`,
   `readPcm`) and `media/library.ts` (`loadLibrary`) from their call sites and the media worker (`engine/media.worker.ts`,
   `engine/rpc.ts`, `lib/local/opfs.ts`).
3. `npm run typecheck`, `lint`, `build` pass.
4. Clone the pushed branch into a temp dir, `npm ci && npm run build` there (proves nothing needed is ignored).

Acceptance: green build from a clean clone; `git status --ignored` lists only expected paths.

### P1. Real backend

Tasks: section 11 in full (mocks off, contract tests, polling, error mapping, video import fallback, session),
`cross-env` for `build:mocks`, vitest added with the contract tests, `LOCAL_DEV.md` at repo root (services, order,
env var names, free SMTP option, S3 CORS JSON, manual checklist).

Acceptance: against the local stack the owner runs J1 and J2 (without Finish features) end to end; every row of 11.4
is reachable in the mocked e2e build and shows the specified UI.

### P2. Design system and shell

Tasks: tokens (7.2), components (7.4), top bar navigation (3.2), routes and redirects (3.1), Videos home (6.3),
Settings (6.9), system screens (6.11), reduced motion audit.

Acceptance: every screen uses only tokens (lint rule or grep: no hex colours outside `tokens.css` and graphics
code); screenshots at 1440×900 and 390×844 reviewed; axe has no serious violations.

### P3. Landing, pricing and first-run flow

Tasks: landing (6.1) with all removals, pricing (6.10, 14.1), auth sheet and screens (6.2), pending prompt + auto-start
(5.1), Create (6.4) with the aspect fix, Rendering state (6.5), notifications, remix link parsing (12.2),
entitlements module (14.2), analytics seam (12.5).

Acceptance: J1 under the 3-minute budget (excluding render) in a timed run; truth checklist (15.6) passes; Lighthouse
targets met.

### P4. Engine consolidation

Tasks: section 10 (workspace, package fixes, decisions per 10.4 with measurements, Timeline v2 and migration,
worker merge, delete losers).

Acceptance: 10.5.

### P5. Vello graphics layer

Tasks: 8.2 version alignment; `animato-graphics` and `animato-overlay` crates (8.3); Graphics document (8.4) with zod
mirror and round-trip test; display list extensions (8.5); `FrameRenderer` in `animato-wasm` (8.1, 8.6); Canvas2D
fallback (8.7); fonts (8.8); budgets measured (8.9); tests (8.10); `wasm-opt -Oz` with a current binaryen; module size
recorded.

Acceptance: a title, a caption line and an end card render identically in preview and export; budgets met or the
gap recorded with numbers; fallback renders on a browser with WebGPU disabled.

### P6. Finish, simple mode, and export

Tasks: video page states (3.4), Finish layout (6.6), looks (7.3) as `buildGraphics` functions, format switching,
title derivation (6.4.4 below), brand panel (6.8), watermark and end card (12.1), takes strip, export sheet (6.7),
"Export all formats", share-ready file names (12.3), activation moments (12.4).

Title derivation: take the user's prompt (not the server prompt), drop leading verbs like "Explain",
"Show", "Visualize", "Animate", keep the first clause, cap at 6 words and 32 characters, Title Case. Deterministic,
unit-tested; always editable.

Acceptance: 6.6 and 6.7 acceptance lists; J2 under budget.

### P7. Voice and captions

Tasks: section 9 (recording, cleaning defaults, transcript model and store, Whisper wiring to the transcript,
captions item, caption styles, word editing, SRT kept).

Acceptance: 9.3.

### P8. Fine-tune mode and assets

Tasks: timeline restyle on Timeline v2 with the Graphics lane; Assets rail with roles and notes (13.2); B-roll
insert at playhead; "Generate a clip" from inside Finish; user's own clip as main (import into a new Video from the
Videos page "Import a clip" in the card menu of the composer strip, secondary).

Acceptance: a B-roll render generated from inside Finish lands in the next slot and can be inserted; every timeline
operation is undoable and serialised as commands.

### P9. AI editor seams

Tasks: section 13 (commands, plan schema, compiler, fixtures, dev harness).

Acceptance: 13.4 fixtures pass; the dev harness applies a plan and one Undo reverts it.

### P10. Growth polish

Tasks: post text, remix analytics events, Open Graph tags and a static OG image for the landing page (a real render
frame), first-video and first-export tips, persistent storage prompt.

### P11. Hardening

Tasks: performance budgets (15.1), reliability items (15.2), the full test matrix (15.3), browser degrade paths
(15.5), optional light theme, `DESIGN_NOTES.md` and `README.md` updated, `PROGRESS.md` final.

---

## 17. Backend gaps register

The frontend works around each of these today. They are listed in priority order for the backend phases that come
after this plan (features, then usage limits, quotas and billing, then deploy).

| # | Gap | Workaround now | Why it matters |
|---|---|---|---|
| G1 | Renders are 480p (Remotion 854×480 @20 fps; Manim `-ql`) | Export at 1080p with crisp Vello graphics over an upscaled animation; never claim 1080p animation | The single biggest quality lever for paid conversion |
| G2 | No `GET /api/jobs` list (with prompt and created time) | IndexedDB history per browser | History across devices; required for usage display |
| G3 | `GET /api/jobs/:id` has no `prompt`, `created_at`, `retry_count`, progress | Prompt kept locally; status transitions observed by polling | Cross-device videos; honest "fixing" stage |
| G4 | No `GET /api/usage` (renders used / remaining) | Show default limits; trust `Retry-After` | Quota UX and the upgrade moment in billing |
| G5 | No cancel or delete of a job | "Delete" only removes local data; copy says so | User control; storage cost |
| G6 | No edit-plan endpoint for the AI editor | Dev harness with pasted JSON | The AI editor feature |
| G7 | No analytics ingestion | In-memory ring buffer | Measuring the funnel in section 1.6 |
| G8 | `error_message` is raw worker output | Keyword mapping, raw text hidden | Leaks internals; sanitise server-side |
| G9 | Aspect ratio and length are not parameters | Formats done in Finish; length as a prompt hint | Native vertical renders would look better than re-laid-out landscape |
| G10 | Production static serving expects `frontend/dist` relative to `api_server` | Build output path decided in the deploy phase | Deploy |
| G11 | CORS origin is hard-coded to `http://localhost:5173` | Same-origin proxy in dev | Deploy |
| G12 | No webhook/push for job completion | Polling with backoff | Server load at scale |

---

## 18. Decisions

### 18.1 Open decisions for the owner (a session must stop and ask)

| # | Question | Default if the owner says "your call" |
|---|---|---|
| D1 | If no Vello release can share a wgpu version with a reasonable compositor port: run Vello on its own device and copy the overlay texture across, or draw video frames as Vello images? | Separate device with a copy, measured; never two copies of wgpu in one module without measuring size |
| D2 | Brand name and domain for remix links and the watermark | "Animato" and a `SITE_URL` constant |
| D3 | Final accent colour | Calm blue `#2F7BF6` |
| D4 | Licence of the `tooscut-*` and `offcut-*` code | Must be confirmed before a commercial launch; building continues meanwhile |

### 18.2 Decisions already made by this plan

- **One noun, "Video".** Projects, jobs and the editor are states of one video page.
- **Formats are a Finish feature,** because the workers always render 16:9.
- **Default format for first-time users is 9:16,** because the primary audience posts Shorts/Reels/TikTok; the last
  used format wins afterwards.
- **Vello draws all graphics; the compositor draws video,** on one device, with under/over display lists.
- **render-engine owns the timeline model and frame building; animato-wasm owns the compositor build.**
- **Watermark on by default, removable during early access,** so early users can judge output fairly while most
  exports still carry the mark.
- **No light theme until P11.**
- **No third-party analytics, fonts or scripts.**
- **Templates become starters inside Create.**

---

## 19. Definition of done (this plan)

- [ ] The owner can start Redis, MongoDB, `api_server`, both workers and `npm run dev`, then run J1, J2, J3, J4 and J5
      end to end with no mocks, following `LOCAL_DEV.md`.
- [ ] Time to first result (J1, excluding render) is under 3 minutes in a timed run.
- [ ] Every export's graphics are drawn by Vello (or the documented Canvas2D fallback), identical in preview and
      export.
- [ ] `packages/render-engine` is a workspace dependency in use; `src/workers/` is gone; nothing is orphaned.
- [ ] Marketing copy passes the truth checklist.
- [ ] The AI editor seams exist and are tested.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, vitest, `cargo test` (crates) and `npm run test:e2e` pass.
- [ ] `DESIGN_NOTES.md`, `PROGRESS.md`, `README.md` and `LOCAL_DEV.md` describe the product as built.

---

## Appendix A. Copy deck

| Place | Copy |
|---|---|
| Landing eyebrow | "Text to animated video" |
| Landing headline | "Explain anything. In motion." |
| Landing sub | "Describe an idea. Animato animates it, then makes it ready for Shorts, Reels and YouTube." |
| Prompt placeholder (cycles) | "Show why the derivative of sin(x) is cos(x)" · "Binary search on 16 boxes, find 42" · "Kinetic quote: Make it simple, but significant" · "Our revenue grew 38% this quarter, animated bar chart" |
| Generate button | "Generate" |
| Signup sheet title | "Create your account to generate" |
| Verify title | "Check your email" / "We sent a 6-digit code to {email}." |
| First auto-start | "Starting your first video…" with "Cancel" |
| Render stages | see 6.5 |
| Ready toast | "Your video is ready." |
| Failure title | "That one didn't render." |
| Try again | "Try again" (sub: "Uses 1 of your renders") |
| Quota | "You've reached the render limit. Next render in {time}." |
| Finish empty captions | "Add your voice to get captions." |
| Whisper first run | "Downloading the speech model (about 40 MB). This happens once." |
| Export done | "Exported {size}." |
| Remix copied | "Link copied. It shares your prompt, not your video." |
| Storage note | "Your videos are stored in this browser." |
| Pricing note | "Billing is not live yet. Everyone is on Free during early access." |

## Appendix B. Keyboard shortcuts

| Key | Where | Action |
|---|---|---|
| `N` | App | New video |
| `⌘K` / `Ctrl K` | App | Command palette |
| `⌘↵` | Composer | Generate |
| `Space` | Video page | Play/pause |
| `J` `K` `L` | Video page | Back, pause, forward |
| `←` `→` | Video page | Previous/next frame (Shift: 1 s) |
| `T` | Video page | Toggle timeline |
| `F` | Video page | Cycle format |
| `E` | Video page | Export |
| `⌘Z` / `⇧⌘Z` | Video page | Undo / redo |
| `S` | Timeline | Split at playhead |
| `Delete` | Timeline | Delete clip (ripple with Shift) |
| `?` | App | Shortcuts sheet |

## Appendix C. Target file map

```
animation_frontend/
  package.json                       workspaces: ["packages/*"]
  packages/render-engine/            @tooscut/render-engine (timeline model, frame builder, keyframes, clip ops, testing)
  crates/
    animato-wasm/                    the one browser module (timeline utils, compositor, graphics, overlay, audio, demux)
    animato-graphics/                graphics document → scene → frame_at → display lists (from offcut-scene)
    animato-overlay/                 display list → Vello texture (from offcut-render)
    compositor/ audio-engine/ keyframe/ types/ offcut-*/ …
  src/
    app/                             router, shell (top bar), guards, palette, errors
    components/ui/                   restyled primitives
    lib/
      api/                           http, auth, jobs, schemas, contract.test.ts
      local/                         IndexedDB tables, OPFS
      entitlements.ts  analytics.ts  motion.ts  validation.ts
    features/
      landing/ auth/ pricing/
      videos/                        home grid, cards
      create/                        composer, starters, prompt building
      video/                         the video page: states, rendering view, finish layout, takes, export sheet
      editor/
        engine/                      workers (media, render, export, stt), audio worklet, frame renderer glue
        graphics/                    schema.ts (zod), looks/*.ts (buildGraphics), canvas2d.ts (fallback drawer)
        plan/                        schema.ts, compile.ts, fixtures/
        model/                       timeline v2, migration
        store.ts                     commands, transactions, undo/redo
        ui/                          inspector sections, timeline, assets rail, preview
      brand/ settings/
    wasm/                            pkg/ (built animato-wasm), engine.ts, stats.ts
```

## Appendix D. Glossary

| Term | Meaning |
|---|---|
| Video | The user-facing object: a prompt, its takes, the finish edits and the exports |
| Take | One render job for a video |
| Render | The server-side generation of an animation by Remotion or Manim |
| Finish | Turning a render into a postable video in the browser |
| Look | A layout preset that decides where video, title, captions and brand go |
| Graphics document | The data Vello draws: titles, captions, shapes, images, cards |
| Display list | The per-frame list of drawing commands produced from the graphics document |
| Edit plan | The future AI editor's output, compiled into editor commands |
| TTFR | Time to first result: landing to a playing video |
