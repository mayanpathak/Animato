// pub mod routes;

// // Re-export for easy access in main.rs
// pub use routes::auth_routes;

pub mod routes;
pub mod jobroutes;

// Re-export for easy access in main.rs
pub use routes::auth_routes;
pub use jobroutes::job_routes;