# Auth Execution Guide for `api_server`

This file turns the authentication plan into phases you can build and test one at a time. Each phase has **Steps** (what to build), then **Tests** (how to prove the phase works before moving on). Section numbers (§) refer to the plan document.

## How to use this guide

- Do the phases in order. Later phases assume earlier ones are done.
- Do not start a phase until every test in the previous one passes.
- Commit at the end of each phase, so a broken phase can be rolled back on its own.
- Nothing here touches `manim_worker` or `remotion_worker`.

### Test setup (used by every phase)

```bash
# Run the server locally, then in another terminal:
export API=http://localhost:<PORT>          # PORT from api_server/.env
export JAR=/tmp/cookies.txt                 # cookie jar for session tests
rm -f $JAR
```

A helper for JSON calls:

```bash
post() { curl -s -i -b $JAR -c $JAR -X POST "$API$1" -H 'Content-Type: application/json' -d "$2"; }
```

Use a mail catcher (for example Mailpit on `localhost:1025`) or a throwaway Gmail account for email tests from Phase 3 onward. Use `mongosh` to inspect the `users` collection and `redis-cli` to inspect Redis. Install `mongosh`, `redis-cli` and Mailpit before Phase 1.

**Windows notes.**

- Run the commands in Git Bash, not PowerShell. In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`, and `export` does not exist.
- Use `localhost` everywhere in development (browser, `API`, `FRONTEND_URL`), never a mix of `localhost` and `127.0.0.1`. The `SameSite=Strict` cookie stops being sent if the two differ.
- The project root is not a git repo; `api_server` has its own. Run every git command from inside `api_server`.

### Phase overview

| Phase | Goal | Plan sections |
| --- | --- | --- |
| 0 | Safe repo and configuration | §1, §12 step 1 |
| 1 | Validation, normalised emails, unique index | §2, §4, §12 step 2 |
| 2 | Close the forgot-password leaks | §8, §12 step 3 |
| 3 | Mailer and reset email | §10, §8, §12 steps 4 and 5 |
| 4 | Email verification (model, signup, verify, resend) | §2, §5, §6, §12 step 6 |
| 5 | `is_verified` everywhere, verified gate, check-auth fix | §4, §7, §12 step 7 |
| 6 | Rate limiting and job quota | §9, §12 step 8 |
| 7 | Production hardening (Secure cookie, CORS, static serving and 404s) | §3, §11, §12 step 9 |
| 8 | Frontend | §11, §12 step 10 |
| Before 9 | Two non-auth tasks: serve rendered videos, list my jobs | none (needed for journey 9.1) |
| 9 | End-to-end acceptance and release | all |

---

## Phase 0: Safe repo and configuration

**Goal:** no secrets in git, no secrets in logs, and all new environment variables declared.

### Steps

1. Add `.env` to `api_server/.gitignore` (it lists only `/target` today).
2. From inside `api_server`, check git history for a committed `.env`. If one was ever committed, rotate `JWT_SECRET`, the SMTP password and the Redis passwords.
3. Remove the startup log lines that print `REDIS_URL_MANIM` and `REDIS_URL_REMOTION`.
4. Add the new variables to `.env` and to the config loader / `AppState`:
   - `FRONTEND_URL` (development: `http://localhost:5173`)
   - `JOB_LIMIT_PER_HOUR` (default 5)
   - `JOB_LIMIT_PER_DAY` (default 15)
5. Create a `.env.example` with every variable name and no real values.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 0.1 | From inside `api_server`: `git check-ignore .env` | Prints `.env` (file is ignored) |
| 0.2 | `git status` (inside `api_server`) after editing `.env` | `.env` does not appear |
| 0.3 | Start the server and read the full startup output | No Redis URL, password, or JWT secret appears |
| 0.4 | Start the server with `FRONTEND_URL` and the job limits unset | Server starts and uses the documented defaults (or fails with a clear message for `FRONTEND_URL`, whichever you chose) |
| 0.5 | Existing signup, login, logout, check-auth still work | Same behaviour as before the phase |

**Done when:** all five tests pass.

---

## Phase 1: Validation, normalised emails, unique index

**Goal:** bad input is rejected before anything else happens, and duplicate accounts are impossible.

### Steps

1. Update the form rules in `src/schema/types.rs`. The password rule is **not the same everywhere**:
   - `SignupForm`: valid email; username 3 to 30 characters; password 8 to 72 characters (the form currently says 6 minimum, no maximum).
   - `LoginForm`: valid email; the password only has to be non-empty, with **no length rule**. Accounts created earlier may have 6 or 7 character passwords and must still be able to log in.
2. Add a form for forgot-password (valid email only) and for reset-password (password 8 to 72 characters, the same rule as signup).
3. In signup, login and forgot-password, trim and lowercase the email **first**, on the raw input, before validation. Otherwise `"  TEST@Example.COM "` fails the email check instead of being normalised.
4. Then call `.validate()` before doing anything else. Reset-password has no email, so it only validates. On failure answer 400 with the reason in `message`. Every lookup and insert uses the normalised email.
5. Create a unique index on `users.email` at startup. If creation fails because duplicates already exist, log which emails and stop, so you can clean them up.
6. In signup, treat a duplicate-key error on insert as 409 "User already exists". Keep the existing lookup if you like, but the index is the real guard.
7. Migrate existing users: lowercase and trim stored emails (see the note below).

