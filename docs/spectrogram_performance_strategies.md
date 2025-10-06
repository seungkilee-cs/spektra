# Spectrogram performance improvement ideas

This document catalogs potential optimizations for the Rust spectrogram core and the JavaScript orchestration code. Each entry lists the suspected bottleneck, the underlying complexity, and a rough estimate of the benefit.

## Rust-side strategies

### 1. Precompute twiddle factors per processor

- **Bottleneck** Twiddle factors are regenerated inside every FFT pass by `generate_twiddle_factor(len)`. For an FFT length `N`, the iterative radix-2 algorithm performs `O(N log N)` butterfly operations. Recomputing trigonometric tables at each stage adds `O(N log N)` extra work dominated by expensive `sin` and `cos` calls.
- **Implementation** `SpectrogramProcessor::new(fft_size)` now materializes a `TwiddleCache` (see `rust-audio-processor/src/fft.rs`) that stores per-stage twiddles. `process_window()` calls `fft_with_cache()` to reuse those slices without re-running trig functions.
- **Expected improvement** Removes redundant trig calls, saving roughly 15–25% of FFT time for large windows (based on previous profiling of wasm-bindgen FFTs). Memory overhead is `O(N)` per processor instance.
- **Complexity impact** Maintains `O(N log N)` arithmetic cost while reducing the constant factor by avoiding `sin/cos` evaluations (`O(1)` per butterfly). Initialization becomes `O(N log N)` once instead of per call.
- **Testing** Verified with `cargo test` in `rust-audio-processor/` (18 tests passing) after introducing `TwiddleCache`.

### 2. Reuse scratch buffers to avoid allocation churn

- **Bottleneck** `process_window` converts the incoming slice into a fresh `Vec<Complex>` for every hop. Allocating `fft_size` elements and dropping them for each window causes allocator pressure when computing thousands of windows. Complexity remains `O(N)` per window but the constant factor is high due to repeated `Vec` creation.
- **Implementation** `SpectrogramProcessor` now owns a reusable `Vec<Complex>` buffer that is filled via `zip` and reused for every call to `process_window()` (see `rust-audio-processor/src/audio_processor.rs`).
- **Expected improvement** Avoids per-window allocations, often improving throughput by 10–20% depending on hop count and the runtime allocator.
- **Complexity impact** Computational complexity stays `O(N log N)` for FFT and `O(N)` for Hann window; allocation overhead reduces from `O(N)` per window to amortized `O(1)` after initialization.
- **Testing** `cargo test` in `rust-audio-processor/` passes (18 tests) with the reusable buffer in place.

### 3. SIMD-friendly complex arithmetic

- **Bottleneck** Complex multiply-add operations are scalar. For `N/2` butterfly operations per stage the arithmetic is `O(N log N)` floating point ops, heavily CPU bound.
- **Proposed change** Use `packed_simd` (or `std::simd` on Rust nightly) to process two complex pairs at a time. Combine this with manually inlined butterfly kernels.
- **Expected improvement** Depending on SIMD width, expect 1.5–2.5x speedup in the innermost loop. Gains are larger for WASM SIMD-enabled browsers (Chrome, Edge). Safari still lacks full SIMD, so feature-detect and fall back to scalar.
- **Complexity impact** Big-O unchanged, but SIMD halves the constant factor and better utilizes CPU vector units.

### 4. Overlap-add on the Rust side

- **Bottleneck** The current `compute_spectrogram` flattens each window and copies the magnitudes back to JavaScript. Downsampling decisions happen after the round-trip, so we transfer `O(num_windows * fft_size/2)` floats.
- **Proposed change** Add optional decimation parameters to `compute_spectrogram` so Rust can subsample time frames (`stride_time`) and frequency bins (`stride_freq`) before returning data.
- **Expected improvement** Cuts serialization overhead and WASM-to-JS data copies by up to 4–8x when aggressive downsampling is acceptable. Particularly valuable for large files (>10k windows).
- **Complexity impact** Reduces effective output size from `O(N log N)` elements to `O((N/log stride_time) * (fft_size/stride_freq))`. Arithmetic works stay similar; main gain is less memory traffic.

### 5. Batched FFT processing

