
use anyhow::{
    anyhow,
    Result,
};

use regex::Regex;

// ======================================================
// Validate Generated Manim Code
// ======================================================
//
// First line of defence only: cheap static checks that reject obviously bad
// or dangerous code BEFORE it reaches Docker (and give Gemini a precise
// reason to repair against). A regex filter on Python can never be a
// sandbox; the real isolation boundary is docker.rs (no network, dropped
// capabilities, read-only fs, resource limits, timeout).

pub fn validate_generated_code(
    code: &str,
) -> Result<()> {

    validate_imports(code)?;

    validate_forbidden_patterns(code)?;

    validate_color_constants(code)?;

    validate_scene_structure(code)?;

    validate_camera_usage(code)?;

    validate_updater_safety(code)?;

    validate_object_limits(code)?;

    validate_runtime_safety(code)?;

    validate_basic_quality(code)?;

    Ok(())
}

// ======================================================
// Import Validation
// ======================================================

fn validate_imports(
    code: &str,
) -> Result<()> {

    let allowed_imports = [
        "from manim import *",
        "import numpy as np",
    ];

    for line in code.lines() {

        let trimmed = line.trim();

        if (trimmed.starts_with("import ") || trimmed.starts_with("from "))
            && !allowed_imports.contains(&trimmed)
        {
            return Err(anyhow!(
                "Forbidden import detected: {}",
                trimmed
            ));
        }

        // `x = 1; import os` on one line
        if trimmed.contains("; import ") || trimmed.contains(";import ") {
            return Err(anyhow!(
                "Forbidden inline import detected: {}",
                trimmed
            ));
        }
    }

    Ok(())
}

// ======================================================
// Forbidden Pattern Validation
// ======================================================

fn validate_forbidden_patterns(
    code: &str,
) -> Result<()> {

    // Distinctive enough to match as plain substrings.
    let forbidden_substrings = [
        "subprocess",
        "socket",
        "requests",
        "urllib",
        "pathlib",
        "shutil",
        "threading",
        "multiprocessing",
        "asyncio",
        "importlib",
        "exec(",
        "eval(",
        "compile(",
        "__import__",
        "__builtins__",
        "builtins",
        "__subclasses__",
        "__globals__",
        "__class__",
        "__bases__",
        "__mro__",
        "globals(",
        "locals(",
        "setattr(",
        "getattr(",
        "delattr(",
        "breakpoint(",
        "tempfile",
        "pickle",
        "marshal",
        "ctypes",
    ];

    for pattern in forbidden_substrings {

        if code.contains(pattern) {

            return Err(anyhow!(
                "Forbidden pattern detected: {}",
                pattern
            ));
        }
    }

    // Short names that would false-positive as substrings ("cos.", "pos.",
    // "user_input(", "reopen(") are matched on word boundaries instead.
    let forbidden_words: [(&str, &str); 10] = [
        (r"\bos\.", "os."),
        (r"\bsys\.", "sys."),
        (r"\bopen\(", "open("),
        (r"\binput\(", "input("),
        (r"\bresource\.", "resource."),
        (r"\bsignal\.", "signal."),
        (r"\bfork\(", "fork("),
        (r"\bwhile\s+True\b", "while True"),
        (r"\bwhile\s*\(\s*True\s*\)", "while(True)"),
        (r"\bwhile\s+1\b", "while 1"),
    ];

    for (regex, label) in forbidden_words {

        if Regex::new(regex)?.is_match(code) {

            return Err(anyhow!(
                "Forbidden pattern detected: {}",
                label
            ));
        }
    }

    Ok(())
}

// ======================================================
// Color Constant Validation
// ======================================================
//
// Manim CE only gives shade variants (_A.._E, lightest to darkest) to a
// specific set of color families (BLUE_C, RED_D, ...). Gemini regularly
// invents a shade for a color that doesn't have one, e.g. ORANGE_C, which
// is a plain NameError at render time (confirmed in production: job
// 8cc726cb failed on exactly this). Catching it here saves a full Docker
// round-trip and gives a precise, cheap error to repair against.

