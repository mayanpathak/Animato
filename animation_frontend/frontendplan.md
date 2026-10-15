# Frontend Build Plan for `animation_frontend` (myanimate)

Stack: React 19, Vite 8, TypeScript, Zustand, Tailwind CSS v4, React Router, GSAP (installed now, used in Phase F10).

Order of work: **logic and security first, decoration last.** Phases F0 to F8 produce a plain, fully working skeleton. GSAP animation is Phase F10 and touches no logic.

Status marks: `[BUILT]` code is written (not yet run by you), `[TODO]` not started, `[BLOCKED]` needs a backend change first.

---

## 1. What the backend gives us (read from `api_server/src`)

Every response is JSON `{ success, message, ... }`. The session is an HttpOnly `token` cookie (`SameSite=Strict`, 7 days). JavaScript can never read it, so the frontend only ever holds the user object in memory.

### Auth endpoints (`/api/auth`)

| Call | Body | Success | Failures the UI must handle |
| --- | --- | --- | --- |
| `POST /signup` | `username`, `email`, `password` | 201, `user`, cookie set, code emailed | 400 validation message, 409 "User already exists", 429 (5 per hour per IP) |
| `POST /verify-email` (session) | `code` | 200, `user` with `is_verified: true` | 400 "Invalid or expired verification code", 401 |
| `POST /resend-verification` (session) | none | 200 "Verification code sent" | 429 (1 per 60 s, 5 per day), 401 |
| `POST /login` | `email`, `password` | 200, `user`, cookie set | 400, 401 "Invalid credentials", 429 (20 per 15 min per IP; 5 failures per 15 min per email) |
| `POST /logout` | none | 200, cookie cleared | none |
| `POST /forgot-password` | `email` | 200, always the same message | 400, 429 (10 per hour per IP) |
| `POST /reset-password/{token}` | `password` | 200 "Password reset successful" | 400 "Invalid or expired reset token", 400 validation, 429 |
| `GET /check-auth` | none | 200, `user` plus `last_login`, `created_at` | 401 |

User object: `{ email, username, is_verified }`. Rules enforced by the server: username 3 to 30 characters, password 8 to 72, email trimmed and lowercased. The verification code is 6 digits, lasts 15 minutes and locks after 5 wrong guesses. A 429 carries a `Retry-After` header in seconds.

### Job endpoints (`/api/jobs`, session + verified)

| Call | Body | Success | Failures |
| --- | --- | --- | --- |
| `POST /api/jobs` | `prompt` (10 to 2000 chars), `library` (`"manim"` or `"remotion"`) | 200, `data: { job_id, library, status }` | 400, 401, 403 "Please verify your email first", 429 (5 per hour, 15 per day per user), 500 |
| `GET /api/jobs/{job_id}` | none | 200, `data: { job_id, library, status, video_path, duration_seconds, file_size_bytes, render_time_ms, error_message }` | 400, 401, 403, 404 "Render job not found" |

`status` is one of `Pending`, `GeneratingCode`, `Rendering`, `Uploading`, `Completed`, `Failed`. There is no push channel, so the frontend polls `GET /api/jobs/{id}` (it has no rate limit).

---

## 2. Things you asked for that the backend changes

Read these before anything else. Each one is a place where the request and the server disagree.

1. **Signup needs a username.** You described signup as email and password, but the server rejects a signup without a 3 to 30 character `username`. The signup form has three fields.

2. **"Not registered, so send them to signup" cannot be done securely.** Login answers the identical 401 "Invalid credentials" for an unknown email and for a wrong password, on purpose, so nobody can test which emails have accounts. The frontend cannot tell the two apart. What is built instead: on a failed login the error shows together with a prominent "No account yet? Sign up" link that carries the typed email over to the signup form. Making it a real automatic redirect would mean weakening the server; I recommend against it.

3. **The video cannot be played yet. `[BLOCKED]`** Workers save the file to their own `static/renders/<job_id>.mp4` and store `video_path: "/renders/<job_id>.mp4"`, but nothing in `api_server` serves that file. The frontend is built against a new endpoint, `GET /api/jobs/{job_id}/video`, that does not exist yet (see Phase F9.1). Until it exists, a finished job shows "video file is not available" in the current-video panel. Everything else works.

