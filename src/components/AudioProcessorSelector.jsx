import React, { useState } from "react";
import {
  processAudioWithRustFFT,
  testRustConnection,
} from "../utils/wasmAudioProcessor";
import { computeSpectogramWithMetrics } from "../utils/audioProcessor"; // JS version

const AudioProcessorSelector = ({ file, onSpectrogramGenerated }) => {
  const [processing, setProcessing] = useState(false);
  const [processingMethod, setProcessingMethod] = useState("rust"); // 'rust' or 'javascript'
  const [performanceData, setPerformanceData] = useState(null);

  const processAudio = async () => {
    if (!file) return;

    setProcessing(true);
    const startTime = performance.now();

    try {
      let spectrogram;
      let processingTime;

      if (processingMethod === "rust") {
        console.log("🦀 Processing with Rust+WASM...");
        spectrogram = await processAudioWithRustFFT(file, 1024, 0.5);
        processingTime = performance.now() - startTime;
      } else {
        console.log("🟡 Processing with JavaScript...");
        const result = await computeSpectogramWithMetrics(file, 1024, 0.5);
        spectrogram = result.result;
        processingTime = result.metrics.totalTime;
      }

      // Performance comparison
      setPerformanceData({
        method: processingMethod,
        time: processingTime,
        fileSize: file.size,
        spectrogramSize: `${spectrogram.length} x ${spectrogram[0].length}`,
      });

      onSpectrogramGenerated(spectrogram);
    } catch (error) {
      console.error(`❌ ${processingMethod} processing failed:`, error);
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

      <div className="method-selector">
        <label>
          <input
            type="radio"
            value="rust"
            checked={processingMethod === "rust"}
            onChange={(e) => setProcessingMethod(e.target.value)}
          />
          🦀 Rust+WASM (Fast)
        </label>

        <label>
          <input
            type="radio"
            value="javascript"
            checked={processingMethod === "javascript"}
            onChange={(e) => setProcessingMethod(e.target.value)}
          />
          🟡 JavaScript (Slow)
        </label>
      </div>

      <div className="action-buttons">
        <button
          onClick={processAudio}
          disabled={processing || !file}
          className="process-btn"
        >
          {processing
            ? "🔄 Processing..."
            : `🚀 Process with ${processingMethod}`}
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
