# Running Animato locally

This is the owner's end-to-end run: the real backend, both render workers and the frontend, with no mocks.
The Claude Code cloud sandbox cannot run this stack (no Docker, Redis, MongoDB, S3 or SMTP). Every frontend
phase is checked there against the mocked e2e build, and this run is the step left for you.

Variable **names** only appear below. Put the values in each service's own `.env` (each service loads its own with
`dotenvy`). Never commit them.

## 1. Services and ports

| Service | Port | Needed for |
|---|---|---|
| MongoDB | 27017 | Users and render jobs (api_server and both workers) |
| Redis (Remotion queue) | 6379 | api_server → remotion_worker; also the rate limits and the render quota |
| Redis (Manim queue) | 6380 | api_server → manim_worker |
| Mail catcher or SMTP provider | 1025 (Mailpit) | Verification codes and reset links |
| S3 bucket (private) | – | Rendered videos (`renders/<job_id>.mp4`) |
| `api_server` | 5000 | `/api/auth/*`, `/api/jobs/*` |
| `remotion_worker` | – | Remotion renders (Docker) |
| `manim_worker` | – | Manim renders (Docker) |
| `animation_frontend` (Vite) | 5173 | The app; proxies `/api` to :5000 |

Quick infrastructure with Docker:

```bash
docker run -d --name animato-mongo -p 27017:27017 mongo:7
docker run -d --name animato-redis-remotion -p 6379:6379 redis:7
docker run -d --name animato-redis-manim -p 6380:6379 redis:7
docker run -d --name animato-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Render sandboxes (the workers start one container per job):

```bash
docker build -t remotion-sandbox:latest remotion_worker/docker/remotion-sandbox
docker build -t manim-sandbox manim_worker
```

## 2. Environment variable names

| Service | Names |
|---|---|
| `api_server` | `PORT`, `NODE_ENV`, `MONGODB_URI`, `DB_NAME`, `REDIS_URL_REMOTION` (or legacy `REDIS_URL`), `REDIS_URL_MANIM`, `JWT_SECRET`, `FRONTEND_URL` (use `http://localhost:5173`; reset links point there), `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `SENDER_NAME`, `S3_BUCKET_NAME`, `JOB_LIMIT_PER_HOUR`, `JOB_LIMIT_PER_DAY`, plus the standard AWS credential chain (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) |
| `remotion_worker` | `MONGODB_URI`, `DB_NAME`, `REDIS_URL_REMOTION`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_THINKING_BUDGET`, `GEMINI_TIMEOUT_SECS`, `S3_BUCKET_NAME`, AWS chain, optional `DOCKER_PATH`, `REMOTION_SANDBOX_IMAGE`, `REMOTION_PROJECT_ROOT`, `REMOTION_CONCURRENCY`, `REMOTION_MAX_REPAIRS`, `RENDER_TIMEOUT_SECS`, `RENDER_MEMORY_LIMIT`, `RENDER_CPU_LIMIT`, `RENDER_PIDS_LIMIT`, `RENDER_RETENTION_SECS`, `CLEANUP_INTERVAL_SECS`, `WATCHDOG_INTERVAL_SECS`, `WATCHDOG_STUCK_AFTER_SECS` |
| `manim_worker` | `MONGODB_URI`, `DB_NAME`, `REDIS_URL_MANIM`, Gemini names as above, `S3_BUCKET_NAME`, AWS chain, optional `DOCKER_PATH`, `MANIM_SANDBOX_IMAGE`, `MANIM_DOCKER_USER`, `MANIM_MAX_REPAIRS` |
| `animation_frontend` | `VITE_API_TARGET` (optional, default `http://localhost:5000`). `VITE_USE_MOCKS` is `false` in `.env.development`; leave it |

`JOB_LIMIT_PER_HOUR` and `JOB_LIMIT_PER_DAY` default to 5 and 15. The frontend shows those defaults
(`src/lib/entitlements.ts` from P3); if you change them, the UI text will not know (backend gap G4).