> **Migration note.** Existing accounts were stored exactly as typed. A user stored as `Bob@Mail.com` will no longer be found by a lowercased login. Run a one-off update that lowercases all stored emails, and resolve any collisions by hand before creating the index.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 1.1 | Signup with `email: "notanemail"` | 400, message names the email |
| 1.2 | Signup with `username: "ab"` | 400 |
| 1.3 | Signup with a 31-character username | 400 |
| 1.4 | Signup with a 7-character password | 400 |
| 1.5 | Signup with a 73-character password | 400 |
| 1.6 | Signup with an empty password | 400 |
| 1.7 | Signup with an 8-character password and valid fields | 201 |
| 1.8 | Signup again with `"  TEST@Example.COM "` after signing up as `test@example.com` | 409 |
| 1.9 | In `mongosh`: `db.users.getIndexes()` | Includes a unique index on `email` |
| 1.10 | Fire two signups for the same new email at the same moment (`curl ... & curl ... &`) | One 201, one 409; `db.users.countDocuments({email})` is 1 |
| 1.11 | Login with `"  TEST@EXAMPLE.COM "` and the right password | 200 |
| 1.12 | Login with an empty body or empty password | 400 |
| 1.13 | Reset-password with an empty password in the body | 400 |
| 1.14 | Reset-password with a 7-character password and a real token | 400, and the token still works afterwards |
| 1.15 | Existing accounts (created before this phase) can still log in | 200 |
| 1.16 | Log in to an account whose password is 6 or 7 characters (insert a bcrypt hash of such a password directly, or use an old account) | 200, not 400 |

**Done when:** all sixteen tests pass.

---

## Phase 2: Close the forgot-password leaks

**Goal:** forgot-password no longer hands out tokens or reveals which emails exist.

### Steps

1. Remove `debug_token` from the forgot-password response.
2. If the email is not registered, answer 200 with the same message as for a registered email: "If an account exists for that email, a reset link has been sent".
3. If the user exists, keep generating the token (20 random bytes as 40 hex characters), storing it and the 1-hour expiry, and overwriting any earlier token. Do not return it.
4. Until Phase 3 sends real email, log the reset link to the **server console only in development** (`NODE_ENV` not `production`) so you can still test reset by hand. Remove this line in Phase 3.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 2.1 | Forgot-password for a registered email | 200, body has `success` and `message`, **no** `debug_token` field anywhere |
| 2.2 | Forgot-password for an unregistered email | 200, same message as 2.1 |
| 2.3 | Compare the two response bodies (2.1 and 2.2) | Identical except for nothing; ideally byte-identical |
| 2.4 | Compare response times for known and unknown emails (run each 10 times) | No obvious large difference |
| 2.5 | After 2.1, check `reset_password_token` and `reset_password_expires_at` in the database | Both set; expiry about 1 hour ahead |
| 2.6 | Call forgot-password twice for the same user | The stored token changes; the first token no longer works |
| 2.7 | Reset-password with the (dev-logged) token, then with it again | First 200, second 400 |
| 2.8 | Reset-password with a made-up token | 400 "Invalid or expired reset token" |

**Done when:** all eight tests pass.

---

## Phase 3: Mailer and the reset email

**Goal:** the server can send email over SMTP, and forgot-password actually emails the reset link.

### Steps