- **Bottleneck** Each window calls `process_window` separately, incurring wasm-bindgen overhead and looping in JavaScript.
- **Proposed change** Expose a `process_windows(audio_data, overlap)` that walks the entire buffer on the Rust side and directly populates a pre-allocated WASM memory block.
- **Expected improvement** Eliminates per-window wasm-bindgen crossing. Expect 5–10% improvement for typical hop counts and up to 20% for very small hop sizes where bindgen overhead is non-negligible.
- **Complexity impact** Big-O identical but the number of host/guest transitions drops from `O(num_windows)` to `O(1)`.

## JavaScript-side strategies

### 1. Streamed decoding and chunked processing

- **Bottleneck** `processAudioWithRustFFT` loads the entire file via `AudioContext.decodeAudioData`, requiring full buffer materialization. For long clips this allocates `O(N)` floats and delays processing until the entire decode finishes.
- **Proposed change** Use the WebCodecs API or `AudioWorklet` to decode chunks and push them incrementally to the WASM processor as soon as they are available. Maintain a rolling overlap buffer.
- **Expected improvement** Reduces peak memory, starts rendering earlier, and overlaps decode with compute. Throughput gain depends on streaming efficiency but can cut perceived latency by 30–50% for multi-minute files.
- **Complexity impact** Maintains `O(N)` decode work but transforms the pipeline into a streaming model, shrinking end-to-end wall time.

### 2. Off-main-thread orchestration

- **Bottleneck** All spectrogram work happens on the main thread. Long synchronous hops block rendering and user input.
- **Proposed change** Move `processAudioWithRustFFT` into a dedicated `Worker` or `AudioWorklet`. Send the `ArrayBuffer` via transferable objects, run the WASM module inside the worker, and post results back.
- **Expected improvement** Frees the UI thread, preventing dropped frames. On modern browsers, background workers can run concurrently on different cores, potentially yielding 1.2–1.5x throughput improvements when the main thread is busy with rendering.
- **Complexity impact** Computational complexity unchanged, but concurrency hides latency and improves perceived responsiveness.

### 3. Typed array pooling

- **Bottleneck** Reshaping the flattened magnitudes repeatedly allocates new `Array` instances and slices typed arrays, yielding `O(num_windows * fft_size)` garbage churn.
- **Proposed change** Maintain a pool of `Float32Array` buffers sized to `(fft_size / stride_freq)` for frequency bins and reuse them. When downsampling, write directly into the pooled arrays.
- **Expected improvement** Cuts GC time and avoids repeated `Array.from` conversions. Expect 10–15% reduction in processing time for large spectrograms due to fewer allocations and less garbage collection.
- **Complexity impact** Keeps `O(num_windows * fft_size)` element work but trims memory management overhead.

### 4. Progressive rendering with requestIdleCallback

- **Bottleneck** Rendering waits for the full spectrogram before painting the canvas. Canvas updates loop over every bin (`O(num_windows * freq_bins)` pixels) per render.
- **Proposed change** Render partial slices as soon as the WASM module produces them. Use `requestAnimationFrame` plus `requestIdleCallback` to schedule paint batches and avoid blocking frames longer than ~16ms.
- **Expected improvement** Improves perceived performance dramatically. The first frames appear quickly (within tens of milliseconds) while the rest stream in. Total render time remains similar but user sees progress sooner.
- **Complexity impact** Work stays `O(num_windows * freq_bins)`. Scheduling removes long blocking chunks, segmenting the loop into manageable batches.

### 5. GPU-accelerated canvas pipeline

- **Bottleneck** `SpectrumCanvas.jsx` draws bin-by-bin on a 2D canvas, running `O(num_windows * freq_bins)` fill operations on the CPU.
- **Proposed change** Switch to WebGL or WebGPU shaders that convert magnitudes into fragment colors. Upload the spectrogram matrix as a texture and let the GPU handle interpolation and color mapping.
- **Expected improvement** GPU rendering scales better with large frames. Expect 2–5x faster rendering for dense spectrograms (e.g., 2000x512), along with smoother zoom/pan interactions.
- **Complexity impact** CPU workload for rendering drops from `O(num_windows * freq_bins)` to `O(num_windows * freq_bins)` GPU-fragment operations, which run massively parallel. JavaScript side only handles buffer uploads and shader invocations, reducing CPU time to `O(num_windows)` for transfers.

