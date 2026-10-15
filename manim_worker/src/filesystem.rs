use anyhow::{Context, Result};
use std::path::PathBuf;
use tokio::fs;

use crate::utils::validate_job_id;

#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,
    pub scene_file: PathBuf,
    pub media_dir: PathBuf,
    pub output_dir: PathBuf,
}

pub async fn create_workspace(
    job_id: &str,
) -> Result<Workspace> {

    // job_id comes from Redis: never build paths from it unchecked.
    validate_job_id(job_id)
        .context("Refusing to create workspace: invalid job_id")?;

    let root = std::env::temp_dir()
        .join("renders")
        .join(job_id);

    let media_dir = root.join("media");

    let output_dir = root.join("output");

    let scene_file = root.join("scene.py");

    // Create root workspace directory
    fs::create_dir_all(&root).await?;

    // Create media directory
    fs::create_dir_all(&media_dir).await?;

    // Create output directory
    fs::create_dir_all(&output_dir).await?;

    Ok(Workspace {
        root,
        scene_file,
        media_dir,
        output_dir,
    })
}

pub async fn write_scene_file(
    workspace: &Workspace,
    code: &str,
) -> Result<()> {

    fs::write(
        &workspace.scene_file,
        code,
    )
    .await?;

    Ok(())
}

/// Wipes the media dir between render attempts so partial output from a
/// failed attempt can never be mistaken for the final video.
pub async fn reset_media_dir(
    workspace: &Workspace,
) -> Result<()> {

    if fs::try_exists(&workspace.media_dir).await? {
        fs::remove_dir_all(&workspace.media_dir).await?;
    }

    fs::create_dir_all(&workspace.media_dir).await?;

    Ok(())
}

/// Keeps every generated attempt (and the error that made it fail) under
/// ./static/generated/<job_id>/ so "what did Gemini write, and why did it
/// fail?" can always be answered after the temporary workspace is gone.
/// Best-effort: never fails the job.
pub async fn save_attempt(
    job_id: &str,
    attempt: u32,
    code: &str,
    error: Option<&str>,
) {

    if validate_job_id(job_id).is_err() {
        return;
    }

    let dir = PathBuf::from("./static/generated").join(job_id);

    if let Err(err) = fs::create_dir_all(&dir).await {
        eprintln!("Could not create {:?}: {}", dir, err);
        return;
    }

    let code_path = dir.join(format!("attempt-{}.py", attempt));

    if let Err(err) = fs::write(&code_path, code).await {
        eprintln!("Could not save {:?}: {}", code_path, err);
    }

    if let Some(error) = error {
        let err_path = dir.join(format!("attempt-{}.error.txt", attempt));

        if let Err(err) = fs::write(&err_path, error).await {
            eprintln!("Could not save {:?}: {}", err_path, err);
        }
    }
}

pub async fn cleanup_workspace(
    workspace: &Workspace,
) -> Result<()> {

    if fs::try_exists(&workspace.root).await? {

        fs::remove_dir_all(
            &workspace.root,
        )
        .await?;
    }

    Ok(())
}
