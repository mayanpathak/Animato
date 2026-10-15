use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::Library;

#[derive(Debug, Deserialize, Validate)]
pub struct LoginForm {
    #[validate(email(message = "Please enter a valid email address"))]
    pub email: String,

    // Non-empty only: accounts created before the 8-character rule may
    // have shorter passwords and must still be able to log in.
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SignupForm {
    #[validate(length(min = 3, max = 30, message = "Username must be between 3 and 30 characters"))]
    pub username: String,

    #[validate(email(message = "Please enter a valid email address"))]
    pub email: String,

    #[validate(length(min = 8, max = 72, message = "Password must be between 8 and 72 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordForm {
    #[validate(email(message = "Please enter a valid email address"))]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordForm {
    #[validate(length(min = 8, max = 72, message = "Password must be between 8 and 72 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailForm {
    pub code: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRenderJobForm {
    #[validate(length(min = 10, max = 2000))]
    pub prompt: String,

    /// "manim" or "remotion". Optional for backwards compatibility with
    /// clients that predate the field (defaults to remotion); any other
    /// value is rejected by serde with a 422.
    #[serde(default)]
    pub library: Library,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
}