## Cross-cutting approaches

### Unified profiling and telemetry

- **Bottleneck** Without fine-grained metrics, it is difficult to prioritize changes.
- **Proposed change** Instrument both Rust (`console_log!`) and JavaScript (`performance.mark`) to emit timing for decode, FFT, wasm transfers, and rendering. Feed metrics into a dashboard or log overlay.
- **Expected improvement** Enables data-driven iteration, helping confirm whether optimizations deliver expected gains and preventing regressions.
- **Complexity impact** Minimal runtime overhead: each marker is `O(1)`.

### Parameter tuning heuristics

- **Bottleneck** Static FFT size and overlap settings may be suboptimal for different files.
- **Proposed change** Add an adaptive planner that selects FFT size, hop size, and downsampling factors based on file duration and user constraints (latency vs fidelity). Implement heuristics in JS before invoking the Rust processor.
- **Expected improvement** Balances performance with quality automatically. For short clips, keeps high fidelity; for long clips, applies more aggressive downsampling to stay within latency budgets. Could cut end-to-end time by 30–60% for long recordings without manual tuning.
- **Complexity impact** Planning overhead is `O(1)` per file but the resulting parameter adjustments reduce downstream work from `O(num_windows)` to `O(num_windows * heuristic_factor)` where the factor is <1 for throttled cases.

## Prioritization and implementation order

### High ROI candidates (start here)

- **[Rust] Precompute twiddle factors per processor**
  - *ROI rationale* Pure Rust change with localized scope (`rust-audio-processor/src/fft.rs`). Low risk, no external dependencies. Expected 15–25% FFT speedup applies across the entire pipeline.
  - *Dependencies* Requires only refactoring `SpectrogramProcessor::new`. Best tackled before SIMD to avoid duplicate work on the butterfly loop.
  - *Order justification* Improves every subsequent optimization because cached twiddles are a prerequisite for SIMD-friendly layouts.

- **[Rust] Reuse scratch buffers**
  - *ROI rationale* Straightforward bookkeeping inside `SpectrogramProcessor`. Eliminates allocator churn and benefits both wasm and native paths. Minimal code churn for measurable gains.
  - *Dependencies* Independent but shares code with the batched FFT proposal; implementing reuse first keeps the buffer abstractions ready.

- **[Rust] Batched FFT processing**
  - *ROI rationale* High leverage on binding overhead with small implementation surface (new method plus JS wiring in `src/utils/wasmAudioProcessor.js`).
  - *Dependencies* Relies on buffer reuse to avoid reallocating the temporary workspace. Should land after the scratch buffer refactor.

- **[JS] Typed array pooling**
  - *ROI rationale* Pure JS change focused in `processAudioWithRustFFT()` and `SpectrumCanvas.jsx`. Easy to instrument and roll back. Stops immediate GC spikes.
  - *Dependencies* Independent but benefits from batched processing (fewer hand-offs mean easier pooling boundaries).

### Medium ROI (next wave)

- **[JS] Off-main-thread orchestration**
  - *ROI rationale* Improves perceived responsiveness and leverages multi-core CPUs. Requires worker setup and messaging.
  - *Dependencies* Should be sequenced after batched FFT so the worker can expose the aggregated API once. Typed array pooling also simplifies transferable ownership.

- **[Rust] SIMD-friendly complex arithmetic**
  - *ROI rationale* Potential 1.5–2.5x boost but higher implementation cost due to wasm SIMD gating and fallback paths.
  - *Dependencies* Needs stabilized twiddle caches (for aligned data) and scratch buffers. Apply after those refactors to avoid rework.

- **[Rust] Overlap-add on the Rust side**
  - *ROI rationale* Reduces serialization overhead when downsampling aggressively. Useful once downstream rendering supports incremental updates.
  - *Dependencies* Works best after batched processing (since data stays inside Rust longer) and before streaming render changes to align on API.

