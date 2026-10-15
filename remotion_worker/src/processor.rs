use anyhow::{anyhow, Result};

use crate::docker_exec::run_docker_render;
use crate::renderer::move_rendered_video;
use crate::{
    generator::{extract_duration_seconds, generate_remotion_code, RepairContext},
    models::RenderResult,
    filesystem::{
        create_workspace,
        write_scene_file,
        cleanup_workspace,
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
    validator::validate_generated_code,
    AppState,
};

// ======================================================
// Self-repair loop
// ======================================================
//
// When the generated code fails (static validation, bundle/React error
// inside Docker, timeout, no video produced), the failed code and the real
// error text are sent back to Gemini for a corrected version. Default: up to
// 2 repair attempts (3 tries in total). Override with REMOTION_MAX_REPAIRS;
// 0 restores the old single-attempt behaviour.

fn max_repairs() -> u32 {
    std::env::var("REMOTION_MAX_REPAIRS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2)
}

/// What a successful generate -> validate -> render run hands back.
struct RenderedScene {
    workspace: Workspace,
    duration_seconds: u32,
    // Start of the render that succeeded (failed attempts are not counted).
    render_started: std::time::Instant,
}

// ======================================================
// Process Render Job
// ======================================================

pub async fn process_render_job(
    state: &AppState,
    job_id: &str,
) -> Result<()> {

    println!("PROCESS_RENDER_JOB (REMOTION) VERSION 1");
    println!("\n=================================================");
    println!("PROCESSING JOB");
    println!("JOB ID: {}", job_id);
    println!("=================================================");

    // ==================================================
    // Fetch Job
    // ==================================================

    println!("\nFetching render job...");

    let job = match get_render_job_by_id(
        state,
        job_id,
    )
    .await
    {
        Ok(job) => job,

        Err(err) => {

            eprintln!("\nFAILED TO FETCH JOB");
            eprintln!("{:#?}", err);

            // Best-effort: if this was a transient DB blip, the job still
            // gets a Failed status instead of staying stuck.
            if let Err(db_err) = mark_job_failed(
                state,
                job_id,
                &format!("Failed to fetch job from database: {}", err),
            )
            .await
            {
                eprintln!("\nFAILED TO MARK JOB FAILED (after fetch error)");
                eprintln!("{:#?}", db_err);
            }

            return Err(err.into());
        }
    };

    let Some(job) = job else {

        eprintln!("\nJOB NOT FOUND");
        eprintln!("Job ID: {}", job_id);

        return Ok(());
    };

    println!("\nJOB FOUND");
    println!("Prompt: {}", job.prompt);

    // ==================================================
    // Mark Generating
    // ==================================================

    println!("\nMarking job as GeneratingCode...");

    if let Err(err) = mark_job_generating(
        state,
        job_id,
    )
    .await
    {
        eprintln!("\nFAILED TO MARK JOB AS GENERATING");
        eprintln!("{:#?}", err);

        // Same reasoning as the fetch error: best-effort Failed status.
        if let Err(db_err) = mark_job_failed(
            state,
            job_id,
            &format!("Failed to mark job as generating: {}", err),
        )
        .await
        {
            eprintln!("\nFAILED TO MARK JOB FAILED (after generating-status error)");
            eprintln!("{:#?}", db_err);
        }

        return Err(err.into());
    }

    println!("Job marked as GeneratingCode");

    // ==================================================
    // Generate -> validate -> render (with Gemini-driven repair)
    // ==================================================
    // On failure the workspace has already been cleaned up by
    // generate_and_render; all that is left is the Failed status.

    let RenderedScene {
        workspace,
        duration_seconds,
        render_started,
    } = match generate_and_render(state, job_id, &job.prompt).await {

        Ok(rendered) => rendered,

        Err(err) => {

            eprintln!("\n========================================");
            eprintln!("GENERATE / RENDER FAILED");
            eprintln!("========================================");

            eprintln!("{:#}", err);

            if let Err(db_err) = mark_job_failed(
                state,
                job_id,
                &format!("{:#}", err),
            )
            .await
            {
                eprintln!("\nFAILED TO MARK JOB FAILED");
                eprintln!("{:#?}", db_err);
            }

            return Err(err);
        }
    };

    println!(
        "\nComponent file exists: {}",
        workspace.component_file.exists()
    );

    // ==================================================
    // Final Rendered Video
    // ==================================================
    // NOTE: unlike Manim, Remotion writes the .mp4 to a
    // deterministic path we chose ourselves
    // (workspace.output_file). There is no unpredictable
    // media/videos/... tree to search, so the old
    // find_rendered_video() step is removed entirely.
    // ==================================================

    let rendered_video_path = workspace.output_file.clone();

    println!("\nFINAL VIDEO PATH (deterministic):");
    println!("{:?}", rendered_video_path);

    // ==================================================
    // Move Final Video To Static Storage
    // ==================================================

    println!("\nMoving rendered video...");

    let public_video_path = match move_rendered_video(
        &rendered_video_path,
        job_id,
    )
    .await
    {
        Ok(path) => {

            println!("\nVIDEO MOVED SUCCESSFULLY");
            println!("Public Path: {}", path);

            path
        }

        Err(err) => {

            eprintln!("\nFAILED TO MOVE VIDEO");
            eprintln!("{:#?}", err);

            let _ = cleanup_workspace(&workspace).await;

            if let Err(db_err) = mark_job_failed(
                state,
                job_id,
                &format!("Failed to move rendered video: {}", err),
            )
            .await
            {
                eprintln!("\nFAILED TO MARK JOB FAILED");
                eprintln!("{:#?}", db_err);
            }

            return Err(err);
        }
    };

    // ==================================================
    // Get Final File Metadata
    // ==================================================

    let local_video_path = format!("./static{}", public_video_path);

    let metadata = match tokio::fs::metadata(&local_video_path)
    .await
    {
        Ok(meta) => meta,

        Err(err) => {

            eprintln!("\nFAILED TO READ FINAL VIDEO METADATA");
            eprintln!("{:#?}", err);

            let _ = cleanup_workspace(&workspace).await;

            if let Err(db_err) = mark_job_failed(
                state,
                job_id,
                &format!("Failed to read final video metadata: {}", err),
            )
            .await
            {
                eprintln!("\nFAILED TO MARK JOB FAILED");
                eprintln!("{:#?}", db_err);
            }

            return Err(err.into());
        }
    };

    // ==================================================
    // Upload To S3
    // ==================================================

    if let Err(err) = mark_job_uploading(state, job_id).await {
        eprintln!("\nFAILED TO MARK JOB AS UPLOADING (non-fatal, continuing)");
        eprintln!("{:#?}", err);
    }

    let s3_key = match upload_video(
        state,
        std::path::Path::new(&local_video_path),
        job_id,
    )
    .await
    {
        Ok(key) => {

            println!("\nVIDEO UPLOADED SUCCESSFULLY");
            println!("S3 Key: {}", key);

            key
        }

        Err(err) => {

            eprintln!("\nFAILED TO UPLOAD VIDEO");
            eprintln!("{:#?}", err);

            let _ = cleanup_workspace(&workspace).await;

            if let Err(db_err) = mark_job_failed(
                state,
                job_id,
                &format!("Failed to upload rendered video: {}", err),
            )
            .await
            {
                eprintln!("\nFAILED TO MARK JOB FAILED");
                eprintln!("{:#?}", db_err);
            }

            return Err(err);
        }
    };

    // S3 holds the video now; the local copy is no longer needed. Non-fatal:
    // the cleanup loop also sweeps ./static/renders.
    if let Err(err) = tokio::fs::remove_file(&local_video_path).await {
        eprintln!("Could not delete local video {}: {}", local_video_path, err);
    }

    // ==================================================
    // Real Render Result
    // ==================================================
    // duration_seconds comes from the generated code's DURATION_SECONDS
    // constant (see generator::extract_duration_seconds).
    // video_path is the S3 object key, not a local path.
    // ==================================================

    let result = RenderResult {

        video_path: s3_key,

        duration_seconds: duration_seconds as f32,

        file_size_bytes: metadata.len(),

        render_time_ms: render_started.elapsed().as_millis() as u64,
    };

    println!("\nREAL RENDER RESULT CREATED");

    // ==================================================
    // Mark Completed
    // ==================================================

    println!("\nMarking job as completed...");

    if let Err(err) = mark_job_completed(
        state,
        job_id,
        result,
    )
    .await
    {

        eprintln!("\nFAILED TO MARK JOB COMPLETED");
        eprintln!("{:#?}", err);

        // ==============================================
        // Mark Failed
        // ==============================================

        if let Err(db_err) = mark_job_failed(
            state,
            job_id,
            &err.to_string(),
        )
        .await
        {
            eprintln!("\nFAILED TO MARK JOB FAILED");
            eprintln!("{:#?}", db_err);
        }

        // The video was already uploaded to S3; only the DB write
        // failed. The workspace holds nothing needed any more, so clean it.
        let _ = cleanup_workspace(&workspace).await;

        return Err(err.into());
    }

    // ==================================================
    // Cleanup Workspace
    // ==================================================

    println!("\nCleaning up workspace...");

    if let Err(err) = cleanup_workspace(&workspace).await {

        eprintln!("\nFAILED TO CLEANUP WORKSPACE");
        eprintln!("{:#?}", err);
    }
    else {

        println!("Workspace cleaned successfully");
    }

    // ==================================================
    // Success
    // ==================================================

    println!("\n=================================================");
    println!("JOB COMPLETED SUCCESSFULLY");
    println!("JOB ID: {}", job_id);
    println!("=================================================\n");

    Ok(())
}

// ======================================================
// Workspace lifetime around the repair loop
// ======================================================

async fn generate_and_render(
    state: &AppState,
    job_id: &str,
    prompt: &str,
) -> Result<RenderedScene> {

    // Filled in by run_attempts as soon as a workspace exists on disk, so
    // every failure path is cleaned up here in one place.
    let mut workspace: Option<Workspace> = None;

    let outcome = run_attempts(state, job_id, prompt, &mut workspace).await;

    if outcome.is_err() {
        if let Some(workspace) = &workspace {
            let _ = cleanup_workspace(workspace).await;
        }
    }

    outcome
}

// ======================================================
// generate -> validate -> render, with Gemini-driven repair
// ======================================================

async fn run_attempts(
    state: &AppState,
    job_id: &str,
    prompt: &str,
    workspace_slot: &mut Option<Workspace>,
) -> Result<RenderedScene> {

    let max_repairs = max_repairs();

    println!("\nStarting Gemini generation...");

    let mut code = generate_remotion_code(&state.gemini_config, prompt, None)
        .await
        .map_err(|err| anyhow!("Gemini generation failed: {}", err))?;

    println!("\nGEMINI GENERATION SUCCESS");

    let mut last_error = String::new();

    for attempt in 0..=max_repairs {

        // ---------------- repair: ask Gemini to fix the last failure -------

        if attempt > 0 {

            println!("\n=================================================");
            println!("REPAIR ATTEMPT {}/{}", attempt, max_repairs);
            println!("Feeding this error back to Gemini:\n{}", last_error);
            println!("=================================================\n");

            if let Err(err) = set_retry_count(state, job_id, attempt as u8).await {
                eprintln!("Warning: could not record retry_count: {}", err);
            }

            // Status back to GeneratingCode while Gemini works on the fix.
            // This also restarts started_at, so the watchdog's stuck-job
            // window applies per attempt rather than to the whole job.
            if let Err(err) = mark_job_generating(state, job_id).await {
                eprintln!("Warning: could not mark job as generating: {}", err);
            }

            code = generate_remotion_code(
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
                    last_error
                )
            })?;
        }

        println!("\n=================================================");
        println!("GENERATED REMOTION CODE (attempt {})", attempt);
        println!("=================================================\n");

        println!("{}", code);

        // ---------------- keep a copy of the generated code ----------------
        // (debugging / e2e content checks) Saved for every job, successful
        // or not. A repair overwrites the file, so it always holds the code
        // of the latest attempt, i.e. the code that was rendered when the
        // job succeeds. Non-fatal.

        let generated_path = format!("./static/generated/{}.tsx", job_id);
        if let Err(err) = tokio::fs::create_dir_all("./static/generated").await {
            eprintln!("Could not create ./static/generated: {}", err);
        } else if let Err(err) = tokio::fs::write(&generated_path, &code).await {
            eprintln!("Could not save generated code to {}: {}", generated_path, err);
        } else {
            println!("Generated code saved to {}", generated_path);
        }

        // ---------------- static validation ----------------

        if let Err(err) = validate_generated_code(&code) {

            last_error = format!("Static validation rejected the code: {}", err);

            eprintln!("\n{}", last_error);

            continue;
        }

        // ---------------- scaffold the Remotion project ----------------
        // create_workspace only creates directories and (over)writes the
        // scaffold files, so on a repair attempt it simply rewrites Root.tsx
        // with the duration the corrected code declares.

        let duration_seconds = extract_duration_seconds(&code);

        println!("Video duration chosen by model: {}s", duration_seconds);

        let workspace = create_workspace(job_id, duration_seconds)
            .await
            .map_err(|err| anyhow!("Workspace creation failed: {}", err))?;

        *workspace_slot = Some(workspace.clone());

        println!("\nPROJECT SCAFFOLDED");
        println!("Root: {:?}", workspace.root);
        println!("Entry Point: {:?}", workspace.entry_point);

        write_scene_file(&workspace, &code)
            .await
            .map_err(|err| anyhow!("Failed to write component file: {}", err))?;

        println!("\nGeneratedScene.tsx written successfully");

        // Output of a failed attempt must not survive into this one. The
        // file usually does not exist, so the result is ignored.
        let _ = tokio::fs::remove_file(&workspace.output_file).await;

        // ---------------- render in the sandbox ----------------

        if let Err(err) = mark_job_rendering(state, job_id).await {
            eprintln!("\nFAILED TO MARK JOB AS RENDERING (non-fatal, continuing)");
            eprintln!("{:#?}", err);
            // Not a hard failure: the render is more valuable to attempt than
            // to abort over a status-label write. The status stays
            // GeneratingCode, which the watchdog also covers.
        }

        println!("\nStarting sandboxed Remotion render (attempt {})...", attempt);

        let render_started = std::time::Instant::now();

        match run_docker_render(job_id, &workspace, duration_seconds).await {

            Ok(()) => {
                return Ok(RenderedScene {
                    workspace,
                    duration_seconds,
                    render_started,
                });
            }

            Err(err) => {
                last_error = format!("{:#}", err);
            }
        }

        eprintln!("\nSANDBOXED REMOTION RENDER FAILED (attempt {}):\n{}", attempt, last_error);
    }

    Err(anyhow!(
        "Remotion render failed after {} attempt(s) (1 generation + {} repair(s)). Last error: {}",
        max_repairs + 1,
        max_repairs,
        last_error
    ))
}