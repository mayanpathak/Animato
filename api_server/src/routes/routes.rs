
use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::controller::authcontroller::{
    signup,
    verify_email,
    resend_verification,
    login,
    logout,
    forgot_password,
    reset_password,
    check_auth,
};
use crate::middleware::auth_middleware;
use crate::AppState;

pub fn auth_routes() -> Router<AppState> {
    // Session required: the gate supplies the user id.
    let session_routes = Router::new()
        .route("/verify-email", post(verify_email))
        .route("/resend-verification", post(resend_verification))
        .route_layer(middleware::from_fn(auth_middleware));

    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password/{token}", post(reset_password))
        .route("/check-auth", get(check_auth))
        .merge(session_routes)
}