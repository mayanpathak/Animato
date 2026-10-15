use std::{future::Future, net::SocketAddr, time::Duration};

use axum::{
    extract::{ConnectInfo, Request},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};

use deadpool_redis::{redis::cmd, Connection, Pool};

use serde_json::json;

use crate::AppState;

// ─── LIMITS ───────────────────────────────────────────────────────────────────

pub struct Limit {
    // Part of the Redis key, so each limit counts separately.
    pub name: &'static str,
    pub max: u32,
    pub window_secs: u64,
}

// Every limit lives here. Lower `max` or `window_secs` to test without
// waiting out a real window.
pub mod limits {
    use super::Limit;

    const MINUTE: u64 = 60;
    const HOUR: u64 = 60 * MINUTE;
    const DAY: u64 = 24 * HOUR;

    pub const SIGNUP_IP: Limit = Limit { name: "signup:ip", max: 5, window_secs: HOUR };

    pub const LOGIN_IP: Limit = Limit { name: "login:ip", max: 20, window_secs: 15 * MINUTE };

    // Failed attempts only.
    pub const LOGIN_FAILED_EMAIL: Limit =
        Limit { name: "login-failed:email", max: 5, window_secs: 15 * MINUTE };

    pub const RESEND_COOLDOWN_USER: Limit =
        Limit { name: "resend-cooldown:user", max: 1, window_secs: MINUTE };

    pub const RESEND_DAILY_USER: Limit =
        Limit { name: "resend-daily:user", max: 5, window_secs: DAY };

    pub const FORGOT_EMAIL: Limit = Limit { name: "forgot:email", max: 3, window_secs: HOUR };

    pub const FORGOT_IP: Limit = Limit { name: "forgot:ip", max: 10, window_secs: HOUR };

    pub const RESET_IP: Limit = Limit { name: "reset:ip", max: 10, window_secs: HOUR };

    // The job maximums come from JOB_LIMIT_PER_HOUR and JOB_LIMIT_PER_DAY.
    pub const JOB_HOUR_WINDOW_SECS: u64 = HOUR;
    pub const JOB_DAY_WINDOW_SECS: u64 = DAY;
}

// ─── REDIS ────────────────────────────────────────────────────────────────────

// Counters share the Remotion Redis instance with `render_queue`; the prefix
// keeps them apart.
const KEY_PREFIX: &str = "rl:";

// An unreachable Redis must not hold a request for the OS connect timeout.
const REDIS_TIMEOUT: Duration = Duration::from_secs(2);

pub enum Decision {
    Allowed,
    Limited { retry_after_secs: u64 },
}

fn key(limit: &Limit, subject: &str) -> String {
    format!("{}{}:{}", KEY_PREFIX, limit.name, subject)
}

async fn with_timeout<T>(work: impl Future<Output = Result<T, String>>) -> Result<T, String> {
    match tokio::time::timeout(REDIS_TIMEOUT, work).await {
        Ok(result) => result,
        Err(_) => Err("timed out".to_string()),
    }
}

