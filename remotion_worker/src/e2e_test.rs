// End-to-end test: real Gemini call -> workspace scaffold -> sandboxed Docker
// render -> video moved to ./static/renders/<job_id>.mp4.
//
// Skips Redis/Mongo (they only carry the job id and status). Costs a real
// Gemini API call and needs Docker running with the remotion-sandbox image
// built, so it is #[ignore]d by default. Run it with:
//
//   cargo test e2e_prompt_to_video -- --ignored --nocapture

use crate::{
    configgemini::GeminiConfig,
    docker_exec::run_docker_render,
    filesystem::{cleanup_workspace, create_workspace, write_scene_file},
    generator::generate_remotion_code,
    renderer::move_rendered_video,
};

#[tokio::test]
#[ignore]
async fn e2e_prompt_to_video() {
    dotenvy::dotenv().ok();
    let gemini_config = GeminiConfig::from_env();

    let job_id = "e2e-test-video";
    let prompt = "A blue circle that grows from nothing and fades in on a white background";

    // 1. prompt -> TSX
    let code = generate_remotion_code(&gemini_config, prompt, None)
        .await
        .expect("Gemini generation failed");
    assert!(
        code.contains("GeneratedScene"),
        "generated code does not export GeneratedScene:\n{code}"
    );

    // 2. TSX -> workspace -> sandboxed render
    let duration = crate::generator::extract_duration_seconds(&code);
    let ws = create_workspace(job_id, duration).await.expect("create_workspace failed");
    write_scene_file(&ws, &code).await.expect("write_scene_file failed");

    let render = run_docker_render(job_id, &ws, duration).await;
    if let Err(e) = &render {
        let _ = cleanup_workspace(&ws).await;
        panic!("sandboxed render failed: {e:#}");
    }

    // 3. move to the folder the real pipeline serves videos from
    let public_path = move_rendered_video(&ws.output_file, job_id)
        .await
        .expect("move_rendered_video failed");
    let _ = cleanup_workspace(&ws).await;

    let final_path = format!("./static{public_path}");
    let size = std::fs::metadata(&final_path)
        .unwrap_or_else(|e| panic!("output video missing at {final_path}: {e}"))
        .len();

    println!("\nE2E OK: video saved at {final_path} ({size} bytes)");
    assert!(size > 10_000, "video suspiciously small: {size} bytes");
}
