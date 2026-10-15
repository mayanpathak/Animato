use axum::{
    extract::{
        rejection::{JsonRejection, PathRejection},
        Path, State,
    },
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension,
    Json,
};

use mongodb::bson::oid::ObjectId;

use serde::Serialize;

use serde_json::json;

use uuid::Uuid;

use validator::Validate;

use crate::{
    middleware::ratelimit::{hit, limits, too_many_requests, Decision, Limit},
    schema::CreateRenderJobForm,
    models::{JobStatus, Library},
    services::{
        create_render_job_service,
        get_render_job_service,
        AppError,
    },
    AppState,
};

// ======================================================
// Response Types
// ======================================================

#[derive(Debug, Serialize)]
pub struct CreateJobResponse {
    pub success: bool,
    pub message: String,
    pub data: CreateJobData,
}

#[derive(Debug, Serialize)]
pub struct CreateJobData {
    pub job_id: String,
    pub library: Library,
    pub status: JobStatus,
}

#[derive(Debug, Serialize)]
pub struct GetJobResponse {
    pub success: bool,
    pub data: GetJobData,
}

#[derive(Debug, Serialize)]
pub struct GetJobData {
    pub job_id: String,
    pub library: Library,
    pub status: JobStatus,
    pub video_path: Option<String>,
    pub duration_seconds: Option<f32>,
    pub file_size_bytes: Option<u64>,
    pub render_time_ms: Option<u64>,

    // NOTE: raw worker error text (may include Docker stderr). Fine while
    // developing; sanitize before exposing to real end users.
    pub error_message: Option<String>,
}

// ======================================================
// AppError -> JSON error response
// ======================================================

fn error_response(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(json!({ "success": false, "message": message })),
    )
        .into_response()
}

// The text inside each error is for the server side only (it can hold raw
// database or Redis details), so every message here is a fixed one.
fn map_app_error(err: AppError) -> Response {
    match err {
        AppError::Validation(_) => error_response(StatusCode::BAD_REQUEST, "Invalid request"),

        AppError::NotFound(_) => error_response(StatusCode::NOT_FOUND, "Render job not found"),

        AppError::Database(_) | AppError::Redis(_) | AppError::Internal(_) => {
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
        }
    }
}

// ======================================================
// Per-user job quota
// ======================================================

// The quota is the cost control, so unlike the auth limits it does not let
// a request through when the counters cannot be read: the job is refused.
async fn check_job_quota(state: &AppState, user_id: &ObjectId) -> Result<(), Response> {
    let subject = user_id.to_hex();

    let quotas = [
        Limit {
            name: "job-hour:user",
            max: state.job_limit_per_hour,
            window_secs: limits::JOB_HOUR_WINDOW_SECS,
        },
        Limit {
            name: "job-day:user",
            max: state.job_limit_per_day,
            window_secs: limits::JOB_DAY_WINDOW_SECS,
        },
    ];

    for quota in &quotas {
        match hit(&state.redis_pools.remotion, quota, &subject).await {
            Ok(Decision::Allowed) => {}

            Ok(Decision::Limited { retry_after_secs }) => {
                return Err(too_many_requests(retry_after_secs));
            }

            Err(reason) => {
                eprintln!("❌ Job quota unavailable ({}), job refused: {}", quota.name, reason);

                return Err(error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error",
                ));
            }
        }
    }

    Ok(())
}

// ======================================================
// POST /api/jobs
// ======================================================

pub async fn create_render_job_handler(
    State(state): State<AppState>,

    Extension(user_id): Extension<ObjectId>,

    payload: Result<Json<CreateRenderJobForm>, JsonRejection>,
) -> Result<Json<CreateJobResponse>, Response> {

    // =========================================
    // Validate request body
    // =========================================

    // Missing, malformed or wrongly typed body (including an unknown
    // library). The status is the one axum chose; the rejection text is not
    // echoed back because it can quote the submitted values.
    let Json(payload) = payload
        .map_err(|rejection| error_response(rejection.status(), "Invalid request body"))?;

    payload.validate().map_err(|_| {
        error_response(
            StatusCode::BAD_REQUEST,
            "Prompt must be between 10 and 2000 characters",
        )
    })?;

    // =========================================
    // Per-user quota
    // =========================================

    // After validation, so a rejected prompt does not use up the quota.
    check_job_quota(&state, &user_id).await?;

    // =========================================
    // Call service layer
    // =========================================

    let response = create_render_job_service(
        &state,
        user_id,
        payload,
    )
    .await
    .map_err(map_app_error)?;

    // =========================================
    // Response
    // =========================================

    Ok(Json(CreateJobResponse {
        success: true,

        message: "Render job created successfully".to_string(),

        data: CreateJobData {
            job_id: response.job_id,
            library: response.library,
            status: response.status,
        },
    }))
}

