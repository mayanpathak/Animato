use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_job_status() -> JobStatus {
    JobStatus::Pending
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum JobStatus {
    Pending,
    GeneratingCode,
    Rendering,
    Uploading,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenderResult {
    pub video_path: String,

    pub duration_seconds: f32,

    pub file_size_bytes: u64,

    pub render_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenderJob {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub job_id: String,

    pub user_id: ObjectId,

    pub prompt: String,

    #[serde(default = "default_job_status")]
    pub status: JobStatus,

    #[serde(default)]
    pub retry_count: u8,

    pub result: Option<RenderResult>,

    pub error_message: Option<String>,

    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,

    #[serde(default = "Utc::now")]
    pub updated_at: DateTime<Utc>,

    pub started_at: Option<DateTime<Utc>>,

    pub completed_at: Option<DateTime<Utc>>,
}