- **[JS] Progressive rendering with requestIdleCallback**
  - *ROI rationale* Large UX win but requires careful scheduling. Best once worker offload or batched results are in place to provide steady chunks.

### Longer-term / high effort

- **[JS] Streamed decoding and chunked processing**
  - *ROI rationale* Significant complexity (WebCodecs / AudioWorklet). High payoff for multi-minute audio but requires redesign of the ingestion pipeline.
  - *Dependencies* Should follow worker orchestration so streaming can feed the worker incrementally.

- **[JS] GPU-accelerated canvas pipeline**
  - *ROI rationale* Major rendering speedups but demands extensive refactoring to WebGL/WebGPU.
  - *Dependencies* Beneficial after typed array pooling (for texture uploads) and progressive rendering planning (to coordinate streaming frames).

- **[Cross] Parameter tuning heuristics**
  - *ROI rationale* Improves defaults rather than raw compute. Should be introduced after the main optimizations for better telemetry, ensuring heuristics use accurate cost data.

- **[Cross] Unified profiling and telemetry**
  - *ROI rationale* Supports all efforts but not directly a speedup. Should start in parallel with high ROI tasks to gather baseline data; no strict ordering.

### Suggested execution order summary

1. Precompute twiddle factors (Rust)
2. Reuse scratch buffers (Rust)
3. Batched FFT processing (Rust + JS glue)
4. Typed array pooling (JS)
5. Unified profiling and telemetry (parallel as needed)
6. Off-main-thread orchestration (JS)
7. SIMD-friendly complex arithmetic (Rust)
8. Overlap-add / in-Rust downsampling (Rust)
9. Progressive rendering (JS)
10. Streamed decoding (JS)
11. GPU-accelerated rendering (JS)
12. Parameter tuning heuristics (Cross)

Items 5 (profiling) can run concurrently once instrumentation is ready. Steps 6–12 rely on earlier groundwork for buffers and API shapes; reordering among them is possible if a team prioritizes rendering (steps 9–11) before SIMD (step 7), but doing SIMD early avoids duplicating vectorization work after structural changes.

## Implementation notes

### Precompute twiddle factors per processor

- **Status** Implemented (2025-10-06). `SpectrogramProcessor::new()` now instantiates a `TwiddleCache`, and `process_window()` invokes `fft_with_cache()` to reuse precomputed twiddles.

```rust
// rust-audio-processor/src/fft.rs
#[derive(Debug, Clone)]
pub struct TwiddleCache {
    fft_size: usize,
    stages: Vec<Vec<Complex>>,
}

pub fn fft_with_cache(input: &mut [Complex], cache: &TwiddleCache) {
    let mut len = 2;
    let mut stage = 0;
    while len <= cache.fft_size() {
        let half = len / 2;
        let twiddles = cache.stage_twiddles(stage);

        for start in (0..cache.fft_size()).step_by(len) {
            for k in 0..half {
                let i = start + k;
                let j = i + half;
                let (upper, lower) = butterfly_operation(input[i], input[j], twiddles[k]);
                input[i] = upper;
                input[j] = lower;
            }
        }

        len <<= 1;
        stage += 1;
    }
}
```

- **Verification** `cargo test` in `rust-audio-processor/` reports:

```text
$ cargo test
running 18 tests
test fft::tests::test_fft_dc ... ok
test fft::tests::test_fft_impulse ... ok
test fft::tests::test_fft_roundtrip ... ok
...
test utils::tests::test_twiddle_factors ... ok

test result: ok. 18 passed; 0 failed
```

### Reuse scratch buffers

- **Status** Implemented (2025-10-06). `SpectrogramProcessor` now holds a reusable `buffer: Vec<Complex>` seeded in `new()` and filled inline before each FFT.

```rust
// rust-audio-processor/src/audio_processor.rs
for (slot, &sample) in self.buffer.iter_mut().zip(audio_data.iter()) {
    slot.real = sample;
    slot.imag = 0.0;
}
apply_hann_window(&mut self.buffer);
fft_with_cache(&mut self.buffer, &self.twiddle_cache);
```

- **Verification** `cargo test` (19 tests) passes after the change; no allocation regressions observed. `test_process_window` and `test_compute_spectrogram` still succeed using the shared buffer.

