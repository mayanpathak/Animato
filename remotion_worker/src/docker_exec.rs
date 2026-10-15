use anyhow::{anyhow, Context, Result};
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::{Child, Command};
use tokio::time::timeout;

use crate::filesystem::Workspace;
use crate::validate::validate_job_id;

// ======================================================
// Run Remotion Render — SANDBOXED via Docker
// ======================================================
//
// Replaces `remotion_exec.rs`. This is the actual isolation boundary
// between untrusted, LLM-generated TSX and the host.
//
// Key properties enforced by the flags below (see spawn_docker_process):
//
//   1. --network none
//        The render container cannot make any outbound network call.
//        This is the enforcement layer behind the Gemini system prompt's
//        "no fetch()" rule.
//
//   2. --memory / --memory-swap / --cpus / --pids-limit
//        A memory bomb OOM-kills the *container*, a fork bomb hits
//        --pids-limit instead of exhausting host PIDs.
//
//   3. --cap-drop=ALL --security-opt=no-new-privileges --read-only
//        No Linux capabilities, no privilege escalation, and the root
//        filesystem is read-only. Only /tmp (tmpfs) and /app/out are
//        writable.
//
//   4. Non-root user
//        The image's USER is `renderer` (see docker/remotion-sandbox).
//
//   5. Bind mounts:
//        <workspace>/src                -> /app/src                (ro)
//        <workspace>/package.json       -> /app/package.json       (ro)
//        <workspace>/tsconfig.json      -> /app/tsconfig.json      (ro)
//        <workspace>/remotion.config.ts -> /app/remotion.config.ts (ro)
//        <workspace>/out                -> /app/out                (rw)
//
//   6. No secrets in the container
//        `docker run` only forwards variables named via -e. We pass none,
//        so GEMINI_API_KEY, MONGODB_URI etc. never reach the container.
//
//   7. --rm
//        Container is deleted on exit regardless of outcome.
//
//   8. stdout/stderr drained concurrently with wait() (tokio::join!),
//      avoiding the pipe-buffer deadlock.
//
//   9. Hard host-side timeout (RENDER_TIMEOUT_SECS). Killing the `docker
//      run` client does not reliably stop the container itself, so on
//      timeout we also run `docker rm -f <name>` explicitly.

