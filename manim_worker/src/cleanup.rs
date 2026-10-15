use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime},
};

pub fn cleanup_old_videos() {
    // Folder where rendered videos are stored
    let renders_dir = "./renders";

    // Delete files older than 10 minutes
    let max_age = Duration::from_secs(10 * 60);

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


