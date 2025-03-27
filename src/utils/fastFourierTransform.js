// https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm
// Main FFT function with Cooley-Tukey Algorithm
function fft(signal) {
  // Convert a signal from time domain to frequency domain
  const N = signal.length;
  const levels = Math.log2(N); //passed into total bits for the reverse function

  // Bit Reversal Permutation
  let X = signal.map((_, i) => signal[bitReverse(i, levels)]);

  // Cooley-Tukey Iterations, where the magic happens
}

// Inverse FFT function
function ifft(frequencyData) {
  // Implement inverse FFT algorithm here
}

function bitReverse(index, totalBits) {
  // Reverses the bits of 'index' assuming 'totalBits' bits
  // Example:
  // bitReverse(1, 3) = 4 (001 becomes 100 in binary)
  // bitReverse(3, 3) = 6 (011 becomes 110 in binary)
  // bitReverse(5, 4) = 10 (0101 becomes 1010 in binary)
  // bitReverse(0, 4) = 0 (0000 becomes 0000 in binary)
  //
  // if binary is not containable with given total bits, throw error
  if (index >= 1 << totalBits) {
    throw new Error("Index too large for specified bits");
  } else {
    // convert index into binary
    let binaryString = index.toString(2).padStart(totalBits, "0");
    // reverse the bits
    let reversedBinary = binaryString.split("").reverse().join("");
    // return binary to decimal before we return
    return parseInt(reversedBinary, 2);
  }
}

const Complex = {
  add: function (a, b) {
    // Adds two complex numbers
    // (a.real + a.imag*i) + (b.real + b.imag*i)
    return {
      real: a.real + b.real,
      imag: a.imag + b.imag,
    };
  },
  subtract: function (a, b) {
    // Subtracts two complex numbers
    // (a.real + a.imag*i) - (b.real + b.imag*i)
    return {
      real: a.real - b.real,
      imag: a.imag - b.imag,
    };
  },
  multiply: function (a, b) {
    // Multiplies two complex numbers
    // (a.real + a.imag*i) * (b.real + b.imag*i)
    return {
      real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag - a.imag * b.real,
    };
  },
};

function generateTwiddleFactors(N) {
  // Generates N complex roots of unity, for every points in FFT
  // Used to combine Discrete Fourier Transforms into a larger one -> This is where divide and conquer comes in
  // We compute the results of broken down signals for this DFT, with Twiddle Factor on these points
  // W_N^k = e^(-2πik/N) for k = 0, 1, ..., N-1
  const twiddleFactors = [];
  for (let k = 0; k < N; k++) {
    const angle = (-2 * Math.PI * k) / N;
    twiddleFactors.push({
      real: Math.cos(angle),
      imag: Math.sine(angle),
    });
  }
  return twiddleFactors;
}

function butterflyOperation(a, b, twiddle) {
  // Performs the basic FFT butterfly operation
  // scale and align the a' and b'
  return {
    upper: Complex.add(a, Complex.multiply(twiddle, b)),
    lower: Complex.subtract(a, Complex.multiply(twiddle, b)),
  };
}

// Export the functions
export { fft, ifft, Complex };
