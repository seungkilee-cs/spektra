# Spektra Project - Comprehensive Analysis

## Project Overview
**Spektra** is a static web-based audio spectrum analyzer built with React, Vite, and Rust/WASM. It enables users to upload audio files and visualize their frequency content using FFT analysis with professional-grade features like dB scaling, color mapping, and metadata display. Inspired by [Spek](https://spek.cc), it runs entirely client-side on platforms like GitHub Pages with no backend required.

---

## 1. package.json - Dependencies & Scripts

### Project Metadata
- **Name**: spektra
- **Type**: ES Module (ESM)
- **Version**: 0.0.0
- **Homepage**: https://seungkilee-cs.github.io/Spektra
- **Access**: Private package

### Available Scripts
| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start development server |
| `start` | `vite` | Alias for dev server |
| `build` | `npm run build:wasm && vite build` | **Sequential**: Compile Rust→WASM first, then Vite bundle |
| `build:wasm` | `./_scripts/build-wasm.sh` | Bash script to compile Rust crate to WebAssembly |
| `test` | `vitest` | Run unit tests |
| `lint` | `eslint src --ext js,jsx` | Lint JavaScript/JSX files |
| `clean` | Removes `dist/`, `rust-audio-processor/target/`, `rust-audio-processor/pkg/` | Full clean build |
| `clean:wasm` | Removes generated WASM files from `src/wasm/` | Clean WASM artifacts only |
| `preview` | `vite preview` | Preview production build locally |
| `predeploy` | Runs build automatically before deploy | Pre-deployment hook |
| `deploy` | `gh-pages -d dist` | Deploy to GitHub Pages |

### Runtime Dependencies (4 packages)
```json
{
  "fft-js": "^0.0.12",              // FFT library (legacy, being replaced)
  "fft.js": "^4.0.4",               // Alternative FFT implementation
  "music-metadata": "^11.0.2",      // Extract audio metadata (title, bitrate, etc.)
  "react": "^19.0.0",               // UI framework
  "react-dom": "^19.0.0"            // React DOM rendering
}
```

**Note**: Both FFT libraries are included but the project is transitioning to Rust+WASM for performance.

### Dev Dependencies (11 packages)
```json
{
  "@eslint/js": "^9.21.0",          // ESLint core rules
  "@types/react": "^19.0.10",       // TypeScript types for React
  "@types/react-dom": "^19.0.4",    // TypeScript types for React DOM
  "@vitejs/plugin-react": "^4.3.4", // Vite React plugin (Fast Refresh)
  "eslint": "^9.21.0",              // Code linter
  "eslint-plugin-react-hooks": "^5.1.0",    // ESLint rules for React Hooks
  "eslint-plugin-react-refresh": "^0.4.19", // ESLint rules for React Fast Refresh
  "gh-pages": "^6.3.0",             // Deploy to GitHub Pages
  "globals": "^15.15.0",            // Global browser constants for ESLint
  "vite": "^6.2.0"                  // Build tool & dev server
}
```

---

## 2. vite.config.js - Build Configuration

```javascript
export default defineConfig({
  plugins: [react()],              // Enable React with Fast Refresh
  base: "/spektra/"                // Deploy at GitHub Pages subdirectory
})
```

### Key Configuration Points
- **React Plugin**: Enables JSX transformation and Fast Refresh (hot module replacement)
- **Base Path**: `/spektra/` ensures assets load correctly on GitHub Pages subdirectory
- **Minimal Config**: Relies on Vite defaults for optimization

### Build Implications
- Outputs to `dist/` directory
- Automatic code splitting and tree-shaking
- CSS modules and asset optimization included

---

## 3. eslint.config.js - Code Quality Standards

### Configuration Structure
Flat config format (ESLint v9+) with two rule sets:

#### Set 1: Ignore Rules
```javascript
{ ignores: ['dist'] }  // Skip linting the build output
```

#### Set 2: Code Style Rules
- **Files**: `**/*.{js,jsx}` (all JavaScript/JSX files)
- **Target**: ES2020 with latest features, browser globals
- **Plugins**:
  - `react-hooks`: Validates Hook usage (dependency arrays, call order)
  - `react-refresh`: Enforces Fast Refresh compatibility (exports as components)

### Linting Rules
```javascript
...js.configs.recommended.rules,              // ESLint recommended rules
...reactHooks.configs.recommended.rules,      // React Hooks linting
'no-unused-vars': [error, varsIgnorePattern: '^[A_Z_]']  // Allow unused UPPERCASE constants
'react-refresh/only-export-components': [warn, allowConstantExport: true]  // Component exports only
```

---

## 4. README.md - Project Documentation

### Purpose
A **static, client-side audio spectrum analyzer** for verifying audio file quality. No installation required; runs in browser.

### Core Features
1. **Audio File Support**: MP3, M4A, FLAC, WAV, OGG, ALAC via drag-and-drop
2. **Spectrogram Visualization**: FFT-based frequency display with logarithmic dB scaling
3. **Metadata Display**: Bitrate, sample rate, codec, duration in expandable header
4. **Professional Labels**: Frequency (Hz) left, dB right, time bottom
5. **Performance**: Downsampling for large files, smooth rendering
6. **Cross-Browser**: Web Audio API with fallbacks
7. **Privacy**: 100% client-side, no server storage

### Technology Stack
- **Frontend**: React.js + Vite
- **Audio Processing**: Web Audio API decoding
- **FFT**: Custom Rust implementation compiled to WASM (replacing JavaScript)
- **Metadata**: music-metadata library
- **Rendering**: HTML5 Canvas (pixel-perfect, efficient)

### Motivation
Creator's experience with fake/low-quality FLAC files from online vendors led to building this tool as a lightweight web alternative to Spek (cross-platform, no installation).

### Current Priorities (Completed)
- ✅ **Rust + WASM FFT**: 3-10x performance improvement over JavaScript
- ✅ **UI Revamp**: Dark theme, responsive design, "Spek for Web" aesthetic
- ✅ **Format Support**: All major formats via browser

### Future Enhancements
- Mobile optimization & PWA support
- Real-time microphone analysis
- Export options (PNG, CSV)
- Comparative analysis (overlay multiple files)
- GPU acceleration via WebGL

---

## 5. Rust Audio Processor - WASM Architecture

### rust-audio-processor/Cargo.toml - Build Configuration

```toml
[package]
name = "rust-audio-processor"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]  # Compile to C-compatible dynamic library (WASM module)

[dependencies]
wasm-bindgen = "0.2"                    # JS↔Rust FFI
console_error_panic_hook = "0.1.7"      # Better WASM panic messages
web-sys = { version = "0.3", features = ["console"] }  # Browser console API
```

#### Key Points
- **cdylib**: Produces `.wasm` binary compatible with JavaScript engines
- **wasm-bindgen**: JavaScript bindings for Rust functions
- **console_error_panic_hook**: Ensures Rust panics appear in browser console (not silent failures)

### Module Structure

```
rust-audio-processor/src/
├── lib.rs                 # Module exports & integration tests
├── audio_processor.rs     # WASM-exported processor (main interface)
├── fft.rs                 # Cooley-Tukey FFT implementation
├── hann_window.rs         # Window function for spectral leakage reduction
└── utils.rs               # Complex number math & utilities
```

---

## 6. rust-audio-processor/src/lib.rs - Module Hub

```rust
pub mod utils;
pub mod fft;
pub mod hann_window;
pub mod audio_processor;

pub use audio_processor::*;  // Re-export main WASM interface
```

### Integration Test (`test_full_pipeline`)
- Validates complete processing: windowing → FFT → magnitude extraction
- Ensures all modules work together correctly

---

## 7. rust-audio-processor/src/audio_processor.rs - WASM Interface

### Architecture: Dual-Target Compilation
```rust
#[cfg(target_arch = "wasm32")]  // Compile ONLY for WebAssembly
#[cfg(not(target_arch = "wasm32"))]  // Compile for native (tests)
```

Allows same code to run in browser AND as Rust tests without cross-compilation.

### Core Component: `SpectrogramProcessor`

#### Struct Fields
```rust
pub struct SpectrogramProcessor {
    fft_size: usize,                // Window size (must be power of 2)
    twiddle_cache: TwiddleCache,    // Pre-computed FFT coefficients
    buffer: Vec<Complex>,            // Reusable working buffer
    time_stride: usize,              // Downsampling in time dimension
    freq_stride: usize,              // Downsampling in frequency dimension
}
```

#### Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `new(fft_size)` | Initialize processor | SpectrogramProcessor |
| `with_strides(time, freq)` | Builder pattern for downsampling | Self |
| `set_strides(time, freq)` | Update downsampling after creation | () |
| `process_window(audio_data[fft_size])` | FFT one audio frame | Vec<f32> magnitudes |
| `compute_spectrogram(audio[..], overlap)` | Process entire file | Flat Vec<f32> |
| `process_windows(audio[..], overlap, time_stride?, freq_stride?)` | Batched with downsampling | (Vec<f32>, num_windows, freq_bins) |

#### Processing Pipeline
```
1. Copy f32 samples → Complex buffer (real part only, imag=0)
2. Apply Hann window (reduce spectral leakage)
3. FFT via cached twiddle factors
4. Extract magnitudes (first half due to symmetry)
5. Optional: Apply time/frequency downsampling
```

### WASM Exports (Rust → JavaScript)

```rust
#[cfg(target_arch = "wasm32")]
pub struct WasmSpectrogramProcessor { ... }

// Exposed methods:
- new(fft_size: usize)
- process_window(audio_data: &[f32]) → Vec<f32>
- compute_spectrogram(audio_data: &[f32], overlap: f32) → Vec<f32>
- process_windows(audio_data: &[f32], overlap: f32, 
                  time_stride?: usize, freq_stride?: usize) → SpectrogramBatch
```

#### Helper Exports
```rust
greet(name: &str) → String              // Test function
multiply_array(numbers: &[f32], factor: f32) → Vec<f32>  // Demo function
```

### Logging System
```rust
macro_rules! console_log {
    // WASM: calls browser console.log via JS
    // Native: calls println! for testing
}
```

### Test Coverage
- ✅ Processor creation with power-of-2 validation
- ✅ Single window processing (sine wave signal)
- ✅ Full spectrogram computation
- ✅ Batch processing with strides
- ✅ Error cases (invalid FFT size, empty audio)

---

## 8. rust-audio-processor/src/fft.rs - Cooley-Tukey FFT

### Algorithm: Radix-2 Decimation-in-Time (DIT)
Computes FFT in O(n log n) time by recursively dividing problem size.

### Core Components

#### `TwiddleCache` - Pre-computed Coefficients
```rust
pub struct TwiddleCache {
    fft_size: usize,
    stages: Vec<Vec<Complex>>,  // One vector per FFT stage
}
```

**Purpose**: Avoid recomputing twiddle factors (complex roots of unity) during processing.
- **Memory**: O(n) storage
- **Time Savings**: O(n) per transform (single pass vs. recalculation)

**Twiddle Factors**: W_N^k = e^(-2πik/N) (unit circle points)

#### Main Functions

| Function | Parameters | Purpose |
|----------|-----------|---------|
| `fft()` | `&mut [Complex]` | In-place FFT (creates temporary cache) |
| `fft_with_cache()` | `&mut [Complex], &TwiddleCache` | Reuse cached twiddles (faster) |
| `ifft()` | `&mut [Complex]` | Inverse FFT via conjugate trick |

#### Processing Steps

```
1. Bit Reversal: Permute indices for in-place computation
2. Butterfly Stages: Combine sub-problems
   - Stage 1: 2-element butterflies
   - Stage 2: 4-element butterflies
   - ... up to FFT size
3. Magnitude Extraction: sqrt(real² + imag²) for each bin
```

### Performance Optimization: SIMD (WebAssembly)

```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
unsafe fn butterfly_pair_simd(...)  // Process 2 butterflies in parallel
```

**SIMD Features**:
- `f32x4_mul`, `f32x4_add`, `f32x4_sub`: Vectorized operations
- `i32x4_shuffle`: Rearrange lanes (complex conjugate simulation)
- Processes 4 floats per instruction (2 complex numbers)
- Falls back to scalar on non-SIMD targets

### Test Suite
- ✅ **Impulse Response**: [1,0,0,0] → all frequency bins = 1
- ✅ **DC Signal**: [1,1,1,1] → energy only at bin 0
- ✅ **Roundtrip**: FFT → IFFT reconstructs original signal
- ✅ **Twiddle Factors**: Unit magnitude, proper angles

---

## 9. rust-audio-processor/src/hann_window.rs - Window Function

### Purpose
Reduce **spectral leakage** when FFT processes finite-duration signals. Hann window tapers signal to zero at edges.

### Formula
```
w[n] = 0.5 * (1 - cos(2π·n / (N-1)))
```
Properties:
- Periodic, symmetric around center
- Zero at endpoints (n=0, n=N-1)
- Peak value of 1.0 in middle
- Reduces spectral leakage compared to rectangular window

### Exported Functions

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `apply_hann_window()` | `&mut [Complex]` | () | Apply to complex signal (FFT input) |
| `apply_hann_window_real()` | `&mut [f32]` | () | Apply to real signal (before conversion) |
| `generate_hann_window()` | size: usize | Vec<f32> | Get window coefficients for reuse |

### Tests
- ✅ **Symmetry**: Window is symmetric around center
- ✅ **Endpoints**: First and last values ≈ 0
- ✅ **Application**: Signal properly attenuated

---

## 10. rust-audio-processor/src/utils.rs - Mathematical Utilities

### Complex Number Struct
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Complex {
    pub real: f32,
    pub imag: f32,
}
```

#### Methods
```rust
Complex::new(real, imag)                    // Constructor
Complex::add(a, b)                          // Addition
Complex::subtract(a, b)                     // Subtraction
Complex::multiply(a, b)                     // Multiplication: (a.r·b.r - a.i·b.i) + i(a.r·b.i + a.i·b.r)
magnitude()                                 // sqrt(real² + imag²)
```

### Bit Reversal
```rust
pub fn bit_reverse(x: usize, bits: usize) -> usize
```
**Purpose**: Permute indices for FFT's in-place computation.

**Example**: bit_reverse(1, 3) = 4
- Input: 001₂
- Output: 100₂

### Twiddle Factor Generation
```rust
pub fn generate_twiddle_factor(n: usize) -> Vec<Complex>
```
Generates n complex roots of unity:
- W_N^k = e^(-2πik/N) for k=0,1,...,N-1
- All have magnitude ≈ 1 (on unit circle)

### Butterfly Operation
```rust
pub fn butterfly_operation(a: Complex, b: Complex, twiddle: Complex) 
    -> (Complex, Complex)
```

**Computation**:
```
twiddle_b = twiddle × b
upper = a + twiddle_b
lower = a - twiddle_b
```

**Purpose**: Fundamental FFT combine operation (Cooley-Tukey algorithm).

### Test Suite (Comprehensive)
- ✅ **Bit Reversal**: 4 test cases including edge cases
- ✅ **Complex Math**: Addition, subtraction, multiplication with 4+ cases each
- ✅ **Twiddle Factors**: Magnitude verification, identity check (W^0)
- ✅ **Butterfly**: Upper/lower computation with 2 test cases

---

## 11. src/styles/SpectrumCanvas.css - Spectrogram Visualization Styling

### Container Styling (`.spectrum-canvas-container`)
```css
Grid Layout: 3 rows (controls, metadata, canvas)
Background: Semi-transparent dark slate with backdrop blur
Border: Subtle glassmorphism effect with inset highlight
Responsive: Padding & gaps scale with viewport (clamp)
```

**Key Properties**:
- `grid-template-rows: auto auto 1fr` - Last row (canvas) grows
- `backdrop-filter: blur(20px)` - Frosted glass effect
- `box-shadow`: Multiple layers (outer depth, inset light edge)

### Canvas Styling (`.spectrum-canvas`)
```css
Background: #0a0a0a (near-black for contrast)
Image Rendering: crisp-edges (pixel-perfect, no interpolation)
Hover: Subtle lift & glow effect (translateY(-2px))
High DPI: -webkit-optimize-contrast for sharp display
```

### Control Elements (`.renderer-controls`)
```css
Layout: Flex row with labels & dropdown
Font: JetBrains Mono (monospace, technical look)
Colors: #cbd5f5 (light blue-gray text)
Dropdown: Custom styling (no-appearance) with hover/focus states
```

### Processing Indicator (`.processing-indicator`)
```css
Position: Fixed above canvas (top: -32px to -20px depending on viewport)
Animation: Pulsing "processing" badge while FFT runs
Colors: #fbbf24 (amber/yellow)
Responsive: Font size & padding scale with viewport
```

### Responsive Breakpoints
| Breakpoint | Changes |
|-----------|---------|
| ≤1024px | Container width constrained |
| ≤768px | Reduced padding & gaps, adjusted positioning |
| ≤600px | Smaller border radius |
| ≤480px | Smaller indicator badge |
| High DPI (2x+) | Optimize image rendering for sharpness |

---

## 12. src/styles/FileUpload.css - Upload Area Styling

### Container (`.file-upload-container`)
```css
Max-width: 500px (modest, focused)
Perspective: 1000px (enables 3D transforms)
```

### Upload Area (`.file-upload-area`)
```css
Base: Subtle semi-transparent background with blur
Border: Light slate with subtle opacity
Transitions: Smooth 0.4s ease for all properties
Hover: Slight lift & rotation (translateY, rotateX)
Drag-Active: Blue accent with intense glow
```

#### State Changes
```
Normal  → Hover   : Lift 5px, rotate 5°, blue tint
Normal  → Active  : Lift 8px, rotate 8°, intense blue glow
```

### Upload Icon (`.upload-icon`)
```css
Centered with margin
Two Animations:
  1. Music Icon: Gradient text, drops shadow, floats up/down (3s)
  2. Platform Base: Blue gradient pulse below (2s)
```

#### Keyframes
```
float: -8px to 0px vertical bob
pulse: 1.0× to 1.2× horizontal scale
```

### Text & Badges (`.upload-text`, `.file-type-badge`)
```css
Headings: White, weighted, scaled clamp(1.1rem to 1.3rem)
Paragraphs: Light gray, smaller font
Badges: Individual colors (--badge-color), fade-in-scale animation
```

**Badge Interaction**:
- Hover: Color invert (background←→text), lift 2px, scale 1.05×

### Responsive Adjustments
| Breakpoint | Changes |
|-----------|---------|
| ≤600px | Border radius 20px, margin on badges |
| ≤700px (height) | Reduce vertical spacing for short screens |

---

## 13. src/styles/AudioMetadataDisplay.css - Metadata Styling

**Minimal, Functional Styling**:
```css
.audio-metadata {
  margin-top: 2rem;
  color: #cccccc;  /* Light gray for readability */
}

.audio-metadata p {
  margin: 0.5rem 0;  /* Breathing room between items */
}
```

**Purpose**: Display parsed audio metadata (bitrate, sample rate, codec, duration).

---

## Integration Architecture Summary

```
JavaScript/React (Browser)
    ↓ Audio File Upload
    ↓ Web Audio API Decode → f32 samples
    ↓
WASM Layer (rust-audio-processor)
    ├─ WasmSpectrogramProcessor
    ├─ process_windows()
    │   ├─ SpectrogramProcessor
    │   ├─ apply_hann_window()
    │   ├─ fft_with_cache()
    │   │   ├─ TwiddleCache (pre-computed)
    │   │   ├─ bit_reverse()
    │   │   ├─ butterfly_operation()
    │   │   └─ [SIMD optimization]
    │   └─ magnitude extraction
    ↓
Spectrogram Data (2D: time × frequency)
    ↓
Canvas Rendering
    └─ SpectrumCanvas.css styling
```

### Performance Strategy
1. **Rust/WASM**: O(n log n) FFT vs. O(n²) naive
2. **Twiddle Caching**: Avoid redundant trig calculations
3. **Stride Downsampling**: Reduce output size for large files
4. **SIMD**: Parallel butterfly operations on WASM
5. **In-place FFT**: Minimal memory allocation

### Build Process
```
npm run build
    ↓
1. ./_scripts/build-wasm.sh
   └─ Compiles rust-audio-processor/ → WebAssembly
      (Outputs: src/wasm/*.wasm, src/wasm/*.js, src/wasm/*.ts)
    ↓
2. vite build
   └─ Bundles React + WASM → dist/
      (Inlines WASM in bundle or references it)
```

---

## Key Architectural Decisions

### 1. **Rust + WASM for FFT**
- **Why**: JavaScript FFT was too slow (3-10x performance improvement)
- **Trade-off**: Adds build complexity, but handles 10+ minute audio files smoothly

### 2. **Dual-Target Compilation**
- **Why**: Same code runs in browser (WASM) AND in Rust tests (native)
- **Benefit**: Testability without WebAssembly runtime, catch bugs early

### 3. **Twiddle Factor Caching**
- **Why**: Trigonometric calculations are expensive
- **Cost**: O(n) memory, saved on every FFT after first creation

### 4. **Stride Downsampling**
- **Why**: Files with 10+ minutes of audio produce huge outputs
- **Solution**: Skip every Nth window (time) or frequency bin (freq) for reduction

### 5. **Canvas Rendering**
- **Why**: DOM/SVG too slow for pixel-level spectrogram
- **Trade-off**: Manual pixel manipulation, but highly performant

### 6. **GitHub Pages Deployment**
- **Why**: No backend needed, static site
- **Constraint**: Base path `/spektra/` in config

---

## Dependency Review

### Critical Dependencies
- **wasm-bindgen**: Essential for Rust↔JS communication
- **music-metadata**: Only way to extract metadata client-side
- **React 19**: Latest features, performance improvements

### Optional/Legacy
- **fft-js**, **fft.js**: Being phased out (Rust WASM is replacement)

### Development Quality
- **ESLint + plugins**: Ensures code quality
- **Vitest**: Modern test runner (Vite-native)
- **gh-pages**: GitHub Pages automation

---

## Build & Deployment Flow

```
Development
  npm install
  npm run dev          → localhost:5173 (Fast Refresh enabled)
  npm run lint         → Check code quality
  npm test             → Run tests

Production
  npm run build:wasm   → Compile Rust
  npm run build        → Bundle with Vite
  npm run preview      → Test production build locally
  npm run deploy       → Push dist/ to GitHub Pages (gh-pages branch)
```

---

## Summary of Files

| File | Type | Purpose | Key Content |
|------|------|---------|------------|
| **package.json** | Config | Dependencies & scripts | React, Vite, Rust build, deploy |
| **vite.config.js** | Config | Vite build setup | React plugin, `/spektra/` base path |
| **eslint.config.js** | Config | Code quality rules | React Hooks, Fast Refresh linting |
| **README.md** | Docs | Project overview | Features, motivation, tech stack |
| **Cargo.toml** | Config | Rust dependencies | wasm-bindgen, web-sys, console hook |
| **lib.rs** | Rust | Module hub | Exports, integration tests |
| **audio_processor.rs** | Rust | WASM interface | SpectrogramProcessor, batching, tests |
| **fft.rs** | Rust | FFT algorithm | Cooley-Tukey, TwiddleCache, SIMD |
| **hann_window.rs** | Rust | Window function | Spectral leakage reduction |
| **utils.rs** | Rust | Math utilities | Complex numbers, bit reversal, butterfly |
| **SpectrumCanvas.css** | CSS | Spectrogram styling | Grid layout, canvas, processing indicator |
| **FileUpload.css** | CSS | Upload area styling | 3D transforms, animations, responsiveness |
| **AudioMetadataDisplay.css** | CSS | Metadata display | Minimal styling for text metadata |

---

## Performance Characteristics

### FFT Processing
- **Time Complexity**: O(n log n) where n = FFT size
- **Space Complexity**: O(n) for buffer + twiddle cache
- **Typical**: 8-10 million sample file → ~1-3 seconds (Rust/WASM)
- **Previous**: Same file → crash or 30+ seconds (JavaScript)

### Rendering
- **Canvas**: Pixel-by-pixel efficient
- **Downsampling**: Stride reduces output by time_stride × freq_stride factor
- **Memory**: ~10-50 MB for typical 4K spectrogram

### Network
- **WASM Bundle**: ~100-200 KB (optimized Rust code)
- **Total App**: ~300-500 KB (with React + dependencies)

---

## Testing Coverage

### Rust Unit Tests (22+ tests)
- Complex arithmetic (add, subtract, multiply)
- FFT correctness (impulse, DC, roundtrip)
- Hann window symmetry & endpoints
- Bit reversal
- Twiddle factors (magnitude, angle)
- Butterfly operations
- Processor creation & batch processing
- Edge cases (empty audio, invalid FFT size)

### Integration Tests
- Full pipeline: windowing → FFT → magnitude

### ESLint
- No unused variables (UPPERCASE ignored)
- React Hooks dependencies
- Component-only exports

---

## Configuration Highlights

### Base Path for GitHub Pages
```javascript
base: "/spektra/"  // Assets loaded from /spektra/index.html, /spektra/assets/...
```

### WASM Module Output
```bash
./_scripts/build-wasm.sh
# Outputs to: src/wasm/
#   - rust_audio_processor.wasm (binary)
#   - rust_audio_processor.js    (loader)
#   - rust_audio_processor.d.ts   (TypeScript types)
```

---

## Notable Code Patterns

### 1. Conditional Compilation
```rust
#[cfg(target_arch = "wasm32")]
// Code only for WebAssembly

#[cfg(not(target_arch = "wasm32"))]
// Code only for native Rust/tests
```

### 2. Builder Pattern
```rust
processor.with_strides(2, 2)  // Returns Self for chaining
```

### 3. Macro for Dual-Target Logging
```rust
console_log!("message")  // console.log in WASM, println! in tests
```

### 4. CSS Responsive Design
```css
clamp(min, preferred, max)  /* Fluid scaling between breakpoints */
@media (max-width: 768px)   /* Mobile adjustments */
@media (-webkit-min-device-pixel-ratio: 2)  /* High DPI screens */
```

### 5. Glassmorphism Effect
```css
backdrop-filter: blur(20px);
border: 1px solid rgba(..., 0.3);
box-shadow: 0 12px 28px rgba(..., 0.38), inset 0 1px 0 rgba(..., 0.05);
```

