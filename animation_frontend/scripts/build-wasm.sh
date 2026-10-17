#!/usr/bin/env bash
# Builds crates/animato-wasm into src/wasm/pkg (committed, so the app builds
# without Rust). Needs: rustup, cargo, node. Installs the wasm32 target and the
# matching wasm-bindgen CLI on first run, then shrinks the module with
# wasm-opt -Oz from the pinned binaryen npm package (fetched by npx).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATES="$ROOT/crates"
OUT="$ROOT/src/wasm/pkg"
BINDGEN_VERSION="0.2.129"
BINARYEN_VERSION="132.0.0"

rustup target add wasm32-unknown-unknown >/dev/null
if ! command -v wasm-bindgen >/dev/null || [[ "$(wasm-bindgen --version)" != *"$BINDGEN_VERSION"* ]]; then
  cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked
fi

cargo build --manifest-path "$CRATES/Cargo.toml" -p animato-wasm --release --target wasm32-unknown-unknown
rm -rf "$OUT"
wasm-bindgen --target web --out-dir "$OUT" --out-name animato_wasm \
  "$CRATES/target/wasm32-unknown-unknown/release/animato_wasm.wasm"
rm -f "$OUT/.gitignore"
# The features rustc enables by default for wasm32-unknown-unknown; wasm-opt
# may use these and no others.
npx --yes --package="binaryen@$BINARYEN_VERSION" -- wasm-opt -Oz \
  --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
  --enable-nontrapping-float-to-int --enable-reference-types --enable-multivalue \
  "$OUT/animato_wasm_bg.wasm" -o "$OUT/animato_wasm_bg.wasm"
echo "Built $(du -h "$OUT/animato_wasm_bg.wasm" | cut -f1) -> $OUT"
