use crate::fft::{fft_with_cache, TwiddleCache};
use crate::hann_window::generate_hann_window;
use crate::utils::Complex;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        log(&format_args!($($t)*).to_string());

        #[cfg(not(target_arch = "wasm32"))]
        println!($($t)*);
    };
}

pub struct SpectrogramProcessor {
    fft_size: usize,
    twiddle_cache: TwiddleCache,
    buffer: Vec<Complex>,
    hann_window: Vec<f32>,
    dc_magnitude_scale: f32,
    ac_magnitude_scale: f32,
    time_stride: usize,
    freq_stride: usize,
}

impl SpectrogramProcessor {
    pub fn new(fft_size: usize) -> SpectrogramProcessor {
        console_log!("Creating SpectrogramProcessor with FFT size: {}", fft_size);
        assert!(fft_size.is_power_of_two(), "FFT size must be power of 2");

        let hann_window = generate_hann_window(fft_size);
        let window_sum = hann_window.iter().sum::<f32>();
        let dc_magnitude_scale = if window_sum > 0.0 {
            1.0 / window_sum
        } else {
            1.0
        };
        let ac_magnitude_scale = dc_magnitude_scale * 2.0;

        SpectrogramProcessor {
            fft_size,
            twiddle_cache: TwiddleCache::new(fft_size),
            buffer: vec![Complex::new(0.0, 0.0); fft_size],
            hann_window,
            dc_magnitude_scale,
            ac_magnitude_scale,
            time_stride: 1,
            freq_stride: 1,
        }
    }

    pub fn with_strides(mut self, time_stride: usize, freq_stride: usize) -> Self {
        self.set_strides(time_stride, freq_stride);
        self
    }

    pub fn set_strides(&mut self, time_stride: usize, freq_stride: usize) {
        assert!(time_stride >= 1, "time_stride must be >= 1");
        assert!(freq_stride >= 1, "freq_stride must be >= 1");
        self.time_stride = time_stride;
        self.freq_stride = freq_stride;
    }

    pub fn time_stride(&self) -> usize {
        self.time_stride
    }

    pub fn freq_stride(&self) -> usize {
        self.freq_stride
    }

    fn hop_size(&self, overlap: f32) -> Option<usize> {
        if !overlap.is_finite() || !(0.0..1.0).contains(&overlap) {
            return None;
        }

        Some(((self.fft_size as f32) * (1.0 - overlap)).floor().max(1.0) as usize)
    }

    fn copy_window_to_buffer(&mut self, audio_data: &[f32]) -> bool {
        if audio_data.len() != self.fft_size {
            console_log!(
                "⚠️ Audio data length {} != fft_size {}",
                audio_data.len(),
                self.fft_size
            );
            return false;
        }

        for ((slot, &sample), &window) in self
            .buffer
            .iter_mut()
            .zip(audio_data.iter())
            .zip(self.hann_window.iter())
        {
            slot.real = sample * window;
            slot.imag = 0.0;
        }

        true
    }

    fn process_window_into(
        &mut self,
        audio_data: &[f32],
        freq_stride: usize,
        output: &mut Vec<f32>,
    ) {
        if !self.copy_window_to_buffer(audio_data) {
            return;
        }

        fft_with_cache(&mut self.buffer, &self.twiddle_cache);

        let freq_bins = self.fft_size / 2;
        for bin in (0..freq_bins).step_by(freq_stride) {
            let scale = if bin == 0 {
                self.dc_magnitude_scale
            } else {
                self.ac_magnitude_scale
            };
            output.push(self.buffer[bin].magnitude() * scale);
        }
    }

    pub fn process_window(&mut self, audio_data: &[f32]) -> Vec<f32> {
        let mut magnitudes = Vec::with_capacity(self.fft_size / 2);
        self.process_window_into(audio_data, 1, &mut magnitudes);
        magnitudes
    }

    pub fn compute_spectrogram(&mut self, audio_data: &[f32], overlap: f32) -> Vec<f32> {
        console_log!(
            "Starting spectrogram computation for {} samples",
            audio_data.len()
        );

        let Some(hop_size) = self.hop_size(overlap) else {
            console_log!("Invalid overlap: {}", overlap);
            return Vec::new();
        };

        let num_windows = if audio_data.len() >= self.fft_size {
            (audio_data.len() - self.fft_size) / hop_size + 1
        } else {
            0
        };

        console_log!(
            "Processing {} windows with hop size {}",
            num_windows,
            hop_size
        );

        let mut spectrogram_flat = Vec::with_capacity(num_windows * (self.fft_size / 2));

        for window_idx in 0..num_windows {
            let start_idx = window_idx * hop_size;
            let end_idx = start_idx + self.fft_size;
            self.process_window_into(&audio_data[start_idx..end_idx], 1, &mut spectrogram_flat);

            if num_windows > 100 && window_idx % (num_windows / 10) == 0 {
                console_log!("Progress: {}/{} windows", window_idx, num_windows);
            }
        }

        console_log!(
            "Spectrogram generation complete: {} x {}",
            num_windows,
            self.fft_size / 2
        );
        spectrogram_flat
    }

