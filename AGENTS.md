# AGENTS.md — Spektra Codebase Guide for LLM Agents

This file provides context, conventions, and guidance for AI agents (LLMs) working in this repository. Read it fully before making any changes.

---

## Project Overview

**Spektra** is a browser-based audio spectrogram analyzer built with React and Rust/WebAssembly. Users upload an audio file; the app extracts metadata, runs FFT-based analysis via a Rust WASM module on a worker thread, and renders a spectrogram on an HTML Canvas.

**Live app:** Deployed to GitHub Pages at `/spektra/` base path.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 (JSX, hooks) |
| Build Tool | Vite 6.2 |
| Linter | ESLint 9 (flat config) |
| Audio Metadata | `music-metadata` npm package |
| Audio Processing | Rust compiled to WebAssembly (`wasm-bindgen`) |
| FFT Worker | Web Worker (`spectrogramWorker.js`) |
| GPU Rendering | WebGL 2 (`gpuSpectrogramRenderer.js`) |
| Canvas Rendering | Canvas 2D (primary spectrogram display) |
| Styling | Plain CSS modules per component |
| Testing | Vitest (unit tests in `src/__tests__/`) |

---

## Repository Layout

```
/
├── AGENTS.md                     ← This file
├── index.html                    ← Vite HTML entry point
├── vite.config.js                ← Vite config (base: /spektra/, WASM plugin)
├── eslint.config.js              ← ESLint flat config
├── package.json                  ← Scripts, dependencies
├── _scripts/
│   └── build-wasm.sh             ← Compiles Rust → WASM (run before JS build)
│
├── rust-audio-processor/         ← Rust crate (compiled to WASM)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                ← wasm-bindgen exports
│       ├── audio_processor.rs    ← SpectrogramProcessor, windowed chunking
│       ├── fft.rs                ← Cooley-Tukey radix-2 FFT (O(n log n))
│       ├── hann_window.rs        ← Hann window coefficients
│       └── utils.rs              ← Complex number type, math helpers
│
├── src/
│   ├── main.jsx                  ← React entry (no StrictMode)
│   ├── App.jsx                   ← Root component, top-level state
│   │
│   ├── components/
│   │   ├── FileUpload.jsx        ← Drag-and-drop file picker
│   │   ├── SpectrumCanvas.jsx    ← Main visualization (Canvas 2D + processing)
│   │   ├── AudioMetadataHeader.jsx ← Collapsible metadata panel
│   │   ├── AudioMetadataDisplay.jsx ← Simple metadata list (not used in App)
│   │   └── AudioProcessorSelector.jsx ← Dev/test control panel (not in App)
│   │
│   ├── utils/
│   │   ├── audioContextManager.js ← Singleton AudioContext + autoplay policy
│   │   ├── wasmAudioProcessor.js  ← Main audio pipeline orchestrator
│   │   ├── formatMetadata.js      ← music-metadata parsing + formatting
│   │   ├── gpuSpectrogramRenderer.js ← WebGL2 spectrogram renderer
│   │   ├── debug.js               ← Conditional debug logging (DEBUG flag)
│   │   ├── profiler.js            ← Performance marks/measures (opt-in)
│   │   └── audioProcessor.js      ← Stub (legacy JS FFT removed)
│   │
│   ├── workers/
│   │   └── spectrogramWorker.js  ← Web Worker: runs WASM FFT in parallel
│   │
│   ├── wasm/
│   │   ├── rust_audio_processor.js      ← wasm-bindgen JS bindings (auto-generated)
│   │   ├── rust_audio_processor_bg.wasm ← Compiled WASM binary
│   │   └── rust_audio_processor.d.ts    ← TypeScript declarations (auto-generated)
│   │
│   ├── styles/
│   │   ├── SpectrumCanvas.css
│   │   ├── FileUpload.css
│   │   └── AudioMetadataDisplay.css
│   │
│   └── __tests__/
│       └── utils/
│           ├── audioProcess.test.js         ← Skipped (legacy JS FFT)
│           └── fastFourierTransform.test.js ← Legacy standalone test
│
└── src/utils/deprecated/         ← Old JS implementations, do not import
```

---

## Data Flow (End-to-End)

```
User uploads file
      │
      ▼
App.jsx → extractAudioMetadata()         [music-metadata: bitrate, codec, etc.]
      │
      ▼
SpectrumCanvas.jsx → processAudioFile()
      │
      ├─ ensureAudioContext()             [audioContextManager.js]
      │
      └─ processAudioWithRustFFT()        [wasmAudioProcessor.js]
            │
            ├─ Decode audio buffer        [AudioContext.decodeAudioData()]
            │
            ├─ Chunk audio into windows
            │
            └─ processViaWorker()         [spectrogramWorker.js  ←→  WASM]
                  │
                  └─ WasmSpectrogramProcessor.process_windows()
                        │
                        └─ FFT + Hann window (Rust/WASM)
      │
      ▼
SpectrumCanvas.jsx → renderSpectrogramFromData()
      │
      └─ Canvas 2D: color-mapped spectrogram + axis labels + grid
```