4. **There is no "list my jobs" endpoint.** The asset bin therefore lives in the browser: job ids and prompts are kept in `localStorage`, keyed by the user's email. Consequences: the bin does not follow the user to another browser, and prompts stay readable in that browser's storage after logout. The videos themselves stay protected, because every job call is checked against the session on the server. Phase F9.2 replaces this with a real endpoint.

5. **Each prompt makes a brand-new video.** The UI looks like a chat, but the server keeps no conversation: a second prompt does not edit the first video. The chat is a log of prompts and their status.

6. **Landing page takes `/`.** `authentication.md` put the app at `/`. With a landing page, the app moves to `/app`. The reset link in the email (`FRONTEND_URL/reset-password/<token>`) is unchanged.

7. **Folder.** The auth guide said `api_server/frontend/`; you asked for `animation_frontend/`. Development is unaffected. For production the build output has to land in `api_server/frontend/dist` (Phase F11).

---

## 3. Packages

Already installed by the Vite template: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `oxlint`.

To install (one command, run inside `animation_frontend`):

```powershell
npm install react-router-dom zustand gsap @gsap/react tailwindcss @tailwindcss/vite
```

| Package | Why |
| --- | --- |
| `react-router-dom` | Routes and route guards |
| `zustand` | The auth store and the studio store |
| `tailwindcss`, `@tailwindcss/vite` | Tailwind v4; no `tailwind.config.js` or PostCSS file needed |
| `gsap`, `@gsap/react` | Animations in Phase F10; unused until then |

Deliberately not added: `axios` (a 60-line `fetch` wrapper covers it), a form library, a validation library, a UI kit. Fewer dependencies means less to audit.

---

## 4. Folder structure

```
animation_frontend/
  vite.config.ts            Tailwind plugin, /api proxy to the API server
  index.html                Title, no-referrer policy
  src/
    main.tsx                Router provider
    App.tsx                 Startup session check, route table
    index.css               Tailwind entry
    types.ts                User, Job, Library, JobStatus
    lib/
      api.ts                The only place that calls fetch
      validation.ts         Client copies of the server's input rules
    store/
      authStore.ts          The only caller of /api/auth
      studioStore.ts        The only caller of /api/jobs; polling; asset bin
    components/
      Guards.tsx            PublicOnlyRoute, VerifyRoute, ProtectedRoute
      ui.tsx                AuthLayout, Field, Button, FormError, Spinner
      OtpInput.tsx          Six-box code entry
      studio/
        ChatPanel.tsx       Prompt log, library dropdown, prompt box
        CurrentVideo.tsx    Player or job status, "New video"
        AssetBin.tsx        Earlier videos
    pages/
      Landing.tsx  Login.tsx  Signup.tsx  VerifyEmail.tsx
      ForgotPassword.tsx  ResetPassword.tsx  Studio.tsx
```

---

## 5. Security rules the code follows

These are the rules to check every later change against.

1. **The token is never touched.** No `Authorization` header, no token in `localStorage`, no reading `document.cookie`. The user object lives in memory only and is rebuilt from `check-auth` on every page load.
2. **Same-origin calls only.** Every call goes to the relative path `/api/...` with `credentials: 'same-origin'`. In development Vite proxies `/api` to the API server, so the browser never makes a cross-origin request and CORS is not involved. The cookie can never be sent to another host.
3. **Use `localhost`, never `127.0.0.1`.** The dev server is pinned to port 5173 (`strictPort`) because the server's CORS origin and the reset-email link both assume it.
4. **The guards are a convenience.** The server's session gate and verified gate are the enforcement. The frontend never assumes a guard was respected: a 401 from any call logs the UI out, a 403 re-checks the user.
5. **Server data is validated before use.** The user object and job payloads are shape-checked. Job ids must match the UUID pattern before they are put in a URL. The video URL is built from the job id, never from the `video_path` string the server returns.
6. **No raw HTML.** No `dangerouslySetInnerHTML`. Worker `error_message` text (it can contain Docker output) is rendered as plain text, truncated, inside a collapsed block.
7. **Passwords stay in the form.** They are held in component state only, never in a store, and cleared after a submit.
8. **The reset token stays out of history and referrers.** `index.html` sets `referrer` to `no-referrer`, the token is format-checked before any request, and after a successful reset the page is replaced (not pushed) by `/login`.
9. **No account enumeration is added.** Forgot-password shows the same sentence whatever the server did. Login shows the server's single message.
10. **One user's data never shows for another.** The studio store is emptied when the studio unmounts (logout), and saved jobs are keyed by email. A response that arrives after the owner changed is discarded.
11. **Logout is honest.** Local state is cleared only when the server confirmed the cookie was cleared. If the call fails, the user is told they are still logged in.
12. **No third-party scripts, fonts or analytics.** Nothing loads from another origin.
13. **Requests cannot hang or double-fire.** Every call times out after 15 seconds; submit buttons are disabled while a call is in flight.