    pub fn process_windows(
        &mut self,
        audio_data: &[f32],
        overlap: f32,
    ) -> (Vec<f32>, usize, usize) {
        let freq_bins = self.fft_size / 2;
        let reduced_bins = freq_bins.div_ceil(self.freq_stride);

        let Some(hop_size) = self.hop_size(overlap) else {
            return (Vec::new(), 0, reduced_bins);
        };

        if audio_data.len() < self.fft_size {
            return (Vec::new(), 0, reduced_bins);
        }

        let total_windows = (audio_data.len() - self.fft_size) / hop_size + 1;
        let num_windows = (0..total_windows).step_by(self.time_stride).count();
        console_log!(
            "process_windows batching {} logical windows (time stride {}, freq stride {})",
            num_windows,
            self.time_stride,
            self.freq_stride
        );
        let mut result = Vec::with_capacity(num_windows * reduced_bins);

        for window_idx in (0..total_windows).step_by(self.time_stride) {
            let start_idx = window_idx * hop_size;
            let end_idx = start_idx + self.fft_size;
            self.process_window_into(
                &audio_data[start_idx..end_idx],
                self.freq_stride,
                &mut result,
            );
        }

        (result, num_windows, reduced_bins)
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm_exports {
    use super::*;
    #[wasm_bindgen]
    pub struct SpectrogramBatch {
        data: Vec<f32>,
        num_windows: u32,
        freq_bins: u32,
    }

    #[wasm_bindgen]
    impl SpectrogramBatch {
        #[wasm_bindgen(getter)]
        pub fn data(&self) -> Vec<f32> {
            self.data.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn num_windows(&self) -> u32 {
            self.num_windows
        }

        #[wasm_bindgen(getter)]
        pub fn freq_bins(&self) -> u32 {
            self.freq_bins
        }
    }

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
        pub fn process_window(&mut self, audio_data: &[f32]) -> Vec<f32> {
            self.inner.process_window(audio_data)
        }

        #[wasm_bindgen]
        pub fn compute_spectrogram(&mut self, audio_data: &[f32], overlap: f32) -> Vec<f32> {
            self.inner.compute_spectrogram(audio_data, overlap)
        }

        #[wasm_bindgen]
        pub fn process_windows(
            &mut self,
            audio_data: &[f32],
            overlap: f32,
            time_stride: Option<usize>,
            freq_stride: Option<usize>,
        ) -> SpectrogramBatch {
            let current_time = self.inner.time_stride();
            let current_freq = self.inner.freq_stride();
            let new_time = time_stride.unwrap_or(current_time);
            let new_freq = freq_stride.unwrap_or(current_freq);
            self.inner.set_strides(new_time, new_freq);
            let (data, num_windows, freq_bins) = self.inner.process_windows(audio_data, overlap);
            SpectrogramBatch {
                data,
                num_windows: num_windows as u32,
                freq_bins: freq_bins as u32,
            }
        }
    }

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

#[cfg(target_arch = "wasm32")]
pub use wasm_exports::*;

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
        let mut processor = SpectrogramProcessor::new(8);
        let test_signal: Vec<f32> = (0..8)
            .map(|i| (2.0 * std::f32::consts::PI * i as f32 / 8.0).sin())
            .collect();

        let result = processor.process_window(&test_signal);
        assert_eq!(result.len(), 4);
        assert!(result.iter().sum::<f32>() > 0.0);
    }

    #[test]
    fn test_full_scale_bin_centered_tone_normalizes_near_one() {
        let mut processor = SpectrogramProcessor::new(1024);
        let test_signal: Vec<f32> = (0..1024)
            .map(|i| (2.0 * std::f32::consts::PI * 8.0 * i as f32 / 1024.0).sin())
            .collect();

        let result = processor.process_window(&test_signal);
        let peak = result.iter().copied().fold(0.0_f32, f32::max);

        assert!((peak - 1.0).abs() < 0.02, "peak was {peak}");
    }

    #[test]
    fn test_compute_spectrogram() {
        let mut processor = SpectrogramProcessor::new(8);
        let test_signal: Vec<f32> = (0..32)
            .map(|i| (2.0 * std::f32::consts::PI * i as f32 / 32.0).sin())
            .collect();

        let result = processor.compute_spectrogram(&test_signal, 0.5);

        assert!(result.len() > 4);
        assert_eq!(result.len() % 4, 0);
    }

    #[test]
    fn test_process_windows_batch() {
        let mut processor = SpectrogramProcessor::new(8);
        let test_signal: Vec<f32> = (0..32)
            .map(|i| (2.0 * std::f32::consts::PI * i as f32 / 32.0).sin())
            .collect();

        let (data, num_windows, freq_bins) = processor.process_windows(&test_signal, 0.5);

        assert_eq!(freq_bins, 4);
        assert_eq!(data.len(), num_windows * freq_bins);
        assert!(num_windows > 0);
    }

    #[test]
    fn test_process_windows_with_strides() {
        let mut processor = SpectrogramProcessor::new(8).with_strides(2, 2);
        let test_signal: Vec<f32> = (0..32)
            .map(|i| (2.0 * std::f32::consts::PI * i as f32 / 32.0).sin())
            .collect();

        let (data, num_windows, freq_bins) = processor.process_windows(&test_signal, 0.5);

        assert_eq!(processor.time_stride(), 2);
        assert_eq!(processor.freq_stride(), 2);
        assert!(num_windows > 0);
        assert_eq!(freq_bins, 2);
        assert_eq!(data.len(), num_windows * freq_bins);
    }

    #[test]
    fn test_invalid_fft_size() {
        let result = std::panic::catch_unwind(|| {
            SpectrogramProcessor::new(7);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_audio_data() {
        let mut processor = SpectrogramProcessor::new(8);
        let empty_data = vec![];
        let result = processor.compute_spectrogram(&empty_data, 0.5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_invalid_overlap_returns_empty_safely() {
        let mut processor = SpectrogramProcessor::new(8);
        let audio_data = vec![0.0; 32];

        assert!(processor.compute_spectrogram(&audio_data, 1.0).is_empty());
        assert!(processor
            .compute_spectrogram(&audio_data, f32::NAN)
            .is_empty());
    }
}
