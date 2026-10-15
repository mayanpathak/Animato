use anyhow::{anyhow, Context, Result};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tokio::fs;
use walkdir::WalkDir;

use crate::filesystem::Workspace;
use crate::utils::validate_job_id;

// ======================================================
// Find Final Rendered Video
// ======================================================
//
// Only looks inside <workspace>/media/videos (where Manim writes), skips
// partial_movie_files, and picks the newest mp4. The old version walked the
// whole workspace and returned the first .mp4 it met, which could be any
// file the generated code had dropped in the mounted directory.

pub fn find_rendered_video(
    workspace: &Workspace,
) -> Result<PathBuf> {

    let videos_dir = workspace.media_dir.join("videos");

    if !videos_dir.exists() {
        return Err(anyhow!(
            "Manim produced no output (media/videos does not exist)"
        ));
    }

    let mut best: Option<(SystemTime, PathBuf)> = None;

    for entry in WalkDir::new(&videos_dir) {

        let entry = entry?;

        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();

        if path
            .components()
            .any(|c| c.as_os_str() == "partial_movie_files")
        {
            continue;
        }

        if path.extension() != Some(std::ffi::OsStr::new("mp4")) {
            continue;
        }

        let modified = entry.metadata()?.modified()?;

        match &best {
            Some((best_time, _)) if *best_time >= modified => {}
            _ => best = Some((modified, path.to_path_buf())),
        }
    }

    match best {
        Some((_, path)) => {
            println!("\nFOUND FINAL VIDEO:\n{:?}", path);
            Ok(path)
        }
        None => Err(anyhow!("No final rendered video found")),
    }
}

// ======================================================
// Move Rendered Video to static storage
// ======================================================

pub async fn move_rendered_video(
    rendered_video_path: &Path,
    job_id: &str,
) -> Result<String> {

    validate_job_id(job_id)
        .context("Refusing to move video: invalid job_id")?;

    println!("\n=====================================");
    println!("MOVING RENDERED VIDEO");
    println!("=====================================");
    println!("\nSource Video Path:\n{:?}", rendered_video_path);

    let static_render_dir = PathBuf::from("./static/renders");

    fs::create_dir_all(&static_render_dir)
        .await
        .context("Failed to create static/renders directory")?;

    let final_video_filename = format!("{}.mp4", job_id);
    let final_video_path = static_render_dir.join(&final_video_filename);

    // copy + remove instead of rename: the workspace lives in the OS temp
    // dir, which is often on a different drive/device than ./static, and
    // rename fails across devices.
    fs::copy(rendered_video_path, &final_video_path)
        .await
        .context("Failed to copy rendered video to static directory")?;

    if let Err(err) = fs::remove_file(rendered_video_path).await {
        eprintln!("Warning: could not remove original video: {}", err);
    }

    let public_video_path = format!("/renders/{}", final_video_filename);

    println!("\nVideo moved successfully. Public Video Path:\n{}", public_video_path);

    Ok(public_video_path)
}

// ======================================================
// Real video duration (from the mp4 `mvhd` box)
// ======================================================

pub fn parse_mp4_duration_secs(data: &[u8]) -> Option<f32> {

    let pos = data.windows(4).position(|w| w == b"mvhd")?;
    let b = data.get(pos + 4..)?;
    let version = *b.first()?;

    let (timescale, duration) = if version == 1 {
        let ts = u32::from_be_bytes(b.get(20..24)?.try_into().ok()?);
        let du = u64::from_be_bytes(b.get(24..32)?.try_into().ok()?);
        (ts, du)
    } else {
        let ts = u32::from_be_bytes(b.get(12..16)?.try_into().ok()?);
        let du = u32::from_be_bytes(b.get(16..20)?.try_into().ok()?) as u64;
        (ts, du)
    };

    if timescale == 0 {
        return None;
    }

    Some(duration as f32 / timescale as f32)
}

pub async fn mp4_duration_secs(path: &str) -> Option<f32> {
    let data = fs::read(path).await.ok()?;
    parse_mp4_duration_secs(&data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn move_rejects_traversal_job_id() {
        let err = move_rendered_video(Path::new("x.mp4"), "../../evil")
            .await
            .unwrap_err();
        assert!(err.to_string().contains("invalid job_id"));
    }

    #[test]
    fn parses_v0_mvhd_duration() {
        // "mvhd", version 0, flags, creation, modification, timescale=1000, duration=5000
        let mut data = b"xxxxmvhd".to_vec();
        data.extend_from_slice(&[0, 0, 0, 0]);
        data.extend_from_slice(&[0, 0, 0, 0]);
        data.extend_from_slice(&[0, 0, 0, 0]);
        data.extend_from_slice(&1000u32.to_be_bytes());
        data.extend_from_slice(&5000u32.to_be_bytes());
        assert_eq!(parse_mp4_duration_secs(&data), Some(5.0));
    }

    #[test]
    fn garbage_has_no_duration() {
        assert_eq!(parse_mp4_duration_secs(b"not an mp4"), None);
    }
}
