use std::env;

#[derive(Clone)]
pub struct GeminiConfig {
    pub api_key: String,
    pub model: String,
}

impl GeminiConfig {
    pub fn from_env() -> Self {
        Self {
            api_key: env::var("GEMINI_API_KEY")
                .expect("GEMINI_API_KEY missing"),

            // Lazily evaluated fallback, and now aligned with what
            // generator.rs used to hardcode (gemini-2.5-flash) instead
            // of silently diverging from it.
            model: env::var("GEMINI_MODEL")
                .unwrap_or_else(|_| "gemini-2.5-flash".to_string()),
        }
    }
}