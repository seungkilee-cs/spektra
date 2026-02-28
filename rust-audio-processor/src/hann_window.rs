// Hann window applications for divide and conquer
use crate::utils::Complex;
use std::f32::consts::PI;

// Apply Hann window to complex signal
pub fn apply_hann_window(signal: &mut [Complex]) {
    let n = signal.len();
    if n == 0 { return; }
    if n == 1 { return; } // single sample: coefficient is 1.0, no change needed
    for (i, sample) in signal.iter_mut().enumerate() {
        let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
        sample.real *= hann_value;
        sample.imag *= hann_value;
    }
}

// Apply Hann window to real signal
pub fn apply_hann_window_real(signal: &mut [f32]) {
    let n = signal.len();
    if n == 0 { return; }
    if n == 1 { return; } // single sample: coefficient is 1.0, no change needed
    for (i, sample) in signal.iter_mut().enumerate() {
        let hann_value = 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n as f32 - 1.0)).cos());
        *sample *= hann_value;
    }
}

// Generate Hann window coefficients
pub fn generate_hann_window(size: usize) -> Vec<f32> {
    if size == 0 { return vec![]; }
    if size == 1 { return vec![1.0]; } // single sample: coefficient is 1.0
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

    #[test]
    fn test_hann_window_single_element_no_nan() {
        // n=1 previously caused division by zero (n-1 = 0) → NaN
        let window = generate_hann_window(1);
        assert_eq!(window.len(), 1);
        assert!(!window[0].is_nan(), "single-element Hann window must not be NaN");
        assert_eq!(window[0], 1.0);
    }

    #[test]
    fn test_hann_window_empty() {
        let window = generate_hann_window(0);
        assert!(window.is_empty());
    }

    #[test]
    fn test_apply_hann_window_real_single_element_no_nan() {
        let mut signal = vec![2.5_f32];
        apply_hann_window_real(&mut signal);
        // coefficient for n=1 is 1.0, so value should be unchanged
        assert!(!signal[0].is_nan());
        assert_eq!(signal[0], 2.5);
    }
}

