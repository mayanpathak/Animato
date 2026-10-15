use axum_extra::extract::cookie::{Cookie, SameSite};
use time::Duration;

// Create auth cookie with JWT
pub fn build_auth_cookie(token: String) -> Cookie<'static> {
    Cookie::build(("token", token))
        .http_only(true)              // JS cannot access (prevents XSS)
        .secure(false)                // true in production (HTTPS only)
        .same_site(SameSite::Strict)  // CSRF protection
        .path("/")                    // accessible everywhere
        .max_age(Duration::days(7))   // matches JWT expiry
        .build()
}

// Clear cookie (logout)
pub fn clear_auth_cookie() -> Cookie<'static> {
    Cookie::build(("token", ""))
        .path("/")
        .max_age(Duration::seconds(0)) // expire immediately
        .build()
}