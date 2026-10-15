use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::fs;

// ======================================================
// Move Rendered Video to Static Directory
// ======================================================
//
// NOTE: find_rendered_video() is REMOVED because Remotion
// writes directly to workspace.output_file — no searching needed.

pub async fn move_rendered_video(
    rendered_video_path: &Path,
    job_id: &str,
) -> Result<String> {
    // Defense in depth: create_workspace already validated this, but this
    // function builds a destination path from job_id and must not depend on
    // being called only after that.
    crate::validate::validate_job_id(job_id)
        .context("Refusing to move video: invalid job_id")?;

    println!("\n=====================================");
    println!("MOVING RENDERED VIDEO");
    println!("=====================================");

    println!("\nSource Video Path:\n{:?}", rendered_video_path);

    // ==================================================
    // Create Static Render Directory
    // ==================================================

    let static_render_dir = PathBuf::from("./static/renders");

    fs::create_dir_all(&static_render_dir).await
        .context("Failed to create static/renders directory")?;

    println!("\nStatic Render Directory Ready:\n{:?}", static_render_dir);

    // ==================================================
    // Final Destination Path
    // ==================================================

    let final_video_filename = format!("{}.mp4", job_id);
    let final_video_path = static_render_dir.join(&final_video_filename);

    println!("\nFinal Video Destination:\n{:?}", final_video_path);

    // ==================================================
    // Move File
    // ==================================================

    // Use copy + remove instead of rename to handle cross-device moves
    fs::copy(rendered_video_path, &final_video_path).await
        .context("Failed to copy rendered video to static directory")?;

    // Remove the original
    fs::remove_file(rendered_video_path).await
        .context("Failed to remove original rendered video")?;

    println!("\nVideo moved successfully");

    // ==================================================
    // Public URL Path
    // ==================================================

    let public_video_path = format!("/renders/{}", final_video_filename);

    println!("\nPublic Video Path:\n{}", public_video_path);

    Ok(public_video_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_traversal_job_id_before_touching_disk() {
        let err = move_rendered_video(Path::new("does-not-matter.mp4"), "../../evil")
            .await
            .unwrap_err();
        assert!(err.to_string().contains("invalid job_id"));
    }
}