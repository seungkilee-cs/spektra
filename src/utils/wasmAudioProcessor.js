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
let workerQueue = Promise.resolve();
let nextWorkerRequestId = 1;

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
  console.log("⚙️ WebAssembly SIMD detected by browser");
} else {
  console.info("⚠️ WebAssembly SIMD unavailable in this browser");
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
      const worker = new Worker(new URL("../workers/spectrogramWorker.js", import.meta.url), {
        type: "module",
      });
      workerInstance = worker;
      return worker;
    })();
  }

  return workerInitPromise;
}

function processViaWorkerNow(audioData, fftSize, overlap, { timeStride, freqStride }) {
  return initWorker().then(
    (worker) =>
      new Promise((resolve, reject) => {
        const profiling = isProfilingEnabled();
        const requestId = nextWorkerRequestId;
        nextWorkerRequestId += 1;

        const cleanup = () => {
          worker.removeEventListener("message", handleMessage);
          worker.removeEventListener("error", handleError);
          worker.removeEventListener("messageerror", handleMessageError);
        };

        const handleMessage = (event) => {
          const { data } = event;
          if (!data || data.requestId !== requestId) {
            return;
          }

          cleanup();

          if (!data.success) {
            reject(new Error(data.message || "Worker processing failed"));
            return;
          }

          resolve(data);
        };

        const handleError = (event) => {
          cleanup();
          reject(new Error(event.message || "Worker error during spectrogram processing"));
        };

        const handleMessageError = () => {
          cleanup();
          reject(new Error("Worker could not deserialize spectrogram message"));
        };

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);
        worker.addEventListener("messageerror", handleMessageError);

        worker.postMessage(
          {
            type: "process",
            requestId,
            audioData,
            fftSize,
            overlap,
            profiling,
            timeStride,
            freqStride,
          },
          [audioData.buffer],
        );
      }),
  );
}

function processViaWorker(audioData, fftSize, overlap, strides) {
  const queued = workerQueue.then(
    () => processViaWorkerNow(audioData, fftSize, overlap, strides),
    () => processViaWorkerNow(audioData, fftSize, overlap, strides),
  );
  workerQueue = queued.catch(() => {});
  return queued;
}

function mixAudioBufferToMono(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels || 1;
  const length = audioBuffer.length;

  if (channelCount === 1) {
    return new Float32Array(audioBuffer.getChannelData(0));
  }

  const mixed = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mixed[i] += channelData[i] / channelCount;
    }
  }

  return mixed;
}

function getChunkLogicalWindowCount(remainingWindows, timeStride) {
  const maxLogicalWindowsPerChunk = 4096;
  if (remainingWindows <= maxLogicalWindowsPerChunk) {
    return remainingWindows;
  }

  return Math.max(
    timeStride,
    Math.floor(maxLogicalWindowsPerChunk / timeStride) * timeStride,
  );
}

export async function processAudioWithRustFFT(
  audioFile,
  fftSize = 1024,
  overlap = 0.5,
  sharedAudioContext = null,
  options = {},
) {
  profileMark("pipeline:start");
  console.time("🦀 Total Rust Audio Processing");

  const maxDisplayFrames = options.maxDisplayFrames ?? 2000;
  const maxDisplayFreqs = options.maxDisplayFreqs ?? 256;

  let audioContext = sharedAudioContext;
  try {
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

    const audioData = mixAudioBufferToMono(audioBuffer);
    const audioMetadata = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      nyquistFreq: audioBuffer.sampleRate / 2,
      channels: audioBuffer.numberOfChannels,
    };

    console.log(
      `🎵 Loaded audio: ${audioData.length} samples @ ${audioBuffer.sampleRate}Hz (${audioBuffer.numberOfChannels} channel${audioBuffer.numberOfChannels === 1 ? "" : "s"})`,
    );

    const hopSize = Math.max(1, Math.floor(fftSize * (1 - overlap)));
    const totalWindows = audioData.length >= fftSize
      ? Math.floor((audioData.length - fftSize) / hopSize) + 1
      : 0;
    const sourceFreqBins = fftSize / 2;
    const timeStride = Math.max(1, Math.ceil(totalWindows / maxDisplayFrames));
    const freqStride = Math.max(1, Math.ceil(sourceFreqBins / maxDisplayFreqs));

    console.log(
      `🧮 Spectrogram plan: ${totalWindows} windows, time stride ${timeStride}, frequency stride ${freqStride}`,
    );

    const spectrogram = [];
    let processedWindows = 0;
    let currentWindow = 0;

    while (currentWindow < totalWindows) {
      const remainingWindows = totalWindows - currentWindow;
      const logicalWindowsThisChunk = getChunkLogicalWindowCount(remainingWindows, timeStride);
      const sampleOffset = currentWindow * hopSize;
      const chunkSamples = fftSize + hopSize * (logicalWindowsThisChunk - 1);
      const chunkCopy = audioData.slice(sampleOffset, sampleOffset + chunkSamples);

      const { spectrogramFlat, numWindows, freqBins: chunkFreqBins, timings } = await processViaWorker(
        chunkCopy,
        fftSize,
        overlap,
        { timeStride, freqStride },
      );

      if (!spectrogramFlat || numWindows === 0) {
        currentWindow += logicalWindowsThisChunk;
        continue;
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
      currentWindow += logicalWindowsThisChunk;

      if (timings) {
        console.log(
          `👷 Worker chunk processed ${numWindows} displayed windows (${chunkFreqBins} bins) in ${timings.fftMs}ms`,
        );
      }
    }

    console.log(
      `🦀 Generated spectrogram: ${spectrogram.length} x ${spectrogram[0]?.length || 0} from ${processedWindows} displayed windows`,
    );

    return {
      spectrogram,
      audioMetadata,
      displayStrides: { timeStride, freqStride },
    };
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

  const testData = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    testData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
  }

  const processor = new WasmSpectrogramProcessor(1024);
  const result = processor.process_window(testData);
  console.log("🦀 FFT test result:", result.length, "frequency bins");

  return { greeting, fftBins: result.length };
}
