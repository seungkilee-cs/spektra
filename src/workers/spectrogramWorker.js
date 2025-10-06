import init, { WasmSpectrogramProcessor } from "../wasm/rust_audio_processor.js";

let initPromise;
let processor = null;
let currentFftSize = null;

async function ensureWasm() {
  if (!initPromise) {
    initPromise = init();
  }
  await initPromise;
}

function getProcessor(fftSize) {
  if (!processor || currentFftSize !== fftSize) {
    processor = new WasmSpectrogramProcessor(fftSize);
    currentFftSize = fftSize;
  }
  return processor;
}

self.addEventListener("message", async (event) => {
  const { data } = event;
  if (!data || data.type !== "process") {
    return;
  }

  const { audioData, fftSize, overlap, profiling } = data;

  try {
    await ensureWasm();
    const wasmProcessor = getProcessor(fftSize);

    let timings;
    const fftStart = profiling ? performance.now() : 0;
    const batch = wasmProcessor.process_windows(audioData, overlap, null, null);
    const fftEnd = profiling ? performance.now() : 0;

    const spectrogramFlat = new Float32Array(batch.data);
    const numWindows = batch.num_windows;
    const freqBins = batch.freq_bins;

    if (profiling) {
      timings = {
        fftMs: (fftEnd - fftStart).toFixed(2),
        numWindows,
        freqBins,
      };
    }

    self.postMessage(
      {
        success: true,
        spectrogramFlat,
        numWindows,
        freqBins,
        timings,
      },
      [spectrogramFlat.buffer],
    );
  } catch (error) {
    self.postMessage({
      success: false,
      message: error?.message || String(error),
    });
  }
});