1. Build the mailer in `src/utils/` using `lettre` and the `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `SENDER_NAME` values already in `AppState`.
2. Write the two HTML templates and keep them in the codebase, each with one placeholder the server fills in:
   - Verify your email: the 6-digit code and "expires in 15 minutes"
   - Reset your password: a button linking to `FRONTEND_URL/reset-password/<token>` and "expires in 1 hour"
3. Send without blocking the response. `lettre` is currently set up with only its blocking (synchronous) transport, which would tie up a server worker. Either enable its `tokio1` features (for example `tokio1-rustls-tls`) and use the async transport, or wrap each send in `tokio::task::spawn_blocking`. Either way, run the send as a background task. A failed send is logged and never changes the response.
4. Wire forgot-password to send the reset email when the user exists. Remove the development console log added in Phase 2.
5. Make sure no log line contains the token, the code, or the SMTP password.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 3.1 | Forgot-password for a registered email with the mail catcher running | An email arrives with a link of the form `FRONTEND_URL/reset-password/<40 hex characters>` |
| 3.2 | The link in the email, with its token passed to `POST /reset-password/{token}` and a valid new password | 200 "Password reset successful" |
| 3.3 | Log in with the new password | 200; the old password gives 401 |
| 3.4 | Forgot-password for an unregistered email | 200, and **no** email arrives |
| 3.5 | Stop the mail catcher (or set a wrong SMTP password) and call forgot-password | Still 200 within about a second; an error is logged |
| 3.6 | Search server logs for the token and for the SMTP password | Neither appears |
| 3.7 | Open the email in a mail client | Renders correctly; states the 1-hour lifetime |
| 3.8 | Request a reset, wait past expiry (or set the expiry back in the database), use the link | 400 |

**Done when:** all eight tests pass.

---

## Phase 4: Email verification

**Goal:** new accounts start unverified, receive a code, and can verify or request a new code.

> **Warning.** Between this phase and Phase 5, new unverified users can still reach `/api/jobs` because the verified gate does not exist yet. Do Phase 5 straight after, and do not deploy in between.

### Steps

1. Add three fields to the user model in `src/models/user.rs`: `verification_code`, `verification_expires_at`, `verification_attempts`. Keep the existing default so a missing `is_verified` still means `true` for old accounts.
2. Write a helper that generates a 6-digit code from a cryptographically secure random source (zero-padded, so `004821` is possible).
3. Change signup to:
   - insert with `is_verified: false`, the code, an expiry 15 minutes ahead, `verification_attempts: 0`
   - issue the session and set the cookie as it does today
   - send the verification email in the background
   - answer 201 with the user object
4. Build `POST /verify-email` (session required, body `{ code }`):
   1. Load the user from the session id.
   2. If already verified, answer 200 with the user object.
   3. If there is no code, it has expired, or `verification_attempts` is 5 or more, answer 400 "Invalid or expired verification code".
   4. If the code does not match, increment `verification_attempts` and answer 400 with the same message.
   5. On a match, set `is_verified: true`, remove the code, expiry and attempt counter, answer 200 with the user object.
5. Build `POST /resend-verification` (session required):
   1. If already verified, answer 200 and send nothing.
   2. Otherwise generate a new code, reset the expiry to 15 minutes ahead and the attempts to 0, send the email, answer 200.
6. Register both routes (uncomment `/verify-email`, add `/resend-verification`).
7. Change reset-password so a successful reset also sets `is_verified: true`.
8. Optional: compare codes in constant time, using a crate such as `subtle`, so the comparison does not stop at the first differing character. The 5-attempt limit is the real protection, so skipping this is acceptable.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 4.1 | Signup with a new email | 201; cookie set; database row has `is_verified: false`, a 6-digit code, expiry about 15 minutes ahead, attempts 0 |
| 4.2 | Check the mail catcher | A verification email with the same 6-digit code arrives |
| 4.3 | `POST /verify-email` with no session cookie | 401 |
| 4.4 | `POST /verify-email` with the right code | 200; row now has `is_verified: true` and no code, expiry or attempts |
| 4.5 | `POST /verify-email` again after success | 200 (already verified) |
| 4.6 | Fresh signup; submit a wrong code | 400 "Invalid or expired verification code"; attempts is 1 |
| 4.7 | Submit 5 wrong codes, then the right one | The right one is rejected with 400 |
| 4.8 | After 4.7, call `/resend-verification`, then submit the new code | 200; attempts had reset to 0; the old code no longer works |
| 4.9 | Set `verification_expires_at` to the past in the database, submit the right code | 400 |
| 4.10 | Generate 1,000 codes in a unit test | All are exactly 6 digits; some start with 0 |
| 4.11 | `/resend-verification` for an already verified user | 200 and no email arrives |
| 4.12 | `/resend-verification` without a session | 401 |
| 4.13 | User A tries to verify with user B's code | 400 (the code is checked against the logged-in user only) |
| 4.14 | Unverified user runs forgot-password and completes the reset | Row has `is_verified: true` afterwards |
| 4.15 | Existing accounts from before this phase | Still `is_verified: true`; login unchanged |
| 4.16 | Unverified user logs out, logs in again, calls `/resend-verification` | 200 and a new code arrives |
| 4.17 | Mail catcher stopped, then signup | Still 201; account exists; error logged |

**Done when:** all seventeen tests pass.

---

## Phase 5: `is_verified` everywhere, verified gate, check-auth fix

**Goal:** verification actually means something. Unverified accounts cannot create jobs, and every user response says whether the user is verified.

### Steps

1. Make one function that builds the user object and use it in every handler. It returns exactly `{ email, username, is_verified }`, plus `last_login` and `created_at` on check-auth. Never the password hash, code, or reset token.
2. Add `is_verified` to the responses of signup, login, verify-email and check-auth.
3. Build the verified gate in `src/middleware/`: runs after the session gate, loads the user, and answers 403 if `is_verified` is false. If the user no longer exists, answer 401.
4. Put the session gate and then the verified gate on the `/api/jobs` routes.
5. Fix check-auth:
   - missing, invalid or expired token: 401 (already so)
   - valid token, user not found: 401 (today 404)
   - valid token with a malformed user id: 401 (today 400)
6. Make every error answer in the same JSON shape, `{ success: false, message }`. The session gate and the job handlers currently return a bare status code with no body, so the frontend would have nothing to show. Suggested messages: 401 "Unauthorized" from the session gate, 403 "Please verify your email first" from the verified gate, and a clear message for each existing job-handler error.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 5.1 | Signup response | Contains `is_verified: false`, and no `password`, `verification_code`, or `reset_password_token` |
| 5.2 | Login response for a verified user | Contains `is_verified: true` |
| 5.3 | Check-auth response | Contains `email`, `username`, `is_verified`, `last_login`, `created_at` |
| 5.4 | Verify-email success response | Contains `is_verified: true` |
| 5.5 | Unverified user calls any `/api/jobs` route | 403 |
| 5.6 | Same user after verifying | The job route works (200/201 as appropriate) |
| 5.7 | No cookie on a job route | 401 |
| 5.8 | Delete the user from the database, then use their still-valid cookie on check-auth | 401, not 404 |
| 5.9 | Same deleted-user cookie on a job route | 401 |
| 5.10 | Send a cookie signed correctly but whose `user_id` claim is not a valid ObjectId (build one with the test secret) | 401, not 400 |
| 5.11 | Send a cookie with a tampered signature | 401 |
| 5.12 | Legacy verified account hits a job route | Works |
| 5.13 | Grep all handler responses (or add a unit test on the builder) for forbidden fields | None found |
| 5.14 | Read the body of the 401 from the session gate and the 403 from the verified gate | JSON with `success: false` and a `message` |
| 5.15 | Trigger each job-handler error (invalid prompt, unknown job, and so on) | Each answers with a JSON body containing `success: false` and a `message` |

**Done when:** all fifteen tests pass. It is now safe to deploy Phases 4 and 5 together.

---

## Phase 6: Rate limiting and job quota

**Goal:** the abuse limits in §9 are enforced, and each user's render spending is capped.

### Steps

1. Enable connection info when starting the server so handlers can read the peer IP.
2. Build the limiter in `src/middleware/` (or as a helper) using the Remotion Redis pool, with all keys prefixed `rl:`. A limit check: `INCR` the key, set `EXPIRE` to the window length on first use, refuse when the count passes the limit.
3. Make refusal consistent: 429, header `Retry-After` set from the key's remaining time, body `{ success: false, message: "Too many requests, try again later" }`.
4. Apply the limits:

   | Endpoint | Key | Limit |
   | --- | --- | --- |
   | `POST /signup` | IP | 5 per hour |
   | `POST /login` | IP | 20 per 15 minutes |
   | `POST /login` | email | 5 **failed** attempts per 15 minutes |
   | `POST /resend-verification` | user | 1 per 60 seconds, 5 per day |
   | `POST /forgot-password` | email | 3 per hour (over the limit: answer the usual 200, **generate no token** and send nothing) |
   | `POST /forgot-password` | IP | 10 per hour |
   | `POST /reset-password/{token}` | IP | 10 per hour |
   | `POST /api/jobs` | user | `JOB_LIMIT_PER_HOUR` and `JOB_LIMIT_PER_DAY` |

   Two ordering rules:
   - **Forgot-password:** check the email limit before generating a token. When the limit is hit, skip token generation entirely. Storing a new token would overwrite the one in the email the user already received and silently break that link.
   - **Jobs:** run the quota check **after** prompt validation, so a rejected prompt does not use up the user's quota.

5. Verify-email needs nothing new in Redis: its limit is the 5-attempt counter on the user record from Phase 4.
6. For the login-by-email limit, count only failures, and clear the counter on a successful login.
7. If Redis is unreachable, auth endpoints let the request through and log the failure. Job creation fails anyway because it cannot enqueue.
8. Make the limits easy to lower for testing (for example, read them from constants you can override in a test build), so you do not wait an hour.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 6.1 | 6 signups from one IP within an hour (valid, distinct emails) | First 5 succeed, the 6th gets 429 |
| 6.2 | The 429 response | Has a `Retry-After` header with a positive number, and the message "Too many requests, try again later" |
| 6.3 | 6 wrong-password logins for one email | First 5 give 401, the 6th gives 429 |
| 6.4 | After 6.3, log in with the **right** password | Still 429 until the window ends. Note the trade-off: anyone can lock a known user out of login for 15 minutes. This is accepted. |
| 6.5 | 3 wrong logins, then a successful login, then 3 more wrong logins | No 429 (success cleared the counter) |
| 6.6 | 21 logins from one IP in 15 minutes | The 21st gives 429 |
| 6.7 | `/resend-verification` twice within 60 seconds | Second gives 429 with `Retry-After` of about 60 or less |
| 6.8 | 5 resends spread across a day, then a 6th | 6th gives 429 |
| 6.9 | 4 forgot-password calls for one registered email | All 200; only 3 emails arrive |
| 6.10 | 4 forgot-password calls for one unregistered email | All 200, no email; responses identical to 6.9 |
| 6.11 | 11 forgot-password calls from one IP | 11th gives 429 |
| 6.12 | 11 reset-password calls from one IP | 11th gives 429 |
| 6.13 | Verified user creates jobs up to `JOB_LIMIT_PER_HOUR` | The next one gives 429 |
| 6.14 | Same user, hourly limit reset (delete the key), up to `JOB_LIMIT_PER_DAY` | The next one gives 429 |
| 6.15 | Two different users each create jobs | Each has their own count |
| 6.16 | In `redis-cli`: `KEYS rl:*` and `TTL` on a few | Keys exist, all prefixed `rl:`, all have a TTL |
| 6.17 | `render_queue` is untouched | Same length and contents as before the tests |
| 6.18 | Stop Redis, call login and signup | Requests are let through; failure logged |
| 6.19 | Stop Redis, create a job | Fails (cannot enqueue) |
| 6.20 | Peer IP check: log the IP seen by the limiter | Shows the real client IP, not `0.0.0.0` or empty |
| 6.21 | Request a reset link, then call forgot-password for the same email until the limit is hit, then use the **first** link | The stored token is unchanged after the limited calls; the first link still works |
| 6.22 | Send a job with an invalid prompt several times, then a valid one | The invalid ones are rejected without using up the quota; the valid one counts once |

**Done when:** all twenty-two tests pass.

---

## Phase 7: Production hardening

**Goal:** the server starts in production mode, serves the frontend and API 404s correctly, and the session cookie and CORS are right.

### Steps

1. First, start the server once with `NODE_ENV=production`. The static-file setup in `src/main.rs` uses `nest_service("/", ...)`, and axum 0.8 is expected to panic when a service is nested at the root. If it panics, switch to `fallback_service` serving `frontend/dist`, with the app's entry page as the fallback.
2. Give unknown `/api/...` paths a JSON 404 (`{ success: false, message: "Not found" }`) instead of the HTML entry page. Only paths outside `/api` fall back to the entry page. This needs its own handling, because the plain fallback would return the HTML page for every unknown path.
3. In `src/utils/setcookie.rs`, set `Secure` to `true` when `NODE_ENV=production`, and `false` otherwise. Apply it to both the set and the clear cookie so logout still works.
4. Read the CORS allowed origin from `FRONTEND_URL` instead of the hard-coded `http://localhost:5173`. Keep credentials enabled.
5. Confirm the production static-file serving still works with the new CORS setting (same-origin requests do not need CORS).

