use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime},
};

pub fn cleanup_old_videos() {
    // Folder where rendered videos are stored — must match
    // renderer.rs::move_rendered_video's static_render_dir.
    let renders_dir = "./static/renders";

    // Delete files older than RENDER_RETENTION_SECS (default: 1 hour).
    // 10 minutes was too aggressive for a user-facing product — a user who
    // takes longer than that to come back would find their video gone.
    let retention_secs: u64 = std::env::var("RENDER_RETENTION_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3600);

    let max_age = Duration::from_secs(retention_secs);

    let path = Path::new(renders_dir);

    if !path.exists() {
        println!("[CLEANUP] renders directory does not exist");
        return;
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(err) => {
            eprintln!("[CLEANUP] Failed to read renders directory: {}", err);
            return;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[CLEANUP] Failed to read entry: {}", err);
                continue;
            }
        };

        let file_path = entry.path();

        // Skip directories
        if file_path.is_dir() {
            continue;
        }

        let metadata = match fs::metadata(&file_path) {
            Ok(meta) => meta,
            Err(err) => {
                eprintln!(
                    "[CLEANUP] Failed to read metadata for {:?}: {}",
                    file_path,
                    err
                );
                continue;
            }
        };

        let modified_time = match metadata.modified() {
            Ok(time) => time,
            Err(err) => {
                eprintln!(
                    "[CLEANUP] Failed to get modified time for {:?}: {}",
                    file_path,
                    err
                );
                continue;
            }
        };

        let age = match SystemTime::now().duration_since(modified_time) {
            Ok(duration) => duration,
            Err(err) => {
                eprintln!(
                    "[CLEANUP] Failed to calculate age for {:?}: {}",
                    file_path,
                    err
                );
                continue;
            }
        };

        if age > max_age {
            match fs::remove_file(&file_path) {
                Ok(_) => {
                    println!(
                        "[CLEANUP] Deleted old video: {:?}",
                        file_path.file_name().unwrap_or_default()
                    );
                }
                Err(err) => {
                    eprintln!(
                        "[CLEANUP] Failed to delete {:?}: {}",
                        file_path,
                        err
                    );
                }
            }
        }
    }
}

// ======================================================
// Periodic background task
// ======================================================

pub async fn run_cleanup_loop() {
    let interval_secs: u64 = std::env::var("CLEANUP_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300); // every 5 minutes

    println!(
        "[CLEANUP] Background cleanup loop started (interval: {}s)",
        interval_secs
    );

    loop {
        tokio::time::sleep(Duration::from_secs(interval_secs)).await;

        // cleanup_old_videos does blocking filesystem I/O — run it on the
        // blocking thread pool so it doesn't stall the async runtime that
        // the render-job worker loop shares.
        let result = tokio::task::spawn_blocking(cleanup_old_videos).await;

        if let Err(join_err) = result {
            eprintln!("[CLEANUP] cleanup task panicked: {:?}", join_err);
        }
    }
}
