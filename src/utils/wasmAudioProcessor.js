import init, {
  WasmSpectrogramProcessor,
  greet,
} from "../wasm/rust_audio_processor.js";

let wasmInitialized = false;
let wasmModule = null;

/**
 * Initialize WASM module (call once per app session)
 */
export async function initWasmAudio() {
  if (wasmInitialized) return wasmModule;

  console.time("🦀 WASM Audio Initialization");

  try {
    // This loads the .wasm binary and sets up memory
    wasmModule = await init();
    wasmInitialized = true;

    console.log("✅ Rust WASM Audio module loaded successfully");
    console.log("📄 Available functions:", Object.keys(wasmModule));

    return wasmModule;
  } catch (error) {
    console.error("❌ Failed to load WASM audio module:", error);
    throw new Error(`WASM initialization failed: ${error.message}`);
  } finally {
    console.timeEnd("🦀 WASM Audio Initialization");
  }
}

/**
 * Process audio with Rust FFT (replaces JavaScript version)
 */
export async function processAudioWithRustFFT(
  audioFile,
  fftSize = 1024,
  overlap = 0.5,
) {
  // Ensure WASM is loaded
  await initWasmAudio();

  console.time("🦀 Total Rust Audio Processing");

  try {
    // 1. Load audio file (same as before)
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const audioData = audioBuffer.getChannelData(0); // Get left channel

    console.log(
      `🎵 Loaded audio: ${audioData.length} samples @ ${audioBuffer.sampleRate}Hz`,
    );

    // 2. Create Rust processor instance
    console.time("🦀 Rust FFT Computation");
    const processor = new WasmSpectrogramProcessor(fftSize);

    // 3. Call Rust function directly!
    const spectrogramFlat = processor.compute_spectrogram(audioData, overlap);
    console.timeEnd("🦀 Rust FFT Computation");

    // 4. Reshape data back to 2D array for canvas
    const numWindows =
      Math.floor((audioData.length - fftSize) / (fftSize * (1 - overlap))) + 1;
    const freqBins = fftSize / 2;
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

/**
 * Test function to verify WASM works
 */
export async function testRustConnection() {
  await initWasmAudio();

  // Test simple function
  const greeting = greet("Spektra");
  console.log("🦀 Rust says:", greeting);

  // Test FFT with small data
  const testData = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    testData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100); // 440Hz sine wave
  }

  const processor = new WasmSpectrogramProcessor(1024);
  const result = processor.process_window(testData);

  console.log("🦀 FFT test result:", result.length, "frequency bins");
  return { greeting, fftBins: result.length };
}
