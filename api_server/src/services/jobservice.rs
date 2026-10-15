use chrono::Utc;
use deadpool_redis::redis::AsyncCommands;
use mongodb::{
    bson::{doc, oid::ObjectId, DateTime as BsonDateTime},
    Collection,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    models::{JobStatus, Library, RenderJob, RenderResult},
    schema::CreateRenderJobForm,
    AppState,
};

// ======================================================
// Constants
// ======================================================

const RENDER_QUEUE: &str = "render_queue";

// ======================================================
// Helper: chrono -> bson datetime
// ======================================================

fn bson_now() -> BsonDateTime {
    BsonDateTime::from_millis(Utc::now().timestamp_millis())
}

// ======================================================
// App Error
// ======================================================

#[derive(Debug)]
pub enum AppError {
    Database(String),
    Redis(String),
    Validation(String),
    NotFound(String),
    Internal(String),
}

// ======================================================
// Response DTOs
// ======================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRenderJobResponse {
    pub success: bool,
    pub job_id: String,
    pub library: Library,
    pub status: JobStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetRenderJobResponse {
    pub success: bool,
    pub job: RenderJob,
}

// ======================================================
// Helper
// ======================================================

fn render_jobs_collection(state: &AppState) -> Collection<RenderJob> {
    state.db.collection("render_jobs")
}

// ======================================================
// Create Render Job
// ======================================================

pub async fn create_render_job_service(
    state: &AppState,
    user_id: ObjectId,
    payload: CreateRenderJobForm,
) -> Result<CreateRenderJobResponse, AppError> {
    let collection = render_jobs_collection(state);
    let now = Utc::now();
    let job_id = Uuid::new_v4().to_string();

    let library = payload.library;

    let job = RenderJob {
        id: None,
        job_id: job_id.clone(),
        user_id,
        prompt: payload.prompt,
        library,
        status: JobStatus::Pending,
        retry_count: 0,
        result: None,
        error_message: None,
        created_at: now,
        updated_at: now,
        started_at: None,
        completed_at: None,
    };

    collection
        .insert_one(&job, None)
        .await
        .map_err(|err| AppError::Database(format!("Failed to insert render job: {}", err)))?;

    // Route to the Redis instance of the chosen library. Getting the
    // connection is inside the same block as the push so that ANY enqueue
    // failure marks the job Failed (previously a connection failure left an
    // orphaned Pending job).
    let pool = state.redis_pools.for_library(library);

    let enqueue_result: Result<(), String> = async {
        let mut redis_conn = pool
            .get()
            .await
            .map_err(|err| format!("Failed to get {} Redis connection: {}", library.as_str(), err))?;

        let queue_result: Result<(), _> = redis_conn.lpush(RENDER_QUEUE, &job_id).await;

        queue_result
            .map_err(|err| format!("Failed to push job into {} queue: {}", library.as_str(), err))
    }
    .await;

    if let Err(msg) = enqueue_result {
        collection
            .update_one(
                doc! { "job_id": &job_id },
                doc! { "$set": {
                    "status": "Failed",
                    "error_message": format!("Failed to enqueue render job ({})", library.as_str()),
                    "updated_at": bson_now(),
                }},
                None,
            )
            .await
            .ok();

        return Err(AppError::Redis(msg));
    }

    println!("Queued job {} -> {} worker", job_id, library.as_str());

    Ok(CreateRenderJobResponse {
        success: true,
        job_id,
        library,
        status: JobStatus::Pending,
    })
}

// ======================================================
// Get Single Render Job
// ======================================================

pub async fn get_render_job_service(
    state: &AppState,
    user_id: ObjectId,
    job_id: String,
) -> Result<GetRenderJobResponse, AppError> {
    let collection = render_jobs_collection(state);

    let job = collection
        .find_one(
            doc! { "job_id": &job_id, "user_id": user_id },
            None,
        )
        .await
        .map_err(|err| AppError::Database(format!("Database error: {}", err)))?
        .ok_or_else(|| AppError::NotFound("Render job not found".to_string()))?;

    Ok(GetRenderJobResponse { success: true, job })
}

// ======================================================
// Mark Job Started
// ======================================================

pub async fn mark_render_job_started_service(
    state: &AppState,
    job_id: &str,
) -> Result<(), AppError> {
    let collection = render_jobs_collection(state);
    let now = bson_now();

    collection
        .update_one(
            doc! { "job_id": job_id },
            doc! { "$set": {
                "status": "GeneratingCode",
                "started_at": now,
                "updated_at": now,
            }},
            None,
        )
        .await
        .map_err(|err| AppError::Database(format!("Failed to mark render job started: {}", err)))?;

    Ok(())
}

// ======================================================
// Update Job Status
// ======================================================

pub async fn update_render_job_status_service(
    state: &AppState,
    job_id: &str,
    status: JobStatus,
) -> Result<(), AppError> {
    let collection = render_jobs_collection(state);
    let status_str = format!("{:?}", status);

    collection
        .update_one(
            doc! { "job_id": job_id },
            doc! { "$set": {
                "status": status_str,
                "updated_at": bson_now(),
            }},
            None,
        )
        .await
        .map_err(|err| AppError::Database(format!("Failed to update job status: {}", err)))?;

    Ok(())
}

// ======================================================
// Mark Job Failed
// ======================================================

pub async fn mark_render_job_failed_service(
    state: &AppState,
    job_id: &str,
    error_message: String,
) -> Result<(), AppError> {
    let collection = render_jobs_collection(state);
    let now = bson_now();

    collection
        .update_one(
            doc! { "job_id": job_id },
            doc! { "$set": {
                "status": "Failed",
                "error_message": error_message,
                "updated_at": now,
                "completed_at": now,
            }},
            None,
        )
        .await
        .map_err(|err| AppError::Database(format!("Failed to mark render job as failed: {}", err)))?;

    Ok(())
}

// ======================================================
// Mark Job Completed
// ======================================================

pub async fn mark_render_job_completed_service(
    state: &AppState,
    job_id: &str,
    result: RenderResult,
) -> Result<(), AppError> {
    let collection = render_jobs_collection(state);
    let now = bson_now();

    collection
        .update_one(
            doc! { "job_id": job_id },
            doc! { "$set": {
                "status": "Completed",
                "result": mongodb::bson::to_bson(&result).unwrap(),
                "updated_at": now,
                "completed_at": now,
            }},
            None,
        )
        .await
        .map_err(|err| AppError::Database(format!("Failed to mark render job completed: {}", err)))?;

    Ok(())
}  