### Tests

| # | Test | Expected |
| --- | --- | --- |
| 7.1 | Start with `NODE_ENV=development`, log in, inspect `Set-Cookie` | Contains `HttpOnly`, `SameSite=Strict`, `Path=/`, and **no** `Secure` |
| 7.2 | Start with `NODE_ENV=production` behind HTTPS, log in, inspect `Set-Cookie` | Also contains `Secure` |
| 7.3 | In production, call logout and inspect `Set-Cookie` | Cookie is cleared (empty or expired) with matching attributes |
| 7.4 | Preflight: `curl -i -X OPTIONS $API/api/auth/login -H "Origin: <FRONTEND_URL>" -H "Access-Control-Request-Method: POST"` | `Access-Control-Allow-Origin` equals `FRONTEND_URL`; `Access-Control-Allow-Credentials: true` |
| 7.5 | Same preflight with `Origin: http://evil.example` | No `Access-Control-Allow-Origin` header for that origin |
| 7.6 | Change `FRONTEND_URL` in `.env` and restart | The allowed origin follows the new value |
| 7.7 | Start with `NODE_ENV=production`, then `GET /` and `GET /some/unknown/path` | The server starts without panicking; both requests return the frontend entry page (needs `api_server/frontend/dist`; a placeholder `index.html` is enough until Phase 8) |
| 7.8 | `GET /api/does-not-exist` in production | 404 with a JSON body (`success: false`, `message`), not the HTML page |
| 7.9 | `POST /api/does-not-exist` in production | Same JSON 404 |

