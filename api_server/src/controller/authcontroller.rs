use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Extension, Json,
};
use axum_extra::extract::cookie::CookieJar;
use mongodb::bson::{doc, oid::ObjectId, to_bson};
use mongodb::error::{ErrorKind, WriteFailure};
use mongodb::Collection;
use serde_json::json;
use std::net::SocketAddr;
use validator::{Validate, ValidationErrors};

use crate::middleware::ratelimit::{
    check_limit, clear_limit, count_limit, limits, peek_limit, Decision,
};
use crate::models::User;
use crate::utils::{
    cookie::{build_auth_cookie, clear_auth_cookie},
    hash::{hash_password, verify_password},
    jwt::generate_token,
    mailer::{send_reset_email, send_verification_email},
    verificationcode::generate_verification_code,
};
use crate::schema::{
    ForgotPasswordForm, LoginForm, ResetPasswordForm, SignupForm, VerifyEmailForm,
};
use crate::AppState;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

macro_rules! internal_err {
    () => {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "message": "Internal server error" })),
        )
            .into_response()
    };
}

fn bad_request(message: impl Into<String>) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "success": false, "message": message.into() })),
    )
        .into_response()
}

// Missing, malformed or wrongly typed JSON body. The rejection text is not
// echoed back because it can quote the submitted values.
fn parse_body<T>(body: Result<Json<T>, JsonRejection>) -> Result<T, Response> {
    match body {
        Ok(Json(form)) => Ok(form),
        Err(_) => Err(bad_request("Invalid request body")),
    }
}

// Only the messages declared on the form rules, never the submitted values.
fn validation_message(errors: &ValidationErrors) -> String {
    let mut messages: Vec<String> = errors
        .field_errors()
        .values()
        .flat_map(|field| field.iter())
        .map(|e| match &e.message {
            Some(m) => m.to_string(),
            None => "Invalid input".to_string(),
        })
        .collect();

    messages.sort();
    messages.dedup();
    messages.join(". ")
}

// The only place a user is turned into response JSON, so the password hash,
// verification code and reset token can never reach a client. `with_dates`
// adds `last_login` and `created_at` (check-auth only).
fn user_object(user: &User, with_dates: bool) -> serde_json::Value {
    let mut object = json!({
        "email": user.email,
        "username": user.username,
        "is_verified": user.is_verified,
    });

    if with_dates {
        object["last_login"] = json!(user.last_login);
        object["created_at"] = json!(user.created_at);
    }

    object
}

fn normalise_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn is_duplicate_key(err: &mongodb::error::Error) -> bool {
    matches!(
        err.kind.as_ref(),
        ErrorKind::Write(WriteFailure::WriteError(e)) if e.code == 11000
    )
}

// ─── SIGNUP ──────────────────────────────────────────────────────────────────

pub async fn signup(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    jar: CookieJar,
    body: Result<Json<SignupForm>, JsonRejection>,
) -> impl IntoResponse {
    let mut body = match parse_body(body) {
        Ok(b) => b,
        Err(res) => return res,
    };

    body.email = normalise_email(&body.email);

    if let Err(errors) = body.validate() {
        return bad_request(validation_message(&errors));
    }

    if let Err(res) = check_limit(&state, &limits::SIGNUP_IP, &addr.ip().to_string()).await {
        return res;
    }

    let collection: Collection<User> = state.db.collection("users");

    match collection.find_one(doc! { "email": &body.email }, None).await {
        Ok(Some(_)) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "success": false, "message": "User already exists" })),
            )
                .into_response();
        }
        Err(_) => return internal_err!(),
        _ => {}
    }

    let hashed = match hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return internal_err!(),
    };

    let now = chrono::Utc::now();
    let verification_code = generate_verification_code();

    let new_user = User {
        id: None,
        username: body.username,
        email: body.email.clone(),
        password: hashed,
        is_verified: false,
        verification_code: Some(verification_code.clone()),
        verification_expires_at: Some(now + chrono::Duration::minutes(15)),
        verification_attempts: 0,
        last_login: now,
        reset_password_token: None,
        reset_password_expires_at: None,
        created_at: now,
        updated_at: now,
    };

    let inserted_id = match collection.insert_one(&new_user, None).await {
        Ok(r) => match r.inserted_id.as_object_id() {
            Some(oid) => oid.to_hex(),
            None => return internal_err!(),
        },
        // Lost a race with another signup for the same email: the unique
        // index rejected the insert.
        Err(e) if is_duplicate_key(&e) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "success": false, "message": "User already exists" })),
            )
                .into_response();
        }
        Err(_) => return internal_err!(),
    };

    // Returns immediately; a failed send is only logged and the account
    // still exists (the user can ask for a new code).
    send_verification_email(&state, &new_user.email, &verification_code);

    let token = match generate_token(inserted_id, &state.jwt_secret) {
        Ok(t) => t,
        Err(_) => return internal_err!(),
    };

    (
        StatusCode::CREATED,
        jar.add(build_auth_cookie(token)),
        Json(json!({
            "success": true,
            "message": "User created successfully",
            "user": user_object(&new_user, false),
        })),
    )
        .into_response()
}

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────

