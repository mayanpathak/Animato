# Authentication Plan for `api_server`

This is the target design for authentication in this project: the Rust/Axum `api_server`, MongoDB, the two Redis instances, and the frontend that is about to be built. The work is collected in order in [section 12](#12-implementation-order).

Nothing here touches `manim_worker` or `remotion_worker`.

**Status marks.** Every part is marked against the code as it stands:

| Mark | Meaning |
| --- | --- |
| `[DONE]` | Implemented and matches this plan |
| `[PARTIAL]` | Some of it is in the code; the note says what is missing |
| `[TODO]` | Not in the code yet |

## Where things stand

| Area | Status | Summary |
| --- | --- | --- |
| Session (JWT cookie) | `[PARTIAL]` | Works end to end; only the production `Secure` flag is missing |
| Signup | `[PARTIAL]` | Creates the account and logs in; no validation, no verification code, user is created already verified |
| Login | `[PARTIAL]` | Works; no validation, no `is_verified` in the response |
| Logout | `[DONE]` | |
| Check-auth | `[PARTIAL]` | Works; no `is_verified`, two wrong status codes |
| Forgot password | `[PARTIAL]` | Creates and stores the token; sends no email, leaks the token in the response, reveals unknown emails |
| Reset password | `[PARTIAL]` | Works; no password rule, does not mark the email verified |
| Email verification | `[TODO]` | No endpoints, no fields, no code generation |
| Verified gate on `/api/jobs` | `[TODO]` | Job routes check the session only |
| Rate limiting | `[TODO]` | Nothing anywhere |
| Sending email | `[TODO]` | `lettre` is a dependency and the SMTP settings are loaded, but nothing sends |
| Frontend | `[TODO]` | No frontend exists; the server side of serving it in production is done |

## Contents

1. [The moving parts](#1-the-moving-parts)
2. [The user record](#2-the-user-record)
3. [The session](#3-the-session)
4. [Endpoints at a glance](#4-endpoints-at-a-glance)
5. [Signup](#5-signup)
6. [Email verification](#6-email-verification)
7. [Login, check-auth and logout](#7-login-check-auth-and-logout)
8. [Forgot password and reset password](#8-forgot-password-and-reset-password)
9. [Rate limiting](#9-rate-limiting)
10. [Sending email](#10-sending-email)
11. [Frontend](#11-frontend)
12. [Implementation order](#12-implementation-order)
13. [Deliberately deferred](#13-deliberately-deferred)

---

## 1. The moving parts

| Part | Role | Where | Status |
| --- | --- | --- | --- |
| Auth routes | Endpoints under `/api/auth` | `src/routes/routes.rs` | `[PARTIAL]` six routes exist; `/verify-email` is commented out, `/resend-verification` is absent |
| Auth handlers | Signup, login, logout, verify, forgot, reset, check-auth | `src/controller/authcontroller.rs` | `[PARTIAL]` six handlers exist; see sections 5 to 8 |
| Session gate | Turns the `token` cookie into a user id | `src/middleware/authmiddleware.rs` | `[DONE]` applied to `/api/jobs` |
| Verified gate | Refuses users whose email is not verified | `src/middleware/` (new) | `[TODO]` |
| Rate limiter | Counts requests per IP, email or user in Redis | `src/middleware/` (new) | `[TODO]` |
| Request forms | Input shapes and validation rules | `src/schema/types.rs` | `[PARTIAL]` `SignupForm` and `LoginForm` declare rules, but no handler runs them |
| Password hashing | bcrypt hash and compare | `src/utils/hashpassword.rs` | `[DONE]` |
| Session issuer | Signs the JWT and builds the cookie | `src/utils/generatejwt.rs`, `src/utils/setcookie.rs` | `[DONE]` except the `Secure` flag |
| Mailer | Sends the verification and reset emails | `src/utils/` (new), using `lettre` | `[TODO]` `lettre` is in `Cargo.toml` but unused |
| User model | One MongoDB collection, `users` | `src/models/user.rs` | `[PARTIAL]` three verification fields to add |

**Configuration** (`api_server/.env`):

| Variable | Purpose | Status |
| --- | --- | --- |
| `PORT`, `MONGODB_URI`, `DB_NAME`, `JWT_SECRET` | Server, database, token signing | `[DONE]` |
| `REDIS_URL_MANIM`, `REDIS_URL_REMOTION` | Job queues; one of them also holds the rate-limit counters | `[DONE]` for the queues |
| `NODE_ENV` | `production` switches on secure cookies and static file serving | `[PARTIAL]` used for static files only |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `SENDER_NAME` | SMTP account | `[PARTIAL]` loaded into `AppState`, never used |
| `FRONTEND_URL` | Base URL for reset links and the allowed CORS origin | `[TODO]` (development: `http://localhost:5173`) |
| `JOB_LIMIT_PER_HOUR`, `JOB_LIMIT_PER_DAY` | Per-user render quota | `[TODO]` (defaults 5 and 15) |

`[TODO]` Add `.env` to `api_server/.gitignore` before anything else; today it lists only `/target`.

---

## 2. The user record

One document per account in `users`. Field names are the Rust (snake_case) names; the API uses the same names.

| Field | Meaning | Status |
| --- | --- | --- |
| `username` | Display name, 3 to 30 characters | `[DONE]` field exists; the length rule is not enforced |
| `email` | Login identifier, stored trimmed and lowercased | `[PARTIAL]` field exists; stored exactly as typed, no unique index |
| `password` | bcrypt hash, never the password itself | `[DONE]` |
| `is_verified` | Whether the email has been confirmed | `[PARTIAL]` field exists; signup sets it to `true`, must become `false` |
| `verification_code` | The 6-digit code emailed at signup | `[TODO]` |
| `verification_expires_at` | Code expiry, 15 minutes after it was sent | `[TODO]` |
| `verification_attempts` | Wrong guesses against the current code | `[TODO]` |
| `reset_password_token` | Random token from the reset link | `[DONE]` |
| `reset_password_expires_at` | Reset token expiry, 1 hour after request | `[DONE]` |
| `last_login`, `created_at`, `updated_at` | Timestamps | `[DONE]` |

**Unique index.** `[TODO]` Create a unique index on `email` at startup. Signup currently checks for an existing user and then inserts, so two simultaneous signups can create duplicates; with the index, the second insert fails and is reported as 409.

**Existing accounts.** `[DONE]` The model defaults `is_verified` to `true` when the field is missing, and every account created so far was saved with `true`, so current users stay verified.

---

## 3. The session

There is no session table. A session is a signed JWT in a cookie.

- `[DONE]` **Issued** on signup and on login. The payload is the user id and an expiry 7 days ahead, signed with `JWT_SECRET`.
- `[DONE]` **Carried** in a cookie named `token`: HttpOnly, `SameSite=Strict`, path `/`, 7-day lifetime.
- `[TODO]` **`Secure`** is hard-coded to `false`. It must be `true` when `NODE_ENV=production`.
- `[DONE]` **Ended** by logout, which clears the cookie. The server keeps no list of tokens, so a token cannot be revoked early (see [section 13](#13-deliberately-deferred)).

**CORS.** `[PARTIAL]` Credentials are enabled and one origin is allowed, but that origin is hard-coded to `http://localhost:5173`. Read it from `FRONTEND_URL` instead.

---

## 4. Endpoints at a glance

All are under `/api/auth`. Every response is JSON with a `success` flag and a `message`.

| Method and path | Session | Input | On success | Status |
| --- | --- | --- | --- | --- |
| `POST /signup` | No | `username`, `email`, `password` | 201, user object, cookie set, code emailed | `[PARTIAL]` no validation, no code, no email |
| `POST /verify-email` | Yes | `code` | 200, user object | `[TODO]` |
| `POST /resend-verification` | Yes | none | 200, new code emailed | `[TODO]` |
| `POST /login` | No | `email`, `password` | 200, user object, cookie set | `[PARTIAL]` no validation |
| `POST /logout` | No | none | 200, cookie cleared | `[DONE]` |
| `POST /forgot-password` | No | `email` | 200, always the same message | `[PARTIAL]` no email sent, token leaked, 404 for unknown email |
| `POST /reset-password/{token}` | No | `password` | 200, password changed | `[PARTIAL]` no password rule |
| `GET /check-auth` | Yes | none | 200, user object | `[PARTIAL]` no `is_verified` |

**The user object.** `[PARTIAL]` It is always exactly `{ email, username, is_verified }`, plus `last_login` and `created_at` on check-auth. It never contains the password hash, the verification code or the reset token. Today the responses return `email` and `username` only; `is_verified` is missing everywhere.

**Status codes.**

| Code | Used for | Status |
| --- | --- | --- |
| 400 | Input failed validation; invalid or expired code or reset token | `[PARTIAL]` used for a missing field and a bad reset token; no validation errors yet |
| 401 | Wrong credentials; missing, invalid or expired session | `[DONE]` |
| 403 | Logged in but email not verified | `[TODO]` |
| 409 | Email already registered | `[DONE]` |
| 429 | Rate limit hit; includes a `Retry-After` header | `[TODO]` |
| 500 | Anything unexpected; the message is always "Internal server error" | `[DONE]` |

**Validation.** `[TODO]` `SignupForm` and `LoginForm` declare their rules, but no handler calls `.validate()`, so empty passwords and malformed emails are accepted today. Every handler must validate before doing anything else. Rules: email must be a valid address; username 3 to 30 characters; password 8 to 72 characters (bcrypt ignores anything past 72 bytes). The forms currently say 6 characters minimum with no maximum. The same password rule applies to reset-password, which has no check at all today.

**Verified gate.** `[TODO]` `/api/jobs` routes sit behind the session gate and a second gate that loads the user and answers 403 if `is_verified` is false. This is what makes verification mean something: without it an unverified account can still spend Gemini calls and render time. Today the job routes have the session gate only.

---

## 5. Signup

1. `[TODO]` Validate the form. On failure answer 400 with the reason.
2. `[TODO]` Trim and lowercase the email.
3. `[DONE]` Hash the password with bcrypt.
4. `[TODO]` Generate a 6-digit verification code from a cryptographically secure random source.
5. `[PARTIAL]` Insert the user with `is_verified: false`, the code, an expiry 15 minutes ahead, and `verification_attempts: 0`. If the unique index rejects the insert, answer 409 "User already exists". Today the user is inserted with `is_verified: true` and no code, and the 409 comes from a lookup before the insert.
6. `[DONE]` Issue the session and set the cookie. The user is logged in from this point but cannot create jobs until verified.
7. `[TODO]` Send the verification email. If sending fails, log it and carry on; the account is still created and the user can ask for a new code.
8. `[PARTIAL]` Answer 201 with the user object. Today it lacks `is_verified`.

A person who signed up but never verified can log in later and request a new code, so an unverified account never blocks its email address.

---

## 6. Email verification

`[TODO]` Nothing in this section exists yet.

### `POST /verify-email`

The code is checked against the logged-in user only. It is never looked up by value across all users.

1. `[TODO]` The session gate supplies the user id. Load that user.
2. `[TODO]` If already verified, answer 200 with the user object.
3. `[TODO]` If there is no code, it has expired, or `verification_attempts` has reached 5, answer 400 "Invalid or expired verification code". The user must request a new one.
4. `[TODO]` Compare the submitted code with the stored one. If it does not match, increment `verification_attempts` and answer 400 with the same message.
5. `[TODO]` On a match, set `is_verified: true`, remove the code, its expiry and the attempt counter, and answer 200 with the user object.

With 5 attempts per code, a guesser has a 5 in 1,000,000 chance per code, and codes can only be requested a few times a day.

### `POST /resend-verification`

1. `[TODO]` The session gate supplies the user id.
2. `[TODO]` If already verified, answer 200 without sending anything.
3. `[TODO]` Generate a new code, reset the expiry to 15 minutes ahead and the attempt counter to 0. The old code stops working.
4. `[TODO]` Send the email and answer 200.

Limited to one request per 60 seconds and five per day per user ([section 9](#9-rate-limiting)).

---

## 7. Login, check-auth and logout

### Login

1. `[TODO]` Validate the form; trim and lowercase the email.
2. `[DONE]` Look up the user. If none, answer 401 "Invalid credentials".
3. `[DONE]` Compare the password against the hash. If it does not match, answer the same 401, so the response does not reveal whether the email exists.
4. `[DONE]` Update `last_login`, issue a session, set the cookie.
5. `[PARTIAL]` Answer 200 with the user object. Today it lacks `is_verified`.

`[DONE]` Login does not refuse unverified users. They get a session, the frontend sends them to the verification page, and the server refuses job creation until they verify.

### Check-auth

`[PARTIAL]` Used by the frontend on startup to recover the session after a refresh, since it cannot read the cookie itself.

- `[DONE]` A missing, invalid or expired token answers 401.
- `[TODO]` A valid token whose user no longer exists answers 401. Today it answers 404, and a token carrying a malformed user id answers 400.
- `[PARTIAL]` Otherwise 200 with the user object. Today it returns `email`, `username`, `last_login` and `created_at`, without `is_verified`.

### Logout

`[DONE]` Clears the cookie and answers 200. Touches no database record.

---

## 8. Forgot password and reset password

Two requests joined by an emailed link.

### `POST /forgot-password`

1. `[PARTIAL]` Validate that `email` is a valid address; trim and lowercase it. Today it only checks that the field is present.
2. `[DONE]` Look up the user.
3. `[PARTIAL]` If the user exists: generate a token of 20 random bytes written as 40 hex characters, store it with an expiry 1 hour ahead (overwriting any earlier token), and email the link `FRONTEND_URL/reset-password/<token>`. The token is generated and stored today; no email is sent.
4. `[TODO]` Whether or not the user exists, answer 200 "If an account exists for that email, a reset link has been sent". Today an unknown email answers 404 "User not found".

`[TODO]` Remove `debug_token` from the response. It currently returns the reset token to whoever asked, which lets anyone who knows an email address take over the account.

### `POST /reset-password/{token}`

1. `[TODO]` Validate the new password against the password rule. Today any string is accepted, including an empty one.
2. `[DONE]` Find the user whose stored token equals the one in the path and whose expiry is in the future. If none, answer 400 "Invalid or expired reset token".
3. `[DONE]` Hash the new password, replace the stored hash, and remove the token and its expiry so the link works only once.
4. `[DONE]` Answer 200 "Password reset successful". The user is not logged in automatically.

`[TODO]` A reset link proves control of the mailbox, so a successful reset also sets `is_verified: true`.

---

## 9. Rate limiting

`[TODO]` Nothing in this section exists yet. Only the Redis connection it will use is in place.

Counters live in Redis, which the server already connects to. Use the Remotion instance's pool with keys prefixed `rl:` so they cannot collide with `render_queue`. Each counter is a key with an expiry equal to its window: increment it, set the expiry on first use, and refuse when the count passes the limit.

| Endpoint | Key | Limit | Status |
| --- | --- | --- | --- |
| `POST /signup` | IP | 5 per hour | `[TODO]` |
| `POST /login` | IP | 20 per 15 minutes | `[TODO]` |
| `POST /login` | email | 5 failed attempts per 15 minutes | `[TODO]` |
| `POST /verify-email` | user | 5 wrong guesses per code (stored on the user record, not in Redis) | `[TODO]` |
| `POST /resend-verification` | user | 1 per 60 seconds, 5 per day | `[TODO]` |
| `POST /forgot-password` | email | 3 per hour | `[TODO]` |
| `POST /forgot-password` | IP | 10 per hour | `[TODO]` |
| `POST /reset-password/{token}` | IP | 10 per hour | `[TODO]` |
| `POST /api/jobs` | user | `JOB_LIMIT_PER_HOUR` (5) and `JOB_LIMIT_PER_DAY` (15) | `[TODO]` |

A refused request answers 429 with a `Retry-After` header and the message "Too many requests, try again later". The forgot-password email limit is the exception: it answers the usual 200 without sending, so the limit cannot be used to test whether an email is registered.

**Client IP.** `[TODO]` The server must be started with connection info enabled so handlers can see the peer address; today it is started without it. If it is later deployed behind a reverse proxy, every request will appear to come from the proxy; at that point read the address from the proxy's forwarding header instead, and only then.

**If Redis is unreachable.** Auth endpoints let the request through and log the failure. Job creation fails anyway, since it cannot enqueue.

**The job quota is the cost control.** Each job can trigger several Gemini calls and a multi-core render. Email verification limits how cheaply accounts can be created; the per-user quota limits what each account can spend.

---

## 10. Sending email

`[TODO]` No email is sent anywhere yet. `lettre` is in `Cargo.toml` and the `EMAIL_*` values are loaded into `AppState`; that is all.

Email goes out over SMTP using `lettre` and the `EMAIL_*` values. There is no third-party mail API and no hosted templates.

| Email | Sent by | Contains | Status |
| --- | --- | --- | --- |
| Verify your email | Signup, resend-verification | The 6-digit code and its 15-minute lifetime | `[TODO]` |
| Reset your password | Forgot-password | A button linking to `FRONTEND_URL/reset-password/<token>` and its 1-hour lifetime | `[TODO]` |

Both are short HTML documents kept in the codebase with a single placeholder that the server fills in. There is no welcome email and no "password changed" email.

Sending must not block the response for long or fail the request. Signup and forgot-password answer the same way whether or not the send succeeded; failures are logged.

A Gmail account with an app password works as the SMTP account and costs nothing. Its sending cap is about 500 messages a day, which the resend and forgot-password limits keep well out of reach.

---

## 11. Frontend

`[TODO]` The frontend does not exist yet. Everything in this section is to build.

`[DONE]` The server side is ready: in production `api_server` serves `frontend/dist`, and any unknown path returns the app's entry page so browser-side routes survive a refresh. In development the frontend runs at `http://localhost:5173`.

**Calling the server.** Every call includes credentials so the cookie is sent. In development calls go to the server's full address; in production to a relative path. The frontend never sees the token; it only holds the user object in memory.

**Auth store.** One shared store is the only code that calls the auth endpoints.

| State | Meaning | Initial |
| --- | --- | --- |
| `user` | The user object last returned by the server | none |
| `isAuthenticated` | Whether someone is logged in | false |
| `isCheckingAuth` | Whether the startup session check is still running | true |
| `isLoading` | Whether a form action is in flight | false |
| `error` | Last error message to show on a form | none |

It exposes one action per endpoint. Each sets `isLoading`, calls the server, writes the result into state, and on failure puts the server's `message` into `error`. If there is no response at all (server unreachable), it must still clear `isLoading` and show a generic message. A 429 shows the server's message.

**Startup.** On mount the app calls check-auth and shows a spinner until it finishes, so a logged-in user never sees the login page flash on refresh.

**Routes and guards.**

| Route | Page | Who may see it |
| --- | --- | --- |
| `/` | The app (prompt, job status, video) | Logged in and verified |
| `/signup`, `/login` | Signup, login | Logged out only |
| `/verify-email` | Six-box code entry with a resend button | Logged in and not yet verified |
| `/forgot-password` | Email form | Logged out only |
| `/reset-password/:token` | New password and confirmation | Logged out only |
| anything else | Redirect to `/` | |

- Logged out and visiting a protected page: redirect to `/login`.
- Logged in but unverified, anywhere except `/verify-email`: redirect to `/verify-email`. This includes straight after login.
- Logged in and verified, visiting a logged-out-only page or `/verify-email`: redirect to `/`.

The guards are a convenience. The server gates in sections 3 and 4 are the real enforcement.

**Page behaviour.**

- **Signup:** on success go to `/verify-email`. A password strength indicator is optional; the server's 8-character rule is what counts, and its error message must be shown.
- **Verify email:** typing moves focus forward, backspace moves it back, pasting a whole code fills all six boxes, and the form submits itself when the sixth box is filled. The resend button is disabled for 60 seconds after each use.
- **Forgot password:** after submitting, always show "If an account exists for that email, you will receive a reset link shortly".
- **Reset password:** if the two fields differ, show an error without calling the server. On success show a confirmation and go to `/login`.

---

## 12. Implementation order

Server first; each step can be tested on its own before the frontend exists. No step is finished yet.

1. `[TODO]` Add `.env` to `.gitignore`. Stop printing the Redis URLs at startup, since they can contain a password.
2. `[TODO]` Call `.validate()` in signup, login and reset-password; update the password rule to 8 to 72 characters; normalise emails; create the unique index on `email`.
3. `[TODO]` Remove `debug_token` from forgot-password and make it always answer 200.
4. `[TODO]` Build the mailer and the two email templates. Add `FRONTEND_URL`.
5. `[TODO]` Wire forgot-password to send the reset email.
6. `[TODO]` Add the three verification fields to the user model. Change signup to create unverified users and send the code. Build `/verify-email` and `/resend-verification`.
7. `[TODO]` Add `is_verified` to every user object. Build the verified gate and put it on `/api/jobs`. Make check-auth answer 401 when the user is missing.
8. `[TODO]` Build the rate limiter and apply the limits in section 9.
9. `[TODO]` Make the cookie `Secure` in production and read the CORS origin from `FRONTEND_URL`.
10. `[TODO]` Build the frontend in section 11.

**Already in place before this plan:**

- `[DONE]` JWT signing and verification, 7-day expiry.
- `[DONE]` HttpOnly, `SameSite=Strict` session cookie, set on signup and login, cleared on logout.
- `[DONE]` bcrypt password hashing and comparison.
- `[DONE]` Session gate on `/api/jobs`.
- `[DONE]` Signup, login, logout and check-auth as working endpoints.
- `[DONE]` Reset token generation, storage, 1-hour expiry and single use.
- `[DONE]` Identical 401 for unknown email and wrong password on login.
- `[DONE]` User responses that never include the password hash or reset token (apart from `debug_token`).
- `[DONE]` Production serving of the built frontend with a fallback to its entry page.

---

## 13. Deliberately deferred

Known limits that are acceptable for now. None of these are implemented, by choice.

- **Sessions cannot be revoked.** Logging out only clears the cookie, and a password reset does not end sessions on other devices; an earlier token stays valid for up to 7 days. Fixing this means recording when the password last changed and rejecting tokens issued before it.
- **Tokens are stored as plain values.** The reset token and verification code are kept unhashed. Both are short-lived and single-use, so the exposure is limited to someone who can already read the database.
- **bcrypt runs on the async runtime.** Hashing takes a noticeable fraction of a second and blocks a worker thread while it runs. The login rate limit keeps this from being abused; moving it to the blocking pool is a later tidy-up.
