use anyhow::{Context, Result};
use std::path::Path;

use crate::AppState;

// ======================================================
// Upload Rendered Video To S3
// ======================================================
//
// Returns the object key (renders/<job_id>.mp4). The bucket is private: the
// key is what gets stored in Mongo, and the API server turns it into a
// short-lived signed URL for the job's owner.

pub async fn upload_video(
    state: &AppState,
    local_path: &Path,
    job_id: &str,
) -> Result<String> {
    // Defense in depth: the key is built from job_id.
    crate::validate::validate_job_id(job_id)
        .context("Refusing to upload video: invalid job_id")?;

    let key = format!("renders/{}.mp4", job_id);

    println!("\nUploading {:?} to s3://{}/{}", local_path, state.s3_bucket, key);

    let body = aws_sdk_s3::primitives::ByteStream::from_path(local_path)
        .await
        .context("Failed to open rendered video for upload")?;

    state
        .s3
        .put_object()
        .bucket(&state.s3_bucket)
        .key(&key)
        .content_type("video/mp4")
        .body(body)
        .send()
        .await
        .map_err(|err| {
            anyhow::anyhow!(
                "S3 upload failed: {}",
                aws_sdk_s3::error::DisplayErrorContext(&err)
            )
        })?;

    println!("Upload complete");

    Ok(key)
}
