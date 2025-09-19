pub mod utils;
pub mod fft;
pub mod hann_window;
pub mod audio_processor;

// Re-export main WASM interface
pub use audio_processor::*;

#[cfg(test)]
mod integration_tests {
    use crate::utils::Complex;
    use crate::fft::fft;
    use crate::hann_window::apply_hann_window;

    #[test]
    fn test_full_pipeline() {
        // Test the complete audio processing pipeline
        let mut signal = vec![
            Complex::new(1.0, 0.0),
            Complex::new(0.5, 0.0),
            Complex::new(-0.5, 0.0),
            Complex::new(-1.0, 0.0),
        ];

        // Apply windowing
        apply_hann_window(&mut signal);
        
        // Apply FFT
        fft(&mut signal);
        
        // Calculate magnitudes
        let magnitudes: Vec<f32> = signal.iter().map(|c| c.magnitude()).collect();
        
        // Should have reasonable magnitudes
        assert!(magnitudes.iter().any(|&m| m > 0.0));
    }
}
