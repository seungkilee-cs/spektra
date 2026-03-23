# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Spektra** is a 100% client-side browser-based audio spectrum analyzer ("Spek for Web"). Users drag-and-drop audio files (MP3, M4A, FLAC, WAV, OGG, AIFF, WebM, Opus) and see a spectrogram rendered via HTML Canvas. All processing happens in-browser — no server involved.

## Commands

```bash
# Development
npm run dev           # Start Vite dev server

# Build
npm run build         # Build WASM then bundle frontend (production)
npm run build:wasm    # Compile Rust → WASM only (copies to src/wasm/)

# Test & Lint
npm test              # Run tests with Vitest
npm run lint          # ESLint (src/**/*.{js,jsx})

# Deploy
npm run deploy        # Build + deploy to GitHub Pages (gh-pages)

# Cleanup
npm run clean         # Remove dist/, Rust target/, pkg/
npm run clean:wasm    # Remove compiled WASM artifacts from src/wasm/
```

To rebuild WASM after changing Rust code, run `npm run build:wasm` before `npm run dev`. Requires `wasm-pack` installed (`cargo install wasm-pack`).

## Architecture

The processing pipeline has four stages:

1. **File Upload & Decode** — `FileUpload.jsx` → `App.jsx` validates file type, uses `music-metadata` for format info, and `Web Audio API` (`audioContext.decodeAudioData`) to decode the file to raw PCM.

2. **FFT Processing (Web Worker + WASM)** — `wasmAudioProcessor.js` sends PCM chunks to `spectrogramWorker.js` (Web Worker). The worker calls the Rust/WASM `WasmSpectrogramProcessor` which applies Hann windowing and runs a radix-2 Cooley-Tukey FFT. Returns a flattened `Float32Array` of magnitudes.

3. **Post-Processing** — Back on the main thread, `wasmAudioProcessor.js` reshapes the flat array into 2D `[numFrames][numFreqs]`, downsamples to ≤2000 frames / ≤256 bins, converts to dB scale (`20×log₁₀(mag)`, clamped to `[-120, 0]`), and normalizes to `[0, 1]`.

4. **Canvas Rendering** — `SpectrumCanvas.jsx` progressively draws chunks of the spectrogram across animation frames using a Spek-inspired color map (blue→cyan→green→yellow→red→white). Draws frequency (Hz) and time axes.

### Key Files

| File | Role |
|------|------|
| `src/App.jsx` | Top-level state, file validation, metadata extraction |
| `src/components/SpectrumCanvas.jsx` | Audio processing orchestration + canvas rendering |
| `src/utils/wasmAudioProcessor.js` | WASM init, worker communication, chunking, post-processing |
| `src/utils/audioContextManager.js` | Web Audio API context lifecycle (autoplay policy handling) |
| `src/workers/spectrogramWorker.js` | Web Worker: loads WASM, runs FFT per chunk |
| `src/wasm/` | Compiled WASM artifacts (generated, do not edit) |
| `rust-audio-processor/src/fft.rs` | Custom radix-2 FFT implementation |
| `rust-audio-processor/src/audio_processor.rs` | WASM bindings (`WasmSpectrogramProcessor`) |

### Rust/WASM Module

The Rust code lives in `rust-audio-processor/` and compiles to `src/wasm/`. The `wasm-pack build --target web --release` command (wrapped by `_scripts/build-wasm.sh`) generates the JS bindings and `.wasm` binary. The main entry point exposed to JS is `WasmSpectrogramProcessor::process_windows()`.

### Vite Config Note

The base path is `/spektra/` (for GitHub Pages). If running locally for non-GH-Pages use, be aware asset paths are prefixed with this.

## State & Singletons

- WASM module (`wasmModule`) and worker instance (`workerInstance`) are module-level singletons in `wasmAudioProcessor.js` — initialized once per page load.
- `SpectrumCanvas.jsx` uses refs (`spectrogramDataRef`, `audioMetadataRef`) to cache processed data without triggering re-renders.

## Supported/Unsupported Formats

ALAC (Apple Lossless in `.m4a`) is explicitly rejected with a warning because browsers cannot decode it via Web Audio API. AAC `.m4a` files are supported. This distinction is made in the file validation logic in `App.jsx`.
