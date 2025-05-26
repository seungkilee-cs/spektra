// Rust implementation of FFT -> Cooley-Tukey Radix 2 iteration
use crate::utils::{bit_reverse, Complex, generate_twiddle_factor, butterfly_operation};

pub fn fft(input: &mut [Complex]) {
    // input validation
    let n = input.len();
    assert!(n.is_power_of_two(), "input size must be power of 2");

    // bit reversal permutation
    let bits = n.trailing_zeros() as usize;
    for i in 0..n {
        let j = bit_reverse(i, bits);
        if i < j {
            input.swap(i,j);
        }
    }
    
    // Iterative, Radix 2, In place Cooley-Tukey
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
