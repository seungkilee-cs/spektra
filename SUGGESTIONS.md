# Performance & Usability Suggestions

## Performance

### 1. Pre-compute the color map as a lookup table
**File:** `src/components/SpectrumCanvas.jsx` — `spekColorMap()` function

Currently `spekColorMap(value)` is called once per pixel during canvas rendering — potentially millions of calls per spectrogram. Since the input is a normalized `[0, 1]` value, a 256-entry lookup table precomputed at module load would eliminate all per-pixel branching:

```js
const COLOR_LUT = new Uint8Array(256 * 3); // [r, g, b, r, g, b, ...]
// fill once at startup, then index as COLOR_LUT[Math.floor(value * 255) * 3]
```

Or better: use `ImageData` and write directly to the pixel buffer instead of repeated `fillRect` calls — this is the canonical fast path for spectrogram renderers.

### 2. Use ImageData instead of fillRect for canvas rendering
**File:** `src/components/SpectrumCanvas.jsx` — progressive render loop

Each `fillRect(x, y, 1, 1)` is a separate draw call. For a 2000×256 spectrogram that's 512,000 calls. Using `ctx.createImageData` + `putImageData` collapses this to one call per column (or one total), which is an order-of-magnitude speedup:

```js
const imageData = ctx.createImageData(width, height);
// write RGBA values directly to imageData.data
ctx.putImageData(imageData, leftMargin, topMargin);
```

### 3. Cache bit-reversal permutation in FFT
**File:** `rust-audio-processor/src/fft.rs` — `fft()` function

Bit-reversal is recomputed on every FFT call. Since FFT size is fixed per `SpectrogramProcessor` instance, the permutation array can be precomputed once in `SpectrogramProcessor::new()` and reused across all windows. For a 1024-point FFT processing thousands of windows, this removes thousands of identical O(n log n) precomputations.

### 4. Pre-allocate the result vector in batch processing
**File:** `rust-audio-processor/src/audio_processor.rs` — `process_windows()`

The output `Vec` grows dynamically with `extend()` inside the window loop. The total output size (`num_windows * fft_size / 2`) is known before the loop starts — pre-allocating with `Vec::with_capacity(total)` eliminates all reallocation:

```rust
let mut output = Vec::with_capacity(num_windows * (self.fft_size / 2));
```

### 5. Pre-initialize WASM in the Web Worker on startup
**File:** `src/workers/spectrogramWorker.js`

WASM is initialized lazily on the first `"process"` message. This adds latency to the first chunk. Since the worker is created specifically to run WASM, initialize it unconditionally at the top level of the worker script so it's ready before the first message arrives.

### 6. Remove or gate console logging
**Files:** `src/components/SpectrumCanvas.jsx`, `src/utils/wasmAudioProcessor.js`

Both files have heavy `console.log` calls inside hot paths (per-chunk processing, resize handlers). In production builds these are non-trivial overhead. Gate them behind the existing `debug.js` utility or strip them with a Vite define (e.g. `__DEV__`).

### 7. Reduce resize debounce from 300ms to 150ms
**File:** `src/components/SpectrumCanvas.jsx` — `ResizeObserver` callback

300ms is perceptible lag when resizing the window. 150ms is a common sweet spot — still debounced but feels responsive. Since the re-render just re-draws from cached `spectrogramDataRef` data, it's cheap.

---

## Usability

### 8. Replace `alert()` with inline error UI
**File:** `src/App.jsx` — unsupported format and ALAC rejection handlers

`alert()` is a modal that blocks the page and looks jarring. A dismissible error banner or toast inside the upload area would be less disruptive and consistent with the app's style. The ALAC error in particular is informative and deserves a better display (explain *why* ALAC can't be decoded).

### 9. Show processing progress per chunk, not just a spinner
**File:** `src/components/SpectrumCanvas.jsx` / `src/utils/wasmAudioProcessor.js`

The worker already processes audio in chunks and returns them progressively. Surface this in the UI: a progress bar that advances as each chunk completes would significantly improve the feel for large files (FLAC/WAV can take several seconds). The chunk index and total are already available in the processing loop.

### 10. Show file size warning for large files before processing
**File:** `src/App.jsx` — `handleFileUpload`

Very large files (e.g. a 500MB 24-bit WAV) can cause the browser to become unresponsive during `decodeAudioData`. A simple check on `file.size` before starting — e.g. a warning banner for files over 200MB — sets user expectations and prevents confusion.

### 11. Preserve the spectrogram when the window resizes
**File:** `src/components/SpectrumCanvas.jsx` — resize handler

Currently a resize triggers a full re-render from cached data, which is correct, but the canvas goes blank during the re-render. Keeping the previous canvas content visible (or scaling it as a placeholder) while the new render runs in the background would eliminate the flash.

### 12. Add keyboard shortcut to re-upload / clear
**File:** `src/App.jsx`

Once a spectrogram is displayed there's no obvious way to go back and try another file without refreshing the page. An "Upload another file" button or `Escape` key handler to return to the landing view would improve the workflow for users comparing multiple files (the core use case per the README).

### 13. Display Nyquist frequency on the Y-axis
**File:** `src/components/SpectrumCanvas.jsx` — axis label rendering

The current Y-axis shows a fixed set of frequency labels. It would be useful to always label the top of the axis with the actual Nyquist frequency of the file (sample rate / 2), since this is what users are checking when verifying fake lossless files — the hard cutoff at 16kHz or 20kHz is the telltale sign.

### 14. Surface the "lossless" flag from metadata visually
**File:** `src/components/AudioMetadataDisplay.jsx` / `src/utils/formatMetadata.js`

`music-metadata` already extracts a `lossless` boolean. Displaying this prominently — e.g. a "Lossless" or "Lossy" badge near the filename — would surface the most important piece of information immediately, before the user even looks at the spectrogram. This directly serves the stated motivation of the project.

### 15. Support dropping a file anywhere on the analysis view
**File:** `src/App.jsx` or `src/components/SpectrumCanvas.jsx`

Once a file has been analyzed, dropping a new file anywhere on the page should replace it. Currently the drop zone disappears after upload. Global `dragover`/`drop` listeners on `document` (removed on unmount) would let users quickly compare files without having to find a specific drop target.
