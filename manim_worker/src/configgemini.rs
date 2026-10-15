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

            // generator.rs used to hard-code gemini-2.5-flash and ignore this
            // config; the default now matches what was actually being used.
            model: env::var("GEMINI_MODEL")
                .unwrap_or_else(|_| "gemini-2.5-flash".to_string()),
        }
    }
}