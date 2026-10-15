// use std::{sync::Arc, time::Duration};

// use redis::AsyncCommands;
// use serde::{Deserialize, Serialize};
// use tokio::{signal, sync::Semaphore};

// #[derive(Debug, Serialize, Deserialize, Clone)]
// struct TaskPayload {
//     job_id: String,
//     prompt: String,
//     numberOfSlides: u8,
//     presentationStyle: String,
//     retry_count: Option<u8>,
// }

// // ===== CONFIG =====

// const REDIS_URL: &str = "redis://127.0.0.1/";
// const QUEUE_NAME: &str = "presentation_Task_queue";

// const MAX_RETRIES: u8 = 3;
// const CONCURRENCY_LIMIT: usize = 5;

// const RESULT_TTL_SECONDS: u64 = 60 * 60 * 24; // 24 hours

// // ===== ENTRY =====

// #[tokio::main]
// async fn main() -> anyhow::Result<()> {
//     println!("Starting Rust worker...");

//     let client = redis::Client::open(REDIS_URL)?;

//     let semaphore = Arc::new(Semaphore::new(CONCURRENCY_LIMIT));

//     loop {
//         tokio::select! {
//             _ = signal::ctrl_c() => {
//                 println!("Shutting down worker...");
//                 break;
//             }

//             result = fetch_job(&client) => {
//                 match result {
//                     Ok(Some(payload)) => {
//                         let permit = semaphore
//                             .clone()
//                             .acquire_owned()
//                             .await
//                             .unwrap();

//                         let client_clone = client.clone();

//                         tokio::spawn(async move {
//                             process_job(client_clone, payload).await;

//                             drop(permit);
//                         });
//                     }

//                     Ok(None) => {
//                         // No jobs found
//                         continue;
//                     }

//                     Err(err) => {
//                         eprintln!("Error fetching job: {:?}", err);

//                         tokio::time::sleep(Duration::from_secs(1)).await;
//                     }
//                 }
//             }
//         }
//     }

//     Ok(())
// }

// // ===== FETCH JOB =====

// async fn fetch_job(
//     client: &redis::Client,
// ) -> anyhow::Result<Option<TaskPayload>> {
//     let mut conn = client.get_async_connection().await?;

//     // BRPOP blocks for 5 seconds
//     let result: Option<(String, String)> = redis::cmd("BRPOP")
//         .arg(QUEUE_NAME)
//         .arg(5)
//         .query_async(&mut conn)
//         .await?;

//     match result {
//         Some((_queue, payload_str)) => {
//             println!("Received raw payload: {}", payload_str);

//             let payload: TaskPayload =
//                 serde_json::from_str(&payload_str)?;

//             Ok(Some(payload))
//         }

//         None => Ok(None),
//     }
// }

// // ===== PROCESS JOB =====

// async fn process_job(
//     client: redis::Client,
//     payload: TaskPayload,
// ) {
//     let job_id = payload.job_id.clone();

//     println!("Processing job: {}", job_id);

//     // Update status to processing
//     if let Err(err) =
//         update_status(&client, &job_id, "processing").await
//     {
//         eprintln!(
//             "Failed to update processing status for {}: {:?}",
//             job_id,
//             err
//         );

//         return;
//     }

//     // Generate presentation
//     let result = generate_presentation(&payload).await;

//     match result {
//         Ok(presentation_json) => {
//             // Store generated result
//             match store_result(
//                 &client,
//                 &job_id,
//                 &presentation_json,
//             )
//             .await
//             {
//                 Ok(_) => {
//                     let _ = update_status(
//                         &client,
//                         &job_id,
//                         "completed",
//                     )
//                     .await;

//                     println!("Job {} completed", job_id);
//                 }

//                 Err(err) => {
//                     eprintln!(
//                         "Failed storing result for {}: {:?}",
//                         job_id,
//                         err
//                     );

//                     retry_job(&client, payload).await;
//                 }
//             }
//         }

//         Err(err) => {
//             eprintln!("Job {} failed: {:?}", job_id, err);

//             retry_job(&client, payload).await;
//         }
//     }
// }

// // ===== MOCK AI CALL =====

// async fn generate_presentation(
//     payload: &TaskPayload,
// ) -> anyhow::Result<String> {
//     println!(
//         "Generating presentation for prompt: {}",
//         payload.prompt
//     );

//     // Simulate API latency
//     tokio::time::sleep(Duration::from_secs(2)).await;

//     // Replace this section with Gemini/OpenAI/etc
//     let fake_response = serde_json::json!({
//         "job_id": payload.job_id,
//         "title": format!("Presentation on {}", payload.prompt),
//         "slides_count": payload.numberOfSlides,
//         "style": payload.presentationStyle,
//         "slides": []
//     });

//     Ok(fake_response.to_string())
// }

// // ===== STORE RESULT =====

// async fn store_result(
//     client: &redis::Client,
//     job_id: &str,
//     result: &str,
// ) -> anyhow::Result<()> {
//     let mut conn = client.get_async_connection().await?;

//     let key = format!("presentation:{}", job_id);

//     conn.set_ex::<_, _, ()>(
//         key,
//         result,
//         RESULT_TTL_SECONDS,
//     )
//     .await?;

//     Ok(())
// }

// // ===== UPDATE STATUS =====

// async fn update_status(
//     client: &redis::Client,
//     job_id: &str,
//     status: &str,
// ) -> anyhow::Result<()> {
//     let mut conn = client.get_async_connection().await?;

//     let key = format!("job_status:{}", job_id);

//     conn.set_ex::<_, _, ()>(
//         key,
//         status,
//         RESULT_TTL_SECONDS,
//     )
//     .await?;

//     Ok(())
// }

// // ===== RETRY LOGIC =====

// async fn retry_job(
//     client: &redis::Client,
//     mut payload: TaskPayload,
// ) {
//     let retry_count = payload.retry_count.unwrap_or(0);

//     if retry_count >= MAX_RETRIES {
//         let _ = update_status(
//             client,
//             &payload.job_id,
//             "failed",
//         )
//         .await;

//         eprintln!(
//             "Job {} permanently failed",
//             payload.job_id
//         );

//         return;
//     }

//     payload.retry_count = Some(retry_count + 1);

//     println!(
//         "Retrying job {} (attempt {})",
//         payload.job_id,
//         retry_count + 1
//     );

//     match client.get_async_connection().await {
//         Ok(mut conn) => {
//             let serialized =
//                 serde_json::to_string(&payload).unwrap();

//             let result = conn
//                 .lpush::<_, _, ()>(QUEUE_NAME, serialized)
//                 .await;

//             if let Err(err) = result {
//                 eprintln!(
//                     "Failed to requeue job {}: {:?}",
//                     payload.job_id,
//                     err
//                 );
//             }
//         }

//         Err(err) => {
//             eprintln!(
//                 "Failed getting Redis connection for retry: {:?}",
//                 err
//             );
//         }
//     }
// }