fn validate_color_constants(
    code: &str,
) -> Result<()> {

    let families_with_shades = [
        "BLUE", "RED", "GREEN", "YELLOW", "PURPLE", "TEAL",
        "PINK", "MAROON", "GOLD", "GREY", "GRAY",
    ];

    let shaded_ref = Regex::new(r"\b([A-Z][A-Z]*)_([A-E])\b")?;

    for caps in shaded_ref.captures_iter(code) {

        let family = &caps[1];

        if !families_with_shades.contains(&family) {

            return Err(anyhow!(
                "Undefined color constant '{}_{}': only {} have shade \
                 variants (_A lightest .. _E darkest) in Manim CE. Use the \
                 plain constant (e.g. \"{}\") instead.",
                family,
                &caps[2],
                families_with_shades.join(", "),
                family
            ));
        }
    }

    Ok(())
}

// ======================================================
// Scene Structure Validation
// ======================================================

fn validate_scene_structure(
    code: &str,
) -> Result<()> {

    if !code.contains("class GeneratedScene") {

        return Err(anyhow!(
            "GeneratedScene class missing"
        ));
    }

    let valid_scene_types = [
        "class GeneratedScene(Scene):",
        "class GeneratedScene(MovingCameraScene):",
        "class GeneratedScene(ThreeDScene):",
        "class GeneratedScene(ZoomedScene):",
    ];

    let mut valid = false;

    for scene_type in valid_scene_types {

        if code.contains(scene_type) {
            valid = true;
            break;
        }
    }

    if !valid {

        return Err(anyhow!(
            "Invalid scene inheritance"
        ));
    }

    if !code.contains("def construct(self):") {

        return Err(anyhow!(
            "construct method missing"
        ));
    }

    if !code.contains("self.wait(") {

        return Err(anyhow!(
            "self.wait() missing"
        ));
    }

    Ok(())
}

// ======================================================
// Camera Validation
// ======================================================

fn validate_camera_usage(
    code: &str,
) -> Result<()> {

    let uses_camera_frame = code.contains("self.camera.frame");

    let uses_moving_camera_scene =
        code.contains("MovingCameraScene");

    if uses_camera_frame
        && !uses_moving_camera_scene
    {

        return Err(anyhow!(
            "self.camera.frame requires MovingCameraScene"
        ));
    }

    Ok(())
}

// ======================================================
// Updater Validation
// ======================================================

fn validate_updater_safety(
    code: &str,
) -> Result<()> {

    if code.contains("add_updater(") {

        if code.contains("for ")
            && code.contains("lambda")
        {
            let safe_lambda_pattern = Regex::new(
                r"lambda\s+\w+\s*,\s*\w+\s*,"
            )?;

            if !safe_lambda_pattern.is_match(code) {

                return Err(anyhow!(
                    "Updater lambda likely has closure capture bug"
                ));
            }
        }

        if !code.contains("clear_updaters()") {

            return Err(anyhow!(
                "Updaters must be cleared before scene ends"
            ));
        }
    }

    Ok(())
}

// ======================================================
// Object Count Validation
// ======================================================

fn validate_object_limits(
    code: &str,
) -> Result<()> {

    let object_creations = [
        "Circle(",
        "Square(",
        "Rectangle(",
        "Dot(",
        "Line(",
        "Arrow(",
        "Text(",
        "MathTex(",
        "Axes(",
        "NumberPlane(",
        "Polygon(",
        "VGroup(",
    ];

    let mut total_objects = 0;

    for pattern in object_creations {

        total_objects += code.matches(pattern).count();
    }

    if total_objects > 25 {

        return Err(anyhow!(
            "Scene too complex: {} visible objects detected",
            total_objects
        ));
    }

    Ok(())
}

// ======================================================
// Runtime Safety Validation
// ======================================================

