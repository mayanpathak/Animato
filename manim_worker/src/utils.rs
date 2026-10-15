use anyhow::{anyhow, Result};
use regex::Regex;

/// Validates that a job_id is safe to use in filesystem paths, Docker
/// container names and Mongo queries. job_ids arrive from Redis, so they are
/// treated as untrusted: without this, an id like "../../x" would make
/// create_workspace/cleanup_workspace (remove_dir_all) operate outside the
/// renders directory.
///
/// Allow-list: 1..=64 chars of [A-Za-z0-9_-], not starting with '-' or '.'.
pub fn validate_job_id(job_id: &str) -> Result<()> {
    if job_id.is_empty() {
        return Err(anyhow!("job_id is empty"));
    }

    if job_id.len() > 64 {
        return Err(anyhow!("job_id exceeds max length of 64 chars"));
    }

    if job_id.starts_with('.') || job_id.starts_with('-') {
        return Err(anyhow!("job_id must not start with '.' or '-'"));
    }

    if !job_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(anyhow!(
            "job_id contains characters outside [A-Za-z0-9_-]: {:?}",
            job_id
        ));
    }

    Ok(())
}

/// First `max` chars (char-safe), with a note if cut.
pub fn truncate_chars(s: &str, max: usize) -> String {
    let total = s.chars().count();
    if total <= max {
        return s.to_string();
    }

    let head: String = s.chars().take(max).collect();
    format!("{head}... [truncated, {total} chars total]")
}

/// Last `max` chars (char-safe). Tracebacks put the useful part at the end.
pub fn tail_chars(s: &str, max: usize) -> String {
    let total = s.chars().count();
    if total <= max {
        return s.to_string();
    }

    s.chars().skip(total - max).collect()
}

/// Removes ANSI colour/cursor escape sequences (Manim uses rich output).
pub fn strip_ansi(s: &str) -> String {
    match Regex::new(r"\x1b\[[0-9;?]*[ -/]*[@-~]") {
        Ok(re) => re.replace_all(s, "").into_owned(),
        Err(_) => s.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_id_accepts_uuid() {
        assert!(validate_job_id("6f9619ff-8b86-d011-b42d-00cf4fc964ff").is_ok());
    }

    #[test]
    fn job_id_rejects_traversal_and_junk() {
        assert!(validate_job_id("").is_err());
        assert!(validate_job_id("../../etc").is_err());
        assert!(validate_job_id("..").is_err());
        assert!(validate_job_id("a/b").is_err());
        assert!(validate_job_id("a\\b").is_err());
        assert!(validate_job_id("-rf").is_err());
        assert!(validate_job_id("job; rm -rf /").is_err());
        assert!(validate_job_id(&"a".repeat(65)).is_err());
    }

    #[test]
    fn truncate_and_tail_are_char_safe() {
        assert_eq!(truncate_chars("hello", 10), "hello");
        assert!(truncate_chars(&"é".repeat(20), 5).starts_with("ééééé..."));
        assert_eq!(tail_chars("abcdef", 3), "def");
        assert_eq!(tail_chars(&"é".repeat(10), 2), "éé");
    }

    #[test]
    fn strips_ansi() {
        assert_eq!(strip_ansi("\x1b[31mERROR\x1b[0m boom"), "ERROR boom");
    }
}
