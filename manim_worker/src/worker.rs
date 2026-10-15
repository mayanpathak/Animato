
use std::sync::Arc;
use std::time::Duration;

use deadpool_redis::redis::AsyncCommands;
use tokio::sync::Semaphore;

use crate::{
    processor::process_render_job,
    services::job_service::mark_job_failed,
    utils::validate_job_id,
    AppState,
};

const RENDER_QUEUE: &str = "render_queue";

const MAX_CONCURRENT_JOBS: usize = 5;

/// Extracts a readable message from a panic payload.
fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "non-string panic payload".to_string()
    }
}

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
        // Acquire a concurrency slot BEFORE popping a job.
        // =====================================
        // BRPOP removes the job from Redis. Popping first and then waiting for
        // a free slot meant a queued job lived only in this process's memory
        // (lost on a crash) and jobs were pulled off the queue faster than
        // they could be processed.

        let permit = semaphore
            .clone()
            .acquire_owned()
            .await
            .expect("semaphore closed");

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

                // A malformed id must never reach paths/Docker/Mongo.
                if let Err(err) = validate_job_id(&job_id) {
                    eprintln!(
                        "Dropping queue entry with invalid job id {:?}: {}",
                        job_id,
                        err
                    );
                    continue; // permit dropped here
                }

                let active = MAX_CONCURRENT_JOBS - semaphore.available_permits();

                println!(
                    "[WORKER] Slot acquired | active jobs: {}",
                    active
                );

                let state_clone = state.clone();
                let semaphore_clone = semaphore.clone();

                // =====================================
                // Spawn concurrent task
                // =====================================

                tokio::spawn(async move {

                    println!(
                        "START job {} at {:?}",
                        job_id,
                        std::time::SystemTime::now()
                    );

                    // Run the job in its own task: if it panics, the
                    // JoinHandle reports it instead of the job silently
                    // staying in GeneratingCode/Rendering forever.
                    let job_state = state_clone.clone();
                    let job_id_inner = job_id.clone();

                    let handle = tokio::spawn(async move {
                        process_render_job(&job_state, &job_id_inner).await
                    });

                    match handle.await {

                        Ok(Ok(_)) => {
                            println!(
                                "Successfully processed job: {}",
                                job_id
                            );
                        }

                        // process_render_job already marked the job Failed.
                        Ok(Err(err)) => {
                            eprintln!(
                                "Failed processing job {}: {:?}",
                                job_id,
                                err
                            );
                        }

                        Err(join_err) => {

                            let msg = if join_err.is_panic() {
                                let payload = join_err.into_panic();
                                format!("Internal error (panic): {}", panic_message(&*payload))
                            } else {
                                "Internal error: job task was cancelled".to_string()
                            };

                            eprintln!("JOB {} ABORTED: {}", job_id, msg);

                            if let Err(db_err) = mark_job_failed(
                                &state_clone,
                                &job_id,
                                &msg,
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

                    println!(
                        "[WORKER] Job finished | active jobs: {}",
                        MAX_CONCURRENT_JOBS
                            - semaphore_clone.available_permits()
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

    #[test]
    fn extracts_panic_messages() {
        let payload: Box<dyn std::any::Any + Send> = Box::new("boom");
        assert_eq!(panic_message(&*payload), "boom");

        let payload: Box<dyn std::any::Any + Send> = Box::new(String::from("bad 7"));
        assert_eq!(panic_message(&*payload), "bad 7");
    }
}