**Key data structures:**
- `SpectrogramBatch` — flat `Float32Array` of magnitude values, `num_windows`, `freq_bins` (returned from WASM)
- Normalized spectrogram — 2D array `[frames][bins]` in 0–1 range, converted from dB
- Metadata object — `{ bitrate, sampleRate, bitsPerSample, channels, codec, lossless, duration, ... }`

---

## NPM Scripts

```bash
npm run dev          # Start Vite dev server (hot reload)
npm run build        # Production build (Vite)
npm run preview      # Preview production build locally
npm run lint         # ESLint (flat config, react-hooks + react-refresh plugins)
npm run test         # Vitest unit tests
```

> **Note:** If you change Rust source files, you must recompile WASM first:
> ```bash
> bash _scripts/build-wasm.sh
> ```
> This runs `wasm-pack build` targeting `web` with `--release` and outputs to `src/wasm/`.

---

## Key Conventions & Patterns

### React
- **No StrictMode** — intentionally removed (see `main.jsx`). Do not add it back without understanding implications for audio context lifecycle.
- **Hooks** — use `useState`, `useRef`, `useEffect`, `useCallback`, `useId`. Avoid class components.
- **Memoization** — use `useCallback` on handlers passed to Canvas effects to prevent re-renders.
- **Accessibility** — components use `aria-expanded`, `aria-controls`, `role`, and keyboard handlers. Maintain this for any UI changes.

### State Management
- All top-level state lives in `App.jsx` (`file`, `metadata`, `isProcessing`).
- No external state library (no Redux, no Zustand). Keep state co-located.

### Debug & Profiling
- Use `debugLog()` / `debugError()` from `src/utils/debug.js` instead of bare `console.log`.
- Enable debug output by setting `DEBUG = true` in `debug.js` (or checking the flag).
- Enable profiling by setting `window.SPEKTRA_PROFILING = true` in the browser console or via localStorage key `spektra_profiling`. Use `profileMark()` / `profileMeasure()` / `profileFlush()` from `profiler.js`.

### Styling
- Each component has a corresponding CSS file in `src/styles/`.
- Styles use CSS custom properties (e.g., `--badge-color`) for dynamic values.
- `FileUpload.css` uses 3D transforms and CSS animations — do not simplify without testing visually.
- `SpectrumCanvas.css` uses a grid layout with glassmorphism effects.

### Supported Audio Formats
The app accepts these formats (validated in `App.jsx`):
`audio/mpeg`, `audio/wav`, `audio/flac`, `audio/ogg`, `audio/aac`, `audio/mp4`, `audio/x-m4a`, `audio/aiff`, `audio/x-aiff`, `audio/opus`, `audio/webm`

ALAC (Apple Lossless inside `.m4a`) is explicitly blocked.

---

## Rust / WASM Module

### When to modify Rust code
Only touch files in `rust-audio-processor/src/` when changing the FFT algorithm, windowing function, or the WASM-exported API.

### Exported WASM API (`lib.rs` → `wasm-bindgen`)
```rust
greet(name: &str) -> String            // smoke-test
multiply_array(numbers, factor) -> Vec<f32>
WasmSpectrogramProcessor::new(fft_size: usize)
  .process_window(audio_data: &[f32]) -> Vec<f32>
  .compute_spectrogram(audio_data: &[f32], overlap: f32) -> Vec<f32>
  .process_windows(audio_data, overlap, time_stride, freq_stride) -> SpectrogramBatch
SpectrogramBatch { data: Vec<f32>, num_windows: usize, freq_bins: usize }
```

### Rust code conventions
- FFT uses Cooley-Tukey radix-2 iterative algorithm with twiddle factor caching.
- Hann window coefficients are precomputed in `hann_window.rs`.
- Complex arithmetic lives in `utils.rs` (`Complex` struct).
- 22+ unit tests live inside each Rust file (`#[cfg(test)]` blocks).

### Build output
`build-wasm.sh` writes three files to `src/wasm/`:
- `rust_audio_processor.js` — JS glue (auto-generated, **do not hand-edit**)
- `rust_audio_processor_bg.wasm` — binary (auto-generated, **do not hand-edit**)
- `rust_audio_processor_bg.wasm.d.ts` — declarations (auto-generated)

---

## Worker Architecture

