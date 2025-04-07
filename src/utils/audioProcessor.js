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

export async function computeSpectogram(file, fftSize = 512, overlap = 0.5) {
  // // audio file handling for
  // const audioContext = new AudioContext();
  // // const arrayBuffer = await file.arrayBuffer();
  // const arrayBuffer = await new Response(file).arrayBuffer();
  //
  // const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  // // first channel
  // const channelData = audioBuffer.gerChanelData(0);

  // Verify file type first
  console.log(file);
  if (!file.type.startsWith("audio/")) {
    throw new Error(`Browser reports invalid type: ${file.type}`);
  }

  // Get ArrayBuffer with proper error handling
  let arrayBuffer;
  try {
    arrayBuffer = await (file.arrayBuffer?.() ||
      new Response(file).arrayBuffer());
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }

  // Create AudioContext and decode
  const audioContext = new AudioContext();
  let audioBuffer;

  try {
    audioBuffer = await new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
  } catch (err) {
    throw new Error(
      `Audio decoding failed: ${err.message}. Supported formats: WAV, MP3, OGG`,
    );
  }

  const channelData = audioBuffer.getChannelData(0);

  console.log("First 10 audio samples:", channelData.slice(0, 10));

  // Spectogram Params
  const windowSize = fftSize;
  const hopSize = Math.floor(windowSize * (1 - overlap));
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);

  // Spectogram data
  const spectogramData = [];
  for (let i = 0; i < numWindows; i++) {
    const start = i * hopSize;
    let segment = channelData.slice(start, start + windowSize);

    // Apply Hann window
    segment = applyHannWindow(segment);

    // Compute FFT
    const spectrum = fft(segment.map((value) => ({ real: value, imag: 0 })));

    // Compute magnitude
    const magnitude = spectrum.map((c) => Math.sqrt(c.real ** 2 + c.imag ** 2));

    spectogramData.push(magnitude);
  }

  return spectogramData;
}
