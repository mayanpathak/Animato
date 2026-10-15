use std::time::Instant;

use anyhow::{anyhow, Context, Result};

use crate::docker::run_manim_container;
use crate::renderer::{
    find_rendered_video,
    move_rendered_video,
    mp4_duration_secs,
};
use crate::{
    generator::{generate_manim_code, RepairContext},
    models::RenderResult,
    filesystem::{
        cleanup_workspace,
        create_workspace,
        reset_media_dir,
        save_attempt,
        write_scene_file,
        Workspace,
    },
    services::job_service::{
        get_render_job_by_id,
        mark_job_completed,
        mark_job_failed,
        mark_job_generating,
        mark_job_rendering,
        mark_job_uploading,
        set_retry_count,
    },
    uploader::upload_video,
    utils::{truncate_chars, validate_job_id},
    validator::validate_generated_code,
    AppState,
};

// ======================================================
// Self-repair loop
// ======================================================
//
// When the generated code fails (static validation, Manim/Python/LaTeX error
// inside Docker, timeout, no video produced), the failed code and the real
// error text are sent back to Gemini for a corrected version. Default: up to
// 2 repair attempts (3 tries in total). Override with MANIM_MAX_REPAIRS.

fn max_repairs() -> u32 {
    std::env::var("MANIM_MAX_REPAIRS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2)
}

// ======================================================
// Process Render Job
// ======================================================
//
// Every failure path ends in mark_job_failed exactly once, here, so a job
// can never be left stuck in Pending/GeneratingCode/Rendering.

pub async fn process_render_job(
    state: &AppState,
    job_id: &str,
) -> Result<()> {

    println!("PROCESS_RENDER_JOB (MANIM) VERSION 1000");
    println!("\n=================================================");
    println!("PROCESSING JOB");
    println!("JOB ID: {}", job_id);
    println!("=================================================");

    // job_id came out of Redis: reject anything that is not a plain id
    // before it is used in a path, container name or query.
    if let Err(err) = validate_job_id(job_id) {
        eprintln!("\nREJECTED JOB WITH INVALID ID: {}", err);
        return Err(err);
    }

    let job = match get_render_job_by_id(state, job_id).await {
        Ok(Some(job)) => job,

        Ok(None) => {
            eprintln!("\nJOB NOT FOUND: {}", job_id);
            return Ok(());
        }

        Err(err) => {
            eprintln!("\nFAILED TO FETCH JOB\n{:#?}", err);
            fail_job(state, job_id, &format!("Failed to fetch job from database: {}", err)).await;
            return Err(err.into());
        }
    };

    println!("\nJOB FOUND\nPrompt: {}", job.prompt);

    if let Err(err) = mark_job_generating(state, job_id).await {
        eprintln!("\nFAILED TO MARK JOB AS GENERATING\n{:#?}", err);
        fail_job(state, job_id, &format!("Failed to mark job as generating: {}", err)).await;
        return Err(err.into());
    }

    let started = Instant::now();

    match run_pipeline(state, job_id, &job.prompt, started).await {

        Ok(result) => {

            if let Err(err) = mark_job_completed(state, job_id, result).await {
                eprintln!("\nFAILED TO MARK JOB COMPLETED\n{:#?}", err);
                fail_job(state, job_id, &format!("Failed to mark job completed: {}", err)).await;
                return Err(err.into());
            }

            println!("\n=================================================");
            println!("JOB COMPLETED SUCCESSFULLY");
            println!("JOB ID: {}", job_id);
            println!("=================================================\n");

            Ok(())
        }

        Err(err) => {
            eprintln!("\n=================================================");
            eprintln!("JOB FAILED: {}", job_id);
            eprintln!("{:#}", err);
            eprintln!("=================================================\n");

            fail_job(state, job_id, &format!("{:#}", err)).await;

            Err(err)
        }
    }
}

async fn fail_job(state: &AppState, job_id: &str, message: &str) {
    if let Err(db_err) = mark_job_failed(state, job_id, message).await {
        eprintln!("\nFAILED TO MARK JOB FAILED\n{:#?}", db_err);
    }
}

// ======================================================
// Workspace lifetime + result assembly
// ======================================================

async fn run_pipeline(
    state: &AppState,
    job_id: &str,
    prompt: &str,
    started: Instant,
) -> Result<RenderResult> {

    let workspace = create_workspace(job_id)
        .await
        .map_err(|err| anyhow!("Workspace creation failed: {}", err))?;

    println!("\nWORKSPACE CREATED: {:?}", workspace.root);

    let outcome = generate_and_render(state, job_id, prompt, &workspace).await;

    // The finished video has already been moved to ./static/renders, so the
    // temporary workspace is disposable on success and failure alike.
    if let Err(err) = cleanup_workspace(&workspace).await {
        eprintln!("\nFAILED TO CLEANUP WORKSPACE\n{:#?}", err);
    } else {
        println!("Workspace cleaned successfully");
    }

    let public_video_path = outcome?;

    let final_path = format!("./static{}", public_video_path);

    let metadata = tokio::fs::metadata(&final_path)
        .await
        .with_context(|| format!("Failed to read final video metadata at {}", final_path))?;

    let duration_seconds = mp4_duration_secs(&final_path).await.unwrap_or(0.0);

    // ---------------- upload to S3 ----------------

    if let Err(err) = mark_job_uploading(state, job_id).await {
        eprintln!("Warning: could not mark job as uploading: {}", err);
    }

    // An error here goes back to process_render_job, which marks the job Failed.
    let s3_key = upload_video(state, std::path::Path::new(&final_path), job_id)
        .await
        .context("Failed to upload rendered video")?;

    // S3 holds the video now; the local copy is no longer needed. Non-fatal.
    if let Err(err) = tokio::fs::remove_file(&final_path).await {
        eprintln!("Could not delete local video {}: {}", final_path, err);
    }

    Ok(RenderResult {
        // S3 object key, not a local path.
        video_path: s3_key,
        duration_seconds,
        file_size_bytes: metadata.len(),
        // Whole pipeline: generation + validation + render + any repairs.
        render_time_ms: started.elapsed().as_millis() as u64,
    })
}

// ======================================================
// generate -> validate -> render, with Gemini-driven repair
// ======================================================

async fn generate_and_render(
    state: &AppState,
    job_id: &str,
    prompt: &str,
    workspace: &Workspace,
) -> Result<String> {

    let max_repairs = max_repairs();

    println!("\nStarting Gemini generation...");

    let mut code = generate_manim_code(&state.gemini_config, prompt, None)
        .await
        .map_err(|err| anyhow!("Gemini generation failed: {}", err))?;

    let mut last_error = String::new();

    for attempt in 0..=max_repairs {

        // ---------------- repair: ask Gemini to fix the last failure -------

        if attempt > 0 {

            println!("\n=================================================");
            println!("REPAIR ATTEMPT {}/{}", attempt, max_repairs);
            println!("Feeding this error back to Gemini:\n{}", truncate_chars(&last_error, 1500));
            println!("=================================================\n");

            if let Err(err) = set_retry_count(state, job_id, attempt as u8).await {
                eprintln!("Warning: could not record retry_count: {}", err);
            }

            // status back to GeneratingCode while Gemini works on the fix
            if let Err(err) = mark_job_generating(state, job_id).await {
                eprintln!("Warning: could not mark job as generating: {}", err);
            }

            code = generate_manim_code(
                &state.gemini_config,
                prompt,
                Some(RepairContext {
                    previous_code: &code,
                    error: &last_error,
                }),
            )
            .await
            .map_err(|err| {
                anyhow!(
                    "Gemini repair (attempt {}) failed: {}. Error being repaired: {}",
                    attempt,
                    err,
                    truncate_chars(&last_error, 1200)
                )
            })?;
        }

        // Every attempt's code is kept under ./static/generated/<job_id>/
        save_attempt(job_id, attempt, &code, None).await;

        println!("\n=================================================");
        println!("GENERATED MANIM CODE (attempt {})", attempt);
        println!("=================================================\n");
        println!("{}", code);

        // ---------------- static validation ----------------

        if let Err(err) = validate_generated_code(&code) {

            last_error = format!("Static validation rejected the code: {}", err);

            eprintln!("\n{}", last_error);

            save_attempt(job_id, attempt, &code, Some(&last_error)).await;

            continue;
        }

        // ---------------- render in the sandbox ----------------

        write_scene_file(workspace, &code)
            .await
            .map_err(|err| anyhow!("Failed to write scene.py: {}", err))?;

        // partial output of a failed attempt must not survive into this one
        reset_media_dir(workspace)
            .await
            .map_err(|err| anyhow!("Failed to reset media dir: {}", err))?;

        if let Err(err) = mark_job_rendering(state, job_id).await {
            eprintln!("Warning: could not mark job as rendering: {}", err);
        }

        println!("\nStarting Docker render (attempt {})...", attempt);

        match run_manim_container(job_id, workspace).await {

            Ok(()) => match find_rendered_video(workspace) {

                Ok(video_path) => {
                    return move_rendered_video(&video_path, job_id).await;
                }

                Err(err) => {
                    last_error = format!(
                        "Manim exited successfully but no usable video was produced: {}",
                        err
                    );
                }
            },

            Err(err) => {
                last_error = format!("{:#}", err);
            }
        }

        eprintln!("\nRENDER ATTEMPT {} FAILED:\n{}", attempt, last_error);

        save_attempt(job_id, attempt, &code, Some(&last_error)).await;
    }

    Err(anyhow!(
        "Render failed after {} attempt(s) (1 generation + {} repair(s)). Last error: {}",
        max_repairs + 1,
        max_repairs,
        last_error
    ))
}
