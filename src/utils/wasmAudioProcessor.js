import init, {
  WasmSpectrogramProcessor,
  greet,
} from "../wasm/rust_audio_processor.js";

let wasmInitialized = false;
let wasmModule = null;

export async function initWasmAudio() {
  if (wasmInitialized && wasmModule) {
    return wasmModule;
  }

  console.time("🦀 WASM Audio Initialization");
  try {
    wasmModule = await init();
    wasmInitialized = true;
    console.log("✅ Rust WASM Audio module loaded successfully");
    return wasmModule;
  } catch (error) {
    console.error("❌ Failed to load WASM audio module:", error);
    throw new Error(`WASM initialization failed: ${error.message}`);
  } finally {
    console.timeEnd("🦀 WASM Audio Initialization");
  }
}

export async function processAudioWithRustFFT(
  audioFile,
  fftSize = 1024,
  overlap = 0.5,
) {
  await initWasmAudio();

  console.time("🦀 Total Rust Audio Processing");
  try {
    // Load audio file
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const audioData = audioBuffer.getChannelData(0);

    console.log(
      `🎵 Loaded audio: ${audioData.length} samples @ ${audioBuffer.sampleRate}Hz`,
    );

    // Create Rust processor and compute spectrogram
    console.time("🦀 Rust FFT Computation");
    const processor = new WasmSpectrogramProcessor(fftSize);
    const batch = processor.process_windows(audioData, overlap, null, null);
    console.timeEnd("🦀 Rust FFT Computation");

    const spectrogramFlat = batch.data;
    const numWindows = batch.num_windows;
    const freqBins = batch.freq_bins;
    const spectrogram = [];

    for (let i = 0; i < numWindows; i++) {
      const start = i * freqBins;
      const end = start + freqBins;
      spectrogram.push(Array.from(spectrogramFlat.slice(start, end)));
    }

    console.log(
      `🦀 Generated spectrogram: ${spectrogram.length} x ${spectrogram[0].length}`,
    );

    return spectrogram;
  } catch (error) {
    console.error("❌ Rust audio processing failed:", error);
    throw error;
  } finally {
    console.timeEnd("🦀 Total Rust Audio Processing");
  }
}

export async function testRustConnection() {
  await initWasmAudio();

  const greeting = greet("Spektra");
  console.log("🦀 Rust says:", greeting);

  // Test FFT with small data
  const testData = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    testData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
  }

  const processor = new WasmSpectrogramProcessor(1024);
  const result = processor.process_window(testData);
  console.log("🦀 FFT test result:", result.length, "frequency bins");

  return { greeting, fftBins: result.length };
}