**Done when:** all nine tests pass.

---

## Phase 8: Frontend

**Goal:** a working UI for the whole auth flow, built on a single auth store. Build it in the three parts below, testing each.

### Phase 8A: Foundation (project, API client, store, startup)

#### Steps

1. Create the frontend project in `api_server/frontend/`, not at the project root. The server serves `frontend/dist` relative to the folder it is started from, and `.env` is loaded from `api_server`, so the server is always started from there. The dev server runs on `http://localhost:5173`.
2. Build one API helper that always sends credentials, uses the server's full address in development and a relative path in production, and never touches the token. Alternatively, use a Vite dev proxy for `/api` so development also uses relative paths and CORS is not involved. Use `localhost` throughout, never `127.0.0.1`.
3. Build the auth store with the state in §11:

   | State | Initial |
   | --- | --- |
   | `user` | none |
   | `isAuthenticated` | false |
   | `isCheckingAuth` | true |
   | `isLoading` | false |
   | `error` | none |

4. Add one action per endpoint: signup, login, logout, verify-email, resend-verification, forgot-password, reset-password, check-auth. Each sets `isLoading`, calls the server, writes the result to state, and puts the server's `message` into `error` on failure. If there is no response at all, clear `isLoading` and show a generic message.
5. On mount, call check-auth and show a spinner until it finishes.

#### Tests

| # | Test | Expected |
| --- | --- | --- |
| 8A.1 | Open the app while logged out | Spinner, then the login page, with no flash of protected content |
| 8A.2 | Log in (use a temporary button or the console), then refresh | Spinner, then still logged in, with `user` restored |
| 8A.3 | Network tab on any call | Request includes the cookie; no `Authorization` header; token not readable from JS (`document.cookie` shows nothing) |
| 8A.4 | Stop the server and trigger an action | `isLoading` returns to false, a generic error shows |
| 8A.5 | Trigger a 429 | The server's message is shown as-is |
| 8A.6 | As an unverified user, trigger a 403 on a job call | The server's message ("Please verify your email first") is shown (depends on Phase 5 step 6) |

