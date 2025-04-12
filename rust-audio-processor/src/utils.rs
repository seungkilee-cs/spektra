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
#[derive(Debug, Clone, Copy)]
pub struct Complex {
    pub real: f32,
    pub imag: f32,
}

impl Complex {
    // Complex number addition
    pub fn add(a: Complex, b: Complex) -> Complex {
        Complex: {
            real: a.real + b.real,
            imag: a.imag + b.imag,
        }
    }
    
    // Complex number subtraction
    pub fn subtract(a: Complex, b: Complex) -> Complex {
        Complex: {
            real: a.real - b.real,
            imag: a.imag - b.imag,
        }
    }

    // Complex number multiplication
    pub fn multiply(a: Complex, b: Complex) -> Complex {
        Complex: {
            real: a.real * b.real - a.imag * b.imag,
            imag: a.real * b.imag + a.imag * b.real,
        }
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
    let twiddle_b = Comlex::multiply(twiddle, b);
    let upper = Comeplx::add(a, twiddle_b);
    let lower = Complex::subtract(a, twiddle_b);
    (upper, lower)
}

// Unit Tests -> Huh So in Rust these are done in files?
#[cfg(test)]
mod tests {

}
