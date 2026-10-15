use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
    Extension,
};

use mongodb::bson::{doc, oid::ObjectId};
use mongodb::Collection;

use crate::models::User;
use crate::AppState;

use super::authmiddleware::gate_error;

// Runs after the session gate, which supplies the user id. Accounts created
// before email verification existed have no `is_verified` field and load as
// verified.
pub async fn verified_middleware(
    State(state): State<AppState>,
    Extension(user_id): Extension<ObjectId>,
    req: Request,
    next: Next,
) -> Result<Response, Response> {
    let collection: Collection<User> = state.db.collection("users");

    let user = match collection.find_one(doc! { "_id": user_id }, None).await {
        Ok(Some(user)) => user,

        // Valid cookie, but the account has been deleted since.
        Ok(None) => return Err(gate_error(StatusCode::UNAUTHORIZED, "Unauthorized")),

        Err(_) => {
            return Err(gate_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error",
            ));
        }
    };

    if !user.is_verified {
        return Err(gate_error(
            StatusCode::FORBIDDEN,
            "Please verify your email first",
        ));
    }

    Ok(next.run(req).await)
}
