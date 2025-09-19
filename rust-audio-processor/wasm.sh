#!/usr/bin/env bash

# 1. Build Rust changes
cd rust-audio-processor
cargo test # Test Rust code
wasm-pack build --target web --out-dir pkg

# 2. Copy to React
cd ..
cp -r rust-audio-processor/pkg/* src/wasm/

# 3. Test in browser
npm start
# Open console and test with test files