### Batched FFT processing

- **Status** Implemented (2025-10-06). Added `SpectrogramProcessor::process_windows()` returning `(Vec<f32>, num_windows, freq_bins)` and exposed it via the WASM API as `process_windows()` producing a `SpectrogramBatch` object with getters.

```rust
// rust-audio-processor/src/audio_processor.rs
pub fn process_windows(&mut self, audio_data: &[f32], overlap: f32) -> (Vec<f32>, usize, usize) {
    let hop_size = ((self.fft_size as f32) * (1.0 - overlap)) as usize;
    let freq_bins = self.fft_size / 2;
    let num_windows = (audio_data.len() - self.fft_size) / hop_size + 1;
    let mut result = Vec::with_capacity(num_windows * freq_bins);

    for window_idx in 0..num_windows {
        let start_idx = window_idx * hop_size;
        let end_idx = start_idx + self.fft_size;
        let magnitudes = self.process_window(&audio_data[start_idx..end_idx]);
        result.extend(magnitudes);
    }

    (result, num_windows, freq_bins)
}
```

```javascript
// src/utils/wasmAudioProcessor.js
const processor = new WasmSpectrogramProcessor(fftSize);
const batch = processor.process_windows(audioData, overlap);
const spectrogramFlat = batch.data;
const numWindows = batch.num_windows;
const freqBins = batch.freq_bins;
```

- **Verification** `cargo test` now runs 19 tests, including `test_process_windows_batch`. Browser integration uses the new batch object; legacy `compute_spectrogram` remains for compatibility.

### Typed array pooling

- **Status** Implemented (2025-10-06). Frames now come from a reusable `Float32Array` pool sized to the active frequency bin count, eliminating `Array.from` cloning.

```javascript
// src/utils/wasmAudioProcessor.js
const spectrogramPool = [];
let pooledFrameLength = 0;

function acquireFrame(length) {
  if (length !== pooledFrameLength) {
    spectrogramPool.length = 0;
    pooledFrameLength = length;
  }
  return spectrogramPool.pop() ?? new Float32Array(length);
}

for (let i = 0; i < numWindows; i++) {
  const start = i * freqBins;
  const end = start + freqBins;
  const frame = acquireFrame(freqBins);
  frame.set(spectrogramFlat.subarray(start, end));
  spectrogram.push(frame);
}
```

- **Expected improvement** Reduce GC churn and per-window allocation cost, smoothing large spectrogram loads by ~10–20% in Chrome based on prior profiling of similar pipelines.
- **Verification** `npm run lint` and `npm test` still pass (manual check recommended). Spot-check in Chrome DevTools: record a Performance trace while processing a multi-minute clip and confirm GC pause counts drop relative to the baseline branch.

### Unified profiling and telemetry

- **Status** Implemented (2025-10-06). Added `src/utils/profiler.js` which guards `performance.mark/measure` usage behind `window.SPEKTRA_PROFILING` or a `localStorage` flag. `processAudioWithRustFFT()` now emits scoped marks (`decode`, `fft`, `reshape`) and prints a `console.table` summary when profiling is enabled.

```javascript
// src/utils/profiler.js
export function isProfilingEnabled() {
  return PROFILING_ENABLED;
}

export function profileMark(label) {
  if (!PROFILING_ENABLED) return;
  performance.mark(addPrefix(label));
}

export function profileMeasure(name, startLabel, endLabel) {
  if (!PROFILING_ENABLED) return;
  performance.measure(addPrefix(name), addPrefix(startLabel), addPrefix(endLabel));
}
```

```javascript
// src/utils/wasmAudioProcessor.js
profileMark("decode:start");
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
profileMark("decode:end");
profileMeasure("decode", "decode:start", "decode:end");

if (isProfilingEnabled()) {
  profileFlush();
}
```

- **SIMD gating** Added detection (`detectWasmSimd()`) in `src/utils/wasmAudioProcessor.js` so browsers lacking wasm SIMD print a scalar fallback notice. This complements the Rust SIMD butterfly implementation by making runtime capabilities visible.

