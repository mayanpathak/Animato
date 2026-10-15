//! Shared domain types for Offcut: units, ids, limits and every cross-boundary type.

pub mod edit;
pub mod error;
pub mod events;
pub mod ids;
pub mod limits;
pub mod media;
pub mod profile;
pub mod prosody;
pub mod stage;
pub mod summary;
pub mod transcript;
pub mod units;

pub use edit::*;
pub use error::*;
pub use events::*;
pub use ids::*;
pub use limits::*;
pub use media::*;
pub use profile::*;
pub use prosody::*;
pub use stage::*;
pub use summary::*;
pub use transcript::*;
pub use units::*;

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::fmt::Debug;

    use serde::Serialize;
    use serde::de::DeserializeOwned;
    use ts_rs::TS;

    use super::typescript::codes;
    use super::{ErrorCode, RejectReason, UnsupportedReason};

    /// The string form of a code enum is the contract between Rust, TypeScript,
    /// the copy file and the analytics tables. This reads the codes from the
    /// TypeScript union and checks that serde reads and writes the same strings.
    fn assert_code_enum<T>(prefix: &str, count: usize)
    where
        T: TS + Serialize + DeserializeOwned + PartialEq + Debug,
    {
        let codes = codes::<T>(&ts_rs::Config::default());
        assert_eq!(codes.len(), count, "{codes:?}");

        let distinct: BTreeSet<&str> = codes.iter().map(String::as_str).collect();
        assert_eq!(distinct.len(), count, "a code appears twice in {codes:?}");

        for code in &codes {
            assert!(
                code.starts_with(prefix),
                "{code} does not start with {prefix}"
            );
            let rest_is_upper_snake = code
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
            assert!(rest_is_upper_snake, "{code} is not UPPER_SNAKE_CASE");

            let json = format!("\"{code}\"");
            let value: T = serde_json::from_str(&json).unwrap();
            assert_eq!(serde_json::to_string(&value).unwrap(), json);
            assert_eq!(serde_json::from_str::<T>(&json).unwrap(), value);
        }
    }

    #[test]
    fn error_code_round_trips_as_29_e_codes() {
        assert_code_enum::<ErrorCode>("E_", 29);
    }

    #[test]
    fn reject_reason_round_trips_as_14_reject_codes() {
        assert_code_enum::<RejectReason>("REJECT_", 14);
    }

    #[test]
    fn unsupported_reason_round_trips_as_11_unsupported_codes() {
        assert_code_enum::<UnsupportedReason>("UNSUPPORTED_", 11);
    }
}

/// Generates `web/src/gen/domain.ts` (v1implementation §9). The output is one
/// string with a fixed order, `\n` line endings and no timestamp.
#[cfg(test)]
mod typescript {
    use std::fmt::Write as _;
    use std::path::Path;

    use ts_rs::{Config, TS, TypeVisitor};

    use super::*;

    const HEADER: &str = "\
// Generated from crates/offcut-types by `sh scripts/gen-types.sh`. Do not edit.
// To change anything here, change the Rust source and run the script again.
";

    /// The unit and id types. TypeScript gets a branded alias for each, so a
    /// `DurMs` cannot be passed where a `TimeMs` is expected there either.
    fn branded(v: &mut impl TypeVisitor) {
        v.visit::<TimeMs>();
        v.visit::<DurMs>();
        v.visit::<Micros>();
        v.visit::<FrameIdx>();
        v.visit::<SampleCount>();
        v.visit::<Hz>();
        v.visit::<FpsMilli>();
        v.visit::<Px>();
        v.visit::<Bytes>();
        v.visit::<BitsPerSec>();
        v.visit::<Confidence>();
        v.visit::<Lufs>();
        v.visit::<Dbfs>();
        v.visit::<UnixSecs>();
        v.visit::<ExportCount>();
        v.visit::<UsdCents>();
        v.visit::<ClipId>();
        v.visit::<ExportId>();
        v.visit::<UserId>();
        v.visit::<AnonId>();
        v.visit::<EventId>();
        v.visit::<WordIdx>();
        v.visit::<SentenceIdx>();
        v.visit::<JobId>();
    }

