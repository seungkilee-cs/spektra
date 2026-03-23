⏺ Write(CLAUDE.md)
  ⎿  Wrote 73 lines to CLAUDE.md
      1 # CLAUDE.md
      2
      3 This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
      4
      5 ## What This Project Is
      6
      7 **Spektra** is a 100% client-side browser-based audio spectrum analyzer ("Spek for Web"). Users drag-and-drop audio files (MP3, M4A, FLAC, WAV, OGG, AIFF, WebM, Opus) and see a spectrogr
        am rendered via HTML Canvas. All processing happens in-browser — no server involved.
      8
      9 ## Commands
     … +63 lines (ctrl+o to expand)

⏺ Created CLAUDE.md with:

  - Commands for dev, build (including WASM rebuild), test, lint, and deploy
  - Architecture overview of the 4-stage pipeline (upload → FFT → post-processing → canvas render)
  - Key files table mapping files to their roles
  - Notes on the Rust/WASM module, Vite base path, singleton patterns, and the ALAC vs AAC format distinction

✻ Cooked for 1m 39s

❯ What are some suggestions you have for performance and usability of this web app? add suggestions in a document

⏺ Explore(Deep dive into performance and usability)
  ⎿  Done (7 tool uses · 40.4k tokens · 45s)
  (ctrl+o to expand)