### Phase 8B: Routes and guards

#### Steps

1. Add the routes and guards from §11:

   | Route | Who may see it |
   | --- | --- |
   | `/` | Logged in and verified |
   | `/signup`, `/login` | Logged out only |
   | `/verify-email` | Logged in and not yet verified |
   | `/forgot-password` | Logged out only |
   | `/reset-password/:token` | Logged out only |
   | anything else | Redirect to `/` |

2. Rules: logged out on a protected page goes to `/login`; logged in but unverified anywhere except `/verify-email` goes to `/verify-email` (including right after login); logged in and verified on a logged-out-only page or `/verify-email` goes to `/`.

#### Tests

| # | Test | Expected |
| --- | --- | --- |
| 8B.1 | Logged out, visit `/` | Redirect to `/login` |
| 8B.2 | Logged out, visit `/verify-email` | Redirect to `/login` |
| 8B.3 | Logged in and unverified, visit `/` | Redirect to `/verify-email` |
| 8B.4 | Logged in and unverified, visit `/login` | Redirect to `/verify-email` |
| 8B.5 | Logged in and verified, visit `/login`, `/signup`, `/verify-email` | Each redirects to `/` |
| 8B.6 | Visit `/nonsense` in any state | Redirect to `/` (then on to wherever that state sends you) |
| 8B.7 | Refresh on `/reset-password/abc` while logged out | Page loads (no redirect loop) |
| 8B.8 | Remove the guards in dev tools or call the API directly while unverified | Server still answers 403 on `/api/jobs` (guards are only a convenience) |

### Phase 8C: Pages

#### Steps

1. **Signup:** form with username, email, password. Show the server's error message. On success go to `/verify-email`. A strength indicator is optional; the 8-character rule is what counts.
2. **Login:** form with email and password. On success go to `/` or, if unverified, `/verify-email`.
3. **Verify email:** six boxes. Typing moves focus forward, backspace moves it back, pasting a whole code fills all six, and the form submits itself when the sixth box is filled. The resend button is disabled for 60 seconds after each use. Show the server's message on a wrong code.
4. **Forgot password:** email form. After submitting, always show "If an account exists for that email, you will receive a reset link shortly".
5. **Reset password:** new password and confirmation. If they differ, show an error without calling the server. On success show a confirmation and go to `/login`.
6. **App page (`/`):** prompt, job status and video, plus a logout button. Show a clear message on 403 or 429 from job calls. Playing the video and listing past jobs need the two tasks in \"Before Phase 9\"; until then, build the prompt and status parts.

#### Tests

| # | Test | Expected |
| --- | --- | --- |
| 8C.1 | Signup with a 7-character password | Server's error message displayed |
| 8C.2 | Signup with valid data | Lands on `/verify-email` |
| 8C.3 | Verify page: type six digits | Focus advances each time; the form submits after the sixth |
| 8C.4 | Verify page: backspace in an empty box | Focus moves to the previous box |
| 8C.5 | Verify page: paste `123456` into the first box | All six boxes fill and the form submits |
| 8C.6 | Verify page: wrong code | Error message shown; boxes can be retyped |
| 8C.7 | Verify page: correct code | Redirect to `/` |
| 8C.8 | Verify page: click resend | Button disabled with a countdown for 60 seconds; a new email arrives |
| 8C.9 | Verify page: click resend a second time within 60 seconds (re-enable via dev tools) | Server's 429 message shown |
| 8C.10 | Forgot password, registered email | Neutral message shown; email arrives |
| 8C.11 | Forgot password, unregistered email | Same neutral message; no email |
| 8C.12 | Reset password with mismatched fields | Error shown; no network request made |
| 8C.13 | Reset password with a valid token and new password | Confirmation, then redirect to `/login`; new password works |
| 8C.14 | Reset password with a used or expired token | Server's "Invalid or expired reset token" shown |
| 8C.15 | Login with wrong password | "Invalid credentials" shown |
| 8C.16 | Logout, then press the browser Back button | Does not show the protected page |
| 8C.17 | Production build: run `npm run build`, serve through `api_server` from `api_server/frontend/dist`, repeat 8C.2, 8C.13 and a refresh on `/verify-email` | All work with relative API paths |
| 8C.18 | Check on a narrow (phone-width) window | Forms are usable |

**Phase 8 done when:** all tests in 8A, 8B and 8C pass.

---

## Before Phase 9: two non-auth tasks

Journey 9.1 (create a job and see the video) cannot pass until these two exist. Neither is auth work, so track them as their own task and finish them before Phase 9.

### Steps

1. Serve the rendered videos. Nothing serves the `/renders/*.mp4` files yet. Decide whether they need the session gate or unguessable file names, so one user cannot fetch another user's video by guessing a path.
2. Add a "list my jobs" endpoint behind the session gate and the verified gate. It returns only the caller's jobs, in the same JSON shape as the rest of the API.

### Tests

