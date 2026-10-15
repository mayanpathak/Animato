//! Compile-fail tests: code that must not compile.
//!
//! Each `tests/ui/*.rs` file has a `.stderr` file beside it holding the compiler
//! output it must produce. That output is tied to the compiler pinned in
//! `rust-toolchain.toml`. When the toolchain changes, regenerate it and read the
//! result before committing: it must show type mismatches, not a missing import.
//!
//! ```sh
//! TRYBUILD=overwrite cargo test -p offcut-types --test ui
//! ```

#[test]
fn ui() {
    trybuild::TestCases::new().compile_fail("tests/ui/*.rs");
}
