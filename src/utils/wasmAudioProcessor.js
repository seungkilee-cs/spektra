import init, { WasmSpectrogramProcessor, greet } from "../wasm/rust_audio_processor.js";
import {
  isProfilingEnabled,
  profileFlush,
  profileMark,
  profileMeasure,
} from "./profiler";
import { ensureAudioContext } from "./audioContextManager";

let wasmInitialized = false;
let wasmModule = null;
let workerInstance;
let workerInitPromise;

const spectrogramPool = [];
let pooledFrameLength = 0;

const wasmSimdSupported = detectWasmSimd();

function detectWasmSimd() {
  if (typeof WebAssembly === "undefined" || typeof WebAssembly.validate !== "function") {
    return false;
  }

  const simdModule = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x09, 0x02, 0x60, 0x00, 0x00, 0x60,
    0x00, 0x01, 0x7b, 0x03, 0x02, 0x01, 0x01, 0x07, 0x07, 0x01, 0x03, 0x66, 0x6f, 0x6f, 0x00,
    0x01, 0x0a, 0x0b, 0x01, 0x09, 0x00, 0xfd, 0x00, 0x0b,
  ]);

  try {
    return WebAssembly.validate(simdModule);
  } catch (error) {
    console.warn("WebAssembly SIMD detection failed", error);
    return false;
  }
}

if (wasmSimdSupported) {
  console.log("⚙️ WebAssembly SIMD detected — enabling vectorized FFT path");
} else {
  console.info(
    "⚠️ WebAssembly SIMD unavailable — running scalar FFT path (Rust fallback will be used)",
  );
}

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

function acquireFrame(length) {
  if (length !== pooledFrameLength) {
    spectrogramPool.length = 0;
    pooledFrameLength = length;
  }

  const frame = spectrogramPool.pop();
  if (frame) {
    return frame;
  }
  return new Float32Array(length);
}

async function initWorker() {
  if (workerInstance) {
    return workerInstance;
  }

  if (!workerInitPromise) {
    workerInitPromise = (async () => {
      await initWasmAudio();
      const worker = new Worker(new URL("../workers/spectrogramWorker.js", import.meta.url), {
        type: "module",
      });
      workerInstance = worker;
      return worker;
    })();
  }

  return workerInitPromise;
}

async function processViaWorker(audioData, fftSize, overlap) {
  const worker = await initWorker();

  return new Promise((resolve, reject) => {
    const profiling = isProfilingEnabled();

    const handleMessage = (event) => {
      const { data } = event;
      if (!data) {
        return;
      }

      worker.removeEventListener("message", handleMessage);

      if (!data.success) {
        reject(new Error(data.message || "Worker processing failed"));
        return;
      }

      resolve(data);
    };

    worker.addEventListener("message", handleMessage);

    worker.postMessage(
      {
        type: "process",
        audioData,
        fftSize,
        overlap,
        profiling,
      },
      [audioData.buffer],
    );
  });
}

export async function processAudioWithRustFFT(
  audioFile,
  fftSize = 1024,
  overlap = 0.5,
  sharedAudioContext = null,
) {
  profileMark("pipeline:start");
  console.time("🦀 Total Rust Audio Processing");

  let audioContext = sharedAudioContext;
  try {
    // Load audio file
    profileMark("decode:start");
    if (!audioContext) {
      audioContext = await ensureAudioContext();
    }
    if (!audioContext) {
      throw new Error("AudioContext could not be initialised");
    }
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    profileMark("decode:end");
    profileMeasure("decode", "decode:start", "decode:end");

    const audioData = new Float32Array(audioBuffer.getChannelData(0));

    console.log(
      `🎵 Loaded audio: ${audioData.length} samples @ ${audioBuffer.sampleRate}Hz`,
    );

    const hopSize = Math.max(1, Math.floor(fftSize * (1 - overlap)));
    const totalWindows = audioData.length >= fftSize
      ? Math.floor((audioData.length - fftSize) / hopSize) + 1
      : 0;
    const windowsPerChunk = Math.max(64, Math.min(256, Math.floor(totalWindows / 4) || 256));

    const spectrogram = [];
    let processedWindows = 0;
    let sampleOffset = 0;

    while (processedWindows < totalWindows) {
      const remainingSamples = audioData.length - sampleOffset;
      const maxWindowsFromSamples = remainingSamples >= fftSize
        ? Math.floor((remainingSamples - fftSize) / hopSize) + 1
        : 0;
      const windowsThisChunk = Math.max(
        1,
        Math.min(windowsPerChunk, totalWindows - processedWindows, maxWindowsFromSamples),
      );

      const chunkSamples = fftSize + hopSize * (windowsThisChunk - 1);
      const chunkData = audioData.subarray(sampleOffset, sampleOffset + chunkSamples);
      const chunkCopy = chunkData.slice();

      const { spectrogramFlat, numWindows, freqBins: chunkFreqBins, timings } = await processViaWorker(
        chunkCopy,
        fftSize,
        overlap,
      );

      if (!spectrogramFlat || numWindows === 0) {
        break;
      }

      profileMark("reshape:start");
      for (let i = 0; i < numWindows; i += 1) {
        const start = i * chunkFreqBins;
        const end = start + chunkFreqBins;
        const frameSlice = spectrogramFlat.subarray(start, end);
        const frame = acquireFrame(chunkFreqBins);
        frame.set(frameSlice);
        spectrogram.push(frame);
      }
      profileMark("reshape:end");
      profileMeasure("reshape", "reshape:start", "reshape:end");

      processedWindows += numWindows;
      sampleOffset += hopSize * numWindows;

      if (timings) {
        console.log(
          `👷 Worker chunk processed ${numWindows} windows (${chunkFreqBins} bins) in ${timings.fftMs}ms`,
        );
      }
    }

    console.log(
      `🦀 Generated spectrogram: ${spectrogram.length} x ${spectrogram[0]?.length || 0}`,
    );

    return spectrogram;
  } catch (error) {
    console.error("❌ Rust audio processing failed:", error);
    throw error;
  } finally {
    if (isProfilingEnabled()) {
      profileMark("pipeline:end");
      profileMeasure("pipeline", "pipeline:start", "pipeline:end");
      profileFlush();
    }

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