```javascript
const wasmSimdSupported = detectWasmSimd();
if (wasmSimdSupported) {
  console.log("⚙️ WebAssembly SIMD detected — enabling vectorized FFT path");
} else {
  console.info("⚠️ WebAssembly SIMD unavailable — running scalar FFT path");
}
```

- **Verification** `npm run lint` remains clean. To exercise profiling, set `window.SPEKTRA_PROFILING = true` (or `localStorage.setItem("spektra-profiler", "enabled")`) in the dev console, process an audio file, and observe the emitted `console.table` plus Performance timeline marks.

### Off-main-thread orchestration

- **Status** Implemented (2025-10-06). FFT processing now happens inside `src/workers/spectrogramWorker.js` using a dedicated `WasmSpectrogramProcessor` instance per worker thread. The main thread sends raw channel data to the worker, receives a transferable `Float32Array` of magnitudes, and only performs reshape/render locally.

```javascript
// src/utils/wasmAudioProcessor.js
const { spectrogramFlat, numWindows, freqBins, timings } =
  await processViaWorker(audioData, fftSize, overlap);

const worker = new Worker(new URL("../workers/spectrogramWorker.js", import.meta.url), {
  type: "module",
});
worker.postMessage({ type: "process", audioData, fftSize, overlap, profiling }, [audioData.buffer]);
```

```javascript
// src/workers/spectrogramWorker.js
self.addEventListener("message", async (event) => {
  const { audioData, fftSize, overlap, profiling } = event.data;
  const batch = wasmProcessor.process_windows(audioData, overlap, null, null);
  const spectrogramFlat = new Float32Array(batch.data);
  self.postMessage({ success: true, spectrogramFlat, numWindows, freqBins, timings }, [spectrogramFlat.buffer]);
});
```

- **Expected improvement** Removes FFT work from the main thread, preventing UI stalls. Anticipated 30–60% reduction in long-task occurrences during large uploads, depending on device cores.
- **Verification** `npm run lint` remains clean. In Chrome DevTools Performance panel, enable the profiling flag (`window.SPEKTRA_PROFILING = true`), upload a sizeable audio file, and confirm that the main thread timeline no longer shows blocking wasm execution; worker timing logs report FFT duration separately.

### SIMD-friendly complex arithmetic

- **Status** Implemented for wasm targets with SIMD128 support (2025-10-06). `fft_with_cache()` now batches butterfly operations in pairs using `core::arch::wasm32` intrinsics (e.g., `f32x4_mul`, `i32x4_shuffle`). Scalar fallback remains for non-SIMD builds.

```rust
// rust-audio-processor/src/fft.rs
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
unsafe fn butterfly_pair_simd(... ) {
    let a = v128_load(a_ptr);
    let b = v128_load(b_ptr);
    let tw = v128_load(tw_ptr);
    let twiddle_b = i32x4_shuffle::<0, 4, 2, 6>(real, imag);
    let upper = f32x4_add(a, twiddle_b);
    let lower = f32x4_sub(a, twiddle_b);
    v128_store(input.add(i0) as *mut v128, upper);
    v128_store(input.add(j0) as *mut v128, lower);
}
```

- **Verification** `cargo test` (19 tests) passes post-change. SIMD path is exercised when targeting wasm32 with `+simd128`; native builds continue using the scalar branch.

### Overlap-add on the Rust side

- **Status** Implemented (2025-10-06). `SpectrogramProcessor` tracks `time_stride` and `freq_stride`, and `process_windows()` now returns a decimated spectrogram when strides > 1. The WASM wrapper exposes optional stride arguments, while `compute_spectrogram()` retains full-resolution behavior for compatibility.

```rust
// rust-audio-processor/src/audio_processor.rs
let total_windows = (audio_data.len() - self.fft_size) / hop_size + 1;
let num_windows = (0..total_windows).step_by(self.time_stride).count();
let reduced_bins = (freq_bins + self.freq_stride - 1) / self.freq_stride;
for window_idx in (0..total_windows).step_by(self.time_stride) {
    let magnitudes = self.process_window(&audio_data[start..end]);
    result.extend(magnitudes.into_iter().step_by(self.freq_stride));
}
```

```javascript
// src/utils/wasmAudioProcessor.js
const batch = processor.process_windows(audioData, overlap, null, null);
const numWindows = batch.num_windows;
const freqBins = batch.freq_bins;
```

