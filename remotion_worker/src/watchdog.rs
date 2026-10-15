use std::sync::Arc;

use crate::{services::job_service::sweep_stuck_jobs, AppState};

pub async fn run_watchdog_loop(state: Arc<AppState>) {
    let interval_secs: u64 = std::env::var("WATCHDOG_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60);

    // Must exceed the worst-case healthy job: up to 4 Gemini attempts at 180s
    // (+50s backoff) plus a render of up to 120s + 12s/video-second (840s
    // for a 60s video), or healthy in-flight jobs get marked Failed.
    let stuck_after_secs: i64 = std::env::var("WATCHDOG_STUCK_AFTER_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1800);

    println!(
        "[WATCHDOG] Loop started (interval: {}s, stuck threshold: {}s)",
        interval_secs, stuck_after_secs
    );

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;

        if let Err(err) = sweep_stuck_jobs(&state, stuck_after_secs).await {
            eprintln!("[WATCHDOG] sweep_stuck_jobs failed: {:?}", err);
        }
    }
}
