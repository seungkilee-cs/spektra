# Manual Testing Guide

Start the dev server before running any tests:
```bash
npm run dev
# App runs at http://localhost:5173/spektra/
```

Open DevTools (F12) and keep the **Console** and **Network** tabs visible throughout testing. All WASM loading and processing events are logged there.

---

## 1. Landing Page

### 1.1 Initial render
- Open the app cold (no previous state).
- **Expect:** Upload area visible with drag-drop zone, supported format badges below it, canvas placeholder with dashed border and text "Upload an audio file to see the spectrum".
- **Expect:** No metadata panel visible yet.

### 1.2 Upload area hover
- Hover the mouse over the drag-drop zone.
- **Expect:** Zone lifts slightly (`translateY(-5px)`), border turns blue.
- Move mouse away.
- **Expect:** Returns to default state.

### 1.3 Upload area click
- Click anywhere inside the drag-drop zone.
- **Expect:** OS file picker dialog opens.
- Press Escape to cancel.
- **Expect:** Nothing changes, app remains on landing page.

---

## 2. File Upload — Valid Formats

For each format, drag-and-drop or click-upload a real audio file of that type and verify the full pipeline completes.

### 2.1 Format matrix

| Format | MIME type | Expected outcome |
|--------|-----------|-----------------|
| MP3 | `audio/mpeg` | Processed, spectrogram shown |
| AAC (.aac) | `audio/aac` | Processed, spectrogram shown |
| M4A (AAC) | `audio/mp4` / `audio/m4a` | Processed, spectrogram shown |
| FLAC | `audio/flac` | Processed, spectrogram shown |
| WAV | `audio/wav` | Processed, spectrogram shown |
| OGG Vorbis | `audio/ogg` | Processed, spectrogram shown |
| AIFF | `audio/x-aiff` | Processed, spectrogram shown |
| WebM | `audio/webm` | Processed, spectrogram shown |
| Opus | `audio/opus` | Processed, spectrogram shown |

For each: after upload, verify the console logs show WASM initialization, chunk processing, and no errors.