⏺ Write(SUGGESTIONS.md)
  ⎿  Wrote 99 lines to SUGGESTIONS.md
       1 # Performance & Usability Suggestions
       2
       3 ## Performance
       4
       5 ### 1. Pre-compute the color map as a lookup table
       6 **File:** `src/components/SpectrumCanvas.jsx` — `spekColorMap()` function
       7
       8 Currently `spekColorMap(value)` is called once per pixel during canvas rendering — potentially millions of calls per spectrogram. Since the input is a normalized `[0, 1]` value, a 256-e
         ntry lookup table precomputed at module load would eliminate all per-pixel branching:
       9
      10 ```js
     … +89 lines (ctrl+o to expand)

⏺ Created SUGGESTIONS.md with 15 concrete suggestions. Quick summary by category:

  Performance (7 items):
  - Pre-compute a 256-entry color lookup table instead of calling spekColorMap() per pixel
  - Switch from fillRect to ImageData + putImageData (eliminates 500k+ draw calls per render)
  - Cache bit-reversal permutation in the Rust FFT (recomputed on every window today)
  - Pre-allocate the output Vec in process_windows() to avoid dynamic growth
  - Initialize WASM in the worker unconditionally at startup, not on first message
  - Gate/remove console logging in hot paths
  - Reduce resize debounce from 300ms → 150ms

  Usability (8 items):
  - Replace alert() with inline error UI (especially the ALAC rejection message)
  - Show per-chunk progress bar instead of just a spinner
  - Warn before processing files over ~200MB
  - Keep old canvas content visible during resize re-render (no blank flash)
  - Add a way to return to the upload view without refreshing (Escape key / button)
  - Always label the Nyquist frequency at the top of the Y-axis (key for fake lossless detection)
  - Surface the lossless flag as a prominent badge — this is the core use case
  - Support dropping a file anywhere on the page once a spectrogram is showing

✻ Crunched for 1m 44s

❯ give me extensive and comprehensive commands to test this app manually

⏺ Explore(Explore app for manual testing)
  ⎿  Done (20 tool uses · 52.4k tokens · 55s)
  (ctrl+o to expand)

⏺ Write(MANUAL_TESTING.md)
  ⎿  Wrote 364 lines to MANUAL_TESTING.md
      1 # Manual Testing Guide
      2
      3 Start the dev server before running any tests:
      4 ```bash
      5 npm run dev
      6 # App runs at http://localhost:5173/spektra/
      7 ```
      8
      9 Open DevTools (F12) and keep the **Console** and **Network** tabs visible throughout testing. All WASM loading and processing events are logged there.
     … +354 lines (ctrl+o to expand)

⏺ Created MANUAL_TESTING.md with 12 sections and a quick sanity checklist. Here's what's covered:

  File upload (sections 2–3):
  - Format matrix for all 9 supported types
  - Drag-and-drop visual states (hover, active, release, drag-away-without-drop)
  - Every error path: non-audio file, ALAC, video file, ALAC vs AAC M4A distinction

  Processing pipeline (section 4):
  - WASM SIMD detection in console
  - First-load vs. second-load (singleton reuse)
  - Very short file (<0.5s), large file (>100MB), responsiveness during processing

  Spectrogram canvas (section 5):
  - Color gradient verification with pink/white noise
  - Time and frequency axis label format (m:ss, Hz vs kHz)
  - Known-frequency test (1 kHz sine wave → single band at 1k label)
  - Lossless vs lossy cutoff comparison (FLAC full-range vs 128k MP3 ~16kHz cutoff)

  Metadata (section 6):
  - All fields for MP3 and FLAC with specific expected values
  - Lossy bit-depth ("Not applicable"), container redundancy suppression
  - Click-inside-expanded-panel does not collapse

  DevTools checks (section 10):
  - WASM network request and caching
  - Worker thread visibility
  - Memory leak check across 5 sequential uploads
  - Performance timeline verifying main thread isn't blocked

  Browser compat, autoplay policy, AudioProcessorSelector debug component all covered too.

✻ Churned for 2m 48s

❯ go make the fixes for the most urgent suggestions.

⏺ Let me read the relevant files before making any changes.

  Read 7 files (ctrl+o to expand)

⏺ Let me also read the CSS files for context before writing changes.

  Read 2 files (ctrl+o to expand)

⏺ Now I have everything I need. I'll implement the 5 most impactful fixes in parallel where possible:

  1. ImageData + Color LUT — replaces ~500k fillRect calls per spectrogram
  2. Pre-initialize WASM in worker before first message
  3. Resize debounce 300ms → 150ms
  4. Inline error banner instead of alert()
  5. Lossless/Lossy badge in metadata header

⏺ Update(src/workers/spectrogramWorker.js)
  ⎿  Added 3 lines, removed 4 lines
       1  import init, { WasmSpectrogramProcessor } from "../wasm/rust_audio_processor.js";
       2
       3 -let initPromise;
       3 +// Eagerly start WASM initialization the moment the worker is created,
       4 +// before any messages arrive, so the first chunk doesn't pay the init cost.
       5 +const initPromise = init();
       6  let processor = null;
       7  let currentFftSize = null;
       8
       9  async function ensureWasm() {
       8 -  if (!initPromise) {
       9 -    initPromise = init();
      10 -  }
      10    await initPromise;
      11  }
      12

⏺ Update(src/components/SpectrumCanvas.jsx)
  ⎿  Added 31 lines
      14      ? window.cancelIdleCallback.bind(window)
      15      : clearTimeout;
      16
      17 +// Pre-computed Spek color LUT: 256 entries → [R, G, B, R, G, B, ...]
      18 +// Built once at module load; replaces per-pixel function calls during rendering.
      19 +const COLOR_LUT = (() => {
      20 +  const lut = new Uint8ClampedArray(256 * 3);
      21 +  for (let i = 0; i < 256; i++) {
      22 +    const t = i / 255;
      23 +    let r, g, b;
      24 +    if (t < 0.1) {
      25 +      const local = t / 0.1;
      26 +      r = Math.floor(local * 20); g = 0; b = 20 + Math.floor(local * 60);
      27 +    } else if (t < 0.3) {
      28 +      const local = (t - 0.1) / 0.2;
      29 +      r = 20 + Math.floor(local * 30); g = Math.floor(local * 50); b = 80 + Math.floor(local * 175);
      30 +    } else if (t < 0.5) {
      31 +      const local = (t - 0.3) / 0.2;
      32 +      r = 50 + Math.floor(local * 150); g = 50 - Math.floor(local * 50); b = 255;
      33 +    } else if (t < 0.7) {
      34 +      const local = (t - 0.5) / 0.2;
      35 +      r = 200 + Math.floor(local * 55); g = Math.floor(local * 100); b = 255 - Math.floor(local * 100);
      36 +    } else if (t < 0.9) {
      37 +      const local = (t - 0.7) / 0.2;
      38 +      r = 255; g = 100 + Math.floor(local * 155); b = Math.max(0, 155 - Math.floor(local * 155));
      39 +    } else {
      40 +      const local = (t - 0.9) / 0.1;
      41 +      r = 255; g = 255; b = Math.floor(local * 255);
      42 +    }
      43 +    lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
      44 +  }
      45 +  return lut;
      46 +})();
      47 +
      48  const SpectrumCanvas = ({ fileUploaded }) => {
      49    const canvasRef = useRef(null);
      50    const containerRef = useRef(null);

⏺ Now reduce the debounce and replace the rendering loop with ImageData:

⏺ Update(src/components/SpectrumCanvas.jsx)
  ⎿  Added 1 line, removed 1 line
      108      let resizeTimeout;
      109      const handleResize = () => {
      110        clearTimeout(resizeTimeout);
      111 -      resizeTimeout = setTimeout(updateCanvasSize, 300);
      111 +      resizeTimeout = setTimeout(updateCanvasSize, 150);
      112      };
      113
      114      updateCanvasSize();

⏺ Now replace the entire drawChunk inner body (fillRect loop + spekColorMap) with the ImageData approach:

⏺ Update(src/components/SpectrumCanvas.jsx)
  ⎿  Added 29 lines, removed 50 lines
      276
      277        const timeBins = normalizedData.length;
      278        const freqBins = normalizedData[0].length;
      279 -      const binWidth = plotWidth / timeBins;
      280 -      const binHeight = plotHeight / freqBins;
      279
      280        const chunkSize = progressiveDraw
      281          ? Math.max(32, Math.floor(timeBins / 40))
      282          : timeBins;
      283
      286 -      const spekColorMap = (normalizedMagnitude) => {
      287 -        const t = Math.max(0, Math.min(1, normalizedMagnitude));
      288 -        let r, g, b;
      289 -
      290 -        if (t < 0.1) {
      291 -          const local = t / 0.1;
      292 -          r = Math.floor(local * 20);
      293 -          g = 0;
      294 -          b = 20 + Math.floor(local * 60);
      295 -        } else if (t < 0.3) {
      296 -          const local = (t - 0.1) / 0.2;
      297 -          r = 20 + Math.floor(local * 30);
      298 -          g = Math.floor(local * 50);
      299 -          b = 80 + Math.floor(local * 175);
      300 -        } else if (t < 0.5) {
      301 -          const local = (t - 0.3) / 0.2;
      302 -          r = 50 + Math.floor(local * 150);
      303 -          g = 50 - Math.floor(local * 50);
      304 -          b = 255;
      305 -        } else if (t < 0.7) {
      306 -          const local = (t - 0.5) / 0.2;
      307 -          r = 200 + Math.floor(local * 55);
      308 -          g = Math.floor(local * 100);
      309 -          b = 255 - Math.floor(local * 100);
      310 -        } else if (t < 0.9) {
      311 -          const local = (t - 0.7) / 0.2;
      312 -          r = 255;
      313 -          g = 100 + Math.floor(local * 155);
      314 -          b = Math.max(0, 155 - Math.floor(local * 155));
      315 -        } else {
      316 -          const local = (t - 0.9) / 0.1;
      317 -          r = 255;
      318 -          g = 255;
      319 -          b = Math.floor(local * 255);
      320 -        }
      321 -
      322 -        return { r, g, b };
      323 -      };
      324 -
      284        const drawChunk = (startIndex) => {
      285          const endIndex = Math.min(startIndex + chunkSize, timeBins);
      286
      328 -        for (let timeIndex = startIndex; timeIndex < endIndex; timeIndex += 1) {
      329 -          const frame = normalizedData[timeIndex];
      330 -          for (let freqIndex = 0; freqIndex < freqBins; freqIndex += 1) {
      331 -            const magnitude = frame[freqIndex];
      332 -            const color = spekColorMap(magnitude);
      333 -            const x = leftMargin + timeIndex * binWidth;
      334 -            const y = topMargin + (freqBins - freqIndex - 1) * binHeight;
      287 +        // Map time-bin range to pixel range, then write directly into an ImageData
      288 +        // buffer — one putImageData call per chunk instead of one fillRect per pixel.
      289 +        const startPx = Math.floor(startIndex * plotWidth / timeBins);
      290 +        const endPx = Math.floor(endIndex * plotWidth / timeBins);
      291 +        const chunkPxWidth = endPx - startPx;
      292
      336 -            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      337 -            ctx.fillRect(x, y, Math.ceil(binWidth), Math.ceil(binHeight));
      293 +        if (chunkPxWidth > 0) {
      294 +          const imageData = ctx.createImageData(chunkPxWidth, plotHeight);
      295 +          const pixels = imageData.data;
      296 +
      297 +          for (let localPx = 0; localPx < chunkPxWidth; localPx++) {
      298 +            const timeIndex = Math.min(
      299 +              Math.floor((startPx + localPx) * timeBins / plotWidth),
      300 +              timeBins - 1,
      301 +            );
      302 +            const frame = normalizedData[timeIndex];
      303 +            for (let py = 0; py < plotHeight; py++) {
      304 +              const freqIndex = Math.min(
      305 +                Math.floor((plotHeight - 1 - py) * freqBins / plotHeight),
      306 +                freqBins - 1,
      307 +              );
      308 +              const lutIdx = Math.floor(Math.max(0, Math.min(1, frame[freqIndex])) * 255) * 3;
      309 +              const pixelIdx = (py * chunkPxWidth + localPx) * 4;
      310 +              pixels[pixelIdx]     = COLOR_LUT[lutIdx];
      311 +              pixels[pixelIdx + 1] = COLOR_LUT[lutIdx + 1];
      312 +              pixels[pixelIdx + 2] = COLOR_LUT[lutIdx + 2];
      313 +              pixels[pixelIdx + 3] = 255;
      314 +            }
      315            }
      316 +
      317 +          ctx.putImageData(imageData, leftMargin + startPx, topMargin);
      318          }
      319
      320          if (progressiveDraw && endIndex < timeBins) {

⏺ Now fix the Rust compute_spectrogram to pre-allocate:

⏺ Update(rust-audio-processor/src/audio_processor.rs)
  ⎿  Added 2 lines, removed 2 lines
      123
      124          console_log!("Processing {} windows with hop size {}", num_windows, hop_size);
      125
      126 -        let mut spectrogram_flat = Vec::new();
      127 -
      126 +        let mut spectrogram_flat = Vec::with_capacity(num_windows * (self.fft_size / 2));
      127 +
      128          for window_idx in 0..num_windows {
      129              let start_idx = window_idx * hop_size;
      130              let end_idx = start_idx + self.fft_size;

⏺ Now replace alert() with an inline error state in App.jsx:

⏺ Update(src/App.jsx)
  ⎿  Added 5 lines, removed 4 lines
      10    const [file, setFile] = useState(null);
      11    const [metadata, setMetadata] = useState(null);
      12    const [isProcessing, setIsProcessing] = useState(false);
      13 +  const [errorMessage, setErrorMessage] = useState(null);
      14
      15    const handleFileSelect = async (selectedFile) => {
      16      try {
      17        setIsProcessing(true);
      18 +      setErrorMessage(null);
      19        debugLog("=== FILE SELECTION START ===");
      20        setFile(null);
      21        setMetadata(null);
     ...
      37
      38        if (selectedFile.type && !supportedTypes.includes(selectedFile.type)) {
      39          debugError("Unsupported file type:", selectedFile.type);
      38 -        alert("Please select a supported audio file format.");
      40 +        setErrorMessage("Unsupported file format. Please upload MP3, AAC/M4A, FLAC, WAV, OGG, AIFF, WebM, or Opus.");
      41          return;
      42        }
      43
     ...
      49
      50        if (codecLower.includes("alac") || containerLower.includes("alac")) {
      51          debugError("Unsupported ALAC codec detected");
      50 -        alert(
      51 -          "Apple Lossless (ALAC) files are not currently supported. Please upload MP3, AAC/M4A, FLAC, WAV, OGG, AIFF, WebM, or Opus."
      52 -        );
      52 +        setErrorMessage("Apple Lossless (ALAC) cannot be decoded by browsers. Please convert to FLAC or re-download as AAC/MP3.");
      53          return;
      54        }
      55
     ...
      67      setFile(null);
      68      setMetadata(null);
      69      setIsProcessing(false);
      70 +    setErrorMessage(null);
      71    };
      72
      73    // Landing page - matches the mockup design

⏺ Add the error banner to the landing page JSX:

⏺ Update(src/App.jsx)
  ⎿  Added 13 lines
       94              <FileUpload onFileSelect={handleFileSelect} />
       95            </div>
       96
       97 +          {errorMessage && (
       98 +            <div className="error-banner" role="alert">
       99 +              <span className="error-banner__text">{errorMessage}</span>
      100 +              <button
      101 +                className="error-banner__dismiss"
      102 +                onClick={() => setErrorMessage(null)}
      103 +                aria-label="Dismiss error"
      104 +              >
      105 +                ✕
      106 +              </button>
      107 +            </div>
      108 +          )}
      109 +
      110            <div className="info-section">
      111              <div className="privacy-note">
      112                🔒 Files are processed locally in your browser - nothing is

⏺ Add error banner styles to App.css:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/App.css)
  ⎿  Added 38 lines
      547    }
      548  }
      549
      550 +.error-banner {
      551 +  display: flex;
      552 +  align-items: center;
      553 +  justify-content: space-between;
      554 +  gap: 12px;
      555 +  width: 100%;
      556 +  padding: 12px 16px;
      557 +  border-radius: var(--card-radius);
      558 +  background: rgba(220, 38, 38, 0.12);
      559 +  border: 1px solid rgba(220, 38, 38, 0.35);
      560 +  color: #fca5a5;
      561 +  font-size: clamp(0.82rem, 2vw, 0.92rem);
      562 +  animation: fadeInUp 0.25s ease-out;
      563 +}
      564 +
      565 +.error-banner__text {
      566 +  flex: 1;
      567 +  line-height: 1.5;
      568 +}
      569 +
      570 +.error-banner__dismiss {
      571 +  flex-shrink: 0;
      572 +  background: none;
      573 +  border: none;
      574 +  color: #fca5a5;
      575 +  cursor: pointer;
      576 +  font-size: 1rem;
      577 +  padding: 2px 6px;
      578 +  border-radius: 4px;
      579 +  opacity: 0.7;
      580 +  transition: opacity 0.15s ease;
      581 +  font-family: inherit;
      582 +}
      583 +
      584 +.error-banner__dismiss:hover {
      585 +  opacity: 1;
      586 +}
      587 +
      588  /* Ensure processing overlay covers the new responsive container */
      589  .processing-overlay {
      590    position: absolute;

⏺ Now add the lossless/lossy badge in AudioMetadataHeader:

⏺ Update(src/components/AudioMetadataHeader.jsx)
  ⎿  Added 5 lines
      83      return "Unknown";
      84    })();
      85
      86 +  const isLosslessBool =
      87 +    metadata.lossless === "Yes (lossless)" ? true
      88 +    : metadata.lossless === "No (lossy)" ? false
      89 +    : null;
      90 +
      91    const summaryMetaItems = [
      92      formatDisplay,
      93      metadata.bitrate,

⏺ Update(src/components/AudioMetadataHeader.jsx)
  ⎿  Added 8 lines
      126        <div className="metadata-header" aria-live="polite">
      127          <div className="metadata-summary-line">
      128            <span className="metadata-summary-line__file">📊 {file.name}</span>
      129 +              {isLosslessBool !== null && (
      130 +                <span
      131 +                  className={`lossless-badge ${isLosslessBool ? "lossless-badge--lossless" : "lossless-badge--lossy"}`}
      132 +                  title={isLosslessBool ? "Lossless encoding — full frequency range preserved" : "Lossy encoding — frequency content may be reduced"}
      133 +                >
      134 +                  {isLosslessBool ? "Lossless" : "Lossy"}
      135 +                </span>
      136 +              )}
      137            <span className="metadata-summary-line__meta">
      138              {summaryMetaItems.map((value, index) => (
      139                <span

⏺ Add the badge styles to App.css:

⏺ Update(src/App.css)
  ⎿  Added 24 lines
      409    letter-spacing: 0.06em;
      410  }
      411
      412 +.lossless-badge {
      413 +  display: inline-flex;
      414 +  align-items: center;
      415 +  padding: 2px 8px;
      416 +  border-radius: 999px;
      417 +  font-size: clamp(0.68rem, 1.6vw, 0.74rem);
      418 +  font-weight: 600;
      419 +  text-transform: uppercase;
      420 +  letter-spacing: 0.07em;
      421 +  flex-shrink: 0;
      422 +}
      423 +
      424 +.lossless-badge--lossless {
      425 +  background: rgba(34, 197, 94, 0.15);
      426 +  border: 1px solid rgba(34, 197, 94, 0.4);
      427 +  color: #86efac;
      428 +}
      429 +
      430 +.lossless-badge--lossy {
      431 +  background: rgba(251, 146, 60, 0.12);
      432 +  border: 1px solid rgba(251, 146, 60, 0.35);
      433 +  color: #fdba74;
      434 +}
      435 +
      436  .metadata-header__chevron {
      437    display: inline-flex;
      438    align-items: center;

⏺ Now let's verify the changed files look correct:

  Read 2 files (ctrl+o to expand)

⏺ Everything looks correct. Let's do a quick lint check to make sure nothing is broken:

⏺ Bash(npm run lint 2>&1)
  ⎿  Error: Exit code 127

     > spektra@0.0.0 lint
     > eslint src --ext js,jsx

     sh: eslint: command not found

⏺ Bash(npx eslint src --ext js,jsx 2>&1)
  ⎿  Error: Exit code 2
     npm warn exec The following package was not found and will be installed: eslint@10.0.3

     Oops! Something went wrong! :(

     ESLint: 10.0.3

     Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@eslint/js' imported from /Users/lsk-sphere/Workspace/seungkilee-cs/spektra/eslint.config.js
         at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
         at packageResolve (node:internal/modules/esm/resolve:768:81)
     … +8 lines (ctrl+o to see all)

⏺ Bash(./node_modules/.bin/eslint src --ext js,jsx 2>&1)
  ⎿  Error: Exit code 127
     (eval):1: no such file or directory: ./node_modules/.bin/eslint

⏺ Bash(npm install 2>&1 | tail -5 && ./node_modules/.bin/eslint src --ext js,jsx 2>&1)
  ⎿  Error: Exit code 1

     To address all issues, run:
       npm audit fix

     Run `npm audit` for details.

     /Users/lsk-sphere/Workspace/seungkilee-cs/spektra/src/utils/audioContextManager.js
       44:14  error  'error' is defined but never used  no-unused-vars

     … +7 lines (ctrl+o to see all)

⏺ All 5 lint errors are pre-existing (in audioContextManager.js and the generated rust_audio_processor.js wasm file) — none introduced by my changes. We're clean.

  Here's a summary of every fix made:

  ---
  Fixes applied

  Performance

  ┌─────────────────────────────────────────────────────────────────┬──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │                               Fix                               │         File         │                                          Impact                                           │
  ├─────────────────────────────────────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Pre-computed color LUT (256 entries, built once at module load) │ SpectrumCanvas.jsx   │ Eliminates per-pixel branch logic during rendering                                        │
  ├─────────────────────────────────────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ ImageData + putImageData replaces fillRect                      │ SpectrumCanvas.jsx   │ ~500k fillRect calls → 1 per chunk; renders pixel-perfect with no sub-pixel overdraw      │
  ├─────────────────────────────────────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Eager WASM init in worker                                       │ spectrogramWorker.js │ WASM is ready before the first message arrives — first chunk no longer pays the init cost │
  ├─────────────────────────────────────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Pre-allocate Vec in compute_spectrogram                         │ audio_processor.rs   │ Removes repeated heap reallocation during the FFT window loop                             │
  ├─────────────────────────────────────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Resize debounce 300ms → 150ms                                   │ SpectrumCanvas.jsx   │ Window resizing feels twice as responsive                                                 │
  └─────────────────────────────────────────────────────────────────┴──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  Usability

  ┌────────────────────────────────────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                      Fix                       │             File              │                                                  What changed                                                  │
  ├────────────────────────────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Replaced both alert() calls with an inline     │ App.jsx + App.css             │ Non-blocking, styled to match the dark UI; distinct message for ALAC ("cannot be decoded by browsers, convert  │
  │ dismissible error banner                       │                               │ to FLAC") vs generic unsupported format                                                                        │
  ├────────────────────────────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Lossless/Lossy badge in metadata header        │ AudioMetadataHeader.jsx +     │ Green "Lossless" or orange "Lossy" pill appears next to the filename — the core signal users come to verify is │
  │                                                │ App.css                       │  now visible at a glance without expanding the metadata panel                                                  │
  └────────────────────────────────────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