const MAX_VERIFICATION_ATTEMPTS: i32 = 5;

fn invalid_verification_code() -> Response {
    bad_request("Invalid or expired verification code")
}

// The session gate has already checked the token; this covers a user that
// was deleted while their cookie was still valid.
async fn load_session_user(
    collection: &Collection<User>,
    user_id: ObjectId,
) -> Result<User, Response> {
    match collection.find_one(doc! { "_id": user_id }, None).await {
        Ok(Some(u)) => Ok(u),
        Ok(None) => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "success": false, "message": "Unauthorized" })),
        )
            .into_response()),
        Err(_) => Err(internal_err!()),
    }
}

pub async fn verify_email(
    State(state): State<AppState>,
    Extension(user_id): Extension<ObjectId>,
    body: Result<Json<VerifyEmailForm>, JsonRejection>,
) -> impl IntoResponse {
    let collection: Collection<User> = state.db.collection("users");

    // The code is only ever checked against the logged-in user, never
    // looked up by value across all users.
    let mut user = match load_session_user(&collection, user_id).await {
        Ok(u) => u,
        Err(res) => return res,
    };

    if user.is_verified {
        return (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "message": "Email already verified",
                "user": user_object(&user, false),
            })),
        )
            .into_response();
    }

    let body = match parse_body(body) {
        Ok(b) => b,
        Err(res) => return res,
    };

    let now = chrono::Utc::now();

    let stored_code = match (&user.verification_code, user.verification_expires_at) {
        (Some(code), Some(expires_at))
            if expires_at > now && user.verification_attempts < MAX_VERIFICATION_ATTEMPTS =>
        {
            code.clone()
        }
        _ => return invalid_verification_code(),
    };

    let now_bson = match to_bson(&now) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };

    if body.code.trim() != stored_code {
        // The filter repeats the limit so parallel wrong guesses cannot push
        // the counter past it.
        let _ = collection
            .update_one(
                doc! {
                    "_id": user_id,
                    "verification_code": &stored_code,
                    "verification_attempts": { "$lt": MAX_VERIFICATION_ATTEMPTS },
                },
                doc! {
                    "$inc": { "verification_attempts": 1 },
                    "$set": { "updated_at": &now_bson },
                },
                None,
            )
            .await;

        return invalid_verification_code();
    }

    // The filter re-checks the code and the limit, so a match that raced
    // with a resend or with the last allowed wrong guess is refused.
    let result = collection
        .update_one(
            doc! {
                "_id": user_id,
                "verification_code": &stored_code,
                "verification_attempts": { "$lt": MAX_VERIFICATION_ATTEMPTS },
            },
            doc! {
                "$set": {
                    "is_verified": true,
                    "updated_at": &now_bson,
                },
                "$unset": {
                    "verification_code": "",
                    "verification_expires_at": "",
                    "verification_attempts": "",
                }
            },
            None,
        )
        .await;

    match result {
        Ok(r) if r.matched_count == 1 => {}
        Ok(_) => return invalid_verification_code(),
        Err(_) => return internal_err!(),
    }

    // `user` was loaded before the update.
    user.is_verified = true;

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Email verified successfully",
            "user": user_object(&user, false),
        })),
    )
        .into_response()
}

// ─── RESEND VERIFICATION ──────────────────────────────────────────────────────

