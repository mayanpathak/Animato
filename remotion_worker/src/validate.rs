use anyhow::{anyhow, Result};

/// Validates that a job_id is safe to interpolate into filesystem paths,
/// Docker container/volume names, and Mongo queries.
///
/// Rules:
///   - non-empty
///   - max 64 chars (UUIDs are 36; this leaves headroom without being unbounded)
///   - ASCII alphanumeric plus '-' and '_' only
///   - does not start with '.' or '-' (rules out "-rf" style flag confusion
///     if job_id is ever interpolated as a bare CLI token, and rules out ".."
///     and hidden-file-style names)
///
/// This intentionally allow-lists rather than deny-lists characters — deny-listing
/// "../" is fragile against encoding tricks, allow-listing is not.
pub fn validate_job_id(job_id: &str) -> Result<()> {
    if job_id.is_empty() {
        return Err(anyhow!("job_id is empty"));
    }

    if job_id.len() > 64 {
        return Err(anyhow!("job_id exceeds max length of 64 chars"));
    }

    let first = job_id.chars().next().unwrap();
    if first == '.' || first == '-' {
        return Err(anyhow!("job_id must not start with '.' or '-'"));
    }

    let all_valid = job_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');

    if !all_valid {
        return Err(anyhow!(
            "job_id contains characters outside [A-Za-z0-9_-]: {:?}",
            job_id
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_uuid_v4() {
        assert!(validate_job_id("6f9619ff-8b86-d011-b42d-00cf4fc964ff").is_ok());
    }

    #[test]
    fn rejects_empty() {
        assert!(validate_job_id("").is_err());
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_job_id("../../etc/passwd").is_err());
        assert!(validate_job_id("..").is_err());
        assert!(validate_job_id("a/../b").is_err());
    }

    #[test]
    fn rejects_shell_metacharacters() {
        assert!(validate_job_id("job; rm -rf /").is_err());
        assert!(validate_job_id("$(whoami)").is_err());
        assert!(validate_job_id("job`id`").is_err());
    }

    #[test]
    fn rejects_leading_dash() {
        assert!(validate_job_id("-rf").is_err());
    }

    #[test]
    fn rejects_too_long() {
        let long_id = "a".repeat(65);
        assert!(validate_job_id(&long_id).is_err());
    }

    #[test]
    fn accepts_underscores_and_dashes_mid_string() {
        assert!(validate_job_id("job_id-123_ABC").is_ok());
    }
}
