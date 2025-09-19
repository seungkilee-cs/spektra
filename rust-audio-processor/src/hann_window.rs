// Hann window applications for divide and conquer
use crate::utils::Complex;
use std::f32::consts::PI;

// Apply Hann window to complex signal
pub fn apply_hann_window(signal: &mut [Complex]) {
    let n = signal.len();
    for (i, sample) in signal.iter_mut().enumerate() {
        let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
        sample.real *= hann_value;
        sample.imag *= hann_value;
    }
}

// Apply Hann window to real signal
pub fn apply_hann_window_real(signal: &mut [f32]) {
    let n = signal.len();
    for (i, sample) in signal.iter_mut().enumerate() {
        let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
        *sample *= hann_value;
    }
}

// Generate Hann window coefficients
pub fn generate_hann_window(size: usize) -> Vec<f32> {
    (0..size)
        .map(|i| 0.5 * (1.0 - ((2.0 * PI * i as f32) / (size as f32 - 1.0)).cos()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hann_window_symmetry() {
        let window = generate_hann_window(10);
        
        // Hann window should be symmetric
        for i in 0..window.len()/2 {
            let symmetric_idx = window.len() - 1 - i;
            assert!((window[i] - window[symmetric_idx]).abs() < 1e-6);
        }
    }

    #[test]
    fn test_hann_window_endpoints() {
        let window = generate_hann_window(10);
        
        // Hann window should be 0 at endpoints
        assert!(window[0].abs() < 1e-6);
        assert!(window[window.len()-1].abs() < 1e-6);
    }

    #[test]
    fn test_apply_hann_window_real() {
        let mut signal = vec![1.0, 2.0, 3.0, 4.0];
        let original = signal.clone();
        
        apply_hann_window_real(&mut signal);
        
        // Signal should be modified (not equal to original)
        assert_ne!(signal, original);
        
        // First and last samples should be zero (Hann property)
        assert!(signal[0].abs() < 1e-6);
        assert!(signal[signal.len()-1].abs() < 1e-6);
    }
}