// ======================================================
// GET /api/jobs/:job_id
// ======================================================

pub async fn get_job_handler(
    State(state): State<AppState>,

    Extension(user_id): Extension<ObjectId>,

    job_id: Result<Path<Uuid>, PathRejection>,
) -> Result<Json<GetJobResponse>, Response> {

    let Path(job_id) = job_id
        .map_err(|_| error_response(StatusCode::BAD_REQUEST, "Invalid job id"))?;

    // =========================================
    // Call service layer
    // =========================================

    let response = get_render_job_service(
        &state,
        user_id,
        job_id.to_string(),
    )
    .await
    .map_err(map_app_error)?;

    // =========================================
    // Extract video URL
    // =========================================

    let video_path = response
    .job
    .result
    .as_ref()
    .map(|result| result.video_path.clone());
    // =========================================
    // Response
    // =========================================

    Ok(Json(GetJobResponse {
        success: true,

        data: GetJobData {
            job_id: response.job.job_id,
            library: response.job.library,
            status: response.job.status,
            video_path,
            duration_seconds: response.job.result.as_ref().map(|r| r.duration_seconds),
            file_size_bytes: response.job.result.as_ref().map(|r| r.file_size_bytes),
            render_time_ms: response.job.result.as_ref().map(|r| r.render_time_ms),
            error_message: response.job.error_message.clone(),
        },
    }))
}

// ======================================================
// GET /api/jobs/:job_id/video
// ======================================================

// How long a signed video link works. The <video> element asks this route
// again (and gets a fresh link) whenever it needs to re-fetch.
const VIDEO_URL_TTL_SECS: u64 = 3600;

// Redirects the job's owner to a short-lived presigned S3 URL. The bucket
// itself stays private.
pub async fn get_job_video_handler(
    State(state): State<AppState>,

    Extension(user_id): Extension<ObjectId>,

    job_id: Result<Path<Uuid>, PathRejection>,
) -> Result<Response, Response> {

    let Path(job_id) = job_id
        .map_err(|_| error_response(StatusCode::BAD_REQUEST, "Invalid job id"))?;

    // Scoped to user_id: someone else's job is a 404, same as a missing one.
    let response = get_render_job_service(
        &state,
        user_id,
        job_id.to_string(),
    )
    .await
    .map_err(map_app_error)?;

    let not_available = || error_response(StatusCode::NOT_FOUND, "Video not available");

    if response.job.status != JobStatus::Completed {
        return Err(not_available());
    }

    // Jobs rendered before the S3 upload existed hold a local path
    // ("/renders/<id>.mp4") instead of an object key; there is no file to
    // sign for those.
    let key = response
        .job
        .result
        .as_ref()
        .map(|result| result.video_path.as_str())
        .filter(|path| path.starts_with("renders/"))
        .ok_or_else(not_available)?;

    let presign_config = aws_sdk_s3::presigning::PresigningConfig::expires_in(
        std::time::Duration::from_secs(VIDEO_URL_TTL_SECS),
    )
    .map_err(|err| {
        eprintln!("❌ Invalid presign config: {}", err);
        error_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
    })?;

    // The signed URL is a credential: it is never logged.
    let presigned = state
        .s3
        .get_object()
        .bucket(&state.s3_bucket)
        .key(key)
        .presigned(presign_config)
        .await
        .map_err(|err| {
            eprintln!(
                "❌ Failed to presign video URL: {}",
                aws_sdk_s3::error::DisplayErrorContext(&err)
            );
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
        })?;

    Ok((
        StatusCode::FOUND,
        [
            (header::LOCATION, presigned.uri().to_string()),
            (header::CACHE_CONTROL, "no-store".to_string()),
        ],
    )
        .into_response())
}