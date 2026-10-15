use anyhow::{anyhow, Result};
use regex::Regex;

// ======================================================
// Validate Generated Remotion (TSX) Code
// ======================================================
//
// Cheap static checks run BEFORE the Docker render (see processor.rs). A
// failure here costs no render and gives Gemini a precise reason to repair
// against.
//
// Deliberately small. It only catches mistakes that the render would NOT
// report clearly on its own:
//   - a missing GeneratedScene export, which otherwise surfaces as a vague
//     "element type is invalid" error from React;
//   - KaTeX used without its stylesheet, which renders an unreadable
//     equation and exits 0, so nothing downstream would ever notice.
//
// It does NOT deny-list fetch/eval/require/imports the way the Manim
// validator does. Videos may now show code snippets, so the generated file
// legitimately contains strings like "import os" or "fetch(" as on-screen
// text, and a substring filter would reject working scenes. The isolation
// boundary is docker_exec.rs (no network, read-only fs, dropped
// capabilities, resource limits), and a wrong import already fails the
// bundle with a clear "Module not found" error that the repair loop handles.

pub fn validate_generated_code(code: &str) -> Result<()> {
    validate_scene_export(code)?;
    validate_katex_stylesheet(code)?;

    Ok(())
}

// ======================================================
// GeneratedScene export
// ======================================================
//
// Root.tsx imports `{ GeneratedScene }` by name, so any named export works:
// `export const GeneratedScene`, `export function GeneratedScene`, or
// `export { GeneratedScene }`.

fn validate_scene_export(code: &str) -> Result<()> {
    let direct = Regex::new(r"export\s+(const|let|var|function)\s+GeneratedScene\b")?;
    let listed = Regex::new(r"export\s*\{[^}]*\bGeneratedScene\b[^}]*\}")?;

    if !direct.is_match(code) && !listed.is_match(code) {
        return Err(anyhow!(
            "The file must export a component named GeneratedScene, e.g. \
             `export const GeneratedScene: React.FC = () => ...`"
        ));
    }

    Ok(())
}

// ======================================================
// KaTeX stylesheet
// ======================================================

fn validate_katex_stylesheet(code: &str) -> Result<()> {
    let imports_katex = Regex::new(r#"from\s+["']katex["']"#)?;

    if imports_katex.is_match(code) && !code.contains("katex/dist/katex.min.css") {
        return Err(anyhow!(
            "katex is imported without its stylesheet. Add \
             `import \"katex/dist/katex.min.css\";` next to the katex import."
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
import { useCurrentFrame, AbsoluteFill, interpolate } from "remotion";

export const DURATION_SECONDS = 5;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: "white", opacity }} />;
};
"#;

    #[test]
    fn valid_scene_passes() {
        assert!(validate_generated_code(VALID).is_ok());
    }

    #[test]
    fn other_named_export_forms_pass() {
        let function_form = VALID.replace(
            "export const GeneratedScene: React.FC = () => {",
            "export function GeneratedScene() {",
        );
        assert!(validate_generated_code(&function_form).is_ok());

        let listed_form = format!(
            "{}\nexport {{ GeneratedScene }};\n",
            VALID.replace("export const GeneratedScene", "const GeneratedScene")
        );
        assert!(validate_generated_code(&listed_form).is_ok());
    }

    #[test]
    fn missing_scene_export_fails() {
        let code = VALID.replace("GeneratedScene", "MyScene");
        let err = validate_generated_code(&code).unwrap_err();
        assert!(err.to_string().contains("GeneratedScene"));
    }

    #[test]
    fn katex_without_stylesheet_fails() {
        let code = format!("import katex from \"katex\";\n{VALID}");
        let err = validate_generated_code(&code).unwrap_err();
        assert!(err.to_string().contains("katex.min.css"));
    }

    #[test]
    fn katex_with_stylesheet_passes() {
        let code = format!(
            "import katex from \"katex\";\nimport \"katex/dist/katex.min.css\";\n{VALID}"
        );
        assert!(validate_generated_code(&code).is_ok());
    }

    #[test]
    fn code_snippet_text_is_not_rejected() {
        // On-screen code for a programming lesson: must not be mistaken for
        // something the scene itself does.
        let code = format!(
            "const snippet = `\nimport os\nfetch(\"https://example.com\")\neval(\"1 + 1\")\n`;\n{VALID}"
        );
        assert!(validate_generated_code(&code).is_ok());
    }
}
