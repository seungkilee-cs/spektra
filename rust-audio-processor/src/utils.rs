use std::f32::consts::PI;
use std::ops::{Add, Mul, Sub};

pub fn bit_reverse(mut x: usize, bits: usize) -> usize {
    let mut result = 0;
    for _ in 0..bits {
        result <<= 1;
        result |= x & 1;
        x >>= 1;
    }
    result
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
#[repr(C)]
pub struct Complex {
    pub real: f32,
    pub imag: f32,
}

impl Complex {
    pub const fn new(real: f32, imag: f32) -> Self {
        Self { real, imag }
    }

    pub fn magnitude(self) -> f32 {
        (self.real * self.real + self.imag * self.imag).sqrt()
    }
}

impl Add for Complex {
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            real: self.real + rhs.real,
            imag: self.imag + rhs.imag,
        }
    }
}

impl Sub for Complex {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        Self {
            real: self.real - rhs.real,
            imag: self.imag - rhs.imag,
        }
    }
}

impl Mul for Complex {
    type Output = Self;

    fn mul(self, rhs: Self) -> Self::Output {
        Self {
            real: self.real * rhs.real - self.imag * rhs.imag,
            imag: self.real * rhs.imag + self.imag * rhs.real,
        }
    }
}

pub fn generate_twiddle_factor(n: usize) -> Vec<Complex> {
    (0..n)
        .map(|k| {
            let angle = (-2.0 * PI * k as f32) / n as f32;
            Complex {
                real: angle.cos(),
                imag: angle.sin(),
            }
        })
        .collect()
}

pub fn butterfly_operation(a: Complex, b: Complex, twiddle: Complex) -> (Complex, Complex) {
    let twiddle_b = twiddle * b;
    (a + twiddle_b, a - twiddle_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f32 = 1e-6;

    #[test]
    fn test_bit_reverse() {
        let test_cases = [(1, 3, 4), (3, 3, 6), (5, 4, 10), (0, 4, 0)];

        for (index, bits, expected) in test_cases {
            let result = bit_reverse(index, bits);
            assert_eq!(result, expected);
        }
    }

    #[test]
    fn test_complex_addition() {
        let a_arr = [
            Complex::new(1.0, 2.0),
            Complex::new(5.0, 6.0),
            Complex::new(-1.0, 3.0),
            Complex::new(2.5, -1.5),
        ];
        let b_arr = [
            Complex::new(3.0, 4.0),
            Complex::new(7.0, 8.0),
            Complex::new(2.0, -1.0),
            Complex::new(-0.5, 2.5),
        ];
        let expected = [
            Complex::new(4.0, 6.0),
            Complex::new(12.0, 14.0),
            Complex::new(1.0, 2.0),
            Complex::new(2.0, 1.0),
        ];

        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            assert_eq!(*a + *b, expected[i]);
        }
    }

    #[test]
    fn test_complex_subtraction() {
        let a_arr = [
            Complex::new(1.0, 2.0),
            Complex::new(5.0, -3.0),
            Complex::new(0.0, 4.0),
        ];
        let b_arr = [
            Complex::new(3.0, 4.0),
            Complex::new(2.0, 1.0),
            Complex::new(-1.0, 2.0),
        ];
        let expected = [
            Complex::new(-2.0, -2.0),
            Complex::new(3.0, -4.0),
            Complex::new(1.0, 2.0),
        ];

        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            assert_eq!(*a - *b, expected[i]);
        }
    }

    #[test]
    fn test_complex_multiplication() {
        let a_arr = [
            Complex::new(1.0, 2.0),
            Complex::new(2.0, 0.0),
            Complex::new(0.0, 1.0),
            Complex::new(1.0, 1.0),
        ];
        let b_arr = [
            Complex::new(3.0, 4.0),
            Complex::new(1.5, 2.5),
            Complex::new(0.0, 1.0),
            Complex::new(1.0, -1.0),
        ];
        let expected = [
            Complex::new(-5.0, 10.0),
            Complex::new(3.0, 5.0),
            Complex::new(-1.0, 0.0),
            Complex::new(2.0, 0.0),
        ];

        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            let result = *a * *b;
            assert!((result.real - expected[i].real).abs() < EPSILON);
            assert!((result.imag - expected[i].imag).abs() < EPSILON);
        }
    }

    #[test]
    fn test_twiddle_factors() {
        let test_sizes = [2, 4, 8];

        for &n in &test_sizes {
            let twiddles = generate_twiddle_factor(n);
            assert_eq!(twiddles.len(), n);
            assert!((twiddles[0].real - 1.0).abs() < EPSILON);
            assert!(twiddles[0].imag.abs() < EPSILON);

            for twiddle in &twiddles {
                let magnitude = (twiddle.real * twiddle.real + twiddle.imag * twiddle.imag).sqrt();
                assert!((magnitude - 1.0).abs() < EPSILON);
            }
        }
    }

    #[test]
    fn test_butterfly_operation() {
        let test_cases = [
            (
                Complex::new(1.0, 0.0),
                Complex::new(1.0, 0.0),
                Complex::new(1.0, 0.0),
                Complex::new(2.0, 0.0),
                Complex::new(0.0, 0.0),
            ),
            (
                Complex::new(2.0, 1.0),
                Complex::new(1.0, -1.0),
                Complex::new(0.0, 1.0),
                Complex::new(3.0, 2.0),
                Complex::new(1.0, 0.0),
            ),
        ];

        for (a, b, twiddle, expected_upper, expected_lower) in test_cases {
            let (upper, lower) = butterfly_operation(a, b, twiddle);
            assert!((upper.real - expected_upper.real).abs() < EPSILON);
            assert!((upper.imag - expected_upper.imag).abs() < EPSILON);
            assert!((lower.real - expected_lower.real).abs() < EPSILON);
            assert!((lower.imag - expected_lower.imag).abs() < EPSILON);
        }
    }
}
