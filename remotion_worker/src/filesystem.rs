use anyhow::{Context, Result};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,           // e.g. /tmp/remotion_projects/<job_id>
    pub entry_point: PathBuf,    // root/src/index.ts — passed to `remotion render`
    pub component_file: PathBuf, // root/src/compositions/GeneratedScene.tsx
    pub output_file: PathBuf,    // root/out/video.mp4 — Remotion writes exactly here
}

// ======================================================
// Create Workspace — scaffolds a full Remotion project
// ======================================================

pub async fn create_workspace(job_id: &str, duration_seconds: u32) -> Result<Workspace> {
    crate::validate::validate_job_id(job_id)
        .context("Refusing to create workspace: invalid job_id")?;

    let project_root = std::env::var("REMOTION_PROJECT_ROOT")
        .unwrap_or_else(|_| std::env::temp_dir().join("remotion_projects").display().to_string());

    let root = PathBuf::from(&project_root).join(job_id);
    let compositions_dir = root.join("src").join("compositions");
    let output_dir = root.join("out");

    fs::create_dir_all(&compositions_dir).await
        .context("Failed to create src/compositions dir")?;
    fs::create_dir_all(&output_dir).await
        .context("Failed to create out dir")?;

    // ---- package.json ----
    // Kept identical to docker/remotion-sandbox/package.json. Nothing is
    // installed from this file (node_modules is baked into the image); it
    // only describes what the image already contains.
    fs::write(
        root.join("package.json"),
        r#"{
  "name": "remotion-job-project",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.503",
    "@remotion/cli": "4.0.503",
    "@remotion/bundler": "4.0.503",
    "@remotion/renderer": "4.0.503",
    "typescript": "5.5.4",
    "katex": "0.16.21",
    "prism-react-renderer": "2.4.1"
  }
}
"#,
    ).await.context("Failed to write package.json")?;

    // ---- tsconfig.json ----
    fs::write(
        root.join("tsconfig.json"),
        r#"{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["dom", "es2020"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
"#,
    ).await.context("Failed to write tsconfig.json")?;

    // ---- remotion.config.ts ----
    fs::write(
        root.join("remotion.config.ts"),
        r#"import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(true);
"#,
    ).await.context("Failed to write remotion.config.ts")?;

    // ---- src/index.ts — THE ENTRY POINT (must call registerRoot) ----
    fs::write(
        root.join("src").join("index.ts"),
        r#"import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
"#,
    ).await.context("Failed to write src/index.ts")?;

    // ---- src/Root.tsx — defines the composition list ----
    // The scene is authored against a fixed 1920x1080 stage (the size the
    // generator prompt promises Gemini) and uniformly scaled down to the
    // output size, so changing the render resolution shrinks the picture
    // instead of pushing hardcoded pixel geometry out of frame.
    let root_tsx = format!(
        r#"import {{ AbsoluteFill, Composition }} from "remotion";
import {{ GeneratedScene }} from "./compositions/GeneratedScene";

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const OUTPUT_WIDTH = {width};
const OUTPUT_HEIGHT = {height};
const SCALE = OUTPUT_WIDTH / DESIGN_WIDTH;

const ScaledScene: React.FC = () => (
  <AbsoluteFill style={{{{ overflow: "hidden" }}}}>
    <div
      style={{{{
        position: "absolute",
        top: 0,
        left: 0,
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `scale(${{SCALE}})`,
        transformOrigin: "top left",
      }}}}
    >
      <GeneratedScene />
    </div>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GeneratedScene"
    component={{ScaledScene}}
    durationInFrames={{{frames}}}
    fps={{{fps}}}
    width={{OUTPUT_WIDTH}}
    height={{OUTPUT_HEIGHT}}
  />
);
"#,
        frames = duration_seconds * crate::generator::FPS,
        fps = crate::generator::FPS,
        width = crate::generator::OUTPUT_WIDTH,
        height = crate::generator::OUTPUT_HEIGHT,
    );

    fs::write(root.join("src").join("Root.tsx"), root_tsx).await
        .context("Failed to write Root.tsx")?;

    // node_modules is intentionally NOT created here: it lives inside the
    // remotion-sandbox Docker image, and only src/, package.json,
    // tsconfig.json, remotion.config.ts and out/ are mounted into the
    // container at render time.

    let entry_point = root.join("src").join("index.ts");
    let component_file = compositions_dir.join("GeneratedScene.tsx");
    let output_file = output_dir.join("video.mp4");

    Ok(Workspace { root, entry_point, component_file, output_file })
}

// ======================================================
// Write the Gemini-generated component file
// ======================================================

pub async fn write_scene_file(workspace: &Workspace, code: &str) -> Result<()> {
    fs::write(&workspace.component_file, code).await?;
    Ok(())
}

// ======================================================
// Cleanup — delete the entire per-job directory
// ======================================================

pub async fn cleanup_workspace(workspace: &Workspace) -> Result<()> {
    if fs::try_exists(&workspace.root).await? {
        fs::remove_dir_all(&workspace.root).await?;
    }
    Ok(())
}