Later, at deployment: add a `Content-Security-Policy` header from `api_server` (`default-src 'self'`; `media-src 'self'`), and finish Phase 7 of the auth guide (`Secure` cookie, CORS from `FRONTEND_URL`).

---

## 6. Routes

| Route | Page | Who may see it | Otherwise |
| --- | --- | --- | --- |
| `/` | Landing | Logged out | Verified: `/app`. Unverified: `/verify-email` |
| `/login`, `/signup` | Sign in, sign up | Logged out | same |
| `/forgot-password` | Email form | Logged out | same |
| `/reset-password/:token` | New password | Logged out | same |
| `/verify-email` | Six-box code | Logged in, not verified | Logged out: `/login`. Verified: `/app` |
| `/app` | Studio | Logged in and verified | Logged out: `/login`. Unverified: `/verify-email` |
| anything else | | | `/` |

The user journeys fall out of this table with no extra navigation code:

- **Sign up:** submit, server sets the cookie and returns an unverified user, the guard moves the user to `/verify-email`.
- **Verify:** the sixth digit submits the code, the server returns a verified user, the guard moves the user to `/app`. The user was already logged in by the signup cookie, so there is no second login.
- **Returning unverified user:** logs in, lands on `/verify-email`, requests a new code.

---

## 7. Phases

Do them in order. Each has steps and tests. Start the API server, both Redis instances and a worker before testing.

Commands you run (PowerShell):

```powershell
# terminal 1, inside api_server
cargo run

# terminal 2, inside animation_frontend
npm run dev
```

Then open `http://localhost:5173`.

### Phase F0: Project setup `[BUILT]`

Steps:

1. Install the packages (section 3).
2. `vite.config.ts`: add the Tailwind plugin; pin port 5173; proxy `/api` to `http://localhost:5000`. If your `PORT` in `api_server/.env` is not 5000, create `animation_frontend/.env.local` containing `VITE_API_TARGET=http://localhost:<PORT>`.
3. `index.css`: replace the template styles with `@import "tailwindcss";`.
4. `index.html`: title `myanimate`, `<meta name="referrer" content="no-referrer">`.
5. Remove the template leftovers: `src/App.css`, `src/assets/hero.png`, `react.svg`, `vite.svg` (nothing imports them any more).

Note on the TypeScript settings already in the project: `verbatimModuleSyntax` means types are imported with `import type`, and `erasableSyntaxOnly` means no `enum`.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F0.1 | `npm run dev` | Starts on `http://localhost:5173` with no errors |
| F0.2 | `npm run build` | Type-check and build pass |
| F0.3 | Open the page | Landing page, styled by Tailwind |
| F0.4 | Network tab, any `/api` call | Goes to `localhost:5173/api/...` and is answered by the API server |

### Phase F1: API client `[BUILT]` (`src/lib/api.ts`)

One function, `api(method, path, body)`, and it never throws. It returns `{ ok, status, message, data, retryAfter }`.

Steps:

