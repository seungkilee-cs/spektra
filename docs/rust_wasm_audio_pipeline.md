# Rust WASM audio pipeline overview

This document walks through the Rust spectrogram processor crate, how it is compiled to WebAssembly, and the way the React app consumes the generated bindings.

## Crate layout

The Rust project lives under `rust-audio-processor/` and exposes the WASM bindings from `src/audio_processor.rs`.

- `lib.rs` re-exports modules and exposes `SpectrogramProcessor` when compiled for native tests while forwarding the wasm-bindgen exports when targeting wasm32.
- `audio_processor.rs` owns the real processing pipeline and the wasm-bindgen wrapper types.
- `fft.rs` implements an iterative radix-2 FFT in terms of twiddle factors and butterfly stages.
- `hann_window.rs` applies Hann tap weights in place before each FFT.
- `utils.rs` provides complex number math, bit reversal utilities, and unit tests covering the primitives.

The `SpectrogramProcessor` type enforces power-of-two FFT sizes, converts audio windows into `Complex` buffers, applies the Hann window, invokes `fft`, and returns magnitudes for the first half of the spectrum. `compute_spectrogram` slices the input stream using a hop size derived from the `overlap` ratio, merges each window’s magnitudes into a flattened vector, and emits progress logs through the `console_log!` macro.

When the crate is built for `wasm32`, the inner processor is wrapped by `WasmSpectrogramProcessor` via wasm-bindgen. The exported methods are thin shims that hand the borrowed `Float32Array` over to Rust without extra copies on the Rust side. Additional helper exports such as `greet` and `multiply_array` support smoke tests from JavaScript. A `#[wasm_bindgen(start)]` function installs `console_error_panic_hook` so panics surface in the browser console.

## Build pipeline and artifacts

`_scripts/build-wasm.sh` runs `wasm-pack build --target web --release --out-dir pkg` inside `rust-audio-processor/`. The script then copies the generated loader, glue code, wasm binary, and TypeScript declaration files into `src/wasm/` so Vite can bundle them. `package.json` wires this script into the `build:wasm` step and fans it into the overall `npm run build` workflow.

The wasm-bindgen output consists of:

- `src/wasm/rust_audio_processor.js`: ESM glue module that lazily instantiates the `.wasm`, exposes `WasmSpectrogramProcessor`, and forwards helper functions.
- `src/wasm/rust_audio_processor_bg.wasm`: compiled WebAssembly binary that holds the Rust logic.
- `src/wasm/rust_audio_processor.d.ts` and `src/wasm/rust_audio_processor_bg.wasm.d.ts`: declaration files used for editor hints.
- `src/wasm/package.json`: metadata for bundlers describing the entry points and side effects.

## JavaScript integration

`src/utils/wasmAudioProcessor.js` owns runtime initialization and higher-level helpers.

- `initWasmAudio()` guards module initialization. It awaits the default `init()` export from `rust_audio_processor.js`, caches the module exports, and logs timing data. Subsequent calls reuse the resolved module.
- `processAudioWithRustFFT(audioFile, fftSize, overlap)` orchestrates the end-to-end pipeline. After ensuring the module is loaded it decodes the uploaded file through Web Audio `AudioContext`, extracts channel data, constructs `new WasmSpectrogramProcessor(fftSize)`, and calls `compute_spectrogram`. The flattened magnitudes returned from Rust are reshaped into frames, downsampled if necessary, and returned to the caller.
- `testRustConnection()` performs a cheap smoke test by calling the exported `greet` function and running `process_window` on a synthetic sine wave.

`AudioProcessorSelector.jsx` pulls in those helpers to let the user trigger processing and view simple timing metrics. `SpectrumCanvas.jsx` reuses `processAudioWithRustFFT` during automated ingestion, converts magnitudes into dB space, normalizes the values, and renders the heatmap.

The legacy JavaScript FFT implementation was removed and replaced with an empty module in `src/utils/audioProcessor.js`, ensuring all consumers flow through the wasm path.

## Data flow summary

1. User uploads an audio file in the React UI.
2. `processAudioWithRustFFT` ensures wasm is initialized and decodes audio samples with Web Audio APIs.
3. JavaScript constructs `WasmSpectrogramProcessor` and invokes `compute_spectrogram`, which transfers sample buffers to Rust via wasm-bindgen.
4. Rust applies Hann windowing, runs the FFT, and returns flattened magnitudes for each time window.
5. JavaScript reshapes, optionally downsamples, and normalizes the data before rendering in `SpectrumCanvas`.

### Data flow diagram

```mermaid
flowchart LR
    upload[User selects audio file]
    selector[React component `AudioProcessorSelector.jsx`]
    wasmInit[`initWasmAudio()` ensures WASM module is loaded]
    processor[`processAudioWithRustFFT()` decodes audio via `AudioContext`]
    wasmProcessor[`new WasmSpectrogramProcessor(fftSize)`]
    rust[`Rust SpectrogramProcessor` inside WASM]
    backToJs[Flattened magnitudes returned to JavaScript]
    reshape[Reshape and optional downsampling in `processAudioWithRustFFT()`]
    render[Render heatmap in `SpectrumCanvas.jsx`]

    upload --> selector
    selector --> wasmInit
    wasmInit --> processor
    processor --> wasmProcessor
    wasmProcessor --> rust
    rust --> backToJs
    backToJs --> reshape
    reshape --> render
```

## Testing and diagnostics

The Rust crate includes integration tests that exercise the Hann window, FFT primitives, and the spectrogram pipeline in native builds. Logging spans both console output in the browser and stdout when running tests locally. On initialization, the wasm loader reports detailed timing via `console.time`, simplifying regression analysis when audio files or FFT parameters change.