| # | Test | Expected |
| --- | --- | --- |
| B.1 | Request a finished job's video URL as its owner | 200, a video content type, and it plays in a `<video>` element |
| B.2 | Request the same video as another user (or logged out, if you chose gating) | Refused, or not guessable, according to your decision in step 1 |
| B.3 | List jobs as a verified user | Only that user's jobs appear |
| B.4 | List jobs with no cookie, and as an unverified user | 401 and 403, with JSON bodies |

---

## Phase 9: End-to-end acceptance and release

**Goal:** prove the whole system works together, in a production-like setup, before real users arrive.

### Steps

1. Finish the two tasks in \"Before Phase 9\" first. Then run the full journey below on a production-like build (`NODE_ENV=production`, HTTPS, real SMTP account, both Redis instances running).
2. Run a brief review of the logs from that run.
3. Complete the release checklist.

### End-to-end journeys

| # | Journey | Expected |
| --- | --- | --- |
| 9.1 | New user: signup, email arrives, enter code, land on the app, create a job, see the video | Every step works; the job counts against the quota |
| 9.2 | New user who never verifies: signup, close the tab, return later and log in | Sent to `/verify-email`; can resend a code and finish; job routes refused until then |
| 9.3 | Forgot password: request, click the emailed link, set a new password, log in | Works; the link fails on a second use |
| 9.4 | Unverified user resets password | Ends up verified |
| 9.5 | Abuse: repeated bad logins, many signups from one IP, many resends | 429s appear at the documented limits, with `Retry-After` |
| 9.6 | Quota: one verified user creates jobs to the limit | Blocked at the hourly limit, and at the daily limit later; other users unaffected |
| 9.7 | Duplicate signup with different letter case | 409 |
| 9.8 | Tampered or missing cookie in the browser | Treated as logged out, no errors shown |
| 9.9 | Redis restart during use | Auth keeps working; job creation recovers when Redis returns |
| 9.10 | Old (pre-plan) account | Logs in, treated as verified, can create jobs |

### Log review

| # | Check | Expected |
| --- | --- | --- |
| 9.11 | Search logs for passwords, codes, reset tokens, JWTs, SMTP password, Redis URLs | None found |
| 9.12 | Search logs for stack traces or raw database errors in API responses | None; every 500 says "Internal server error" |

### Release checklist

- [ ] `.env` is not tracked by git; secrets were rotated if they were ever committed
- [ ] `JWT_SECRET` is long and random, and differs between development and production
- [ ] `NODE_ENV=production`, served over HTTPS
- [ ] `FRONTEND_URL` is the real production address
- [ ] SMTP account works from the production host, and its daily sending cap is acceptable
- [ ] Unique index on `users.email` exists in the production database
- [ ] Existing users' emails have been lowercased (Phase 1 migration) and old accounts remain verified
- [ ] Redis instances are not exposed to the public internet
- [ ] If a reverse proxy is added later, the client-IP logic is updated to read the forwarding header (only then; see §9)
- [ ] The built frontend is in `api_server/frontend/dist`, and the server is started from `api_server`
- [ ] The known limits in §13 are accepted: sessions cannot be revoked early, codes and tokens are stored unhashed, bcrypt runs on the async runtime
- [ ] The login lockout trade-off is accepted: five wrong passwords lock an email out of login for 15 minutes, so anyone can briefly lock out a known user

**Done when:** every journey and log check passes and the checklist is fully ticked.

---

## Appendix: Quick reference of what each phase changes

| Phase | Files touched (expected) |
| --- | --- |
| 0 | `.gitignore`, startup/config code, `.env`, `.env.example` |
| 1 | `src/schema/types.rs`, `src/controller/authcontroller.rs`, startup (index), one-off migration |
| 2 | `src/controller/authcontroller.rs` |
| 3 | `src/utils/` (mailer, templates), `src/controller/authcontroller.rs`, `Cargo.toml` (`lettre` async features) |
| 4 | `src/models/user.rs`, `src/controller/authcontroller.rs`, `src/routes/routes.rs`, `src/utils/` (code helper) |
| 5 | `src/controller/authcontroller.rs`, `src/middleware/authmiddleware.rs` (JSON errors), `src/middleware/` (verified gate), job controller (JSON errors), `src/routes/routes.rs` |
| 6 | `src/middleware/` (limiter), `src/routes/routes.rs`, server start-up (connection info), job controller |
| 7 | `src/utils/setcookie.rs`, CORS setup, `src/main.rs` (static serving, fallback, JSON 404 for `/api`) |
| 8 | `api_server/frontend/` (new) |
| Before 9 | Render file serving, job-listing endpoint and route (non-auth) |
| 9 | none (verification only) |

---

## Change log

What has actually been changed in the code, newest last.

### Phase 4 steps 4-7 (2026-10-05)

| File | Change |
| --- | --- |
| `src/controller/authcontroller.rs` | New `verify_email` and `resend_verification` handlers. `reset_password` also sets `is_verified: true`. |
| `src/routes/routes.rs` | `/verify-email` and `/resend-verification` registered behind the session gate. |
| `src/schema/types.rs`, `src/schema/mod.rs` | New `VerifyEmailForm { code }`. |