pub async fn resend_verification(
    State(state): State<AppState>,
    Extension(user_id): Extension<ObjectId>,
) -> impl IntoResponse {
    let collection: Collection<User> = state.db.collection("users");

    let user = match load_session_user(&collection, user_id).await {
        Ok(u) => u,
        Err(res) => return res,
    };

    if user.is_verified {
        return (
            StatusCode::OK,
            Json(json!({ "success": true, "message": "Email already verified" })),
        )
            .into_response();
    }

    // Cooldown first: a request it refuses does not use up the daily count.
    let subject = user_id.to_hex();

    if let Err(res) = check_limit(&state, &limits::RESEND_COOLDOWN_USER, &subject).await {
        return res;
    }

    if let Err(res) = check_limit(&state, &limits::RESEND_DAILY_USER, &subject).await {
        return res;
    }

    let now = chrono::Utc::now();
    let verification_code = generate_verification_code();

    let expires_bson = match to_bson(&(now + chrono::Duration::minutes(15))) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };
    let now_bson = match to_bson(&now) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };

    // Overwrites the old code, so it stops working. The filter keeps a
    // resend that raced with a successful verify from re-adding a code.
    let result = collection
        .update_one(
            doc! { "_id": user_id, "is_verified": false },
            doc! { "$set": {
                "verification_code": &verification_code,
                "verification_expires_at": expires_bson,
                "verification_attempts": 0,
                "updated_at": now_bson,
            }},
            None,
        )
        .await;

    match result {
        Ok(r) if r.matched_count == 1 => {
            // Returns immediately; a failed send is only logged.
            send_verification_email(&state, &user.email, &verification_code);
        }
        Ok(_) => {}
        Err(_) => return internal_err!(),
    }

    (
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Verification code sent" })),
    )
        .into_response()
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    jar: CookieJar,
    body: Result<Json<LoginForm>, JsonRejection>,
) -> impl IntoResponse {
    let mut body = match parse_body(body) {
        Ok(b) => b,
        Err(res) => return res,
    };

    body.email = normalise_email(&body.email);

    if let Err(errors) = body.validate() {
        return bad_request(validation_message(&errors));
    }

    if let Err(res) = check_limit(&state, &limits::LOGIN_IP, &addr.ip().to_string()).await {
        return res;
    }

    // Failed attempts for this email. Checked without counting: only a
    // failure below adds to it, and a success clears it. Unknown emails are
    // counted too, so the limit does not reveal which emails are registered.
    if let Err(res) = peek_limit(&state, &limits::LOGIN_FAILED_EMAIL, &body.email).await {
        return res;
    }

    let collection: Collection<User> = state.db.collection("users");

    let user = match collection.find_one(doc! { "email": &body.email }, None).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            count_limit(&state, &limits::LOGIN_FAILED_EMAIL, &body.email).await;

            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "success": false, "message": "Invalid credentials" })),
            )
                .into_response();
        }
        Err(_) => return internal_err!(),
    };

    match verify_password(&body.password, &user.password) {
        Ok(true) => {}
        _ => {
            count_limit(&state, &limits::LOGIN_FAILED_EMAIL, &body.email).await;

            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "success": false, "message": "Invalid credentials" })),
            )
                .into_response();
        }
    }

    clear_limit(&state, &limits::LOGIN_FAILED_EMAIL, &body.email).await;

    let user_id = match user.id {
        Some(oid) => oid,
        None => return internal_err!(),
    };

    let now = chrono::Utc::now();
    let now_bson = match to_bson(&now) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };

    let _ = collection
        .update_one(
            doc! { "_id": user_id },
            doc! { "$set": { "last_login": &now_bson, "updated_at": &now_bson } },
            None,
        )
        .await;

    let token = match generate_token(user_id.to_hex(), &state.jwt_secret) {
        Ok(t) => t,
        Err(_) => return internal_err!(),
    };

    (
        StatusCode::OK,
        jar.add(build_auth_cookie(token)),
        Json(json!({
            "success": true,
            "message": "Logged in successfully",
            "user": user_object(&user, false),
        })),
    )
        .into_response()
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

pub async fn logout(jar: CookieJar) -> impl IntoResponse {
    (
        StatusCode::OK,
        jar.add(clear_auth_cookie()),
        Json(json!({ "success": true, "message": "Logged out successfully" })),
    )
        .into_response()
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────

// The one answer forgot-password gives once the input is valid, whatever
// happened behind it.
fn reset_link_sent() -> Response {
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "If an account exists for that email, a reset link has been sent",
        })),
    )
        .into_response()
}

pub async fn forgot_password(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    body: Result<Json<ForgotPasswordForm>, JsonRejection>,
) -> impl IntoResponse {
    let mut body = match parse_body(body) {
        Ok(b) => b,
        Err(res) => return res,
    };

    body.email = normalise_email(&body.email);

    if let Err(errors) = body.validate() {
        return bad_request(validation_message(&errors));
    }

    let email = body.email;

    if let Err(res) = check_limit(&state, &limits::FORGOT_IP, &addr.ip().to_string()).await {
        return res;
    }

    // Over the per-email limit: the usual answer, but no new token and no
    // email. A new token would overwrite the one in the link already sent.
    if let Decision::Limited { .. } = count_limit(&state, &limits::FORGOT_EMAIL, &email).await {
        return reset_link_sent();
    }

    let collection: Collection<User> = state.db.collection("users");

    let user_id = match collection.find_one(doc! { "email": &email }, None).await {
        Ok(user) => user.and_then(|u| u.id),
        Err(_) => return internal_err!(),
    };

    // Known and unknown emails take the same path from here (token, one
    // update, same answer) so neither the body nor the timing reveals which
    // emails are registered. For an unknown email the update targets a fresh
    // id and matches nothing.
    let known = user_id.is_some();
    let user_id = user_id.unwrap_or_else(ObjectId::new);

    let reset_token: String = (0..20).map(|_| format!("{:02x}", rand::random::<u8>())).collect();

    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
    let expires_bson = match to_bson(&expires_at) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };
    let updated_bson = match to_bson(&chrono::Utc::now()) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };

    let _ = collection
        .update_one(
            doc! { "_id": user_id },
            doc! { "$set": {
                "reset_password_token": &reset_token,
                "reset_password_expires_at": expires_bson,
                "updated_at": updated_bson,
            }},
            None,
        )
        .await;

    // Returns immediately; the send runs in the background and a failure is
    // only logged, so it cannot change this response.
    if known {
        send_reset_email(&state, &email, &reset_token);
    }

    reset_link_sent()
}

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────

