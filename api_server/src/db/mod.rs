pub mod db;

// Re-export for cleaner imports
pub use db::{connect_db, ensure_user_email_index};