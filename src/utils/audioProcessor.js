import { fft } from "./fastFourierTransform";

// Generate Hann window with memoization
const hannWindowCache = new Map();
function generateHannWindow(N) {
  if (hannWindowCache.has(N)) {
    return hannWindowCache.get(N);
  }
  console.time(`Generate Hann Window (N=${N})`);
  const hannWindow = [];
  for (let n = 0; n < N; n++) {
    hannWindow.push(0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1))));
  }
  hannWindowCache.set(N, hannWindow);
  console.timeEnd(`Generate Hann Window (N=${N})`);
  return hannWindow;
}

function applyHannWindow(segment) {
  const N = segment.length;
  console.time("Apply Hann Window");
  const hannWindow = generateHannWindow(N);
  const result = segment.map((value, index) => value * hannWindow[index]);
  console.timeEnd("Apply Hann Window");
  return result;
}

function validateFFTSize(size) {
  return size > 0 && (size & (size - 1)) === 0; // Power of 2 check
}

export async function computeSpectogram(file, fftSize = 512, overlap = 0.5) {
  console.time("Total computeSpectogram");

  // File verification
  console.time("File type check");
  if (!file.type.startsWith("audio/")) {
    throw new Error(`Browser reports invalid type: ${file.type}`);
  }
  console.timeEnd("File type check");

  // ArrayBuffer handling
  let arrayBuffer;
  try {
    console.time("File to ArrayBuffer");
    arrayBuffer = await (file.arrayBuffer?.() ||
      new Response(file).arrayBuffer());
    console.timeEnd("File to ArrayBuffer");
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }

  // AudioContext creation
  console.time("AudioContext creation");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API not supported in this browser");
  }
  const audioContext = new AudioContextClass();
  console.timeEnd("AudioContext creation");
  console.log("AudioContext created with:", {
    constructor: AudioContextClass.name,
    sampleRate: audioContext.sampleRate,
    state: audioContext.state,
  });

  console.log("audioContext created. Sample rate:", audioContext.sampleRate);
  console.time("DecodeAudioData");

  let audioBuffer;
  try {
    audioBuffer = await new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
  } catch (err) {
    throw new Error(
      `Audio decoding failed: ${err.message}. Supported formats: WAV, MP3, OGG`,
    );
  } finally {
    console.timeEnd("DecodeAudioData");
  }

  console.log("audioBuffer duration:", audioBuffer.duration);
  console.time("ChannelData extraction");
  const channelData = audioBuffer.getChannelData(0);
  console.timeEnd("ChannelData extraction");
  console.log("First 10 audio samples:", channelData.slice(0, 10));

  // Spectogram Processing
  console.time("Spectogram Generation");
  const windowSize = fftSize;
  const hopSize = Math.floor(windowSize * (1 - overlap));
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);

  console.log(
    `Processing ${numWindows} windows of size ${windowSize} with hop ${hopSize}`,
  );
  console.log(
    `Total samples: ${channelData.length} (~${audioBuffer.duration.toFixed(1)}s)`,
  );

  const spectogramData = [];
  let lastLogTime = Date.now();

  for (let i = 0; i < numWindows; i++) {
    // Progress logging
    if (Date.now() - lastLogTime > 1000) {
      console.log(
        `Processing window ${i}/${numWindows} (${((i / numWindows) * 100).toFixed(1)}%)`,
      );
      lastLogTime = Date.now();
    }

    console.time("WindowSlice");
    const start = i * hopSize;
    let segment = channelData.slice(start, start + windowSize);
    console.timeEnd("WindowSlice");

    console.time("WindowProcessing");
    segment = applyHannWindow(segment);

    console.time("FFT");
    const spectrum = fft(segment);
    console.timeEnd("FFT");

    console.time("MagnitudeCalc");
    const magnitude = spectrum.map((c) => Math.sqrt(c.real ** 2 + c.imag ** 2));
    console.timeEnd("MagnitudeCalc");

    spectogramData.push(magnitude);
    console.timeEnd("WindowProcessing");
  }

  console.timeEnd("Spectogram Generation");

  // ADD VALIDATION
  console.log("Spectogram data validation:");
  console.log(`- Generated ${spectogramData.length} time frames`);
  console.log(
    `- Each frame has ${spectogramData[0]?.length || 0} frequency bins`,
  );

  if (spectogramData.length === 0) {
    throw new Error("No spectogram data generated - audio may be too short");
  }

  if (spectogramData[0].length === 0) {
    throw new Error("Empty frequency bins - FFT may have failed");
  }

  // Check for valid magnitude values
  const flatData = spectogramData.flat();
  const validValues = flatData.filter((val) => !isNaN(val) && isFinite(val));
  console.log(
    `- Valid magnitude values: ${validValues.length}/${flatData.length}`,
  );

  if (validValues.length === 0) {
    throw new Error("All magnitude values are invalid (NaN or Infinite)");
  }

  const maxMag = Math.max(...validValues);
  const minMag = Math.min(...validValues);
  console.log(
    `- Magnitude range: ${minMag.toFixed(6)} to ${maxMag.toFixed(6)}`,
  );

  console.timeEnd("Total computeSpectogram");
  return spectogramData;
}