async fn expire(conn: &mut Connection, key: &str, limit: &Limit) -> Result<(), String> {
    let _: i64 = cmd("EXPIRE")
        .arg(key)
        .arg(limit.window_secs)
        .query_async(conn)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// The refusal for a counter that is at or over its limit.
async fn limited(conn: &mut Connection, key: &str, limit: &Limit) -> Result<Decision, String> {
    let ttl: i64 = cmd("TTL")
        .arg(key)
        .query_async(conn)
        .await
        .map_err(|e| e.to_string())?;

    match ttl {
        // The window ended between the two commands.
        -2 => Ok(Decision::Allowed),

        // A counter with no expiry (its EXPIRE was lost) would refuse
        // forever, so give it a full window now.
        t if t < 0 => {
            expire(conn, key, limit).await?;
            Ok(Decision::Limited { retry_after_secs: limit.window_secs })
        }

        t => Ok(Decision::Limited { retry_after_secs: (t as u64).max(1) }),
    }
}

/// Counts one request for `subject` (an IP, email or user id) against
/// `limit`. `Err` means Redis could not be used.
pub async fn hit(pool: &Pool, limit: &Limit, subject: &str) -> Result<Decision, String> {
    with_timeout(async {
        let key = key(limit, subject);

        let mut conn = pool.get().await.map_err(|e| e.to_string())?;

        let count: i64 = cmd("INCR")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        // First use in this window: start the clock.
        if count == 1 {
            expire(&mut conn, &key, limit).await?;
        }

        if count <= i64::from(limit.max) {
            return Ok(Decision::Allowed);
        }

        limited(&mut conn, &key, limit).await
    })
    .await
}

/// Reads the counter without counting this request: refuses once `max` has
/// been reached.
pub async fn peek(pool: &Pool, limit: &Limit, subject: &str) -> Result<Decision, String> {
    with_timeout(async {
        let key = key(limit, subject);

        let mut conn = pool.get().await.map_err(|e| e.to_string())?;

        let count: Option<i64> = cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        if count.unwrap_or(0) < i64::from(limit.max) {
            return Ok(Decision::Allowed);
        }

        limited(&mut conn, &key, limit).await
    })
    .await
}

/// Removes the counter.
pub async fn clear(pool: &Pool, limit: &Limit, subject: &str) -> Result<(), String> {
    with_timeout(async {
        let mut conn = pool.get().await.map_err(|e| e.to_string())?;

        let _: i64 = cmd("DEL")
            .arg(key(limit, subject))
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
}

// ─── FOR AUTH HANDLERS ────────────────────────────────────────────────────────
//
// If Redis is unreachable these let the request through and log the failure.

// The limit name only: the subject can be an email address.
fn log_unavailable(limit: &Limit, reason: &str) {
    eprintln!("❌ Rate limiter unavailable ({}), request let through: {}", limit.name, reason);
}

pub fn too_many_requests(retry_after_secs: u64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, retry_after_secs.to_string())],
        Json(json!({ "success": false, "message": "Too many requests, try again later" })),
    )
        .into_response()
}

fn refuse(decision: Decision) -> Result<(), Response> {
    match decision {
        Decision::Allowed => Ok(()),
        Decision::Limited { retry_after_secs } => Err(too_many_requests(retry_after_secs)),
    }
}

/// Counts the request and says whether it is within the limit.
pub async fn count_limit(state: &AppState, limit: &Limit, subject: &str) -> Decision {
    match hit(&state.redis_pools.remotion, limit, subject).await {
        Ok(decision) => decision,
        Err(reason) => {
            log_unavailable(limit, &reason);
            Decision::Allowed
        }
    }
}

/// Counts the request; `Err` is the 429 to return.
pub async fn check_limit(state: &AppState, limit: &Limit, subject: &str) -> Result<(), Response> {
    refuse(count_limit(state, limit, subject).await)
}

/// Does not count the request; `Err` is the 429 to return.
pub async fn peek_limit(state: &AppState, limit: &Limit, subject: &str) -> Result<(), Response> {
    match peek(&state.redis_pools.remotion, limit, subject).await {
        Ok(decision) => refuse(decision),
        Err(reason) => {
            log_unavailable(limit, &reason);
            Ok(())
        }
    }
}

pub async fn clear_limit(state: &AppState, limit: &Limit, subject: &str) {
    if let Err(reason) = clear(&state.redis_pools.remotion, limit, subject).await {
        eprintln!("❌ Rate limiter unavailable ({}), counter not cleared: {}", limit.name, reason);
    }
}

// ─── TEMPORARY ────────────────────────────────────────────────────────────────

// TEMPORARY (test 6.20): logs the peer IP of every request. Development
// only; remove once the limits are applied.
pub async fn debug_peer_ip(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request,
    next: Next,
) -> Response {
    println!("[debug] peer IP: {}", addr.ip());

    next.run(req).await
}
