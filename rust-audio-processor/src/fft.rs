// Rust implementation of FFT -> Cooley-Tukey Radix 2 iteration
use crate::utils::{bit_reverse, Complex, generate_twiddle_factor, butterfly_operation};

pub fn fft(input: &mut [Complex]) {
    // input validations
    let n = input.len();
    assert!(n.is_power_of_two(), "Input size must be power of 2");

    // bit reversal permutation
    let bits = n.trailing_zeros() as usize;
    for i in 0..n {
        let j = bit_reverse(i, bits);
        if i < j {
            input.swap(i, j);
        }
    }

    // Inplace, Radix 2 Iterative Cooley-Tukey
    let mut len = 2;
    while len <= n {
        let half = len / 2;
        let twiddles = generate_twiddle_factor(len);

        for start in (0..n).step_by(len) {
            for k in 0..half {
                let i = start + k;
                let j = i + half;

                let (upper, lower) = butterfly_operation(input[i], input[j], twiddles[k]);
                input[i] = upper;
                input[j] = lower;
            }
        }
        len *= 2;
    }
}

pub fn ifft(input: &mut [Complex]) {
    let n = input.len();
    // Conjugate All Inputs
    for c in input.iter_mut() {
        c.imag = -c.imag;
    }

    // Forward fft
    fft(input);

    // Conjugate Again and Scale
    for c in input.iter_mut() {
        c.real /= n as f32;
        c.imag = -c.imag / n as f32;
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::Complex;

    #[test]
    fn test_fft_impulse() {
        // Test impulse response: [1, 0, 0, 0]
        let mut input = vec![
            Complex::new(1.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
        ];
        
        fft(&mut input);
        
        // Impulse should result in all 1's in frequency domain
        for i in 0..4 {
            assert!((input[i].real - 1.0).abs() < 1e-6, "Real part at {}: {}", i, input[i].real);
            assert!(input[i].imag.abs() < 1e-6, "Imag part at {}: {}", i, input[i].imag);
        }
    }

    #[test]
    fn test_fft_dc() {
        // Test DC signal: [1, 1, 1, 1]
        let mut input = vec![
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
        ];
        
        fft(&mut input);
        
        // DC should have energy only in first bin
        assert!((input[0].real - 4.0).abs() < 1e-6);
        assert!(input[0].imag.abs() < 1e-6);
        
        // Other bins should be zero
        for i in 1..4 {
            assert!(input[i].magnitude() < 1e-6, "Bin {} should be zero but got {}", i, input[i].magnitude());
        }
    }

    #[test]
    fn test_fft_roundtrip() {
        // Test FFT -> IFFT roundtrip
        let original = vec![
            Complex::new(1.0, 0.5),
            Complex::new(2.0, -1.0),
            Complex::new(0.5, 2.0),
            Complex::new(-1.0, 0.5),
        ];
        
        let mut input = original.clone();
        
        // Forward FFT
        fft(&mut input);
        
        // Inverse FFT
        ifft(&mut input);
        
        // Should match original (within floating point precision)
        for i in 0..4 {
            assert!((input[i].real - original[i].real).abs() < 1e-6);
            assert!((input[i].imag - original[i].imag).abs() < 1e-6);
        }
    }
}

