#!/bin/bash
set -e

echo "🦀 Building Rust WASM module..."
cd rust-audio-processor
wasm-pack build --target web --out-dir pkg

echo "📦 Copying WASM artifacts to React app..."
cp pkg/*.js ../src/wasm/
cp pkg/*.wasm ../src/wasm/
cp pkg/*.ts ../src/wasm/ 2>/dev/null || true

echo "✅ WASM build complete!"
