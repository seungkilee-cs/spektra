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

pub fn ifft(input: &mute [Complex]) {
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