pub async fn run_docker_render(
    job_id: &str,
    workspace: &Workspace,
    duration_seconds: u32,
) -> Result<()> {
    validate_job_id(job_id).context("Refusing to render: invalid job_id")?;

    println!("\n=====================================");
    println!("STARTING SANDBOXED REMOTION RENDER");
    println!("=====================================");
    println!("\nJob ID:       {}", job_id);
    println!("Project Root: {:?}", workspace.root);
    println!("Output File:  {:?}", workspace.output_file);

    let docker_path = std::env::var("DOCKER_PATH").unwrap_or_else(|_| "docker".to_string());
    which::which(&docker_path)
        .map_err(|_| anyhow!("docker not found at '{}' — check DOCKER_PATH", docker_path))?;

    let image = std::env::var("REMOTION_SANDBOX_IMAGE")
        .unwrap_or_else(|_| "remotion-sandbox:latest".to_string());

    // How many frames Chromium renders in parallel inside the container.
    // Tuned for a 12-core host running MAX_CONCURRENT_JOBS=4 (see worker.rs):
    // 4 jobs x 3 cores each. Must be raised together with --cpus below, or
    // the extra tabs just queue behind each other with no speedup, and both
    // must stay matched to worker.rs's MAX_CONCURRENT_JOBS so the product
    // never exceeds host core count.
    let concurrency = std::env::var("REMOTION_CONCURRENCY").unwrap_or_else(|_| "3".to_string());

    // Render time scales with video length / concurrency. RENDER_TIMEOUT_SECS,
    // if set, is a fixed override; otherwise allow 60s fixed + 4s per second
    // of video (was 12s/s at concurrency 1, 6s/s at concurrency 3).
    let render_timeout_secs: u64 = std::env::var("RENDER_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60 + 4 * duration_seconds as u64);

    // Memory scales with total concurrent jobs (MAX_CONCURRENT_JOBS in
    // worker.rs), each running its own Docker container. 3g x 4 jobs = 12GB,
    // leaving ~4GB for the OS, Docker itself, the API server, and the Manim
    // worker on a 16GB machine — lower this if the render OOMs or the rest
    // of the machine starves.
    let memory_limit =
        std::env::var("RENDER_MEMORY_LIMIT").unwrap_or_else(|_| "3g".to_string());
    let cpu_limit = std::env::var("RENDER_CPU_LIMIT").unwrap_or_else(|_| "3.0".to_string());
    let pids_limit = std::env::var("RENDER_PIDS_LIMIT").unwrap_or_else(|_| "512".to_string());

    let render_future = spawn_and_run(
        &docker_path, &image, job_id, workspace,
        &memory_limit, &cpu_limit, &pids_limit, &concurrency,
    );

    match timeout(Duration::from_secs(render_timeout_secs), render_future).await {
        Ok(Ok(())) => {
            if workspace.output_file.exists() {
                println!("\nSandboxed render completed successfully");
                Ok(())
            } else {
                Err(anyhow!(
                    "Container exited 0 but no output file was found at {:?} — \
                     check for a composition id / mount path mismatch",
                    workspace.output_file
                ))
            }
        }

        Ok(Err(e)) => Err(e),

        Err(_elapsed) => {
            eprintln!("\nRENDER TIMED OUT after {}s", render_timeout_secs);

            // The future was dropped, which kills the `docker run` client
            // (kill_on_drop) but may leave the container itself running.
            let container_name = format!("remotion-render-{}", job_id);
            let _ = Command::new(&docker_path)
                .arg("rm")
                .arg("-f")
                .arg(&container_name)
                .output()
                .await;

            Err(anyhow!("Render timed out after {}s", render_timeout_secs))
        }
    }
}

// ======================================================
// Spawn `docker run ...`, drain both pipes concurrently, wait
// ======================================================

async fn spawn_and_run(
    docker_path: &str,
    image: &str,
    job_id: &str,
    workspace: &Workspace,
    memory_limit: &str,
    cpu_limit: &str,
    pids_limit: &str,
    concurrency: &str,
) -> Result<()> {
    let mut child = spawn_docker_process(
        docker_path, image, job_id, workspace,
        memory_limit, cpu_limit, pids_limit, concurrency,
    )?;

    let mut stdout_pipe = child.stdout.take().context("child stdout was not piped")?;
    let mut stderr_pipe = child.stderr.take().context("child stderr was not piped")?;

    let mut stdout_buf = String::new();
    let mut stderr_buf = String::new();

    let (stdout_res, stderr_res, wait_res) = tokio::join!(
        stdout_pipe.read_to_string(&mut stdout_buf),
        stderr_pipe.read_to_string(&mut stderr_buf),
        child.wait(),
    );

    if let Err(err) = stdout_res {
        eprintln!("Warning: failed reading child stdout: {}", err);
    }
    if let Err(err) = stderr_res {
        eprintln!("Warning: failed reading child stderr: {}", err);
    }

    let status = wait_res.context("docker run process error while waiting for exit")?;

    println!("\nDOCKER EXIT STATUS:\n{}", status);
    println!("\nDOCKER STDOUT (last 4000 chars):\n{}", tail(&stdout_buf, 4000));

    if !status.success() {
        eprintln!("\nDOCKER STDERR (last 4000 chars):\n{}", tail(&stderr_buf, 4000));

        return Err(anyhow!(
            "docker run exited with {}: {}",
            status,
            tail(&stderr_buf, 2000)
        ));
    }

    Ok(())
}

fn tail(s: &str, max_chars: usize) -> String {
    let count = s.chars().count();
    if count <= max_chars {
        return s.to_string();
    }
    let skip = count - max_chars;
    s.chars().skip(skip).collect()
}

// ======================================================
// Build the `docker run` command with the full isolation flag set
// ======================================================

fn spawn_docker_process(
    docker_path: &str,
    image: &str,
    job_id: &str,
    workspace: &Workspace,
    memory_limit: &str,
    cpu_limit: &str,
    pids_limit: &str,
    concurrency: &str,
) -> Result<Child> {
    let container_name = format!("remotion-render-{}", job_id);

    // Host-side mount sources. These MUST be absolute paths — Docker's
    // -v flag requires absolute paths on the host side.
    let host_src = workspace.root.join("src");
    let host_package_json = workspace.root.join("package.json");
    let host_tsconfig = workspace.root.join("tsconfig.json");
    let host_remotion_config = workspace.root.join("remotion.config.ts");
    let host_out = workspace.root.join("out");

    let mut cmd = Command::new(docker_path);

    cmd.arg("run")
        // ---- lifecycle ----
        .arg("--rm")
        .arg("--name").arg(&container_name)
        // ---- network isolation ----
        .arg("--network").arg("none")
        // ---- resource limits ----
        .arg("--memory").arg(memory_limit)
        .arg("--memory-swap").arg(memory_limit) // disable swap beyond the memory limit
        .arg("--cpus").arg(cpu_limit)
        .arg("--pids-limit").arg(pids_limit)
        // ---- privilege hardening ----
        .arg("--cap-drop").arg("ALL")
        .arg("--security-opt").arg("no-new-privileges")
        .arg("--read-only")
        // Chromium and npm both need a writable /tmp; the root fs is
        // read-only so we grant a tmpfs explicitly instead of loosening
        // --read-only.
        .arg("--tmpfs").arg("/tmp:rw,size=512m")
        // ---- mounts: source read-only, output read-write ----
        .arg("-v").arg(format!("{}:/app/src:ro", host_src.display()))
        .arg("-v").arg(format!("{}:/app/package.json:ro", host_package_json.display()))
        .arg("-v").arg(format!("{}:/app/tsconfig.json:ro", host_tsconfig.display()))
        .arg("-v").arg(format!("{}:/app/remotion.config.ts:ro", host_remotion_config.display()))
        .arg("-v").arg(format!("{}:/app/out:rw", host_out.display()))
        // No -e flags: no host secrets reach the container.
        .arg(image)
        // Image ENTRYPOINT is `npx remotion`; args below.
        .arg("render")
        .arg("/app/src/index.ts")
        .arg("GeneratedScene") // MUST match Root.tsx's Composition id, case-sensitive
        .arg("/app/out/video.mp4")
        .arg("--concurrency")
        .arg(concurrency)
        .kill_on_drop(true)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    cmd.spawn().context("Failed to spawn `docker run` for sandboxed render")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::{cleanup_workspace, create_workspace, write_scene_file};

    // Needs Docker running and the remotion-sandbox image built:
    //   cargo test docker_exec -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn renders_simple_scene_in_sandbox() {
        let job_id = "test-sandbox-render";
        let ws = create_workspace(job_id, 5).await.unwrap();

        write_scene_file(
            &ws,
            r##"import { useCurrentFrame, AbsoluteFill, interpolate } from "remotion";
export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "white", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: 300, height: 300, borderRadius: "50%", backgroundColor: "#3b82f6", transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};
"##,
        )
        .await
        .unwrap();

        let result = run_docker_render(job_id, &ws, 5).await;
        let exists = ws.output_file.exists();
        let _ = cleanup_workspace(&ws).await;

        result.unwrap();
        assert!(exists);
    }

    #[tokio::test]
    async fn rejects_invalid_job_id() {
        let ws = Workspace {
            root: "x".into(),
            entry_point: "x".into(),
            component_file: "x".into(),
            output_file: "x".into(),
        };
        assert!(run_docker_render("../evil", &ws, 5).await.is_err());
    }
}
