// utility for math

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
// Butteryfly Operationsa