## 3. Email (SMTP)

The mailer has two modes (`api_server/src/utils/mailer.rs`):

- **No `EMAIL_USER`** → plain SMTP with no login, for a local mail catcher. Free and offline: run Mailpit (above),
  set `EMAIL_HOST` to `localhost` and `EMAIL_PORT` to `1025`, leave `EMAIL_USER` and `EMAIL_PASS` empty, and read the
  6-digit codes and reset links at <http://localhost:8025>.
- **With `EMAIL_USER`** → a real provider: implicit TLS on port 465, STARTTLS on any other port (587). Free options
  include a Gmail account with an app password (`smtp.gmail.com`, 587) or a free-tier transactional provider such as
  Brevo. Use this only when you want mail to reach a real inbox.

## 4. S3 bucket CORS (required for Finish)

`GET /api/jobs/:id/video` answers 302 to a presigned S3 URL. A `<video>` element plays it without CORS, but the app
also **downloads the bytes** into the browser (OPFS) to finish and export the video, and that `fetch` needs the bucket
to allow the app's origin. Without it the video page shows "Couldn't load the video for finishing." and offers the
plain player and Download.

Bucket → Permissions → Cross-origin resource sharing (CORS):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:4173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add your production origin when you deploy. The bucket stays private; presigned URLs expire after one hour and the
app always asks the API for a fresh one.

## 5. Start order

```bash
# 1. Infrastructure (Mongo, both Redis, Mailpit) — see section 1
# 2. API
cd api_server && cargo run
# 3. Workers (separate terminals)
cd remotion_worker && cargo run
cd manim_worker && cargo run
# 4. Frontend
cd animation_frontend && npm ci && npm run dev    # http://localhost:5173
```

`npm ci` runs `onnxruntime-node`'s postinstall, which downloads native binaries. The browser build does not need
them; if it fails (offline, proxy), use `npm ci --ignore-scripts`.

## 6. Manual checklist

Tick each line on the real stack. Phases add lines as they land.

**Auth (P1)**
- [ ] Sign up with a new email → the verify screen names the address; the code arrives (Mailpit or inbox).
- [ ] A wrong code shows the server message; the right one lands in the app.
- [ ] Resend shows a countdown; a second resend within a minute shows the wait from `Retry-After`.
- [ ] Log out → log in with the wrong password ("Invalid credentials") → log in with the right one.
- [ ] Forgot password → the reset link opens `/reset-password/<token>` → the new password works.
- [ ] Reload the app while logged in: you stay logged in (check-auth); in another browser profile you see none of
      the first user's videos.

**Renders (P1)**
- [ ] Create a Remotion job and a Manim job. The status moves Pending → GeneratingCode → Rendering → Uploading →
      Completed, and the page updates by itself.
- [ ] Reload mid-render: the page resumes the same job.
- [ ] The finished video plays. Open it in the editor: the import succeeds (needs the S3 CORS rule above).
- [ ] Remove the CORS rule (or test from another origin): the page shows "Couldn't load the video for finishing.",
      the video still plays and Download works. Restore the rule.
- [ ] Start 6 jobs within an hour: the 6th shows "You've reached the render limit. Next render in …" and Generate
      stays disabled until then.
- [ ] Stop `api_server` while a job page is open: after a while the page says "Lost track of this render."; start
      the server again and press "Check again".
- [ ] Ask for something absurd that fails: the page shows "That one didn't render." with a plain cause; the raw
      worker output is only under "Technical details".

## 7. Mocked e2e build (what the sandbox runs)

```bash
cd animation_frontend
npm run test        # vitest: API contract fixtures, polling schedule, error mapping
npm run test:e2e    # Playwright against `npm run build:mocks` (MSW answers the real endpoints)
```

The MSW mock exists only in that build. The demo account is `demo@animato.dev` / `animato-demo`, and the mock
verification code is `123456`.