fn validate_runtime_safety(
    code: &str,
) -> Result<()> {

    let dangerous_runtime_patterns = [
        "np.random",
        "random.",
        "random_bright_color",
        "always_redraw(",
        "TracedPath(",
        "UpdateFromFunc(",
        "rate_func=there_and_back_with_pause",
        "for _ in range(1000)",
        "for _ in range(500)",
        "for i in range(1000)",
        "for i in range(500)",
    ];

    for pattern in dangerous_runtime_patterns {

        if code.contains(pattern) {

            return Err(anyhow!(
                "Potentially expensive runtime pattern detected: {}",
                pattern
            ));
        }
    }

    Ok(())
}

// ======================================================
// Basic Quality Validation
// ======================================================

fn validate_basic_quality(
    code: &str,
) -> Result<()> {

    let animation_calls = code.matches("self.play(").count();

    if animation_calls < 2 {

        return Err(anyhow!(
            "Scene too simple: insufficient animations"
        ));
    }

    if animation_calls > 15 {

        return Err(anyhow!(
            "Scene too complex: too many animation calls"
        ));
    }

    let line_count = code.lines().count();

    if line_count > 300 {

        return Err(anyhow!(
            "Generated code too large"
        ));
    }

    Ok(())
}

// ======================================================
// Unit Tests
// ======================================================

#[cfg(test)]
mod tests {

    use super::*;

    const VALID: &str = r#"
from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.play(circle.animate.shift(RIGHT))
        self.wait()
"#;

    fn with_body(extra: &str) -> String {
        VALID.replace("circle = Circle()", &format!("circle = Circle()\n        {extra}"))
    }

    #[test]
    fn valid_scene_passes() {
        assert!(validate_generated_code(VALID).is_ok());
    }

    #[test]
    fn forbidden_import_fails() {

        let code = r#"
from manim import *
import os

class GeneratedScene(Scene):
    def construct(self):
        self.wait()
"#;

        assert!(validate_generated_code(code).is_err());
    }

    #[test]
    fn camera_frame_without_moving_camera_scene_fails() {

        let code = r#"
from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        self.camera.frame.animate.scale(2)
        self.wait()
"#;

        assert!(validate_generated_code(code).is_err());
    }

    #[test]
    fn os_call_is_rejected_but_cos_and_pos_are_not() {
        assert!(validate_generated_code(&with_body("os.system('id')")).is_err());
        // legitimate names containing "os." / "input(" as substrings
        assert!(validate_generated_code(&with_body("x = np.cos(1.0)")).is_ok());
        assert!(validate_generated_code(&with_body("pos.append(1)")).is_ok());
        assert!(validate_generated_code(&with_body("user_input(1)")).is_ok());
    }

    #[test]
    fn rejects_nonexistent_color_shade() {
        // Reproduces the real failure from job 8cc726cb: ORANGE has no
        // shade variants in Manim CE.
        let err = validate_generated_code(&with_body("sq.set_color(ORANGE_C)")).unwrap_err();
        assert!(err.to_string().contains("ORANGE_C"));
    }

    #[test]
    fn accepts_real_color_shades() {
        assert!(validate_generated_code(&with_body("sq.set_color(BLUE_C)")).is_ok());
        assert!(validate_generated_code(&with_body("sq.set_color(RED_D)")).is_ok());
        assert!(validate_generated_code(&with_body("sq.set_color(GREY_A)")).is_ok());
    }

    #[test]
    fn sandbox_escape_names_are_rejected() {
        assert!(validate_generated_code(&with_body("x = ().__class__")).is_err());
        assert!(validate_generated_code(&with_body("x = __builtins__")).is_err());
        assert!(validate_generated_code(&with_body("open('/etc/passwd')")).is_err());
        assert!(validate_generated_code(&with_body("while 1: pass")).is_err());
        assert!(validate_generated_code(&with_body("x = 1; import os")).is_err());
    }
}
