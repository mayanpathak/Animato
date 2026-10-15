use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};

use axum_extra::extract::cookie::CookieJar;

use mongodb::bson::oid::ObjectId;

use serde_json::json;

use crate::utils::verify_token;

// Every gate answers in the API's usual shape so the frontend always has a
// message to show.
pub fn gate_error(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(json!({ "success": false, "message": message })),
    )
        .into_response()
}

fn unauthorized() -> Response {
    gate_error(StatusCode::UNAUTHORIZED, "Unauthorized")
}

pub async fn auth_middleware(
    jar: CookieJar,
    mut req: Request,
    next: Next,
) -> Result<Response, Response> {

    // JWT secret
    let secret = std::env::var("JWT_SECRET").map_err(|_| {
        gate_error(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
    })?;

    // Read token
    let token = match jar.get("token") {
        Some(cookie) => cookie.value().to_string(),
        None => return Err(unauthorized()),
    };

    // Verify token
    let claims = match verify_token(&token, &secret) {
        Ok(claims) => claims,
        Err(_) => return Err(unauthorized()),
    };

    // Convert string -> ObjectId
    let object_id = ObjectId::parse_str(&claims.user_id)
        .map_err(|_| unauthorized())?;

    // Insert ObjectId into extensions
    req.extensions_mut().insert(object_id);

    Ok(next.run(req).await)
}
