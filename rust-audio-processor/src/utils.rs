// utility for math
use std::f32::consts::PI;

// Bit Reversal Function
// Reverses the bits of `index` assuming `total_bits` bits.
// assert_eq!(bit_reverse(1, 3), 4); // 001 -> 100
// assert_eq!(bit_reverse(3, 3), 6); // 011 -> 110
// assert_eq!(bit_reverse(5, 4), 10); // 0101 -> 1010
// assert_eq!(bit_reverse(0, 4), 0); // 0000 -> 0000
pub fn bit_reverse(mut x: usize, bits: usize) -> usize {
    let mut result = 0;
    for _ in 0..bits {
        result <<= 1;         // Shift result left by one bit
        result |= x & 1;      // Add the least significant bit of x to result
        x >>= 1;              // Shift x right by one bit
    }
    result
}

// Complex Number Operations
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Complex {
    pub real: f32,
    pub imag: f32,
}

impl Complex {
    // Consturctor
    pub fn new(real: f32, imag: f32) -> Self {
        Complex { real, imag }
    }

    // Complex number addition
    pub fn add(a: Complex, b: Complex) -> Complex {
        Complex {
            real: a.real + b.real,
            imag: a.imag + b.imag,
        }
    }
    
    // Complex number subtraction
    pub fn subtract(a: Complex, b: Complex) -> Complex {
        Complex {
            real: a.real - b.real,
            imag: a.imag - b.imag,
        }
    }

    // Complex number multiplication
    pub fn multiply(a: Complex, b: Complex) -> Complex {
        Complex {
            real: a.real * b.real - a.imag * b.imag,
            imag: a.real * b.imag + a.imag * b.real,
        }
    }

    // Magnitude Calculation
    pub fn magnitude(self) -> f32 {
        (self.real * self.real + self.imag * self.imag).sqrt()
    }
}

// Twiddle Factor Generation
// Generates N complex roots of unity (twiddle factors).
// Used to combine Discrete Fourier Transforms into a larger one.
// W_N^k = e^(-2πik/N) for k = 0, 1, ..., N-1
pub fn generate_twiddle_factor(n: usize) -> Vec<Complex> {
    (0..n).map(|k| { 
        let angle = (-2.0 * PI * k as f32) / n as f32;
        Complex {
            real: angle.cos(),
            imag: angle.sin(),
        }
    }).collect()
}

// Butterfly Operationsa
// Performs the basic FFT butterfly operation.
// Combines two complex numbers using a twiddle factor.
// Returns the "upper" and "lower" results after scaling and alignment.
pub fn butterfly_operation(a: Complex, b: Complex, twiddle: Complex) ->  (Complex, Complex) {
    let twiddle_b = Complex::multiply(twiddle, b);
    let upper = Complex::add(a, twiddle_b);
    let lower = Complex::subtract(a, twiddle_b);
    (upper, lower)
}

// Unit Tests -> Huh So in Rust these are done in files? Neat.
#[cfg(test)] 
mod tests {
    use super::*;

    #[test]
    fn test_bit_reverse() {
        let test_cases = vec![
            // (index, bits, expected_result)
            (1, 3, 4),  // 001 -> 100 (binary reversal)
            (3, 3, 6),  // 011 -> 110 (binary reversal)
            (5, 4, 10), // 0101 -> 1010 (binary reversal)
            (0, 4, 0),  // 0000 -> 0000 (zeros stay zeros)
        ];
        
        for (index, bits, expected) in test_cases {
            let result = bit_reverse(index, bits);
            assert_eq!(result, expected, 
                "bit_reverse({}, {}) expected {}, got {}", index, bits, expected, result);
        }
    }

