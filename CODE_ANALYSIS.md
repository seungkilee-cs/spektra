# Spektra Codebase Analysis — Detailed Findings

## Executive Summary
This analysis covers the main UI components and styling of the Spektra audio spectrogram analyzer. The codebase is generally well-structured with good React patterns and accessibility features, but contains several bugs, performance issues, UX gaps, and code quality concerns that should be addressed.

---

## 🐛 BUGS

### 1. **SpectrumCanvas: Double Audio Processing on File Change**
**File:** `src/components/SpectrumCanvas.jsx` (lines 215–219)
**Issue:**
```jsx
useEffect(() => {
  if (fileUploaded && !isProcessing && !isProcessed) {
    processAudioFile(fileUploaded);
  }
}, [fileUploaded, isProcessing, isProcessed, processAudioFile]);
```
When a new file is uploaded, `processAudioFile` function reference changes due to `getOrCreateAudioContext` being recreated. This can trigger multiple processing cycles. Additionally, `processAudioFile` is listed as a dependency in line 211 but `getOrCreateAudioContext` is a dependency of `processAudioFile`, creating a potential dependency chain issue.

**Fix:** Memoize `getOrCreateAudioContext` with `useCallback([])` to stabilize its reference, and ensure the effect dependency array is minimal.

---

### 2. **FileUpload: File Type Validation Mismatch**
**File:** `src/components/FileUpload.jsx` (lines 8–39)
**Issue:**
```javascript
const supportedFormats = [
  { type: "audio/mpeg", extension: "MP3", color: "#4285f4" },
  // ...
  { type: "audio/mp4", extension: "AAC", color: "#ff9800" },
  { type: "audio/m4a", extension: "M4A", color: "#ff9800" },
  { type: "audio/x-m4a", extension: "M4A", color: "#ff9800" },
];
```

However, `src/App.jsx` (lines 21–33) also defines its own `supportedTypes` list that doesn't include `audio/aiff`. The `FileUpload.jsx` includes `audio/x-aiff` (line 18), but `App.jsx` doesn't validate against the full list. This causes inconsistency — a user could select `audio/aiff` in `FileUpload` which would pass the component's check, then fail `App.jsx`'s validation.

**Fix:** Centralize supported formats into a shared constant in a separate file (e.g., `src/constants/audioFormats.js`) and import in both components.

---

### 3. **SpectrumCanvas: Canvas Display When No File Uploaded**
**File:** `src/components/SpectrumCanvas.jsx` (lines 461–485)
**Issue:**
```jsx
useEffect(() => {
  if (!fileUploaded && canvasRef.current) {
    // Placeholder rendering
  }
}, [fileUploaded, canvasSize]);
```
This effect runs on every `canvasSize` change even when `fileUploaded` is null, causing redundant placeholder renders. More importantly, this placeholder is rendered even when the component is first mounted (before any file upload), which wastes processing cycles.

**Fix:** Separate the placeholder rendering into its own effect or only render it when transitioning from a file being uploaded to none.

---

### 4. **AudioMetadataHeader: Potential Key Warning with Dynamic Index**
**File:** `src/components/AudioMetadataHeader.jsx` (lines 124–131 and 150–158)
**Issue:**
```jsx
{summaryMetaItems.map((value, index) => (
  <span key={`${value}-${index}`} className="metadata-summary-line__meta-item">
    {value}
  </span>
))}
```
Using index-based keys combined with string values is brittle. If an item is filtered out or reordered, the key becomes unreliable. Similarly, on line 150, using `key={label}` is better but not guaranteed to be unique if labels are repeated.

