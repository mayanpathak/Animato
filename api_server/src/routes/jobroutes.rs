use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{
    controller::{
        create_render_job_handler,
        get_job_handler,
        get_job_video_handler,
    },
    middleware::{auth_middleware, verified_middleware},
    AppState,
};

pub fn job_routes(state: AppState) -> Router<AppState> {
    Router::new()

        // POST /api/jobs
        .route(
            "/",
            post(create_render_job_handler),
        )

        // GET /api/jobs/:job_id
        .route(
            "/{job_id}",
            get(get_job_handler),
        )

        // GET /api/jobs/:job_id/video
        .route(
            "/{job_id}/video",
            get(get_job_video_handler),
        )

        // The layer added last runs first: session gate, then verified gate.
        .route_layer(
            middleware::from_fn_with_state(state, verified_middleware),
        )
        .route_layer(
            middleware::from_fn(auth_middleware),
        )
}