    #[test]
    fn test_complex_addition() {
        let a_arr = vec![
            Complex { real: 1.0, imag: 2.0 },   // First test case
            Complex { real: 5.0, imag: 6.0 },   // Second test case  
            Complex { real: -1.0, imag: 3.0 },  // Negative real part
            Complex { real: 2.5, imag: -1.5 },  // Negative imaginary part
        ];
        let b_arr = vec![
            Complex { real: 3.0, imag: 4.0 },   // (1+2i) + (3+4i) = 4+6i
            Complex { real: 7.0, imag: 8.0 },   // (5+6i) + (7+8i) = 12+14i
            Complex { real: 2.0, imag: -1.0 },  // (-1+3i) + (2-1i) = 1+2i
            Complex { real: -0.5, imag: 2.5 },  // (2.5-1.5i) + (-0.5+2.5i) = 2+1i
        ];
        let expected = vec![
            Complex { real: 4.0, imag: 6.0 },   // (1+3, 2+4)
            Complex { real: 12.0, imag: 14.0 }, // (5+7, 6+8)
            Complex { real: 1.0, imag: 2.0 },   // (-1+2, 3-1)
            Complex { real: 2.0, imag: 1.0 },   // (2.5-0.5, -1.5+2.5)
        ];
        
        // iter() returns reference so I need *a, *b for dereferencing
        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            let result = Complex::add(*a, *b);
            assert_eq!(result, expected[i], 
                "Addition test failed at index {}: ({:?}) + ({:?}) expected {:?}, got {:?}", 
                i, a, b, expected[i], result);
        }
    }

    #[test]
    fn test_complex_subtraction() {
        let a_arr = vec![
            Complex { real: 1.0, imag: 2.0 },   // Basic subtraction
            Complex { real: 5.0, imag: -3.0 },  // Negative imaginary
            Complex { real: 0.0, imag: 4.0 },   // Pure imaginary minuend
        ];
        let b_arr = vec![
            Complex { real: 3.0, imag: 4.0 },   // (1+2i) - (3+4i) = -2-2i
            Complex { real: 2.0, imag: 1.0 },   // (5-3i) - (2+1i) = 3-4i  
            Complex { real: -1.0, imag: 2.0 },  // (0+4i) - (-1+2i) = 1+2i
        ];
        let expected = vec![
            Complex { real: -2.0, imag: -2.0 }, // (1-3, 2-4)
            Complex { real: 3.0, imag: -4.0 },  // (5-2, -3-1)
            Complex { real: 1.0, imag: 2.0 },   // (0-(-1), 4-2)
        ];
        
        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            let result = Complex::subtract(*a, *b); // Fixed typo: subtract not :subtract
            assert_eq!(result, expected[i], 
                "Subtraction test failed at index {}: ({:?}) - ({:?}) expected {:?}, got {:?}", 
                i, a, b, expected[i], result);
        }
    }
    
    #[test]
    fn test_complex_multiplication() {
        let a_arr = vec![
            Complex { real: 1.0, imag: 2.0 },   // (1+2i) * (3+4i)
            Complex { real: 2.0, imag: 0.0 },   // Real number * complex
            Complex { real: 0.0, imag: 1.0 },   // Pure imaginary * pure imaginary
            Complex { real: 1.0, imag: 1.0 },   // (1+i) * (1-i) = 1+1 = 2
        ];
        let b_arr = vec![
            Complex { real: 3.0, imag: 4.0 },   // Standard multiplication
            Complex { real: 1.5, imag: 2.5 },   // 2 * (1.5+2.5i) = 3+5i
            Complex { real: 0.0, imag: 1.0 },   // i * i = -1
            Complex { real: 1.0, imag: -1.0 },  // Conjugate multiplication
        ];
        let expected = vec![
            Complex { real: -5.0, imag: 10.0 }, // (1×3-2×4, 1×4+2×3) = (3-8, 4+6) = -5+10i ✅
            Complex { real: 3.0, imag: 5.0 },   // 2×1.5 + i×2×2.5 = 3+5i
            Complex { real: -1.0, imag: 0.0 },  // i×i = -1+0i
            Complex { real: 2.0, imag: 0.0 },   // (1+i)(1-i) = 1-i² = 1-(-1) = 2
        ];
        
        for (i, (a, b)) in a_arr.iter().zip(b_arr.iter()).enumerate() {
            let result = Complex::multiply(*a, *b);
            // Use floating point comparison for safety
            assert!((result.real - expected[i].real).abs() < 1e-6, 
                "Multiplication test failed at index {}: ({:?}) * ({:?}) expected {:?}, got {:?} - real part mismatch", 
                i, a, b, expected[i], result);
            assert!((result.imag - expected[i].imag).abs() < 1e-6, 
                "Multiplication test failed at index {}: ({:?}) * ({:?}) expected {:?}, got {:?} - imag part mismatch", 
                i, a, b, expected[i], result);
        }
    }

    #[test]
    fn test_twiddle_factors() {
        // Test twiddle factor generation for common FFT sizes
        let test_sizes = vec![2, 4, 8];
        
        for &n in &test_sizes {
            let twiddles = generate_twiddle_factor(n);
            assert_eq!(twiddles.len(), n, "Twiddle factor count mismatch for N={}", n);
            
            // W_N^0 should always be 1+0i (identity)
            assert!((twiddles[0].real - 1.0).abs() < 1e-6, 
                "W_{}^0 real part should be 1.0, got {}", n, twiddles[0].real);
            assert!(twiddles[0].imag.abs() < 1e-6, 
                "W_{}^0 imag part should be 0.0, got {}", n, twiddles[0].imag);
            
            // All twiddle factors should have magnitude ~1 (unit circle)
            for (k, twiddle) in twiddles.iter().enumerate() {
                let magnitude = (twiddle.real * twiddle.real + twiddle.imag * twiddle.imag).sqrt();
                assert!((magnitude - 1.0).abs() < 1e-6, 
                    "W_{}^{} magnitude should be 1.0, got {} for {:?}", n, k, magnitude, twiddle);
            }
        }
    }

    #[test]
    fn test_butterfly_operation() {
        // Test cases for butterfly operation: (a, b, twiddle) -> (upper, lower)
        let test_cases = vec![
            // (a, b, twiddle, expected_upper, expected_lower)
            (
                Complex::new(1.0, 0.0),     // a = 1+0i
                Complex::new(1.0, 0.0),     // b = 1+0i  
                Complex::new(1.0, 0.0),     // twiddle = 1+0i (identity)
                Complex::new(2.0, 0.0),     // upper = a + twiddle*b = 1 + 1*1 = 2
                Complex::new(0.0, 0.0),     // lower = a - twiddle*b = 1 - 1*1 = 0
            ),
            (
                Complex::new(2.0, 1.0),     // a = 2+i
                Complex::new(1.0, -1.0),    // b = 1-i
                Complex::new(0.0, 1.0),     // twiddle = i
                Complex::new(3.0, 2.0),     // upper = (2+i) + i*(1-i) = (2+i) + (i+1) = 3+2i
                Complex::new(1.0, 0.0),     // lower = (2+i) - i*(1-i) = (2+i) - (i+1) = 1+0i
            ),
        ];

        for (i, (a, b, twiddle, expected_upper, expected_lower)) in test_cases.iter().enumerate() {
            let (upper, lower) = butterfly_operation(*a, *b, *twiddle);
            
            // Test upper result
            assert!((upper.real - expected_upper.real).abs() < 1e-6, 
                "Butterfly test {} upper real: expected {}, got {}", i, expected_upper.real, upper.real);
            assert!((upper.imag - expected_upper.imag).abs() < 1e-6, 
                "Butterfly test {} upper imag: expected {}, got {}", i, expected_upper.imag, upper.imag);
                
            // Test lower result  
            assert!((lower.real - expected_lower.real).abs() < 1e-6, 
                "Butterfly test {} lower real: expected {}, got {}", i, expected_lower.real, lower.real);
            assert!((lower.imag - expected_lower.imag).abs() < 1e-6, 
                "Butterfly test {} lower imag: expected {}, got {}", i, expected_lower.imag, lower.imag);
        }
    }
}
