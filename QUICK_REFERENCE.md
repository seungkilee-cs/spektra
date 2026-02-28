# Spektra Code Analysis - Quick Reference Card

## 🚨 Critical Issue (Fix Now)

### Hann Window Division by Zero
```rust
// ❌ BROKEN (line 8, 18, 26 in hann_window.rs)
let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
// Fails when n == 1: divides by 0.0 → NaN

// ✅ FIXED
if n < 2 { return; }  // Add this guard
let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
```

**Time:** 5 minutes | **Impact:** Prevents spectrum corruption

---

## 🔴 High Priority Bugs (Fix This Week)

### 1. Overlap Not Validated
```rust
// ❌ BROKEN (line 112, 147 in audio_processor.rs)
let hop_size = ((self.fft_size as f32) * (1.0 - overlap)) as usize;
// overlap = 1.5 → negative → wraps around!

// ✅ FIXED
assert!(overlap >= 0.0 && overlap < 1.0, "overlap must be [0.0, 1.0)");
let hop_size = ((self.fft_size as f32) * (1.0 - overlap)) as usize;
```

**Time:** 5 minutes | **Impact:** Prevents undefined behavior

---

### 2. Process Window Silent Failures
```rust
// ❌ BROKEN (line 85-88 in audio_processor.rs)
if audio_data.len() != self.fft_size {
    console_log!("⚠️ Audio data length {} != fft_size {}", ...);
    return Vec::new();  // Caller can't tell if this was success or error!
}

// ✅ FIXED (Option A: Return Result)
pub fn process_window(&mut self, audio_data: &[f32]) -> Result<Vec<f32>, String> {
    if audio_data.len() != self.fft_size {
        return Err(format!("Expected {} samples, got {}", self.fft_size, audio_data.len()));
    }
    // ... rest
    Ok(magnitudes)
}

// ✅ FIXED (Option B: Assert/Panic)
assert_eq!(audio_data.len(), self.fft_size,
    "Audio data length mismatch: expected {}, got {}", 
    self.fft_size, audio_data.len());
```

**Time:** 10 minutes | **Impact:** Proper error detection

---

### 3. FFT Size Bounds Missing
```rust
// ❌ BROKEN (line 48 in audio_processor.rs)
assert!(fft_size.is_power_of_two(), "FFT size must be power of 2");
// FFT size = 2^30 (1GB) would pass!

// ✅ FIXED
assert!(
    fft_size.is_power_of_two() && fft_size >= 2 && fft_size <= 65536,
    "FFT size must be power of 2 between 2 and 65536, got {}", fft_size
);
```

**Time:** 5 minutes | **Impact:** Prevents OOM crashes

---

### 4. Unused FFT Dependencies
```json
// ❌ BROKEN (package.json)
{
  "dependencies": {
    "fft-js": "^0.0.12",    // UNUSED (replaced by Rust)
    "fft.js": "^4.0.4",     // UNUSED (replaced by Rust)
    "music-metadata": "^11.0.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}

// ✅ FIXED
{
  "dependencies": {
    "music-metadata": "^11.0.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Time:** 5 minutes | **Impact:** Reduces bundle size ~100KB

---

## 🟡 Performance Issues (10-20% Speedup)

### Hann Window Caching
```rust
// ❌ CURRENT (recomputes every window)
pub struct SpectrogramProcessor {
    fft_size: usize,
    twiddle_cache: TwiddleCache,
    buffer: Vec<Complex>,
    // NO HANN CACHE
}

pub fn process_window(&mut self, audio_data: &[f32]) -> Vec<f32> {
    // ... copy to buffer ...
    apply_hann_window(&mut self.buffer);  // ← Recomputes trig each time!
}

// ✅ FIXED (precompute once)
pub struct SpectrogramProcessor {
    fft_size: usize,
    twiddle_cache: TwiddleCache,
    buffer: Vec<Complex>,
    hann_window: Vec<f32>,  // ← ADD THIS
}

impl SpectrogramProcessor {
    pub fn new(fft_size: usize) -> Self {
        let hann_window = generate_hann_window(fft_size);  // Compute once
        // ...
    }

    pub fn process_window(&mut self, audio_data: &[f32]) -> Vec<f32> {
        for (i, &sample) in audio_data.iter().enumerate() {
            self.buffer[i].real = sample * self.hann_window[i];  // Reuse cached
            self.buffer[i].imag = 0.0;
        }
        // Skip apply_hann_window call
        fft_with_cache(&mut self.buffer, &self.twiddle_cache);
        // ...
    }
}
```

**Time:** 30 minutes | **Gain:** 10-20% faster for 50+ windows

---

## 📋 Configuration Fixes

### Add .gitignore for WASM
```gitignore
# WASM auto-generated artifacts
src/wasm/rust_audio_processor.js
src/wasm/rust_audio_processor_bg.wasm
src/wasm/rust_audio_processor_bg.wasm.d.ts
src/wasm/rust_audio_processor.d.ts
```

**Time:** 5 minutes | **Impact:** Prevents manual edits

---

### Fix Build Script Error Handling
```bash
#!/bin/bash
set -e  # Exit on first error ← ADD THIS