pub async fn reset_password(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(token): Path<String>,
    body: Result<Json<ResetPasswordForm>, JsonRejection>,
) -> impl IntoResponse {
    let body = match parse_body(body) {
        Ok(b) => b,
        Err(res) => return res,
    };

    if let Err(errors) = body.validate() {
        return bad_request(validation_message(&errors));
    }

    let password = body.password;

    if let Err(res) = check_limit(&state, &limits::RESET_IP, &addr.ip().to_string()).await {
        return res;
    }

    let collection: Collection<User> = state.db.collection("users");

    let now = chrono::Utc::now();
    let now_bson = match to_bson(&now) {
        Ok(b) => b,
        Err(_) => return internal_err!(),
    };

    let user = match collection
        .find_one(
            doc! {
                "reset_password_token": &token,
                "reset_password_expires_at": { "$gt": &now_bson }
            },
            None,
        )
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "success": false, "message": "Invalid or expired reset token" })),
            )
                .into_response();
        }
        Err(_) => return internal_err!(),
    };

    let user_id = match user.id {
        Some(oid) => oid,
        None => return internal_err!(),
    };

    let hashed = match hash_password(&password) {
        Ok(h) => h,
        Err(_) => return internal_err!(),
    };

    let _ = collection
        .update_one(
            doc! { "_id": user_id },
            doc! {
                // Using the emailed link proves the address, so a reset
                // also verifies the account.
                "$set": {
                    "password": hashed,
                    "is_verified": true,
                    "updated_at": &now_bson,
                },
                "$unset": {
                    "reset_password_token": "",
                    "reset_password_expires_at": "",
                }
            },
            None,
        )
        .await;

    (
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Password reset successful" })),
    )
        .into_response()
}

// ─── CHECK AUTH ───────────────────────────────────────────────────────────────

pub async fn check_auth(
    State(state): State<AppState>,
    jar: CookieJar,
) -> impl IntoResponse {
    let token = match jar.get("token") {
        Some(c) => c.value().to_string(),
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "success": false, "message": "Not authenticated" })),
            )
                .into_response();
        }
    };

    let claims = match crate::utils::jwt::verify_token(&token, &state.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "success": false, "message": "Invalid or expired token" })),
            )
                .into_response();
        }
    };

    // A correctly signed token with a malformed user id, or one whose user
    // no longer exists, is simply not a session: 401 like any other bad token.
    let oid = match ObjectId::parse_str(&claims.user_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "success": false, "message": "Invalid or expired token" })),
            )
                .into_response();
        }
    };

    let collection: Collection<User> = state.db.collection("users");

    match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(u)) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "user": user_object(&u, true),
            })),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "success": false, "message": "Not authenticated" })),
        )
            .into_response(),
        Err(_) => internal_err!(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_with_secrets() -> User {
        let now = chrono::Utc::now();

        User {
            id: Some(ObjectId::new()),
            username: "tester".to_string(),
            email: "tester@example.com".to_string(),
            password: "HASH-SECRET".to_string(),
            is_verified: false,
            verification_code: Some("CODE-SECRET".to_string()),
            verification_expires_at: Some(now),
            verification_attempts: 3,
            last_login: now,
            reset_password_token: Some("TOKEN-SECRET".to_string()),
            reset_password_expires_at: Some(now),
            created_at: now,
            updated_at: now,
        }
    }

    fn keys(object: &serde_json::Value) -> Vec<String> {
        let mut keys: Vec<String> = object.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    }

    #[test]
    fn user_object_has_exactly_the_public_fields() {
        let user = user_with_secrets();

        let plain = user_object(&user, false);
        assert_eq!(keys(&plain), ["email", "is_verified", "username"]);
        assert_eq!(plain["is_verified"], false);

        let with_dates = user_object(&user, true);
        assert_eq!(
            keys(&with_dates),
            ["created_at", "email", "is_verified", "last_login", "username"]
        );

        for object in [plain, with_dates] {
            let text = object.to_string();
            assert!(!text.contains("SECRET"), "a secret field leaked");
        }
    }
}
