mod models;
mod mongo;
mod processor;
mod redis;
mod worker;
mod configgemini;
mod cleanup;
mod renderer;
mod generator;
mod filesystem;
mod docker_exec;
mod validate;
mod validator;
mod watchdog;
mod uploader;

#[cfg(test)]
mod e2e_test;

mod services {
    pub mod job_service;
}

use crate::configgemini::GeminiConfig;
use deadpool_redis::Pool;
use mongodb::Database;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub redis_pool: Pool,
    pub gemini_config: GeminiConfig,
    pub s3: aws_sdk_s3::Client,
    pub s3_bucket: String,
}

#[tokio::main]
async fn main() {

    // =====================================
    // Load environment variables
    // =====================================

    dotenvy::dotenv().ok();

    let gemini_config = GeminiConfig::from_env();

    println!("Gemini model: {}", gemini_config.model);

    println!("Starting worker runtime...");

    // =====================================
    // Connect MongoDB
    // =====================================

    let (_client, db) = mongo::connect_db().await;

    println!("MongoDB connected.");
    

    // =====================================
    // Connect Redis
    // =====================================

    let redis_pool = redis::create_redis_pool().await;

    println!("Redis connected.");

    // =====================================
    // S3 client (rendered video storage)
    // =====================================
    // Reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from the
    // environment. Built once and shared by every job.

    let aws_config =
        aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

    let s3 = aws_sdk_s3::Client::new(&aws_config);

    let s3_bucket = std::env::var("S3_BUCKET_NAME")
        .expect("S3_BUCKET_NAME must be set");

    println!("S3 bucket: {}", s3_bucket);

    // =====================================
    // Shared app state
    // =====================================

    let state = AppState {
        db,
        redis_pool,
        gemini_config,
        s3,
        s3_bucket,
    };

    let state = Arc::new(state);

    // =====================================
    // Background maintenance tasks
    // =====================================
    // Both loop forever, so they must be spawned, not awaited, or
    // start_worker below would never run.

    tokio::spawn(cleanup::run_cleanup_loop());
    tokio::spawn(watchdog::run_watchdog_loop(state.clone()));

    // =====================================
    // Start worker runtime (blocks forever)
    // =====================================

    worker::start_worker(state).await;
}
