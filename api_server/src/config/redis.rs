use deadpool_redis::{Config, Pool, Runtime};
use std::env;

use crate::models::Library;

/// One Redis instance per rendering library. Each worker BRPOPs
/// `render_queue` on its own instance, so routing a job = picking the pool.
///
///   REDIS_URL_MANIM     e.g. redis://localhost:6380
///   REDIS_URL_REMOTION  e.g. redis://localhost:6379
///                       (falls back to the legacy REDIS_URL if unset)
#[derive(Clone)]
pub struct RedisPools {
    pub manim: Pool,
    pub remotion: Pool,
}

impl RedisPools {
    pub fn for_library(&self, library: Library) -> &Pool {
        match library {
            Library::Manim => &self.manim,
            Library::Remotion => &self.remotion,
        }
    }
}

fn build_pool(name: &str, url: String) -> Pool {
    Config::from_url(url)
        .create_pool(Some(Runtime::Tokio1))
        .unwrap_or_else(|e| panic!("Failed to create Redis pool for {}: {}", name, e))
}

pub async fn create_redis_pools() -> RedisPools {
    let manim_url = env::var("REDIS_URL_MANIM")
        .expect("REDIS_URL_MANIM must be set (e.g. redis://localhost:6380)");

    let remotion_url = env::var("REDIS_URL_REMOTION")
        .or_else(|_| env::var("REDIS_URL"))
        .expect("REDIS_URL_REMOTION must be set (e.g. redis://localhost:6379)");

    RedisPools {
        manim: build_pool("manim", manim_url),
        remotion: build_pool("remotion", remotion_url),
    }
}