    /// Every other type, in module order.
    fn declared(v: &mut impl TypeVisitor) {
        v.visit::<Span>();
        v.visit::<WordRange>();
        v.visit::<Rotation>();
        v.visit::<Orientation>();
        v.visit::<ContainerKind>();
        v.visit::<VideoCodec>();
        v.visit::<AudioCodec>();
        v.visit::<ProbeInfo>();
        v.visit::<VideoTrackInfo>();
        v.visit::<AudioTrackInfo>();
        v.visit::<ClipInfo>();
        v.visit::<RejectReason>();
        v.visit::<Word>();
        v.visit::<Sentence>();
        v.visit::<Unit>();
        v.visit::<Quantity>();
        v.visit::<NormalizedSpan>();
        v.visit::<Transcript>();
        v.visit::<EventKind>();
        v.visit::<ListItem>();
        v.visit::<EventParams>();
        v.visit::<DetectedEvent>();
        v.visit::<WordProsody>();
        v.visit::<Prosody>();
        v.visit::<StyleId>();
        v.visit::<CropOffset>();
        v.visit::<EditState>();
        v.visit::<Plan>();
        v.visit::<ProfileKind>();
        v.visit::<ExportProfile>();
        v.visit::<ChangeSummary>();
        v.visit::<PipelineStage>();
        v.visit::<ErrorCode>();
        v.visit::<UnsupportedReason>();
        v.visit::<FailureStage>();
    }

    struct Brands<'a>(&'a mut String, &'a Config);