**Fix:** Use `label` as the key for detail items (it's unique per iteration), and create proper unique IDs for summary items.

---

### 5. **App: Missing Error State Visualization**
**File:** `src/App.jsx` (lines 13–62)
**Issue:**
The `handleFileSelect` function catches errors (lines 58–59) but never sets an error state or informs the user beyond the console. If metadata extraction fails, the UI shows no feedback and the file is silently rejected.

**Fix:** Add an `errorMessage` state in `App.jsx`, display it to the user, and set it in the catch block.

---

### 6. **SpectrumCanvas: Missing Error Handling for Canvas Context**
**File:** `src/components/SpectrumCanvas.jsx` (lines 232, 464)
**Issue:**
```javascript
const ctx = canvas.getContext("2d");
```
No null check after `getContext()`. In rare cases (e.g., out-of-memory or browser limitations), this can return `null`, causing crashes when trying to call `ctx.fillRect()`, etc.

**Fix:** Add guard: `if (!ctx) return;` after `getContext("2d")`.

---

### 7. **SpectrumCanvas: Downsampling Logic Loses Precision**
**File:** `src/components/SpectrumCanvas.jsx` (lines 151–171)
**Issue:**
```javascript
if (spectrogramData.length > maxDisplayFrames) {
  const timeStep = Math.floor(spectrogramData.length / maxDisplayFrames);
  displayData = spectrogramData.filter((_, index) => index % timeStep === 0);
}
```
The downsampling skips frames but doesn't account for the loss of resolution. If FFT data has 3000 frames and `maxDisplayFrames = 2000`, the `timeStep = 1`, so no downsampling occurs. But the logic assumes it did, creating confusion. Also, better downsampling would average adjacent frames rather than skip them.

**Fix:** Use proper downsampling with averaging or interpolation, and add validation to ensure downsampling actually occurs when needed.

---

## ⚡ PERFORMANCE ISSUES

### 1. **SpectrumCanvas: Unnecessary Canvas Re-renders on Container Resize**
**File:** `src/components/SpectrumCanvas.jsx` (lines 428–439)
**Issue:**
```jsx
useEffect(() => {
  if (spectrogramDataRef.current && isProcessed && hasRenderedInitialRef.current) {
    renderSpectrogramFromData(spectrogramDataRef.current, { progressive: false });
  }
}, [canvasSize, isProcessed, renderSpectrogramFromData]);
```
Every time canvas size changes, the entire spectrogram is re-rendered non-progressively, causing a full redraw of potentially thousands of pixels. On mobile or slow devices, this can cause jank.

**Fix:** Implement a debounce or request-animation-frame-based batch resize handler. Alternatively, use `transform: scale()` on the canvas for non-destructive resizing.

---

### 2. **FileUpload: Unnecessary Re-renders of Badge Animations**
**File:** `src/components/FileUpload.jsx` (lines 103–114)
**Issue:**
```jsx
{supportedFormats.map((format, index) => (
  <span
    key={format.extension}
    className="file-type-badge"
    style={{ --badge-color: format.color, animationDelay: `${index * 0.1}s` }}
  >
    {format.extension}
  </span>
))}
```
The `animationDelay` is recalculated on every render. Also, the `supportedFormats` array is recreated on every render (not memoized), causing all badges to re-render even if props don't change.

**Fix:** Move `supportedFormats` outside the component or memoize it with `useMemo`.

---

### 3. **SpectrumCanvas: Redundant Canvas Size Computations**
**File:** `src/components/SpectrumCanvas.jsx` (lines 43–88)
**Issue:**
```jsx
const updateCanvasSize = useCallback(() => {
  if (!containerRef.current) return;
  const container = containerRef.current;
  const rect = container.getBoundingClientRect(); // Forces reflow
  const computedStyle = window.getComputedStyle(container); // Forces reflow
  // ... 19 more lines of calculations
}, []);

useEffect(() => {
  let resizeTimeout;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateCanvasSize, 300);
  };
  updateCanvasSize(); // Called immediately
  window.addEventListener("resize", handleResize);
  // ...
}, [updateCanvasSize]);
```
`getBoundingClientRect()` and `getComputedStyle()` force layout recalculations (reflow). This is called on mount and on every resize event (with 300ms debounce). Better to use `ResizeObserver` to avoid reading dimensions synchronously.

**Fix:** Use `ResizeObserver` instead of window resize events + debounce.

---

### 4. **SpectrumCanvas: Inefficient Progressive Rendering with Idle Callback**
**File:** `src/components/SpectrumCanvas.jsx` (lines 309–318)
**Issue:**
```javascript
if (progressiveDraw && endIndex < timeBins) {
  const scheduleNext = () => {
    pendingRenderRef.current.frame = requestAnimationFrame(() => {
      drawChunk(endIndex);
    });
  };
  pendingRenderRef.current.idle = scheduleIdleCallback(() => {
    scheduleNext();
  }, { timeout: 32 });
}
```
The logic schedules an idle callback first, then inside that, schedules a request animation frame. This adds extra latency. For a 3000-frame spectrogram with 32-frame chunks, this creates ~94 scheduling operations. Better to use `requestAnimationFrame` directly or batch more frames.

**Fix:** Schedule `requestAnimationFrame` directly without the idle callback, or increase chunk size dynamically.

---

### 5. **Debug Module: Always Evaluating Arguments**
**File:** `src/utils/debug.js` (lines 2–6)
**Issue:**
```javascript
export function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
```
Even when `DEBUG = false`, the function still receives and evaluates all arguments (e.g., `debugLog("prefix", obj, methodCall())`). The `methodCall()` is still executed. This wastes CPU cycles.

**Fix:** Use a macro-like approach or check DEBUG before passing arguments. In practice, this is minor if callers don't pass expensive computations, but it's not best practice.

---

## ♿ UX/ACCESSIBILITY ISSUES

### 1. **FileUpload: Missing Keyboard Navigation for Drag-and-Drop**
**File:** `src/components/FileUpload.jsx` (lines 72–119)
**Issue:**
```jsx
<div
  className={`file-upload-area ${dragActive ? "drag-active" : ""}`}
  onDragEnter={handleDrag}
  onDragLeave={handleDrag}
  onDragOver={handleDrag}
  onDrop={handleDrop}
  onClick={onButtonClick}
>
```
The drag-and-drop div is interactive but has no `role="button"`, `tabIndex`, or `onKeyDown` handler. Keyboard users cannot navigate to or activate this element.

**Fix:** Add `role="button"`, `tabIndex={0}`, and a `handleKeyDown` handler that calls `onButtonClick()` on Enter/Space.

---

### 2. **SpectrumCanvas: Missing Live Region for Processing Status**
**File:** `src/components/SpectrumCanvas.jsx` (lines 494–498)
**Issue:**
```jsx
{isProcessing && (
  <div className="processing-indicator" role="status" aria-live="polite">
    🦀 Processing with Rust+WASM...
  </div>
)}
```
The indicator is correctly marked as `aria-live="polite"`, but it's positioned absolutely above the canvas. Screen reader users may not notice it if they're focused on the canvas or file upload. The message lacks detail (e.g., no progress indicator).

**Fix:** Add more descriptive text like "Processing audio file, please wait" and ensure the live region is announced to screen readers immediately.

---

### 3. **AudioMetadataHeader: Collapsible Panel Lacks Keyboard Support Documentation**
**File:** `src/components/AudioMetadataHeader.jsx` (lines 110–162)
**Issue:**
```jsx
<section
  className={`metadata-panel ${expanded ? "metadata-panel--expanded" : ""}`}
  aria-expanded={expanded}
  aria-controls={detailsId}
  role="button"
  tabIndex={0}
  onClick={handlePanelClick}
  onKeyDown={handlePanelKeyDown}
>
```
Good accessibility here, but there's no visual indicator (e.g., `aria-label`) that describes the component as "toggle" or "expand". A screen reader user sees "button" but doesn't know what it does without reading all the metadata.

**Fix:** Add `aria-label="Toggle detailed metadata"` or similar.

---

### 4. **SpectrumCanvas: Canvas Description Incomplete for Accessibility**
**File:** `src/components/SpectrumCanvas.jsx` (lines 500–514)
**Issue:**
```jsx
<p id={canvasDescriptionId} className="sr-only">
  {audioMetadataRef.current
    ? `Spectrogram visualization. Duration ${audioMetadataRef.current.duration.toFixed(1)} seconds at ${audioMetadataRef.current.sampleRate} hertz.`
    : "Spectrogram visualization of uploaded audio."
}
</p>

<canvas
  ref={canvasRef}
  role="img"
  aria-label="Audio spectrogram visualization"
  aria-describedby={canvasDescriptionId}
/>
```
The description doesn't explain what the visual colors mean (blue = quiet, white = loud) or axis labels. A blind user cannot interpret the spectrogram.

**Fix:** Expand the description to: `"Spectrogram visualization. Colors represent amplitude: blue (quiet) to white (loud). Duration X seconds, sample rate Y Hz. Time axis shows MM:SS format, frequency axis shows Hz."`

---

### 5. **App: No Focus Management on File Upload**
**File:** `src/App.jsx` (lines 72–136)
**Issue:**
When a user uploads a file and the UI transitions to the analysis view, focus is not managed. The page doesn't scroll to the new content, and focus is not set to the new main content area. This is confusing for screen reader users.

**Fix:** Use `useRef` to focus on the analysis section when the file is uploaded, or implement scroll-to behavior.

---

### 6. **SpectrumCanvas: Color Map Not Accessible for Colorblind Users**
**File:** `src/components/SpectrumCanvas.jsx` (lines 254–291)
**Issue:**
The Spek color map (blue → cyan → green → yellow → orange → white) is not colorblind-friendly. Protanopia (red-blindness) users will see blue/cyan as indistinguishable from gray.

**Fix:** Offer an alternative colormap option (e.g., viridis, which is designed to be colorblind-friendly) or add a UI toggle.

---

### 7. **FileUpload: Error Alert Blocks User Interaction**
**File:** `src/components/FileUpload.jsx` (lines 37, 37) and `App.jsx` (lines 37, 49–51)
**Issue:**
```javascript
alert("Please select a supported audio file format.");
```
Using `alert()` is disruptive and blocks the entire page. Users cannot retry without dismissing the modal.

**Fix:** Replace with an inline error message displayed below the file upload area, or a toast notification.

---

## 🔧 CODE QUALITY ISSUES

### 1. **Inconsistent Console Logging Patterns**
**Files:** `src/components/SpectrumCanvas.jsx`, `src/utils/wasmAudioProcessor.js`
**Issue:**
The codebase mixes `debugLog()` from `debug.js`, bare `console.log()`, `console.time()`, and emoji-prefixed logging:
- `debugLog()` is used in `App.jsx`
- `console.log()` is used extensively in `SpectrumCanvas.jsx` and `wasmAudioProcessor.js`
- `console.time()` is used for performance tracking

**Fix:** Standardize on either `debugLog()` everywhere or create a dedicated logger that respects the DEBUG flag.

---

### 2. **Magic Numbers Throughout Codebase**
**Files:** `src/components/SpectrumCanvas.jsx`, `src/components/FileUpload.jsx`
**Issue:**
```javascript
// SpectrumCanvas.jsx
const leftMargin = 70;
const rightMargin = 60;
const bottomMargin = 50;
const topMargin = 30;
const chunkSize = Math.max(32, Math.floor(timeBins / 40));
const maxDisplayFrames = 2000;
const maxDisplayFreqs = 256;

// FileUpload.jsx
const minWidth = 280;
const maxWidth = 1200;
```
These magic numbers lack comments explaining their purpose or origin.

**Fix:** Extract to a `src/constants/canvasConfig.js` with documented values.

---

### 3. **Large Monolithic SpectrumCanvas Component**
**File:** `src/components/SpectrumCanvas.jsx` (520 lines)
**Issue:**
The component handles:
- Canvas sizing and responsiveness
- Audio processing state management
- Spectrogram rendering
- Axis drawing
- Progressive rendering scheduling

This violates single responsibility principle and makes testing and maintenance difficult.

**Fix:** Split into smaller components:
- `<SpectrogramRenderer>` — handles rendering logic
- `<CanvasContainer>` — handles sizing
- `<SpectrumAxes>` — handles axis drawing

---

### 4. **Unused Components and Code**
**Files:** `src/components/AudioMetadataDisplay.jsx`, `src/components/AudioProcessorSelector.jsx`
**Issue:**
These components are not imported or used in `App.jsx`. They exist but serve no purpose in the current app flow.

**Fix:** Either integrate them or delete them. If keeping for future use, document this clearly.

---

### 5. **Missing JSDoc Comments**
**Files:** All `.jsx` files
**Issue:**
React components lack JSDoc blocks describing props, return types, and purpose.

**Fix:** Add JSDoc comments:
```javascript
/**
 * Renders an audio spectrogram from decoded audio data.
 * @param {File} fileUploaded - The audio file to process
 * @returns {JSX.Element} Canvas container with spectrogram visualization
 */
const SpectrumCanvas = ({ fileUploaded }) => { ... };
```

---

### 6. **Inefficient Type Checking in AudioMetadataHeader**
**File:** `src/components/AudioMetadataHeader.jsx` (lines 55–62)
**Issue:**
```javascript
const containerDisplay = (() => {
  const container = metadata.container;
  if (!container || container === "Unknown") return null;
  if (codecBase && container.toLowerCase() === codecBase.toLowerCase()) {
    return null;
  }
  return container;
})();
```
This IIFE is verbose. It should be a simple conditional expression.

**Fix:**
```javascript
const containerDisplay = 
  (metadata.container && metadata.container !== "Unknown" && 
   (!codecBase || metadata.container.toLowerCase() !== codecBase.toLowerCase()))
    ? metadata.container
    : null;
```

---

### 7. **Hardcoded Color Values**
**Files:** `src/styles/FileUpload.css`, `src/styles/SpectrumCanvas.css`
**Issue:**
Colors are hardcoded throughout CSS without a design system:
```css
border-color: rgba(59, 130, 246, 0.4);
background: rgba(30, 41, 59, 0.1);
color: #94a3b8;
```

**Fix:** Use CSS custom properties (already partially done):
```css
:root {
  --primary-color: #3b82f6;
  --bg-dark: #0a0a0a;
  --text-secondary: #94a3b8;
}
```

---

## 🎯 MISSING FEATURES

### 1. **No Error Recovery UI**
**File:** `src/App.jsx`
**Issue:**
If audio processing fails in `SpectrumCanvas`, the user sees no error message. The processing spinner stops, but there's no "Retry" or "Try another file" option.

**Fix:** Add an error state to `SpectrumCanvas` and display it with a retry button.

---

### 2. **No Audio Playback Feature**
**Issue:**
The app analyzes audio but cannot play it back. Users cannot verify that the spectrogram matches what they're hearing.

**Fix:** Add a play/pause button with audio controls (optional enhancement, may be out of scope).

---

### 3. **No Export/Download Feature**
**Issue:**
Users cannot save the spectrogram image or data. They must screenshot or manually export.

**Fix:** Add a "Download as PNG" or "Download data" button.

---

### 4. **No Preset FFT Sizes**
**File:** `src/components/SpectrumCanvas.jsx` (line 121)
**Issue:**
FFT size is hardcoded to 1024. Users cannot change frequency resolution vs. time resolution tradeoff.

**Fix:** Add a UI dropdown (e.g., "FFT Size: 512 / 1024 / 2048") and re-process on change.

---

### 5. **No Zoom/Pan on Spectrogram**
**File:** `src/components/SpectrumCanvas.jsx`
**Issue:**
Large spectrograms are hard to examine in detail. Users cannot zoom into specific frequency/time regions.

**Fix:** Implement mouse wheel zoom and drag-to-pan (optional enhancement).

---

### 6. **No Frequency Peak Detection**
**Issue:**
No feature to identify prominent frequency peaks or label them automatically.

**Fix:** Implement peak detection algorithm and optional frequency labels (optional enhancement).

---

### 7. **No Accessibility for Interactive Canvas Elements**
**File:** `src/components/SpectrumCanvas.jsx`
**Issue:**
The canvas is non-interactive for keyboard/screen reader users. There's no text alternative for exploring the data.

**Fix:** Provide a data table view or keyboard-navigable frequency/time grid (optional enhancement).

---

## 📋 SUMMARY TABLE

| Category | Count | Severity |
|---|---|---|
| Bugs | 7 | 🔴 Critical (3), 🟡 Medium (4) |
| Performance | 5 | 🟡 Medium (4), 🟢 Low (1) |
| Accessibility | 7 | 🟡 Medium (6), 🔴 Critical (1) |
| Code Quality | 7 | 🟡 Medium (7) |
| Missing Features | 7 | 🟢 Low (7) |

---

## 🚀 RECOMMENDED FIXES (Priority Order)

1. **Critical:** Fix file type validation mismatch (Bug #2)
2. **Critical:** Add canvas context null check (Bug #6)
3. **Critical:** Improve colorblind accessibility (Accessibility #6)
4. **High:** Implement error state in App (Bug #5)
5. **High:** Memoize getOrCreateAudioContext (Bug #1)
6. **High:** Replace alert() with inline errors (Accessibility #7)
7. **Medium:** Add keyboard support to FileUpload (Accessibility #1)
8. **Medium:** Implement ResizeObserver (Performance #3)
9. **Medium:** Reduce console logging inconsistency (Code Quality #1)
10. **Low:** Extract magic numbers to constants (Code Quality #2)
