use mongodb::bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[validate(length(min = 3))]
    pub username: String,

    #[validate(email)]
    pub email: String,

    #[validate(length(min = 6))]
    pub password: String,

    #[serde(default = "default_true")]
    pub is_verified: bool,

    // Absent on accounts created before email verification existed.
    #[serde(default)]
    pub verification_code: Option<String>,

    #[serde(default)]
    pub verification_expires_at: Option<DateTime<Utc>>,

    #[serde(default)]
    pub verification_attempts: i32,

    #[serde(default = "Utc::now")]
    pub last_login: DateTime<Utc>,

    pub reset_password_token: Option<String>,
    pub reset_password_expires_at: Option<DateTime<Utc>>,

    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,

    #[serde(default = "Utc::now")]
    pub updated_at: DateTime<Utc>,
}