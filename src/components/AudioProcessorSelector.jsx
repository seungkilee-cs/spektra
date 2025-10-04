import React, { useState } from "react";
import {
  processAudioWithRustFFT,
  testRustConnection,
} from "../utils/wasmAudioProcessor";

const AudioProcessorSelector = ({ file, onSpectrogramGenerated }) => {
  const [processing, setProcessing] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);

  const processAudio = async () => {
    if (!file) return;

    setProcessing(true);
    const startTime = performance.now();

    try {
      console.log("🦀 Processing with Rust+WASM...");
      const spectrogram = await processAudioWithRustFFT(file, 1024, 0.5);
      const processingTime = performance.now() - startTime;

      // Performance comparison
      setPerformanceData({
        method: "rust",
        time: processingTime,
        fileSize: file.size,
        spectrogramSize: `${spectrogram.length} x ${spectrogram[0].length}`,
      });

      onSpectrogramGenerated(spectrogram);
    } catch (error) {
      console.error("❌ Rust processing failed:", error);
      alert(`Processing failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const runTest = async () => {
    try {
      const result = await testRustConnection();
      alert(
        `✅ WASM Test Passed!\n${result.greeting}\nFFT generated ${result.fftBins} frequency bins`,
      );
    } catch (error) {
      alert(`❌ WASM Test Failed: ${error.message}`);
    }
  };

  return (
    <div className="audio-processor-controls">
      <h3>🎛️ Audio Processing Engine</h3>

      <p className="processor-note">
        🦀 Rust+WASM FFT is always used (legacy JS path removed).
      </p>

      <div className="action-buttons">
        <button
          onClick={processAudio}
          disabled={processing || !file}
          className="process-btn"
        >
          {processing ? "🔄 Processing..." : "🚀 Process with Rust"}
        </button>

        <button onClick={runTest} className="test-btn">
          🧪 Test WASM
        </button>
      </div>

      {performanceData && (
        <div className="performance-results">
          <h4>📊 Performance Results</h4>
          <p>
            <strong>Method:</strong> {performanceData.method}
          </p>
          <p>
            <strong>Time:</strong> {performanceData.time.toFixed(2)}ms
          </p>
          <p>
            <strong>File Size:</strong>{" "}
            {(performanceData.fileSize / 1024 / 1024).toFixed(2)}MB
          </p>
          <p>
            <strong>Output:</strong> {performanceData.spectrogramSize}
          </p>
        </div>
      )}
    </div>
  );
};

export default AudioProcessorSelector;
