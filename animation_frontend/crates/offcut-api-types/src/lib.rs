//! API request and response types and the analytics allowlist. Definitions only.

pub mod account;
pub mod analytics;
pub mod auth;
pub mod billing;
pub mod errors;
pub mod usage;

pub use account::*;
pub use analytics::*;
pub use auth::*;
pub use billing::*;
pub use errors::*;
pub use usage::*;

/// Generates `web/src/gen/api.ts` (v1implementation §9). The output is one
/// string with a fixed order, `\n` line endings and no timestamp.
#[cfg(test)]
mod typescript {
    use std::collections::BTreeSet;
    use std::fmt::Write as _;
    use std::path::Path;

    use ts_rs::{Config, TS, TypeVisitor};

    use super::*;

    const HEADER: &str = "\
// Generated from crates/offcut-api-types by `sh scripts/gen-types.sh`. Do not edit.
// To change anything here, change the Rust source and run the script again.
";

    /// Every type of this crate that crosses the API, in module order.
    fn declared(v: &mut impl TypeVisitor) {
        v.visit::<MagicLinkRequest>();
        v.visit::<VerifyRequest>();
        v.visit::<SessionResponse>();
        v.visit::<MeResponse>();
        v.visit::<Wanted>();
        v.visit::<NotifyMeRequest>();
        v.visit::<AccountExport>();
        v.visit::<ExportedUser>();
        v.visit::<ExportedSession>();
        v.visit::<ExportedReceipt>();
        v.visit::<SubscriptionSummary>();
        v.visit::<SubscriptionStatus>();
        v.visit::<BillingInterval>();
        v.visit::<Offer>();
        v.visit::<CheckoutRequest>();
        v.visit::<UrlResponse>();
        v.visit::<UsageReceiptRequest>();
        v.visit::<EntitlementResponse>();
        v.visit::<HeroVariant>();
        v.visit::<CheckResult>();
        v.visit::<GpuVendor>();
        v.visit::<MemoryBucket>();
        v.visit::<Platform>();
        v.visit::<DurationBucket>();
        v.visit::<ClipSource>();
        v.visit::<DownloadOutcome>();
        v.visit::<AsrBackend>();
        v.visit::<ReviewActionKind>();
        v.visit::<ExportedAs>();
        v.visit::<PostExportAnswer>();
        v.visit::<PromptPlacement>();
        v.visit::<PromptAction>();
        v.visit::<SigninStep>();
        v.visit::<CheckoutStep>();
        v.visit::<AnalyticsEvent>();
        v.visit::<EventsBatch>();
        v.visit::<ApiError>();
        v.visit::<ApiErrorCode>();
    }

    struct Declarations<'a>(&'a mut String, &'a Config);

    impl TypeVisitor for Declarations<'_> {
        fn visit<T: TS + 'static + ?Sized>(&mut self) {
            let docs = T::docs().unwrap_or_default();
            let _ = writeln!(self.0, "\n{docs}export {}", T::decl(self.1));
        }
    }

    /// Collects the names this crate declares and the names its types refer to.
    /// What is referred to but not declared here comes from `./domain`.
    struct Names<'a> {
        cfg: &'a Config,
        own: BTreeSet<String>,
        used: BTreeSet<String>,
    }

    impl TypeVisitor for Names<'_> {
        fn visit<T: TS + 'static + ?Sized>(&mut self) {
            self.own.insert(T::name(self.cfg));
            let used = T::dependencies(self.cfg).into_iter().map(|d| d.ts_name);
            self.used.extend(used);
        }
    }

    fn domain_imports(cfg: &Config) -> Vec<String> {
        let mut names = Names {
            cfg,
            own: BTreeSet::new(),
            used: BTreeSet::new(),
        };
        declared(&mut names);
        names.used.difference(&names.own).cloned().collect()
    }

    fn api_ts() -> String {
        let cfg = Config::default();
        let mut out = String::from(HEADER);

        out.push_str("\nimport type {\n");
        for name in domain_imports(&cfg) {
            let _ = writeln!(out, "  {name},");
        }
        out.push_str("} from \"./domain\";\n");

        declared(&mut Declarations(&mut out, &cfg));

        out.push_str("\nexport const ANALYTICS_EVENT_DOCS = [\n");
        for doc in ANALYTICS_EVENT_DOCS {
            let name = serde_json::to_string(doc.name).unwrap();
            let description = serde_json::to_string(doc.description).unwrap();
            let _ = writeln!(out, "  {{ name: {name}, description: {description} }},");
        }
        out.push_str("] as const;\n");

        let _ = writeln!(
            out,
            "\nexport const MAX_EVENTS_PER_BATCH = {MAX_EVENTS_PER_BATCH};"
        );
        // `ts-rs` leaves a space at the end of some lines of a documented type.
        let lines: Vec<&str> = out.lines().map(str::trim_end).collect();
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
        std::fs::write(&path, api_ts()).unwrap();
    }

    /// The names declared with `pub struct` or `pub enum` in a source file,
    /// and the prop enums declared in the `prop_enums!` table of `analytics.rs`.
    fn declared_names(source: &str) -> Vec<&str> {
        let code = source.split("#[cfg(test)]").next().unwrap();
        let after = |line: &'static str| code.split(line).skip(1);
        let plain = after("\npub struct ").chain(after("\npub enum "));
        let plain = plain.map(|rest| rest.split(|c: char| !c.is_alphanumeric()).next().unwrap());

        let table = code.split("\nprop_enums! {\n").nth(1).unwrap_or_default();
        let table = table.split("\n}").next().unwrap_or_default();
        let props = table
            .lines()
            .map(|line| line.split(':').next().unwrap().trim());

        plain.chain(props).filter(|name| !name.is_empty()).collect()
    }

    #[test]
    fn typescript_declares_every_type_once() {
        let ts = api_ts();
        assert_eq!(ts, api_ts(), "the output must not change between runs");
        assert!(ts.ends_with('\n') && !ts.contains('\r') && !ts.contains("bigint"));

        let sources = [
            include_str!("auth.rs"),
            include_str!("account.rs"),
            include_str!("billing.rs"),
            include_str!("usage.rs"),
            include_str!("analytics.rs"),
            include_str!("errors.rs"),
        ];
        let names: Vec<&str> = sources.iter().flat_map(|s| declared_names(s)).collect();
        // 38 types cross the API. `EventDoc` does not: its table is written as a constant.
        assert_eq!(names.len(), 39);
        for name in names.into_iter().filter(|name| *name != "EventDoc") {
            let declarations = ts.matches(&format!("\nexport type {name} = ")).count();
            assert_eq!(declarations, 1, "{name} is declared {declarations} times");
        }

        let imports = domain_imports(&Config::default());
        let expected = [
            "AnonId",
            "ErrorCode",
            "EventKind",
            "ExportId",
            "FailureStage",
            "Orientation",
            "PipelineStage",
            "Plan",
            "RejectReason",
            "StyleId",
            "UnixSecs",
            "UnsupportedReason",
        ];
        assert_eq!(imports, expected);

        let docs = ts
            .split("export const ANALYTICS_EVENT_DOCS = [\n")
            .nth(1)
            .unwrap();
        let docs = docs.split("] as const;").next().unwrap();
        assert_eq!(docs.lines().count(), 19);
        assert!(ts.ends_with("\nexport const MAX_EVENTS_PER_BATCH = 50;\n"));
    }
}
