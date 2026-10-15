use chrono::{Duration as ChronoDuration, Utc};

use mongodb::bson::{
    doc,
    to_bson,
};

use crate::{
    models::{
        RenderJob,
        RenderResult,
    },
    AppState,
};

// ======================================================
// Get Job
// ======================================================

pub async fn get_render_job_by_id(
    state: &AppState,
    job_id: &str,
) -> mongodb::error::Result<Option<RenderJob>> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    collection
        .find_one(
            doc! {
                "job_id": job_id
            },
            None,
        )
        .await
}

// ======================================================
// Mark GeneratingCode
// ======================================================

pub async fn mark_job_generating(
    state: &AppState,
    job_id: &str,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "status": "GeneratingCode",
                    "started_at": to_bson(&now).unwrap(),
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Mark Rendering
// ======================================================

pub async fn mark_job_rendering(
    state: &AppState,
    job_id: &str,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "status": "Rendering",
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Mark Uploading
// ======================================================

pub async fn mark_job_uploading(
    state: &AppState,
    job_id: &str,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "status": "Uploading",
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Record how many repair retries have been used
// ======================================================

pub async fn set_retry_count(
    state: &AppState,
    job_id: &str,
    retry_count: u8,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "retry_count": retry_count as i32,
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Mark Completed
// ======================================================

pub async fn mark_job_completed(
    state: &AppState,
    job_id: &str,
    result: RenderResult,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "status": "Completed",
                    "result": to_bson(&result).unwrap(),
                    "completed_at": to_bson(&now).unwrap(),
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Mark Failed
// ======================================================

const MAX_ERROR_MESSAGE_CHARS: usize = 4000;

// Second, independent backstop: callers build error strings from many
// sources, so bound the text again at the point it is written to Mongo.
fn bound_error_message(error_message: &str) -> String {
    if error_message.chars().count() > MAX_ERROR_MESSAGE_CHARS {
        let truncated: String = error_message.chars().take(MAX_ERROR_MESSAGE_CHARS).collect();
        format!("{truncated}... [truncated]")
    } else {
        error_message.to_string()
    }
}

pub async fn mark_job_failed(
    state: &AppState,
    job_id: &str,
    error_message: &str,
) -> mongodb::error::Result<()> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();

    let bounded_message = bound_error_message(error_message);

    collection
        .update_one(
            doc! {
                "job_id": job_id
            },
            doc! {
                "$set": {
                    "status": "Failed",
                    "error_message": bounded_message,
                    "completed_at": to_bson(&now).unwrap(),
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    Ok(())
}

// ======================================================
// Watchdog: sweep stuck jobs
// ======================================================
//
// If the worker crashes/OOMs/is redeployed mid-job, the job's status can be
// left at GeneratingCode/Rendering/Uploading forever, and its Redis queue
// entry (already popped via BRPOP) is gone. This does NOT re-queue the job
// (that needs BRPOPLPUSH + ack or Redis Streams); it only makes the stuck
// state visible and terminal so the product layer can offer a retry.
pub async fn sweep_stuck_jobs(
    state: &AppState,
    stuck_after_secs: i64,
) -> mongodb::error::Result<u64> {

    let collection =
        state.db.collection::<RenderJob>("render_jobs");

    let now = Utc::now();
    let cutoff = now - ChronoDuration::seconds(stuck_after_secs);

    let result = collection
        .update_many(
            doc! {
                "status": { "$in": ["GeneratingCode", "Rendering", "Uploading"] },
                "started_at": { "$lt": to_bson(&cutoff).unwrap() }
            },
            doc! {
                "$set": {
                    "status": "Failed",
                    "error_message": "Job exceeded maximum processing time (worker crash or stall suspected)",
                    "completed_at": to_bson(&now).unwrap(),
                    "updated_at": to_bson(&now).unwrap(),
                }
            },
            None,
        )
        .await?;

    if result.modified_count > 0 {
        println!(
            "[WATCHDOG] Marked {} stuck job(s) as Failed",
            result.modified_count
        );
    }

    Ok(result.modified_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_messages_pass_through() {
        assert_eq!(bound_error_message("boom"), "boom");
    }

    #[test]
    fn long_messages_are_truncated() {
        let out = bound_error_message(&"x".repeat(10_000));
        assert!(out.ends_with("... [truncated]"));
        assert_eq!(out.chars().count(), MAX_ERROR_MESSAGE_CHARS + "... [truncated]".len());
    }
}