`spectrogramWorker.js` runs in a separate thread:
- Lazily initializes the WASM module once.
- Caches `WasmSpectrogramProcessor` instances per FFT size.
- Receives audio chunks via `postMessage`, transfers results back using transferable `ArrayBuffer`s.
- Profiling is optional; timings are included in the response only when requested.

When adding new heavy computation, add it to the worker (not the main thread).

---

## Spectrogram Rendering

`SpectrumCanvas.jsx` uses Canvas 2D with:
- **Spek color map**: 6-stop gradient `blue → cyan → green → yellow → orange → white`
- **Progressive rendering**: chunked via `requestAnimationFrame` + `requestIdleCallback` to avoid blocking the main thread
- **Axes**: Time (MM:SS), Frequency (Hz/kHz), Amplitude (dB, –120 to 0)
- **Downsampling**: If spectrogram exceeds 2000 frames × 256 freq bins, it is downsampled before rendering
- **Responsive sizing**: min 280px / max 1200px width; aspect ratio 0.75 (mobile) / 0.55 (desktop)

`gpuSpectrogramRenderer.js` offers a WebGL2 alternative with a 7-stop Spek-inspired palette. It is available but not currently wired into the main render path.

---

## Testing

```bash
npm run test        # Run all Vitest tests
```

- Test files live in `src/__tests__/`.
- `audioProcess.test.js` — all tests are skipped (`describe.skip`); legacy JS FFT was removed.
- `fastFourierTransform.test.js` — legacy standalone script; not a proper Vitest suite.
- Rust tests: run with `cargo test` inside `rust-audio-processor/`.

When adding new utilities, add corresponding Vitest tests in `src/__tests__/utils/`.

---

## Files to Never Edit Manually

| File | Reason |
|---|---|
| `src/wasm/rust_audio_processor.js` | Auto-generated by wasm-bindgen |
| `src/wasm/rust_audio_processor_bg.wasm` | Compiled binary |
| `src/wasm/rust_audio_processor_bg.wasm.d.ts` | Auto-generated declarations |
| `src/wasm/rust_audio_processor.d.ts` | Auto-generated declarations |

---

## Files to Treat as Deprecated

| File | Status |
|---|---|
| `src/utils/audioProcessor.js` | Stub — old JS FFT removed, do not import |
| `src/utils/deprecated/` | All files here are legacy; do not import |
| `src/__tests__/utils/audioProcess.test.js` | Skipped — tests for removed code |
| `src/__tests__/utils/fastFourierTransform.test.js` | Legacy standalone script |

---

## Components Not Currently Used in App

| Component | Notes |
|---|---|
| `AudioMetadataDisplay.jsx` | Simpler alternative to `AudioMetadataHeader`; not rendered by `App` |
| `AudioProcessorSelector.jsx` | Dev/testing panel; not rendered by `App` |

---

## Common Agent Tasks & Where to Look

| Task | Files to focus on |
|---|---|
| Change FFT parameters (size, overlap) | `wasmAudioProcessor.js`, `SpectrumCanvas.jsx` |
| Change spectrogram color palette | `SpectrumCanvas.jsx` (`spekColorMap`), `gpuSpectrogramRenderer.js` |
| Add a new audio format | `App.jsx` (format whitelist + UI), `FileUpload.jsx` (badge config) |
| Change metadata fields displayed | `formatMetadata.js`, `AudioMetadataHeader.jsx` |
| Improve WASM FFT algorithm | `rust-audio-processor/src/fft.rs`, rebuild WASM |
| Add new worker computation | `spectrogramWorker.js`, `wasmAudioProcessor.js` |
| Fix audio context autoplay issues | `audioContextManager.js` |
| Add performance measurements | `profiler.js` (`profileMark`, `profileMeasure`) |
| Style changes | `src/styles/<ComponentName>.css` |
| Add unit tests | `src/__tests__/utils/` (Vitest) |

---

## Environment & Browser Compatibility

- Requires **WebAssembly** support (all modern browsers).
- Requires **Web Workers** for parallel FFT processing.
- Requires **AudioContext** (Web Audio API) — subject to autoplay policy; `audioContextManager.js` handles unlocking via user gesture.
- **WebGL2** is used by `gpuSpectrogramRenderer.js` with a WebGL1 fallback.
- **SIMD** optimizations are detected at runtime and logged when available.
- Safari compatibility is handled explicitly in the WASM bindings (`MAX_SAFARI_DECODE_BYTES`).

---

## Deployment

- `vite.config.js` sets `base: '/spektra/'` for GitHub Pages.
- Production build output goes to `dist/`.
- `git-deploy.sh` handles deployment to the `gh-pages` branch.
- Do not change the `base` path without updating all relative asset references.
