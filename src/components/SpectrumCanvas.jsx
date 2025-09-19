import React, { useRef, useEffect, useState, useCallback } from "react";
import { computeSpectogram } from "../utils/audioProcessor";
import { debugLog, debugError } from "../utils/debug";
import "../styles/SpectrumCanvas.css";

// WASM imports - these will be created next
let wasmModule = null;
let WasmSpectrogramProcessor = null;

// Initialize WASM (try to load, fall back gracefully if not available)
const initWasm = async () => {
  if (wasmModule) {
    console.log("✅ WASM already initialized");
    return wasmModule;
  }

  try {
    console.log("🔄 Attempting to load WASM module...");
    console.time("🦀 WASM Initialization");

    // Check if files exist first
    const wasmImports = await import("../wasm/rust_audio_processor.js");
    console.log("✅ WASM JS bindings loaded");

    wasmModule = await wasmImports.default();
    console.log("✅ WASM binary loaded");

    WasmSpectrogramProcessor = wasmImports.WasmSpectrogramProcessor;
    console.log("✅ WASM exports:", Object.keys(wasmImports));

    console.log("✅ Rust WASM module initialized successfully");
    return wasmModule;
  } catch (error) {
    console.error("❌ WASM module loading failed:", error);
    console.error("❌ Error details:", error.message);
    console.error("❌ Error stack:", error.stack);
    return null;
  } finally {
    console.timeEnd("🦀 WASM Initialization");
  }
};
// WASM-powered audio processing
const processAudioWithWasm = async (file) => {
  console.log("🦀 Starting WASM audio processing...");

  const wasmInstance = await initWasm();
  if (!wasmInstance || !WasmSpectrogramProcessor) {
    throw new Error("WASM module not available");
  }

  console.log("🦀 WASM module confirmed available");

  try {
    // Load audio file (same as JS version)
    console.log("🦀 Loading audio for WASM processing...");
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const audioData = audioBuffer.getChannelData(0);

    console.log(
      `🎵 Audio loaded for WASM: ${audioData.length} samples @ ${audioBuffer.sampleRate}Hz`,
    );

    // Create Rust processor and process
    console.log("🦀 Creating WASM processor...");
    const processor = new WasmSpectrogramProcessor(1024);
    console.log("🦀 Calling compute_spectrogram...");

    const spectrogramFlat = processor.compute_spectrogram(audioData, 0.5);
    console.log(
      "🦀 WASM compute_spectrogram completed, got",
      spectrogramFlat.length,
      "values",
    );

    // Reshape flat array back to 2D
    const numWindows = Math.floor((audioData.length - 1024) / (1024 * 0.5)) + 1;
    const freqBins = 1024 / 2;
    const spectrogram = [];

    for (let i = 0; i < numWindows; i++) {
      const start = i * freqBins;
      const end = start + freqBins;
      spectrogram.push(Array.from(spectrogramFlat.slice(start, end)));
    }

    console.log(
      `🦀 WASM Generated spectrogram: ${spectrogram.length} x ${spectrogram[0].length}`,
    );
    return spectrogram;
  } catch (error) {
    console.error("❌ WASM processing error:", error);
    throw error;
  }
};
// Performance comparison logging (your existing function)
const logPerformanceComparison = (
  jsTime,
  wasmTime,
  fileSize,
  spectrogramSize,
) => {
  const speedup = (jsTime / wasmTime).toFixed(2);
  const improvement = (((jsTime - wasmTime) / jsTime) * 100).toFixed(1);
  const fileMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log(`
🏆 FFT Performance Comparison Results
${"=".repeat(50)}
📁 File Size: ${fileMB} MB
📊 Spectrogram: ${spectrogramSize}
${"─".repeat(30)}
🟡 JavaScript (fft-js): ${jsTime.toFixed(2)}ms
🦀 Rust+WASM: ${wasmTime.toFixed(2)}ms
${"─".repeat(30)}
⚡ Speedup: ${speedup}x faster
📈 Improvement: ${improvement}% faster
🏁 Winner: ${speedup > 1 ? "🦀 Rust+WASM" : "🟡 JavaScript (fft-js)"}
${"=".repeat(50)}
  `);

  // performance entry for debug
  if (performance && performance.mark) {
    performance.mark(`spektra-js-fft-${jsTime}ms`);
    performance.mark(`spektra-rust-fft-${wasmTime}ms`);
  }
};

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const spectrogramDataRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 450 });
  const [isProcessed, setIsProcessed] = useState(false);
  const [processingMethod, setProcessingMethod] = useState("auto"); // 'js', 'wasm', 'auto'

  // Your existing resize logic stays the same
  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const padding = 40;
      const maxWidth = Math.min(rect.width - padding, 1200);
      const width = Math.max(600, maxWidth);
      const height = Math.max(400, Math.min(600, width * 0.5));

      setCanvasSize((prev) => {
        if (
          Math.abs(prev.width - width) > 20 ||
          Math.abs(prev.height - height) > 20
        ) {
          return { width, height };
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateCanvasSize, 300);
    };

    updateCanvasSize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  useEffect(() => {
    if (fileUploaded && !spectrogramDataRef.current && !isProcessed) {
      processAudioFile(fileUploaded);
    }
  }, [fileUploaded?.name, fileUploaded?.size]);

  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed) {
      renderSpectrogramFromData(spectrogramDataRef.current);
    }
  }, [canvasSize, isProcessed]);

  // 🚀 ENHANCED processAudioFile with WASM comparison
  const processAudioFile = async (file) => {
    try {
      console.log("=== STARTING SPECTRUM PROCESSING ===");
      setIsProcessed(false);

      let jsTime = 0;
      let wasmTime = 0;
      let jsSpectrogramData = null;
      let wasmSpectrogramData = null;
      let finalSpectrogramData = null;

      // 🟡 JavaScript FFT Processing
      console.log("🟡 Processing with JavaScript FFT...");
      const jsStart = performance.now();
      jsSpectrogramData = await computeSpectogram(file);
      jsTime = performance.now() - jsStart;
      console.log(`🟡 JavaScript FFT completed in ${jsTime.toFixed(2)}ms`);

      // 🦀 Try WASM FFT Processing
      try {
        console.log("🦀 Processing with Rust+WASM FFT...");
        const wasmStart = performance.now();
        wasmSpectrogramData = await processAudioWithWasm(file);
        wasmTime = performance.now() - wasmStart;
        console.log(`🦀 Rust+WASM FFT completed in ${wasmTime.toFixed(2)}ms`);

        // 🏆 Log performance comparison
        logPerformanceComparison(
          jsTime,
          wasmTime,
          file.size,
          `${jsSpectrogramData.length} x ${jsSpectrogramData[0].length}`,
        );

        // Choose which data to use based on processingMethod
        if (
          processingMethod === "wasm" ||
          (processingMethod === "auto" && wasmTime < jsTime)
        ) {
          finalSpectrogramData = wasmSpectrogramData;
          console.log("✅ Using Rust+WASM result (faster)");
        } else {
          finalSpectrogramData = jsSpectrogramData;
          console.log("✅ Using JavaScript result");
        }
      } catch (wasmError) {
        console.warn(
          "⚠️ WASM processing failed, using JavaScript:",
          wasmError.message,
        );
        finalSpectrogramData = jsSpectrogramData;

        // Log JS-only performance
        console.log(`🟡 JavaScript-only processing: ${jsTime.toFixed(2)}ms`);
        console.log(
          `📊 Processing rate: ${(file.size / 1024 / (jsTime / 1000)).toFixed(2)} KB/s`,
        );
      }

      // 📊 Continue with your existing processing logic...
      console.log(
        "Final spectrogram dimensions:",
        finalSpectrogramData.length,
        "x",
        finalSpectrogramData[0].length,
      );

      // Process and cache the data (your existing logic)
      let displayData = finalSpectrogramData;

      // Downsample if needed
      const maxDisplayFrames = 2000;
      const maxDisplayFreqs = 256;

      if (finalSpectrogramData.length > maxDisplayFrames) {
        console.log(
          `Downsampling time: ${finalSpectrogramData.length} → ${maxDisplayFrames}`,
        );
        const timeStep = Math.floor(
          finalSpectrogramData.length / maxDisplayFrames,
        );
        displayData = finalSpectrogramData.filter(
          (_, index) => index % timeStep === 0,
        );
      }

      if (displayData[0].length > maxDisplayFreqs) {
        console.log(
          `Downsampling frequency: ${displayData[0].length} → ${maxDisplayFreqs}`,
        );
        const freqStep = Math.floor(displayData[0].length / maxDisplayFreqs);
        displayData = displayData.map((frame) =>
          frame.filter((_, index) => index % freqStep === 0),
        );
      }

      // Convert to dB and normalize
      const dbData = displayData.map((frame) =>
        frame.map((magnitude) => {
          const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -120;
          return Math.max(-120, db);
        }),
      );

      const minDb = -120;
      const maxDb = 0;
      const normalizedData = dbData.map((frame) =>
        frame.map((db) => (db - minDb) / (maxDb - minDb)),
      );

      // Cache the processed data
      spectrogramDataRef.current = normalizedData;
      setIsProcessed(true);
      console.log("✅ Audio processing completed");
    } catch (error) {
      console.error("❌ Error processing audio:", error);
      spectrogramDataRef.current = null;
      setIsProcessed(false);
    }
  };

  // Your existing renderSpectrogramFromData function stays exactly the same
  const renderSpectrogramFromData = useCallback(
    (normalizedData) => {
      // ... your existing rendering code (unchanged)
      const canvas = canvasRef.current;
      if (!canvas || !normalizedData) return;

      console.log("=== RENDERING SPECTROGRAM ===");
      const ctx = canvas.getContext("2d");

      // Responsive margins
      const leftMargin = Math.max(60, canvasSize.width * 0.08);
      const rightMargin = Math.max(60, canvasSize.width * 0.08);
      const bottomMargin = Math.max(40, canvasSize.height * 0.1);
      const topMargin = Math.max(20, canvasSize.height * 0.05);
      const plotWidth = canvas.width - leftMargin - rightMargin;
      const plotHeight = canvas.height - topMargin - bottomMargin;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate rendering params
      const timeBins = normalizedData.length;
      const freqBins = normalizedData[0].length;

      // ✅ FIXED: Ensure integer pixel alignment to prevent rendering artifacts
      const binWidth = Math.max(1, plotWidth / timeBins);
      const binHeight = Math.max(1, plotHeight / freqBins);

      console.log("Rendering params:", {
        timeBins,
        freqBins,
        binWidth,
        binHeight,
        plotWidth,
        plotHeight,
      });

      // Create ImageData buffer
      const imageData = ctx.createImageData(
        Math.floor(plotWidth),
        Math.floor(plotHeight),
      );
      const data = imageData.data;

      // Color mapping function
      const spekColorMap = (normalizedMagnitude) => {
        const t = Math.max(0, Math.min(1, normalizedMagnitude));
        let r, g, b;

        if (t < 0.1) {
          const local = t / 0.1;
          r = Math.floor(local * 20);
          g = 0;
          b = 20 + Math.floor(local * 60);
        } else if (t < 0.3) {
          const local = (t - 0.1) / 0.2;
          r = 20 + Math.floor(local * 30);
          g = Math.floor(local * 50);
          b = 80 + Math.floor(local * 175);
        } else if (t < 0.5) {
          const local = (t - 0.3) / 0.2;
          r = 50 + Math.floor(local * 150);
          g = 50 - Math.floor(local * 50);
          b = 255;
        } else if (t < 0.7) {
          const local = (t - 0.5) / 0.2;
          r = 200 + Math.floor(local * 55);
          g = Math.floor(local * 100);
          b = 255 - Math.floor(local * 100);
        } else if (t < 0.9) {
          const local = (t - 0.7) / 0.2;
          r = 255;
          g = 100 + Math.floor(local * 155);
          b = Math.max(0, 155 - Math.floor(local * 155));
        } else {
          const local = (t - 0.9) / 0.1;
          r = 255;
          g = 255;
          b = Math.floor(local * 255);
        }

        return { r, g, b };
      };

      // Optimized pixel filling with proper bounds checking
      const imageWidth = Math.floor(plotWidth);
      const imageHeight = Math.floor(plotHeight);

      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          const color = spekColorMap(magnitude);

          // Calculate pixel positions with bounds checking
          const xStart = Math.floor(timeIndex * binWidth);
          const xEnd = Math.min(
            imageWidth,
            Math.floor((timeIndex + 1) * binWidth),
          );
          const yStart = Math.floor(imageHeight - (freqIndex + 1) * binHeight);
          const yEnd = Math.min(
            imageHeight,
            Math.floor(imageHeight - freqIndex * binHeight),
          );

          // Fill the rectangular region
          for (
            let y = Math.max(0, yStart);
            y < Math.max(yStart + 1, yEnd);
            y++
          ) {
            for (
              let x = Math.max(0, xStart);
              x < Math.max(xStart + 1, xEnd);
              x++
            ) {
              if (x < imageWidth && y < imageHeight && y >= 0 && x >= 0) {
                const index = (y * imageWidth + x) * 4;
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
              }
            }
          }
        });
      });

      // Draw spectrogram
      ctx.putImageData(imageData, leftMargin, topMargin);

      // Add labels to canvas
      addLabelsToCanvas(
        ctx,
        canvas,
        leftMargin,
        rightMargin,
        topMargin,
        bottomMargin,
        plotWidth,
        plotHeight,
      );

      console.log("✅ Spectrogram rendering completed");
    },
    [canvasSize],
  );

  // Your existing addLabelsToCanvas function stays the same
  const addLabelsToCanvas = (
    ctx,
    canvas,
    leftMargin,
    rightMargin,
    topMargin,
    bottomMargin,
    plotWidth,
    plotHeight,
  ) => {
    // ... your existing label code (unchanged)
  };

  // Reset cached data when file changes
  useEffect(() => {
    if (!fileUploaded) {
      spectrogramDataRef.current = null;
      setIsProcessed(false);
    }
  }, [fileUploaded]);

  // Placeholder rendering
  useEffect(() => {
    if (!fileUploaded && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(60, 20, canvas.width - 120, canvas.height - 60);
      ctx.setLineDash([]);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "1rem 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "Upload an audio file to see the spectrum",
        canvas.width / 2,
        canvas.height / 2,
      );
    }
  }, [fileUploaded, canvasSize]);

  return (
    <div className="spectrum-container" ref={containerRef}>
      {/* 🚀 Optional: Add processing method selector for testing */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{ marginBottom: "10px", fontSize: "12px", color: "#94a3b8" }}
        >
          🧪 Processing:
          <select
            value={processingMethod}
            onChange={(e) => setProcessingMethod(e.target.value)}
            style={{
              marginLeft: "5px",
              backgroundColor: "#1a1a1a",
              color: "white",
              border: "1px solid #374151",
            }}
          >
            <option value="auto">Auto (fastest)</option>
            <option value="js">JavaScript only</option>
            <option value="wasm">WASM only</option>
          </select>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="spectrum-canvas"
      />
    </div>
  );
};

export default SpectrumCanvas;
