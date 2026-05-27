#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUST_DIR="$ROOT_DIR/rust-audio-processor"
WASM_OUT_DIR="$ROOT_DIR/src/wasm"
WASM_PACK_BIN="${WASM_PACK:-wasm-pack}"
WASM_JS="$WASM_OUT_DIR/rust_audio_processor.js"
WASM_BINARY="$WASM_OUT_DIR/rust_audio_processor_bg.wasm"

has_current_checked_in_artifacts() {
  [[ -f "$WASM_JS" && -f "$WASM_BINARY" ]] || return 1

  if find "$RUST_DIR/src" "$RUST_DIR/Cargo.toml" "$RUST_DIR/Cargo.lock" -type f -newer "$WASM_BINARY" | grep -q .; then
    return 1
  fi

  return 0
}

if ! command -v "$WASM_PACK_BIN" >/dev/null 2>&1; then
  if has_current_checked_in_artifacts; then
    echo "wasm-pack not found; reusing current checked-in WASM artifacts."
    exit 0
  fi

  cat >&2 <<MSG
wasm-pack is required because Rust sources are newer than src/wasm artifacts.
Install it with:
  cargo install wasm-pack --locked
or set WASM_PACK=/path/to/wasm-pack and rerun npm run build.
MSG
  exit 127
fi

echo "Building Rust WASM module..."
cd "$RUST_DIR"
"$WASM_PACK_BIN" build --target web --release --out-dir pkg

echo "Copying WASM artifacts to React app..."
mkdir -p "$WASM_OUT_DIR"
cp pkg/*.js "$WASM_OUT_DIR/"
cp pkg/*.wasm "$WASM_OUT_DIR/"
cp pkg/*.d.ts "$WASM_OUT_DIR/" 2>/dev/null || true

echo "WASM build complete!"
ls -lh "$WASM_OUT_DIR"
