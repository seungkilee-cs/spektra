#!/bin/bash
set -e

echo "Building Rust WASM module..."
cd rust-audio-processor

# note: clean previous builds for CI/CD, keep for dev
# rm -rf target/ pkg/

# Build optimized WASM
wasm-pack build --target web --release --out-dir pkg

echo "Copying WASM artifacts to React app..."
mkdir -p ../src/wasm
cp pkg/*.js ../src/wasm/
cp pkg/*.wasm ../src/wasm/
cp pkg/*.d.ts ../src/wasm/ 2>/dev/null || true

echo "🧹 Cleaning up temporary files..."
# for dev keep the pkg/ - for debugging and manually remove
# rm -rf pkg/

echo "WASM build complete!"
echo "WASM files:"
ls -lh ../src/wasm/