- The wrong-code and success updates repeat the "attempts under 5" condition in their filters, so parallel guesses cannot pass the limit.
- A deleted user with a still-valid cookie gets 401 from both routes.
- The submitted code is trimmed before comparing. The optional constant-time compare (step 8) was skipped.
- A successful reset leaves the old verification code, expiry and attempts on the row; they are unusable once the user is verified.
- Tests 4.3-4.9, 4.11-4.14 and 4.16 passed. Email delivery was not confirmed (test addresses were `@example.com`).

### Phase 5 steps 1, 2 and 5 (2026-10-05)

| File | Change |
| --- | --- |
| `src/controller/authcontroller.rs` | New `user_object` builder, used by signup, login, verify-email and check-auth. Check-auth answers 401 for a missing user (was 404) and for a malformed user id in the token (was 400). Unit test on the builder (test 5.13). |

- `user_object` returns exactly `{ email, username, is_verified }`, plus `last_login` and `created_at` for check-auth.
- Tests 5.1-5.4, 5.8, 5.10, 5.11 and 5.13 passed. A real verification email was received (Gmail app password in `.env`).

### Phase 5 steps 3, 4 and 6 (2026-10-05)

| File | Change |
| --- | --- |
| `src/middleware/verifiedmiddleware.rs` (new), `src/middleware/mod.rs` | Verified gate: loads the session user; 403 "Please verify your email first" if unverified, 401 "Unauthorized" if the user no longer exists. |
| `src/middleware/authmiddleware.rs` | Session gate answers 401 `{ success: false, message: "Unauthorized" }` instead of a bare status. |
| `src/routes/jobroutes.rs`, `src/main.rs` | `/api/jobs` routes run the session gate, then the verified gate. `job_routes` now takes the app state (the gate needs the database). |
| `src/controller/jobcontroller.rs` | Every error is `{ success: false, message }`. |

Job-handler error messages:

| Case | Status | Message |
| --- | --- | --- |
| Missing, malformed or wrongly typed body (including an unknown `library`) | as chosen by axum (400, 415 or 422) | "Invalid request body" |
| Prompt shorter than 10 or longer than 2000 characters | 400 | "Prompt must be between 10 and 2000 characters" |
| Job id in the path is not a UUID | 400 | "Invalid job id" |
| Job does not exist or belongs to another user | 404 | "Render job not found" |
| Database, Redis or other failure | 500 | "Internal server error" |

- Legacy accounts with no `is_verified` field still pass the verified gate.
- `cargo check` is clean of errors; no warnings come from the files changed in Phases 4 and 5.

### Phase 6 steps 1-3, 7 and 8 (2026-10-05)

| File | Change |
| --- | --- |
| `src/middleware/ratelimit.rs` (new), `src/middleware/mod.rs` | Limiter helper: `hit` (INCR, EXPIRE on first use, TTL for `Retry-After`), `too_many_requests` (the 429), `check_limit` (lets the request through and logs if Redis is unreachable). All limits are constants in `limits`. |
| `src/main.rs` | Server started with connection info. Temporary development-only peer IP log. |

- No limit is applied to any route yet.
- Keys are `rl:<limit name>:<subject>` on the Remotion Redis instance.
- Each Redis check is capped at 2 seconds, so an unreachable Redis cannot stall a request.
- A counter found with no expiry is given a full window instead of refusing forever.
- `ratelimit.rs` carries `#![allow(dead_code)]` until step 4 uses it; remove it then, along with `debug_peer_ip`.

### Phase 6 step 4, auth endpoints, and step 6 (2026-10-05)

| File | Change |
| --- | --- |
| `src/controller/authcontroller.rs` | Limits applied to signup, login, resend-verification, forgot-password and reset-password. |
| `src/middleware/ratelimit.rs` | New `peek` and `clear` (login failure counter) and the handler helpers `count_limit`, `peek_limit`, `clear_limit`. File-wide `allow(dead_code)` removed. |

- Every limit is checked after the body has been parsed and validated, so a 400 never uses up a limit.
- Login: the per-email counter is read before the password check, incremented on a failed login (unknown email included) and deleted on a success.
- Resend-verification: the 60-second cooldown is checked before the daily count, so a request the cooldown refuses does not use up the daily count. An already verified user is answered before either limit.
- Forgot-password: the IP limit answers 429. The email limit answers the usual 200 before the user lookup, with no token generated and no email sent.
- The job quota is not applied yet. `debug_peer_ip` is still in place.

### Phase 6 step 4, job quota (2026-10-06)

| File | Change |
| --- | --- |
| `src/controller/jobcontroller.rs` | `POST /api/jobs` checks the hourly and daily quota per user id after prompt validation. |
| `src/middleware/ratelimit.rs` | `allow(dead_code)` removed from the job window constants. |

- Keys are `rl:job-hour:user:<user id>` and `rl:job-day:user:<user id>` on the Remotion Redis instance. `render_queue` is not touched.
- Over the quota answers the usual 429 with `Retry-After`.
- If the counters cannot be read the job is refused with 500, unlike the auth limits, which let the request through. Otherwise a Manim job could bypass the quota while only the Remotion Redis is down.
- A job that passes the quota and then fails to enqueue still counts.
- `GET /api/jobs/{job_id}` has no limit.