### 2.2 Drag-and-drop interaction
- Drag a valid audio file over the upload zone (hold, don't drop yet).
- **Expect:** Zone activates — background turns blue (`rgba(59,130,246,0.1)`), border intensifies, zone lifts (`translateY(-8px) rotateX(8deg)`).
- Drop the file.
- **Expect:** Drag-active state resets immediately, processing begins.

### 2.3 Drag over then drag away (no drop)
- Drag a file over the zone, then drag it back outside the browser window.
- **Expect:** Zone returns to default state (no blue highlight, no lift).

---

## 3. File Upload — Invalid Formats and Errors

### 3.1 Non-audio file
- Drag-and-drop a `.png`, `.pdf`, or `.txt` file.
- **Expect:** Alert dialog: "Please select a supported audio file format."
- Dismiss the alert.
- **Expect:** App stays on the landing page, no state change.

### 3.2 ALAC file (Apple Lossless in .m4a)
- Upload an `.m4a` file that is encoded with ALAC (not AAC).
- **Expect:** Alert dialog mentioning ALAC is not supported and listing the supported formats.
- **Expect:** App stays on landing page.
- Verify in console that metadata extraction ran before the alert fired (codec/container check happens after extraction).

### 3.3 AAC M4A (must succeed, not be rejected as ALAC)
- Upload an AAC-encoded `.m4a` file.
- **Expect:** No ALAC alert. Processing proceeds normally.
- This distinguishes the two M4A code paths.

### 3.4 Drop a video file with audio (e.g. .mp4 video)
- Drag an `.mp4` video file.
- **Expect:** Rejected with "Please select a supported audio file format." (MIME type is `video/mp4`, not in the allowed list).

---

## 4. Processing Pipeline

### 4.1 Processing indicators
- Upload any medium-sized audio file (2–5 minutes, e.g. a FLAC).
- **Expect:** A spinner overlay appears on the canvas area immediately with "Processing audio file…".
- **Expect:** Console logs WASM initialization (first run only), then chunk-by-chunk processing messages.
- **Expect:** After processing: spectrogram renders progressively (you can watch columns appear left to right), then axes and labels are drawn.

### 4.2 WASM SIMD detection (console)
- After first file load, check console.
- **Expect one of:**
  - `⚙️ WebAssembly SIMD detected — enabling vectorized FFT path`
  - `⚠️ WebAssembly SIMD unavailable — running scalar FFT path`
- This only logs once per page load (WASM is a singleton).

### 4.3 First-load vs. second-load WASM init
- Load a file, wait for it to finish.
- Click "New File" and upload a second file.
- **Expect:** Second file processes faster — WASM module is already initialized, worker is already running.
- Console should not show WASM init messages again.

### 4.4 Very short audio file (<0.5 seconds)
- Upload a very short clip (a short WAV beep, or trim a file to ~0.1s).
- **Expect:** Processing completes, canvas renders (may show very few time frames or just the axes).
- **Expect:** No crash or infinite spinner.

### 4.5 Large audio file (>100 MB, e.g. a long WAV)
- Upload a large uncompressed WAV file.
- **Expect:** Processing takes noticeably longer, chunked processing is visible in the console.
- **Expect:** UI remains responsive during processing (page doesn't freeze — test by moving the mouse).
- **Expect:** Spectrogram eventually appears correctly.

---

## 5. Spectrogram Canvas

### 5.1 Color gradient
- Use a file with a known broad frequency range (e.g. pink noise or white noise WAV).
- **Expect:** Visible gradient from dark blue/black (silence or near-silence) through cyan, green, yellow, to bright white/red at peaks.
- No single solid color filling the whole canvas.

### 5.2 Time axis
- Upload a file of known duration (e.g. exactly 3 minutes).
- **Expect:** X-axis labels start at `0:00` and end at or near `3:00`.
- Intermediate labels in `m:ss` format (e.g. `0:30`, `1:00`, `1:30`…).
- Labels are evenly spaced and not truncated.

### 5.3 Frequency axis (Y)
- **Expect:** Y-axis labels in Hz for values under 1000 (e.g. `0`, `500`) and in kHz for values ≥ 1000 (e.g. `2.2k`, `11.0k`, `22.1k`).
- For a 44100 Hz file: topmost frequency label should be near 22050 Hz (≈ `22.1k`).
- For a 48000 Hz file: topmost label near `24.0k`.

### 5.4 Amplitude axis (right side)
- **Expect:** Right-axis shows dB scale from `-120dB` at the bottom to `0dB` at the top.
- Approximately 6 evenly spaced labels.

### 5.5 Grid lines
- **Expect:** Faint dashed horizontal and vertical lines overlaid on the spectrogram, aligned with the axis labels.

### 5.6 Axis titles
- **Expect:** "Time" label below the time axis, "Frequency (Hz)" label along the left axis (rotated), "Amplitude (dB)" label along the right axis (rotated).

### 5.7 Known-frequency test
- Generate or download a 1 kHz sine wave WAV file.
- **Expect:** A single bright horizontal band at exactly 1 kHz, all other frequencies dark.
- Verify the band lines up with the `1.0k` frequency label on the Y-axis.

### 5.8 Lossless vs. lossy frequency cutoff
- Upload a genuine FLAC file with full-range content.
- **Expect:** Frequency content visible up to the Nyquist limit.
- Upload an MP3 encoded at 128 kbps.
- **Expect:** Sharp high-frequency cutoff visible in the spectrogram (typically around 16 kHz for 128k MP3).

---

## 6. Metadata Panel

### 6.1 Header always visible
- After upload, check the top of the analysis view.
- **Expect:** Metadata header bar shows: filename, format, bitrate (kbps), sample rate (Hz), file size (MB).

### 6.2 Expand / collapse
- Click the metadata header bar.
- **Expect:** Expands to show a detailed grid. The chevron icon rotates 180°.
- Click again.
- **Expect:** Collapses. Chevron returns to default orientation.

### 6.3 Keyboard accessibility
- Tab to the metadata header.
- Press `Enter`.
- **Expect:** Panel expands.
- Press `Space`.
- **Expect:** Panel collapses.

### 6.4 Metadata fields — MP3
Upload a standard MP3 and expand the metadata panel. Verify:
- **File Name:** Correct filename with extension.
- **Format:** Shows "MP3" (or similar).
- **Duration:** In `mm:ss` (e.g. `3:42`).
- **File Size:** In MB to 1 decimal (e.g. `8.5 MB`).
- **Bitrate:** In kbps (e.g. `320.0 kbps`).
- **Sample Rate:** e.g. `44100 Hz`.
- **Bits Per Sample:** "Not applicable (lossy)" for MP3.
- **Channels:** e.g. `2`.
- **Container:** Not shown (MP3 codec = container).

### 6.5 Metadata fields — FLAC
Upload a FLAC file and verify:
- **Bits Per Sample:** e.g. `16-bit` or `24-bit` (not "Not applicable").
- **Container:** Not shown if container matches codec. If it differs, shown separately.
- **Format:** Should not say "lossy".

### 6.6 Metadata for edge-case codecs
- Upload a WAV file: Bits Per Sample should show actual bit depth (e.g. `16-bit`).
- Upload an Opus file: Bits Per Sample should show "Not applicable (lossy)".
- Upload an OGG file: Format should reflect Vorbis codec.

### 6.7 Clicking expanded panel does not collapse
- Expand the metadata panel.
- Click directly on the grid content inside the expanded area.
- **Expect:** Panel stays open (click does not bubble up to the toggle handler).

---

## 7. Navigation & State

### 7.1 "New File" button
- After a file is processed and spectrogram is shown, click "New File".
- **Expect:** Returns to the landing page (drag-drop zone visible again).
- **Expect:** Canvas placeholder reappears.
- **Expect:** Metadata panel is gone.

### 7.2 Upload another file after "New File"
- Click "New File", then upload a different audio file.
- **Expect:** New spectrogram renders correctly, metadata updates to the new file.

### 7.3 Page refresh
- Process a file, then press F5 to refresh.
- **Expect:** Returns to clean landing page (no cached state).
- **Expect:** WASM re-initializes on next file upload.

---

## 8. Responsive Layout

Test these widths either by resizing the browser window or using DevTools device emulation.

### 8.1 Wide desktop (≥1200px)
- **Expect:** Canvas fills up to 1200px max width, aspect ratio ~0.55 (wide format).
- **Expect:** Metadata header displays all fields in a single row.

### 8.2 Tablet (768px)
- **Expect:** Canvas narrows accordingly.
- **Expect:** Metadata panel fields wrap to column layout.
- **Expect:** "New File" button becomes full width.

### 8.3 Narrow mobile (480px)
- **Expect:** Canvas min width 280px, height adjusts to 0.75 aspect ratio (taller relative format).
- **Expect:** Processing indicator font shrinks.
- **Expect:** Upload area and format badges still readable.

### 8.4 Canvas resize mid-session
- Upload and process a file on a wide window.
- Slowly resize the window narrower, then wider.
- **Expect:** Canvas redraws after a ~300ms debounce at each new stable size.
- **Expect:** Spectrogram re-renders correctly at each size (axes re-labeled, color map unchanged).
- **Expect:** No blank permanent state after resize.

### 8.5 Very narrow window (280px)
- Resize browser to minimum (~280px wide).
- **Expect:** App doesn't overflow or break layout. Horizontal scrollbar may appear but nothing clips in a broken way.

---

## 9. Browser Compatibility

Run the full upload-and-process flow in each browser:

| Browser | Notes |
|---------|-------|
| Chrome (latest) | Reference browser — all features expected |
| Firefox (latest) | Check WASM SIMD support may differ |
| Safari (macOS, latest) | AudioContext requires user gesture; check webkit prefix handling |
| Edge (latest) | Chromium-based, should match Chrome |

For each:
- **Verify:** WASM loads (check console, no "WebAssembly" errors).
- **Verify:** Spectrogram renders after upload.
- **Verify:** Metadata panel expands/collapses.
- **Note:** Safari may require a click before AudioContext can be created.

---

## 10. Console & DevTools Checks

### 10.1 No errors on clean load
- Open DevTools Console, set filter to "Errors".
- Load the app with no file.
- **Expect:** Zero errors.

### 10.2 WASM network request
- Open DevTools Network tab, filter by "wasm".
- Upload a file.
- **Expect:** `rust_audio_processor_bg.wasm` (or similar) loads with HTTP 200 and is cached on subsequent uses.

### 10.3 Web Worker activity
- In DevTools, go to Sources → Threads (or similar panel).
- Upload a file.
- **Expect:** A worker thread appears during FFT processing and is reused on subsequent uploads.

### 10.4 Memory — no leak after multiple uploads
- Open DevTools Memory tab.
- Take a heap snapshot.
- Upload and process 5 different files in sequence ("New File" between each).
- Take another heap snapshot.
- Compare: memory usage should not grow unboundedly. Some growth is expected (WASM module stays loaded), but spectrogram data from previous files should be released.

### 10.5 Performance timeline
- Open DevTools Performance tab, start recording.
- Upload and process a file.
- Stop recording.
- **Verify:** Main thread is not fully blocked during FFT (worker thread doing the work).
- **Verify:** Canvas rendering appears as a series of short tasks (progressive chunks), not one long blocking task.

---

## 11. AudioContext / Autoplay Policy

### 11.1 Fresh page, immediate upload
- Open a fresh tab (no prior interaction with the page).
- Immediately drag-and-drop a file.
- **Expect:** Processing completes successfully. AudioContext should resume via the drop event (which counts as a user gesture).

### 11.2 Safari / strict autoplay policy
- On Safari or a browser with strict autoplay, load the page.
- Upload a file.
- **Expect:** If AudioContext is suspended, the app either resumes on the upload interaction or shows no error (silent resume).
- **Verify in console:** No "NotAllowedError" or "The AudioContext was not allowed to start" errors left unhandled.

---

## 12. AudioProcessorSelector (Debug Component)

If the `AudioProcessorSelector` component is visible in the UI:

### 12.1 "Test WASM" button
- Click "Test WASM".
- **Expect:** Console output confirming WASM module is loaded and responding.
- **Expect:** A result display showing method, processing time, file size, and output dimensions.

### 12.2 "Process with Rust" button
- After uploading a file, click "Process with Rust".
- **Expect:** Re-processes the audio and displays performance timing in the result area.

---

## Quick Sanity Checklist

Run this after any code change to catch regressions:

```
[ ] Landing page renders without errors
[ ] Drag-drop zone hover and drag-active states work
[ ] MP3 upload → spectrogram shown, no console errors
[ ] FLAC upload → spectrogram shown, bit depth in metadata
[ ] ALAC upload → ALAC-specific alert, no processing
[ ] Non-audio file → generic alert, no processing
[ ] Metadata panel expands and collapses on click and keyboard
[ ] "New File" returns to landing page
[ ] Second upload after "New File" works correctly
[ ] Canvas resizes correctly when window is resized
[ ] Time, frequency, and dB axes all labeled correctly
[ ] No console errors throughout the above steps
```