echo "Building WASM module..."

if ! command -v wasm-pack &> /dev/null; then
    echo "ERROR: wasm-pack not found"
    exit 1
fi

cd rust-audio-processor
wasm-pack build --target web --release --out-dir ../src/wasm || {
    echo "ERROR: WASM build failed"
    exit 1
}
cd ..

if [ ! -f "src/wasm/rust_audio_processor_bg.wasm" ]; then
    echo "ERROR: WASM binary not created"
    exit 1
fi

echo "✅ WASM build successful"
```

**Time:** 15 minutes | **Impact:** Catches build failures early

---

## 🧪 Missing Tests (Add These)

### Edge Case Tests for Hann Window
```rust
#[test]
fn test_hann_window_n_equals_1() {
    let mut signal = vec![Complex::new(1.0, 0.0)];
    apply_hann_window(&mut signal);  // Should not panic/NaN
    assert!(!signal[0].real.is_nan());
}

#[test]
fn test_hann_window_n_equals_2() {
    let window = generate_hann_window(2);
    assert_eq!(window.len(), 2);
    assert!(!window.iter().any(|w| w.is_nan()));
}
```

**Time:** 30 minutes | **Impact:** Catches edge cases

---

### FFT Accuracy Test
```rust
#[test]
fn test_fft_sine_wave_frequency() {
    // Generate 1000 Hz sine wave at 44100 Hz sample rate
    let sample_rate = 44100.0;
    let freq = 1000.0;
    let fft_size = 4096;
    
    let mut signal: Vec<Complex> = (0..fft_size)
        .map(|i| {
            let t = i as f32 / sample_rate;
            let sample = (2.0 * PI * freq * t).sin();
            Complex::new(sample, 0.0)
        })
        .collect();
    
    fft(&mut signal);
    
    // Peak should be at bin ≈ 1000 * 4096 / 44100 ≈ 93
    let magnitudes: Vec<f32> = signal.iter().map(|c| c.magnitude()).collect();
    let peak_bin = magnitudes.iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .map(|(i, _)| i)
        .unwrap();
    
    assert!((peak_bin as f32 - 93.0).abs() < 5.0);  // Within tolerance
}
```

**Time:** 1 hour | **Impact:** Verifies FFT correctness

---

## 📊 Before/After Checklist

### Before Fixing
- [ ] Understand the issue by reading relevant analysis document
- [ ] Locate exact file and line numbers
- [ ] Read the "Impact" section to know what breaks

### Fixing
- [ ] Copy the "✅ FIXED" code example
- [ ] Adapt to your codebase if needed
- [ ] Run tests to verify no regression
- [ ] Verify the fix solves the problem

### After Fixing
- [ ] All existing tests pass
- [ ] New tests added for edge cases
- [ ] Code follows project conventions
- [ ] Commit message references the issue

---

## Priority Order

### Do First (Critical, 35 minutes)
1. Hann window division by zero (5 min)
2. Overlap validation (5 min)
3. FFT size bounds (5 min)
4. Remove unused FFT packages (5 min)
5. Add .gitignore WASM files (5 min)
6. Process window error handling (10 min)

### Do Next (High-Impact, 2-3 hours)
7. Hann window caching (30 min, +10-20% perf)
8. Build script error handling (15 min)
9. Add edge case tests (1 hour)
10. WASM init error handling (20 min)

### Do Later (Nice-to-Have, 1+ hours)
11. Standardize error handling (2 hours)
12. Add FFT accuracy tests (1 hour)
13. Complex operator traits (30 min)
14. Fix comment typos (5 min)

---

## Testing Commands

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- fft.rs

# Lint JavaScript
npm run lint

# Build WASM
npm run build:wasm

# Full build
npm run build

# Clean rebuild
npm run clean && npm run build
```

---

## Document Locations

- **All Issues:** `COMPLETE_FINDINGS_SUMMARY.md`
- **Rust/WASM Details:** `RUST_WASM_ISSUES.md`
- **JS/Build Details:** `JS_CONFIG_ISSUES.md`
- **Navigation:** `ANALYSIS_INDEX.md`
- **Architecture:** `ANALYSIS_SUMMARY.md`
- **React Issues:** `CODE_ANALYSIS.md`

---

## Key Stats

| Metric | Value |
|--------|-------|
| Total Issues Found | 26 |
| Critical | 1 |
| High | 4 |
| Medium | 9 |
| Low | 12 |
| Quick Fixes (< 10 min) | 6 |
| Medium Fixes (15-30 min) | 4 |
| Major Work (1+ hours) | 6 |

