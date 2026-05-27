use crate::utils::{bit_reverse, butterfly_operation, generate_twiddle_factor, Complex};

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
use core::arch::wasm32::{
    f32x4_add, f32x4_mul, f32x4_sub, i32x4_shuffle, v128, v128_load, v128_store,
};

#[derive(Debug, Clone)]
pub struct TwiddleCache {
    fft_size: usize,
    stages: Vec<Vec<Complex>>,
    bit_reversal: Vec<usize>,
}

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
unsafe fn butterfly_pair_simd(
    input: *mut Complex,
    start: usize,
    half: usize,
    twiddles: *const Complex,
    k: usize,
) {
    let i0 = start + k;
    let j0 = i0 + half;

    let a_ptr = input.add(i0) as *const v128;
    let b_ptr = input.add(j0) as *const v128;
    let tw_ptr = twiddles.add(k) as *const v128;

    let a = v128_load(a_ptr);
    let b = v128_load(b_ptr);
    let tw = v128_load(tw_ptr);

    let b_swapped = i32x4_shuffle::<1, 0, 3, 2>(b, b);
    let tw_swapped = i32x4_shuffle::<1, 0, 3, 2>(tw, tw);

    let mul_rr = f32x4_mul(b, tw);
    let mul_ii = f32x4_mul(b_swapped, tw_swapped);
    let real = f32x4_sub(mul_rr, mul_ii);

    let mul_ri = f32x4_mul(b, tw_swapped);
    let mul_ir = f32x4_mul(b_swapped, tw);
    let imag = f32x4_add(mul_ri, mul_ir);

    let twiddle_b = i32x4_shuffle::<0, 4, 2, 6>(real, imag);

    let upper = f32x4_add(a, twiddle_b);
    let lower = f32x4_sub(a, twiddle_b);

    v128_store(input.add(i0) as *mut v128, upper);
    v128_store(input.add(j0) as *mut v128, lower);
}

impl TwiddleCache {
    pub fn new(fft_size: usize) -> Self {
        assert!(fft_size.is_power_of_two(), "FFT size must be power of 2");

        let mut stages = Vec::new();
        let mut len = 2;
        while len <= fft_size {
            let twiddles = generate_twiddle_factor(len)
                .into_iter()
                .take(len / 2)
                .collect();
            stages.push(twiddles);
            len <<= 1;
        }

        let bits = fft_size.trailing_zeros() as usize;
        let bit_reversal = (0..fft_size).map(|i| bit_reverse(i, bits)).collect();

        Self {
            fft_size,
            stages,
            bit_reversal,
        }
    }

    #[inline]
    pub fn fft_size(&self) -> usize {
        self.fft_size
    }

    #[inline]
    pub fn stage_twiddles(&self, stage: usize) -> &[Complex] {
        &self.stages[stage]
    }

    #[inline]
    pub fn bit_reversal(&self) -> &[usize] {
        &self.bit_reversal
    }
}

pub fn fft_with_cache(input: &mut [Complex], cache: &TwiddleCache) {
    let n = input.len();
    assert_eq!(cache.fft_size(), n, "Input size must match cache size");

    for (i, &j) in cache.bit_reversal().iter().enumerate() {
        if i < j {
            input.swap(i, j);
        }
    }

    let mut len = 2;
    let mut stage = 0;
    while len <= n {
        let half = len / 2;
        let twiddles = cache.stage_twiddles(stage);

        for start in (0..n).step_by(len) {
            #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
            {
                let mut k = 0;
                let ptr = input.as_mut_ptr();
                let tw_ptr = twiddles.as_ptr();

                while k + 1 < half {
                    unsafe {
                        butterfly_pair_simd(ptr, start, half, tw_ptr, k);
                    }
                    k += 2;
                }

                while k < half {
                    let i = start + k;
                    let j = i + half;
                    let (upper, lower) = butterfly_operation(input[i], input[j], twiddles[k]);
                    input[i] = upper;
                    input[j] = lower;
                    k += 1;
                }
            }

            #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
            for (k, twiddle) in twiddles.iter().copied().enumerate().take(half) {
                let i = start + k;
                let j = i + half;
                let (upper, lower) = butterfly_operation(input[i], input[j], twiddle);
                input[i] = upper;
                input[j] = lower;
            }
        }

        len <<= 1;
        stage += 1;
    }
}

pub fn fft(input: &mut [Complex]) {
    let cache = TwiddleCache::new(input.len());
    fft_with_cache(input, &cache);
}

pub fn ifft(input: &mut [Complex]) {
    let n = input.len();
    for c in input.iter_mut() {
        c.imag = -c.imag;
    }

    fft(input);

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
        let mut input = vec![
            Complex::new(1.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
        ];

        fft(&mut input);

        for (i, bin) in input.iter().enumerate().take(4) {
            assert!(
                (bin.real - 1.0).abs() < 1e-6,
                "Real part at {i}: {}",
                bin.real
            );
            assert!(bin.imag.abs() < 1e-6, "Imag part at {i}: {}", bin.imag);
        }
    }

    #[test]
    fn test_fft_dc() {
        let mut input = vec![
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
            Complex::new(1.0, 0.0),
        ];

        fft(&mut input);

        assert!((input[0].real - 4.0).abs() < 1e-6);
        assert!(input[0].imag.abs() < 1e-6);

        for (i, bin) in input.iter().enumerate().take(4).skip(1) {
            assert!(
                bin.magnitude() < 1e-6,
                "Bin {i} should be zero but got {}",
                bin.magnitude()
            );
        }
    }

    #[test]
    fn test_fft_roundtrip() {
        let original = vec![
            Complex::new(1.0, 0.5),
            Complex::new(2.0, -1.0),
            Complex::new(0.5, 2.0),
            Complex::new(-1.0, 0.5),
        ];

        let mut input = original.clone();
        fft(&mut input);
        ifft(&mut input);

        for i in 0..4 {
            assert!((input[i].real - original[i].real).abs() < 1e-6);
            assert!((input[i].imag - original[i].imag).abs() < 1e-6);
        }
    }
}