1. Relative `/api` base, `credentials: 'same-origin'`, `cache: 'no-store'`, JSON body.
2. 15-second timeout with `AbortController`.
3. `ok` is true only when the HTTP status is 2xx **and** the body says `success: true`.
4. On failure, `message` is the server's `message`. With no response, or a non-JSON response (the proxy answering while the server is down), it is a fixed generic sentence and `status` is 0.
5. On 429, read `Retry-After` into `retryAfter` and append the wait to the message.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F1.1 | Stop the API server, submit the login form | Generic "could not reach the server" message; the button re-enables |
| F1.2 | Network tab on a login | Cookie set by the response; no `Authorization` header; `document.cookie` in the console shows no `token` |
| F1.3 | Six wrong logins for one email | The sixth shows "Too many requests, try again later" with a wait time |

### Phase F2: Auth store `[BUILT]` (`src/store/authStore.ts`)

State as in `authentication.md` section 11: `user`, `isAuthenticated`, `isCheckingAuth` (starts true), `isLoading`, `error`.

Actions: `checkAuth`, `signup`, `login`, `logout`, `verifyEmail`, `resendVerification`, `forgotPassword`, `resetPassword`, plus `clearError`, `sessionLost` (a 401 arrived somewhere) and `refreshUser` (a 403 arrived somewhere).

Rules:

1. Each action sets `isLoading`, calls the server, writes the result, and always clears `isLoading`.
2. A user object that fails the shape check is treated as a failure.
3. `logout` clears local state only on a confirmed 200.
4. Passwords are arguments only; nothing is stored.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F2.1 | Open the app logged out | Spinner, then the landing page; no flash of the studio |
| F2.2 | Log in, refresh | Spinner, then still in the studio |
| F2.3 | Delete the `token` cookie in dev tools, refresh | Landing page, no error shown |

### Phase F3: Routing and guards `[BUILT]` (`src/App.tsx`, `src/components/Guards.tsx`)

Steps:

1. `App` calls `checkAuth` once on mount and renders only a spinner until it finishes.
2. Three guard components implement the table in section 6. All redirects use `replace`, so Back never returns to a page the user may not see.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F3.1 | Logged out, visit `/app` and `/verify-email` | Both go to `/login` |
| F3.2 | Unverified, visit `/app`, `/login`, `/` | All go to `/verify-email` |
| F3.3 | Verified, visit `/`, `/login`, `/signup`, `/verify-email` | All go to `/app` |
| F3.4 | Visit `/nonsense` | Goes to `/`, then wherever the state sends you |
| F3.5 | Log out, press Back | Does not show the studio |
| F3.6 | Unverified, call `POST /api/jobs` by hand from the console | 403 from the server |

### Phase F4: Landing page `[BUILT]` (`src/pages/Landing.tsx`)

Header with the name `myanimate`, a tagline, one paragraph, and two buttons: Sign in (`/login`) and Sign up (`/signup`). Nothing else.

### Phase F5: Sign up and sign in `[BUILT]`

Steps:

1. **Signup:** username, email, password. The client runs the same rules as the server before sending (username 3 to 30, valid email, password 8 to 72), and still shows whatever message the server returns. A 409 shows "User already exists" beside a link to sign in.
2. **Login:** email and password (the password only has to be non-empty, matching the server, so old short passwords still work). On failure: the server's message plus the "No account yet? Sign up" link carrying the email (section 2, point 2). A "Forgot password?" link.
3. Both forms clear the password field after a failed submit and clear the shared `error` on mount.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F5.1 | Signup with a 7-character password | Error shown, no request sent |
| F5.2 | Signup with valid data | Lands on `/verify-email`; an email arrives |
| F5.3 | Signup with an email that exists | "User already exists" and a sign-in link |
| F5.4 | Login with an unknown email | "Invalid credentials" and the sign-up link; clicking it opens signup with the email filled in |
| F5.5 | Login with the wrong password | Exactly the same message as F5.4 |
| F5.6 | Login as a verified user | Lands on `/app` |
| F5.7 | Double-click the submit button | One request in the network tab |

### Phase F6: Verify email `[BUILT]` (`src/pages/VerifyEmail.tsx`, `src/components/OtpInput.tsx`)

Steps:

1. Six boxes: digits only; typing moves forward; Backspace in an empty box moves back; pasting a code fills all six; the form submits itself when the sixth box fills.
2. Wrong code: show the server's message, empty the boxes, focus the first. After 5 wrong tries, tell the user the code is locked and to request a new one (the server enforces this; the count here is only a hint).
3. Resend button: disabled with a countdown for 60 seconds after each use. On a 429 the countdown is set from `Retry-After`.
4. "Use a different account" logs out, so a user who mistyped their email is not stuck.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F6.1 | Type six digits | Focus advances; submits after the sixth |
| F6.2 | Backspace in an empty box | Focus moves back |
| F6.3 | Paste `123456` | All boxes fill and it submits |
| F6.4 | Wrong code | Message shown, boxes cleared |
| F6.5 | Correct code | Lands on `/app` without logging in again |
| F6.6 | Click resend | Countdown from 60; a new email arrives; the old code fails |
| F6.7 | Five wrong codes, then the right one | Refused; the locked hint shows; a resent code works |
| F6.8 | Sign up, close the tab, come back and log in | Lands on `/verify-email` |

### Phase F7: Forgot and reset password `[BUILT]`

Steps:

1. **Forgot:** email form. After a successful call always show "If an account exists for that email, you will receive a reset link shortly".
2. **Reset:** the token from the URL must be 40 hex characters, otherwise show "invalid link" and send nothing. Two password fields; if they differ, show an error without calling the server. On success, replace the page with `/login` and show a confirmation there.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F7.1 | Forgot, registered email | Neutral message; email arrives |
| F7.2 | Forgot, unknown email | Same message; no email |
| F7.3 | Reset with mismatched fields | Error; no request |
| F7.4 | Reset with a valid link | Lands on `/login` with a confirmation; the new password works; Back does not return to the link |
| F7.5 | Open the same link again and submit | "Invalid or expired reset token" |
| F7.6 | Open `/reset-password/abc` | "Invalid link"; no request |

### Phase F8: Studio `[BUILT]` except video playback

Layout: a header (name, username, Log out). Below it two columns: on the left the chat with the asset bin under it, on the right the current video. On a narrow screen the columns stack.

**Store (`src/store/studioStore.ts`).**

| State | Meaning |
| --- | --- |
| `jobs` | Every job this browser knows for this user, oldest first |
| `currentId` | The job shown in the current-video panel, or none |
| `library` | The dropdown value, `manim` or `remotion` |
| `isSubmitting`, `error` | Prompt form status |
| `pollStalled` | Polling gave up; the UI offers "Check again" |

The asset bin is not separate state: it is every job except the current one. That makes the behaviours simple and impossible to get out of step:

- **Send a prompt:** create the job, make it current. Whatever was current is now in the bin.
- **New video:** set `currentId` to none. The old current video is now in the bin and the panel is empty, ready for the next prompt.
- **Click a bin item:** it becomes current; the previous current goes to the bin.

Steps:

1. `submitPrompt`: trim; check 10 to 2000 characters; refuse while another job is still running (one render at a time); `POST /api/jobs`; on success add the job and start polling.
2. Polling: `GET /api/jobs/{id}` every 2.5 seconds until `Completed` or `Failed`. Stops on logout. Gives up after 8 failed calls in a row or 30 minutes, and sets `pollStalled`.
3. Errors: 401 logs the UI out; 403 re-checks the user (the guard then moves them to verify); 429 shows the server's message with the wait time; 404 marks the job as gone.
4. Persistence: jobs and `currentId` are saved to `localStorage` under `myanimate:jobs:v1:<email>` (latest 50). On entering the studio they are read back, shape-checked, and an unfinished job resumes polling.
5. Chat panel: one pair of bubbles per job (the prompt, then its status), the library dropdown, the prompt box with a character count. Enter sends; Shift+Enter makes a new line.
6. Current video: player when completed, status while running, the reason when failed, an empty state otherwise, and the New video button.
7. Asset bin: cards with the prompt, library and status, newest first.

Tests:

| # | Test | Expected |
| --- | --- | --- |
| F8.1 | Send a 5-character prompt | Error; no request |
| F8.2 | Send a valid prompt with Remotion selected | Bubbles appear; status moves through queued, writing code, rendering, ready |
| F8.3 | Same with Manim selected | The request body carries `"library": "manim"` |
| F8.4 | While a job is running | The prompt box and New video are disabled |
| F8.5 | Refresh during a render | The job is still there and keeps updating |
| F8.6 | Click New video after a job finished | The panel empties; the job appears in the bin |
| F8.7 | Click a bin item | It becomes current; the previous one moves to the bin |
| F8.8 | Create jobs past the hourly quota (5) | "Too many requests" with a wait time |
| F8.9 | Log out, log in as another user | The first user's jobs are not shown |
| F8.10 | Delete the cookie during a render | The UI returns to `/login` on the next poll |
| F8.11 | A finished job's video | `[BLOCKED]` shows "video file is not available" until F9.1 is done |

### Phase F9: Backend work the studio needs `[TODO]` (inside `api_server`, not frontend)

These are the "Before Phase 9" tasks from `Authexecution.md`. They need your go-ahead because they change `api_server`.

1. **F9.1 Serve the video.** `GET /api/jobs/{job_id}/video`, behind the session gate and the verified gate. It looks the job up by id **and** user id (so another user gets 404), picks the worker's render folder from the job's library, and streams `<job_id>.mp4` with range support (needed for seeking; `tower-http`'s file service already in `Cargo.toml` does this). Two new settings give the folder paths, for example `RENDERS_DIR_REMOTION=../remotion_worker/static/renders` and `RENDERS_DIR_MANIM=../manim_worker/static/renders`. Gating by session is safer than relying on unguessable file names. The frontend already requests this exact path, so no frontend change follows.
2. **F9.2 List my jobs.** `GET /api/jobs`, same gates, returns the caller's jobs (id, prompt, library, status, created time), newest first, capped. Then the studio store loads from the server and the `localStorage` copy is deleted.
3. **Expired files.** The workers delete old renders on a timer. A completed job whose file is gone must show "this video has expired"; the player's error handler already does this.
4. **Phase 7 of the auth guide** (Secure cookie, CORS origin from `FRONTEND_URL`, static serving that does not panic, JSON 404 under `/api`) before any deployment.

### Phase F10: Animation with GSAP `[TODO]`

Only after F0 to F9 pass. Rules: animations never gate logic (no "wait for the tween before navigating"), and everything respects `prefers-reduced-motion` through `gsap.matchMedia()`.

1. Use `useGSAP` from `@gsap/react` with a `scope` ref per component, so tweens are cleaned up on unmount.
2. Landing: staggered entrance of name, tagline, paragraph, buttons.
3. Auth pages: card fade-and-rise on mount; a short shake on the error line.
4. Verify email: a pulse on each filled box; shake on a wrong code.
5. Studio: new chat bubbles slide in; the current video moves into the bin with GSAP Flip when New video is clicked; a progress shimmer while rendering.

### Phase F11: Production build `[TODO]`

1. Set `build.outDir` in `vite.config.ts` to `../api_server/frontend/dist` (with `emptyOutDir: true`), since `api_server` serves `frontend/dist` relative to its own folder.
2. Finish Phase 7 of the auth guide first: `main.rs` still nests the static service at `/`, which is expected to panic on axum 0.8.
3. Run test 8C.17 of the auth guide: build, serve through `api_server`, repeat signup, reset and a refresh on `/verify-email`.
4. Check the forms at phone width.

---

## 8. End-to-end acceptance (after F9.1)

| # | Journey | Expected |
| --- | --- | --- |
| E1 | Landing, Sign up, code from email, studio, prompt, video plays | Every step works with no manual login |
| E2 | Sign up, close the tab, return, Sign in | Verify page; resend; finish; studio |
| E3 | Sign in with an unregistered email | "Invalid credentials" and the sign-up link |
| E4 | Forgot password, link, new password, sign in | Works; the link fails a second time |
| E5 | Two prompts, New video between them | First video in the bin, second is current |
| E6 | Log out, sign in as another user | Nothing from the first user is visible or playable |
