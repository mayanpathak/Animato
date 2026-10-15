use anyhow::{anyhow, Context, Result};
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::timeout;

use crate::filesystem::Workspace;
use crate::utils::{strip_ansi, tail_chars, validate_job_id};

// ======================================================
// Run Manim in a sandboxed Docker container
// ======================================================
//
// This is the isolation boundary between untrusted, LLM-generated Python and
// the host. What is enforced (and why):
//
//   --network none            no outbound network from generated code
//   --memory/--memory-swap    OOM kills the container, not the host
//   --cpus / --pids-limit     CPU hog / fork bomb stays inside the container
//   --cap-drop ALL,
//   no-new-privileges         no Linux capabilities, no privilege escalation
//   --read-only + tmpfs /tmp  root fs immutable; only /tmp and the mounted
//                             workspace are writable
//   --user                    not root inside the container
//   --name + host timeout     a hung/infinite-loop scene is killed with
//                             `docker rm -f` instead of holding a worker
//                             slot forever
//   no `-e` secrets           GEMINI_API_KEY / MONGODB_URI never enter it
//
// Env overrides (all optional):
//   DOCKER_PATH, MANIM_SANDBOX_IMAGE, MANIM_RENDER_TIMEOUT_SECS (240),
//   MANIM_MEMORY (1g), MANIM_CPUS (1.0), MANIM_PIDS (256),
//   MANIM_DOCKER_USER (1000:1000; set to "none" to run as the image default),
//   MANIM_READ_ONLY (1; set 0 if a scene needs a writable root fs)

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| default.to_string())
}

pub async fn run_manim_container(
    job_id: &str,
    workspace: &Workspace,
) -> Result<()> {

    // job_id becomes part of the container name.
    validate_job_id(job_id)
        .context("Refusing to render: invalid job_id")?;

    println!("\n=====================================");
    println!("STARTING DOCKER RENDER");
    println!("=====================================");
    println!("\nWorkspace Root: {:?}", workspace.root);

    let docker_path = env_or("DOCKER_PATH", "docker");
    let image = env_or("MANIM_SANDBOX_IMAGE", "manim-sandbox");
    let timeout_secs: u64 = env_or("MANIM_RENDER_TIMEOUT_SECS", "240")
        .parse()
        .unwrap_or(240);
    let container_name = format!("manim-render-{}", job_id);

    let render = spawn_and_wait(&docker_path, &image, &container_name, workspace);

    match timeout(Duration::from_secs(timeout_secs), render).await {
        Ok(result) => result,

        Err(_elapsed) => {
            eprintln!("\nRENDER TIMED OUT after {}s", timeout_secs);

            // Dropping the future kills the `docker run` client
            // (kill_on_drop) but not necessarily the container itself.
            let _ = Command::new(&docker_path)
                .arg("rm")
                .arg("-f")
                .arg(&container_name)
                .output()
                .await;

            Err(anyhow!(
                "Render timed out after {}s. The scene is too heavy or contains an \
                 endless loop; make it simpler and shorter.",
                timeout_secs
            ))
        }
    }
}

async fn spawn_and_wait(
    docker_path: &str,
    image: &str,
    container_name: &str,
    workspace: &Workspace,
) -> Result<()> {

    let memory = env_or("MANIM_MEMORY", "1g");
    let cpus = env_or("MANIM_CPUS", "1.0");
    let pids = env_or("MANIM_PIDS", "256");
    let read_only = env_or("MANIM_READ_ONLY", "1") != "0";
    let user = std::env::var("MANIM_DOCKER_USER").unwrap_or_else(|_| "1000:1000".to_string());

    let mount_path = format!("{}:/workspace", workspace.root.display());

    let mut cmd = Command::new(docker_path);

    cmd.arg("run")
        .arg("--rm")
        .arg("--name").arg(container_name)
        .arg("--network").arg("none")
        .arg("--memory").arg(&memory)
        .arg("--memory-swap").arg(&memory)
        .arg("--cpus").arg(&cpus)
        .arg("--pids-limit").arg(&pids)
        .arg("--cap-drop").arg("ALL")
        .arg("--security-opt").arg("no-new-privileges")
        // LaTeX / fontconfig / ffmpeg need a writable HOME and /tmp.
        .arg("--tmpfs").arg("/tmp:rw,size=512m")
        .arg("-e").arg("HOME=/tmp");

    if read_only {
        cmd.arg("--read-only");
    }

    // "none" (or empty) = run as the image's default user.
    let user = user.trim();
    if !user.is_empty() && !user.eq_ignore_ascii_case("none") {
        cmd.arg("--user").arg(user);
    }

    cmd.arg("-v").arg(&mount_path)
        .arg(image)
        .arg("manim")
        .arg("/workspace/scene.py")
        .arg("GeneratedScene")
        .arg("-ql")
        .kill_on_drop(true)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .context("Failed to spawn `docker run` (is Docker running?)")?;

    let mut stdout_pipe = child.stdout.take().context("child stdout was not piped")?;
    let mut stderr_pipe = child.stderr.take().context("child stderr was not piped")?;

    let mut stdout_buf = String::new();
    let mut stderr_buf = String::new();

    // Drain both pipes while waiting, so a chatty render cannot deadlock on
    // a full pipe buffer.
    let (stdout_res, stderr_res, wait_res) = tokio::join!(
        stdout_pipe.read_to_string(&mut stdout_buf),
        stderr_pipe.read_to_string(&mut stderr_buf),
        child.wait(),
    );

    if let Err(err) = stdout_res {
        eprintln!("Warning: failed reading docker stdout: {}", err);
    }
    if let Err(err) = stderr_res {
        eprintln!("Warning: failed reading docker stderr: {}", err);
    }

    let status = wait_res.context("docker run process error while waiting for exit")?;

    let stdout_clean = strip_ansi(&stdout_buf);
    let stderr_clean = strip_ansi(&stderr_buf);

    println!("\nDOCKER EXIT STATUS: {}", status);
    println!("\nDOCKER STDOUT (last 3000 chars):\n{}", tail_chars(&stdout_clean, 3000));
    println!("\nDOCKER STDERR (last 3000 chars):\n{}", tail_chars(&stderr_clean, 3000));

    if !status.success() {
        // This text is what gets fed back to Gemini for the repair attempt,
        // so it carries the real Python/Manim/LaTeX error, not a generic
        // "render failed". Both streams: Manim splits its output unpredictably.
        // Kept short because every char is resent as input tokens on a
        // repair; the exception itself is at the tail of the stream.
        return Err(anyhow!(
            "manim exited with {}\n--- STDERR ---\n{}\n--- STDOUT ---\n{}",
            status,
            tail_chars(stderr_clean.trim(), 1500),
            tail_chars(stdout_clean.trim(), 600),
        ));
    }

    println!("\nDocker render completed successfully");

    Ok(())
}
