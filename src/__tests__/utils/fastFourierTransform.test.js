import { fft, ifft, Complex } from "../../utils/fastFourierTransform.js";

function testFFT() {
  // Test Case: Simple Signal
  const signal = [
    { real: 1, imag: 0 },
    { real: -1, imag: 0 },
    { real: 1, imag: 0 },
    { real: -1, imag: 0 },
  ];

  console.log("Original Signal:", signal);

  // Perform FFT
  const spectrum = fft(signal);

  console.log("FFT Spectrum:", spectrum);

  // Perform IFFT
  const reconstructedSignal = ifft(spectrum);

  console.log("Reconstructed Signal:", reconstructedSignal);

  // Validate Reconstruction
  for (let i = 0; i < signal.length; i++) {
    if (
      Math.abs(signal[i].real - reconstructedSignal[i].real) > Number.EPSILON ||
      Math.abs(signal[i].imag - reconstructedSignal[i].imag) > Number.EPSILON
    ) {
      console.error(`Mismatch at index ${i}`);
      return false;
    }
  }

  console.log("Test Passed!");
}

// Run Test
testFFT();