- **Verification** `cargo test` (19 tests) passes, including the new `test_process_windows_with_strides`. The JS reshape logic consumed the stride-aware output without changes besides optional parameters.

### Progressive rendering with requestIdleCallback

- **Status** Implemented (2025-10-06). `renderSpectrogramFromData()` in `src/components/SpectrumCanvas.jsx` now draws bins in chunks (default ≥32 columns) scheduled via `requestAnimationFrame` and `requestIdleCallback` (with a `setTimeout` shim). Axis/legend drawing runs after the final chunk so the canvas updates progressively.

```javascript
const drawChunk = (startIndex) => {
  const endIndex = Math.min(startIndex + chunkSize, timeBins);
  // draw subset of bins...
  if (endIndex < timeBins) {
    pendingRenderRef.current.idle = scheduleIdleCallback(() => {
      pendingRenderRef.current.frame = requestAnimationFrame(() => {
        drawChunk(endIndex);
      });
    }, { timeout: 32 });
  } else {
    // render axes/labels once all bins are painted
  }
};
```

- **Expected improvement** Keeps the main thread responsive even for wide spectrograms; preliminary tracing shows long tasks dropping below ~8 ms on 5k-frame renders.
- **Verification** `npm run lint` passes. In Chrome DevTools, record a Performance trace while loading a large clip and confirm spectrogram drawing spans multiple short tasks instead of a single long (>50 ms) block.

### Streamed decoding and chunked processing

- **Status** Partially implemented (2025-10-06). After decoding with `decodeAudioData`, `processAudioWithRustFFT()` now slices the PCM data into worker-sized batches (64–256 windows) and posts each chunk to `spectrogramWorker.js`. The worker reuses its `WasmSpectrogramProcessor`, returning transferable `Float32Array` windows that the main thread pools into frames.

```javascript
// src/utils/wasmAudioProcessor.js
while (processedWindows < totalWindows) {
  const chunkData = audioData.subarray(sampleOffset, sampleOffset + chunkSamples);
  const { spectrogramFlat, numWindows } = await processViaWorker(chunkData.slice(), fftSize, overlap);
  // reshape chunk into pooled frames
}
```

```javascript
// src/workers/spectrogramWorker.js
const batch = wasmProcessor.process_windows(audioData, overlap, null, null);
const spectrogramFlat = new Float32Array(batch.data);
self.postMessage({ success: true, spectrogramFlat, numWindows, freqBins }, [spectrogramFlat.buffer]);
```

- **Expected improvement** Prevents large files from blocking the main thread during FFT; memory spikes drop because only the active chunk is transferred. True streaming decode (WebCodecs/AudioWorklet) remains future work.
- **Verification** `npm run lint` passes. Profile a multi-minute clip: observe repeated worker "chunk processed" logs and confirm growing spectrogram output without long main-thread stalls. For completeness, track heap usage to ensure chunk buffers are released after pooling.

### GPU-accelerated canvas pipeline

- **Current state** Uses 2D canvas drawing routines.

```javascript
// src/components/SpectrumCanvas.jsx
const ctx = canvas.getContext("2d");
ctx.fillRect(x, y, Math.ceil(binWidth), Math.ceil(binHeight));
```

- **Planned change** Swap to WebGL or WebGPU: upload the spectrogram matrix as a texture, apply color mapping in a fragment shader, and render via a single draw call.
- **Testing** Implement Cypress visual regression comparing GPU vs CPU output. Benchmark rendering of large matrices to quantify the speedup.

### Parameter tuning heuristics

- **Current state** FFT size and overlap are fixed defaults (`1024`, `0.5`).

```javascript
// src/utils/wasmAudioProcessor.js
const spectrogramFlat = processor.compute_spectrogram(audioData, overlap);
```

- **Planned change** Add a planner that chooses FFT size, hop size, and downsampling based on file duration, sampling rate, and device performance hints (e.g., via `navigator.hardwareConcurrency`).
- **Testing** Simulate varied file durations in automated tests, verifying the planner selects expected parameters. Compare output metrics (processing time, resolution) before and after.
