
use std::sync::Arc;
use std::time::Duration;

use deadpool_redis::redis::AsyncCommands;
use futures::FutureExt; // for .catch_unwind()
use tokio::sync::Semaphore;

use crate::{
    processor::process_render_job,
    services::job_service::mark_job_failed,
    AppState,
};

/// Extracts a human-readable message from a caught panic payload.
/// Handles panic!("literal") and panic!("{}", args); anything else (e.g.
/// std::panic::panic_any with a custom type) gets a generic message.
fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "non-string panic payload".to_string()
    }
}

const RENDER_QUEUE: &str = "render_queue";

// Each render runs in its own Docker container requesting --cpus 3.0 /
// REMOTION_CONCURRENCY=3 (see docker_exec.rs), tuned for a 12-core host as
// 4 jobs x 3 cores. This was previously 2 jobs x 6 cores: Chromium's own
// frame-render parallelism plateaus well before 6 concurrent tabs, so a
// lone job rarely used all 6 cores productively — it mostly just meant
// fewer jobs were ever in flight at once. Raise this only together with a
// matching cut to RENDER_CPU_LIMIT/REMOTION_CONCURRENCY so the product never
// exceeds host core count again.
const MAX_CONCURRENT_JOBS: usize = 4;

pub async fn start_worker(
    state: Arc<AppState>,
) {

    println!("Worker started.");
    println!("Waiting for jobs...");

    // =====================================
    // Concurrency limiter
    // =====================================

    let semaphore = Arc::new(
        Semaphore::new(MAX_CONCURRENT_JOBS)
    );

    loop {

        // =====================================
        // Get Redis connection
        // =====================================

        let mut redis_conn = match state
            .redis_pool
            .get()
            .await
        {
            Ok(conn) => conn,

            Err(err) => {

                eprintln!(
                    "Failed to get Redis connection: {}",
                    err
                );

                tokio::time::sleep(
                    Duration::from_secs(2)
                )
                .await;

                continue;
            }
        };

        // =====================================
        // Fetch next job
        // =====================================

        let result: Result<
            Option<(String, String)>,
            _
        > = redis_conn
            .brpop(RENDER_QUEUE, 0.0)
            .await;

        match result {

            Ok(Some((_queue, job_id))) => {

                println!(
                    "Received job: {}",
                    job_id
                );

                // =====================================
                // Wait for concurrency slot
                // =====================================

                let available_before =
                    semaphore.available_permits();

                println!(
                    "[QUEUE] Waiting for slot | available permits: {}",
                    available_before
                );

                // =====================================
                // Acquire concurrency permit
                // =====================================

                let permit = semaphore
                    .clone()
                    .acquire_owned()
                    .await
                    .unwrap();

                let available_after =
                    semaphore.available_permits();

                println!(
                    "[WORKER] Slot acquired | active jobs: {} | available permits: {}",
                    MAX_CONCURRENT_JOBS - available_after,
                    available_after
                );

                // =====================================
                // Clone shared state
                // =====================================

                let state_clone = state.clone();

                // IMPORTANT:
                // Clone semaphore before moving into task
                let semaphore_clone =
                    semaphore.clone();

                // =====================================
                // Spawn concurrent task
                // =====================================

                tokio::spawn(async move {

                    println!(
                        "START job {} at {:?}",
                        job_id,
                        std::time::SystemTime::now()
                    );

                    // A panic unwinds past the normal Err handling in
                    // processor.rs, so mark_job_failed would never run and
                    // the job would stay stuck. Catch it here and write the
                    // Failed status ourselves.
                    let job_id_for_panic = job_id.clone();
                    let state_for_panic = state_clone.clone();

                    let result = std::panic::AssertUnwindSafe(
                        process_render_job(&state_clone, &job_id)
                    )
                    .catch_unwind()
                    .await;

                    match result {

                        Ok(Ok(_)) => {

                            println!(
                                "Successfully processed job: {}",
                                job_id
                            );
                        }

                        Ok(Err(err)) => {

                            // processor.rs already marks the job Failed on
                            // its own error paths.
                            eprintln!(
                                "Failed processing job {}: {:?}",
                                job_id,
                                err
                            );
                        }

                        Err(panic_payload) => {

                            let panic_msg = panic_message(&*panic_payload);

                            eprintln!(
                                "PANIC while processing job {}: {}",
                                job_id_for_panic,
                                panic_msg
                            );

                            if let Err(db_err) = mark_job_failed(
                                &state_for_panic,
                                &job_id_for_panic,
                                &format!("Internal error (panic): {}", panic_msg),
                            )
                            .await
                            {
                                eprintln!(
                                    "FAILED TO MARK JOB FAILED after panic: {:?}",
                                    db_err
                                );
                            }
                        }
                    }

                    println!(
                        "END job {} at {:?}",
                        job_id,
                        std::time::SystemTime::now()
                    );

                    // =====================================
                    // Release semaphore slot
                    // =====================================

                    drop(permit);

                    let available_after_release =
                        semaphore_clone
                            .available_permits();

                    println!(
                        "[WORKER] Job finished | active jobs: {} | available permits: {}",
                        MAX_CONCURRENT_JOBS
                            - available_after_release,
                        available_after_release
                    );
                });
            }

            Ok(None) => {

                eprintln!(
                    "BRPOP returned no data."
                );
            }

            Err(err) => {

                eprintln!(
                    "Redis BRPOP error: {}",
                    err
                );

                tokio::time::sleep(
                    Duration::from_secs(1)
                )
                .await;
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn catches_panic_and_extracts_message() {
        let r = std::panic::AssertUnwindSafe(async { panic!("test panic"); })
            .catch_unwind()
            .await;
        assert_eq!(panic_message(&*r.unwrap_err()), "test panic");
    }

    #[tokio::test]
    async fn catches_formatted_panic_message() {
        let n = 7;
        let r = std::panic::AssertUnwindSafe(async move { panic!("bad {n}"); })
            .catch_unwind()
            .await;
        assert_eq!(panic_message(&*r.unwrap_err()), "bad 7");
    }
}