    impl TypeVisitor for Brands<'_> {
        fn visit<T: TS + 'static + ?Sized>(&mut self) {
            let (name, base) = (T::name(self.1), T::inline(self.1));
            let docs = T::docs().unwrap_or_default();
            let _ = writeln!(
                self.0,
                "{docs}export type {name} = {base} & {{ readonly __unit: \"{name}\" }};"
            );
        }
    }

    struct Declarations<'a>(&'a mut String, &'a Config);

    impl TypeVisitor for Declarations<'_> {
        fn visit<T: TS + 'static + ?Sized>(&mut self) {
            let docs = T::docs().unwrap_or_default();
            let _ = writeln!(self.0, "\n{docs}export {}", T::decl(self.1));
        }
    }

    /// How a limit is written in TypeScript: a unit value carries its brand.
    trait Limit {
        fn ts(&self, cfg: &Config) -> String;
    }

    macro_rules! limit_impls {
        (units: $($unit:ty),+; plain: $($plain:ty),+) => {
            $(impl Limit for $unit {
                fn ts(&self, cfg: &Config) -> String {
                    format!("{} as {}", self.get(), <$unit>::name(cfg))
                }
            })+
            $(impl Limit for $plain {
                fn ts(&self, _: &Config) -> String {
                    self.to_string()
                }
            })+
        };
    }

    limit_impls!(units: DurMs, Bytes, Px, FpsMilli, ExportCount; plain: u32, i64, f32);

    macro_rules! limits {
        ($cfg:expr; $($name:ident),+ $(,)?) => {
            [$((stringify!($name), $name.ts($cfg))),+]
        };
    }

    fn limits(cfg: &Config) -> [(&'static str, String); 21] {
        limits![cfg;
            MAX_CLIP_DURATION, MAX_FILE_SIZE, MAX_LONG_SIDE, MAX_INPUT_FPS, INPUT_FPS_TOLERANCE,
            OUTPUT_FPS, CREATOR_WIDTH, CREATOR_HEIGHT, FREE_WIDTH, FREE_HEIGHT,
            FREE_EXPORTS_PER_MONTH, CREATOR_FAIR_USE_PER_MONTH, ENTITLEMENT_OFFLINE_TTL_SECS,
            MIN_DEVICE_MEMORY_GB, CAPABILITY_CHECK_BUDGET, DETECTOR_PRECISION_TARGET,
            PREVIEW_MAX_DRIFT, LOUDNESS_TOLERANCE_LU, ANALYTICS_RETENTION_DAYS, MIN_WORDS,
            MAX_RECENT_CLIPS,
        ]
    }

    /// The strings of a code enum, read from its TypeScript union.
    pub(super) fn codes<T: TS>(cfg: &Config) -> Vec<String> {
        let union = T::inline(cfg);
        let codes = union.split(" | ").map(|code| code.trim_matches('"'));
        codes.map(str::to_owned).collect()
    }

    fn code_array<T: TS>(out: &mut String, cfg: &Config, name: &str) {
        let _ = writeln!(out, "\nexport const {name} = [");
        for code in codes::<T>(cfg) {
            let _ = writeln!(out, "  \"{code}\",");
        }
        out.push_str("] as const;\n");
    }

    fn domain_ts() -> String {
        let cfg = Config::default();
        let mut out = String::from(HEADER);
        out.push('\n');
        branded(&mut Brands(&mut out, &cfg));
        declared(&mut Declarations(&mut out, &cfg));

        out.push_str("\nexport const LIMITS = {\n");
        for (name, value) in limits(&cfg) {
            let _ = writeln!(out, "  {name}: {value},");
        }
        out.push_str("} as const;\n");

        code_array::<ErrorCode>(&mut out, &cfg, "ERROR_CODES");
        code_array::<RejectReason>(&mut out, &cfg, "REJECT_REASONS");
        code_array::<UnsupportedReason>(&mut out, &cfg, "UNSUPPORTED_REASONS");
        without_trailing_spaces(&out)
    }

    /// `ts-rs` leaves a space at the end of some lines of a documented type.
    fn without_trailing_spaces(text: &str) -> String {
        let lines: Vec<&str> = text.lines().map(str::trim_end).collect();
        lines.join("\n") + "\n"
    }

    #[test]
    #[ignore = "writes the file named by OFFCUT_GEN_OUT; run by scripts/gen-types.sh"]
    fn write_typescript() {
        let out = std::env::var("OFFCUT_GEN_OUT").expect("set OFFCUT_GEN_OUT to the output path");
        // A relative path is resolved against the workspace root, not the crate folder.
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join(out);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, domain_ts()).unwrap();
    }

    /// The names declared with `pub struct` or `pub enum` in a source file.
    fn declared_names(source: &str) -> Vec<&str> {
        let code = source.split("#[cfg(test)]").next().unwrap();
        let after = |line: &'static str| code.split(line).skip(1);
        let names = after("\npub struct ").chain(after("\npub enum "));
        names
            .map(|rest| rest.split(|c: char| !c.is_alphanumeric()).next().unwrap())
            .collect()
    }

    #[test]
    fn typescript_declares_every_type_and_limit_once() {
        let ts = domain_ts();
        assert_eq!(ts, domain_ts(), "the output must not change between runs");
        assert!(ts.ends_with('\n') && !ts.contains('\r') && !ts.contains("bigint"));

        let sources = [
            include_str!("units.rs"),
            include_str!("ids.rs"),
            include_str!("media.rs"),
            include_str!("transcript.rs"),
            include_str!("events.rs"),
            include_str!("prosody.rs"),
            include_str!("edit.rs"),
            include_str!("profile.rs"),
            include_str!("summary.rs"),
            include_str!("stage.rs"),
            include_str!("error.rs"),
        ];
        let names: Vec<&str> = sources.iter().flat_map(|s| declared_names(s)).collect();
        assert_eq!(names.len(), 59);
        for name in names {
            let declarations = ts.matches(&format!("\nexport type {name} = ")).count();
            assert_eq!(declarations, 1, "{name} is declared {declarations} times");
        }
        assert_eq!(ts.matches("readonly __unit: ").count(), 24);

        let limit_names: Vec<&str> = include_str!("limits.rs")
            .split("\npub const ")
            .skip(1)
            .map(|rest| rest.split(':').next().unwrap())
            .collect();
        assert_eq!(limit_names.len(), 21);
        for name in limit_names {
            assert_eq!(ts.matches(&format!("\n  {name}: ")).count(), 1, "{name}");
        }
        assert!(ts.contains("\n  MAX_CLIP_DURATION: 90000 as DurMs,\n"));
        assert!(ts.contains("\n  OUTPUT_FPS: 30,\n"));
        assert!(ts.contains("\n  DETECTOR_PRECISION_TARGET: 0.9,\n"));

        let entries = |array: &str| {
            let body = ts
                .split(&format!("export const {array} = [\n"))
                .nth(1)
                .unwrap();
            body.split("] as const;").next().unwrap().lines().count()
        };
        assert_eq!(entries("ERROR_CODES"), 29);
        assert_eq!(entries("REJECT_REASONS"), 14);
        assert_eq!(entries("UNSUPPORTED_REASONS"), 11);
    }
}
