import { fft } from "./fastFourierTransform";

// generate Hann window
function generateHannWindow(N) {
  const hannWindow = [];
  for (let n = 0; n < N; n++) {
    hannWindow.push(0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1))));
  }
  return hannWindow;
}

// Apply Hann Window to reduce leakage
function applyHannWindow(segment) {
  const N = segment.length;
  const hannWindow = generateHannWindow(N);
  return segment.map((value, index) => value * hannWindow[index]);
}
