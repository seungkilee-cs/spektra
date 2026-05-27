use crate::utils::Complex;
use std::f32::consts::PI;

fn hann_coefficient(index: usize, len: usize) -> f32 {
    if len <= 1 {
        return 1.0;
    }

    0.5 * (1.0 - ((2.0 * PI * index as f32) / (len as f32 - 1.0)).cos())
}

pub fn apply_hann_window(signal: &mut [Complex]) {
    let n = signal.len();
    for (i, sample) in signal.iter_mut().enumerate() {
        let hann_value = hann_coefficient(i, n);
        sample.real *= hann_value;
        sample.imag *= hann_value;
    }
}

pub fn apply_hann_window_real(signal: &mut [f32]) {
    let n = signal.len();
    for (i, sample) in signal.iter_mut().enumerate() {
        *sample *= hann_coefficient(i, n);
    }
}

pub fn generate_hann_window(size: usize) -> Vec<f32> {
    (0..size).map(|i| hann_coefficient(i, size)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hann_window_symmetry() {
        let window = generate_hann_window(10);

        for i in 0..window.len() / 2 {
            let symmetric_idx = window.len() - 1 - i;
            assert!((window[i] - window[symmetric_idx]).abs() < 1e-6);
        }
    }

    #[test]
    fn test_hann_window_endpoints() {
        let window = generate_hann_window(10);

        assert!(window[0].abs() < 1e-6);
        assert!(window[window.len() - 1].abs() < 1e-6);
    }

    #[test]
    fn test_single_sample_hann_window_is_safe() {
        assert_eq!(generate_hann_window(1), vec![1.0]);
    }

    #[test]
    fn test_apply_hann_window_real() {
        let mut signal = vec![1.0, 2.0, 3.0, 4.0];
        let original = signal.clone();

        apply_hann_window_real(&mut signal);

        assert_ne!(signal, original);
        assert!(signal[0].abs() < 1e-6);
        assert!(signal[signal.len() - 1].abs() < 1e-6);
    }
}
