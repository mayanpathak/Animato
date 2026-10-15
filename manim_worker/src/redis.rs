use deadpool_redis::{Config, Pool, Runtime};
use std::env;

pub async fn create_redis_pool() -> Pool {
    let redis_url = env::var("REDIS_URL_MANIM")
        .expect("REDIS_URL_MANIM must be set");

    let cfg = Config::from_url(redis_url);

    cfg.create_pool(Some(Runtime::Tokio1))
        .expect("Failed to create Redis pool")
}