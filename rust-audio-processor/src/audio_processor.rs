// Audio Processing for Computing Spectogram (WASM Interface)
use crate::utils::Complex;
use crate::fft::fft;
use crate::hann_window::apply_hann_window;

// Only include wasm-bindgen stuff when compiling for WASM target
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

// Set up panic hook for better WASM debugging (WASM only)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

// Import console.log for debugging (WASM only)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Console logging macro - works in both WASM and native
macro_rules! console_log {
    ($($t:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        log(&format_args!($($t)*).to_string());
        
        #[cfg(not(target_arch = "wasm32"))]
        println!($($t)*);
    };
}

// Core FFT processor that works in both WASM and native environments
pub struct SpectrogramProcessor {
    fft_size: usize,
}

impl SpectrogramProcessor {
    // Create new SpectrogramProcessor
    pub fn new(fft_size: usize) -> SpectrogramProcessor {
        console_log!("🦀 Creating SpectrogramProcessor with FFT size: {}", fft_size);
        assert!(fft_size.is_power_of_two(), "FFT size must be power of 2");
        SpectrogramProcessor { fft_size }
    }

    // Process a single audio window and return magnitudes
    pub fn process_window(&self, audio_data: &[f32]) -> Vec<f32> {
        if audio_data.len() != self.fft_size {
            console_log!("⚠️ Audio data length {} != fft_size {}", audio_data.len(), self.fft_size);
            return Vec::new();
        }
        
        // Convert to complex numbers
        let mut buffer: Vec<Complex> = audio_data
            .iter()
            .map(|&x| Complex::new(x, 0.0))
            .collect();
        
        // Apply Hann window
        apply_hann_window(&mut buffer);
        
        // Perform FFT
        fft(&mut buffer);
        
        // Calculate magnitudes (first half due to symmetry)
        let magnitudes: Vec<f32> = buffer[0..self.fft_size / 2]
            .iter()
            .map(|c| c.magnitude())
            .collect();
        
        magnitudes
    }

    // Process complete spectrogram from audio data
    pub fn compute_spectrogram(&self, audio_data: &[f32], overlap: f32) -> Vec<f32> {
        console_log!("🦀 Starting spectrogram computation for {} samples", audio_data.len());
        
        let hop_size = ((self.fft_size as f32) * (1.0 - overlap)) as usize;
        let num_windows = if audio_data.len() >= self.fft_size {
            (audio_data.len() - self.fft_size) / hop_size + 1
        } else {
            0
        };
        
        console_log!("🦀 Processing {} windows with hop size {}", num_windows, hop_size);
        
        let mut spectrogram_flat = Vec::new();
        
        for window_idx in 0..num_windows {
            let start_idx = window_idx * hop_size;
            let end_idx = start_idx + self.fft_size;
            
            if end_idx <= audio_data.len() {
                let window_slice = &audio_data[start_idx..end_idx];
                let magnitudes = self.process_window(window_slice);
                spectrogram_flat.extend(magnitudes);
            }
            
            // Progress logging
            if num_windows > 100 && window_idx % (num_windows / 10) == 0 {
                console_log!("🦀 Progress: {}/{} windows", window_idx, num_windows);
            }
        }
        
        console_log!("🦀 Spectrogram generation complete: {} x {}", num_windows, self.fft_size / 2);
        spectrogram_flat
    }
}

// WASM-specific exports (only compiled for WASM target)
#[cfg(target_arch = "wasm32")]
mod wasm_exports {
    use super::*;
    use wasm_bindgen::prelude::*;

    // WASM-exported FFT processor
    #[wasm_bindgen]
    pub struct WasmSpectrogramProcessor {
        inner: SpectrogramProcessor,
    }

    #[wasm_bindgen]
    impl WasmSpectrogramProcessor {
        #[wasm_bindgen(constructor)]
        pub fn new(fft_size: usize) -> WasmSpectrogramProcessor {
            WasmSpectrogramProcessor {
                inner: SpectrogramProcessor::new(fft_size),
            }
        }

        #[wasm_bindgen]
        pub fn process_window(&self, audio_data: &[f32]) -> Vec<f32> {
            self.inner.process_window(audio_data)
        }

        #[wasm_bindgen]
        pub fn compute_spectrogram(&self, audio_data: &[f32], overlap: f32) -> Vec<f32> {
            self.inner.compute_spectrogram(audio_data, overlap)
        }
    }

    // Simple test functions for WASM integration
    #[wasm_bindgen]
    pub fn greet(name: &str) -> String {
        console_log!("🦀 Rust greeting function called");
        format!("Hello, {}! From Rust+WASM 🚀", name)
    }

    #[wasm_bindgen]
    pub fn multiply_array(numbers: &[f32], factor: f32) -> Vec<f32> {
        console_log!("🦀 Multiplying {} numbers by {}", numbers.len(), factor);
        numbers.iter().map(|&x| x * factor).collect()
    }
}

// Re-export WASM functions only when compiling for WASM
#[cfg(target_arch = "wasm32")]
pub use wasm_exports::*;

// Tests work on both WASM and native targets
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spectrogram_processor_creation() {
        let processor = SpectrogramProcessor::new(1024);
        assert_eq!(processor.fft_size, 1024);
    }

    #[test]
    fn test_process_window() {
        let processor = SpectrogramProcessor::new(8);
        
        // Create test signal (simple sine wave)
        let mut test_signal = Vec::new();
        for i in 0..8 {
            let sample = (2.0 * std::f32::consts::PI * i as f32 / 8.0).sin();
            test_signal.push(sample);
        }
        
        let result = processor.process_window(&test_signal);
        assert_eq!(result.len(), 4); // Half of FFT size
        
        // Result should have some energy
        let total_energy: f32 = result.iter().sum();
        assert!(total_energy > 0.0);
    }

    #[test]
    fn test_compute_spectrogram() {
        let processor = SpectrogramProcessor::new(8);
        
        // Create longer test signal
        let test_signal: Vec<f32> = (0..32)
            .map(|i| (2.0 * std::f32::consts::PI * i as f32 / 32.0).sin())
            .collect();
        
        let result = processor.compute_spectrogram(&test_signal, 0.5);
        
        // Should have multiple windows of results
        assert!(result.len() > 4); // More than one window
        assert_eq!(result.len() % 4, 0); // Multiple of frequency bins
    }

    #[test]
    fn test_invalid_fft_size() {
        // This should panic because 7 is not a power of 2
        let result = std::panic::catch_unwind(|| {
            SpectrogramProcessor::new(7);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_audio_data() {
        let processor = SpectrogramProcessor::new(8);
        let empty_data = vec![];
        let result = processor.compute_spectrogram(&empty_data, 0.5);
        assert!(result.is_empty());
    }
}
