import { fft } from "fft-js";

const hannWindowCache = new Map();

const getHannWindow = (size) => {
  if (!hannWindowCache.has(size)) {
    const window = new Float32Array(size);
    for (let n = 0; n < size; n += 1) {
      window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
    }
    hannWindowCache.set(size, window);
  }

  return hannWindowCache.get(size);
};

const ensureAudioContext = () => {
  const AudioContextClass =
    typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);

  if (!AudioContextClass) {
    throw new Error("Web Audio API not supported in this browser");
  }

  return new AudioContextClass();
};

const decodeFileToBuffer = async (file) => {
  const audioContext = ensureAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    try {
      await audioContext.close();
    } catch (closeError) {
      console.warn("Failed to close AudioContext", closeError);
    }
  }
};

const computeSpectrogramFrames = (channelData, fftSize, overlap) => {
  const hopSize = Math.max(1, Math.floor(fftSize * (1 - overlap)));
  if (hopSize <= 0) {
    throw new Error("Computed hop size must be positive");
  }

  if (channelData.length < fftSize) {
    throw new Error("Audio file is shorter than the selected FFT window size");
  }

  const numWindows = Math.floor((channelData.length - fftSize) / hopSize) + 1;
  if (numWindows <= 0) {
    throw new Error("Audio length does not permit any FFT windows");
  }

  const hannWindow = getHannWindow(fftSize);
  const frames = new Array(numWindows);

  for (let windowIndex = 0; windowIndex < numWindows; windowIndex += 1) {
    const start = windowIndex * hopSize;
    const windowed = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i += 1) {
      windowed[i] = channelData[start + i] * hannWindow[i];
    }

    const spectrum = fft(Array.from(windowed));
    const magnitudes = new Float32Array(Math.floor(fftSize / 2));

    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      const real = spectrum[bin][0];
      const imag = spectrum[bin][1];
      magnitudes[bin] = Math.sqrt(real * real + imag * imag);
    }

    frames[windowIndex] = Array.from(magnitudes);
  }

  return frames;
};

export async function computeSpectogram(file, fftSize = 1024, overlap = 0.5) {
  const audioBuffer = await decodeFileToBuffer(file);
  const channelData = audioBuffer.getChannelData(0);
  return computeSpectrogramFrames(channelData, fftSize, overlap);
}

export async function computeSpectogramWithMetrics(file, fftSize = 1024, overlap = 0.5) {
  const metrics = {
    totalTime: 0,
    fftSize,
    overlap,
    sampleRate: 0,
    channels: 0,
    windows: 0,
  };

  const startTime = performance.now();
  const audioBuffer = await decodeFileToBuffer(file);

  metrics.sampleRate = audioBuffer.sampleRate;
  metrics.channels = audioBuffer.numberOfChannels;

  const channelData = audioBuffer.getChannelData(0);
  const frames = computeSpectrogramFrames(channelData, fftSize, overlap);
  metrics.windows = frames.length;
  metrics.totalTime = performance.now() - startTime;

  return {
    result: frames,
    metrics,
  };
}
