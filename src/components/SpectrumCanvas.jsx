import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { computeSpectogram } from "../utils/audioProcessor";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const spectrogramDataRef = useRef(null); // Cache computed data
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 450 });
  const [isProcessed, setIsProcessed] = useState(false);

  // Debounced resize handler to prevent excessive re-renders
  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const padding = 40;

      const maxWidth = Math.min(rect.width - padding, 1200);
      const width = Math.max(600, maxWidth);
      const height = Math.max(400, Math.min(600, width * 0.5));

      setCanvasSize((prev) => {
        // Only update if size actually changed significantly
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

  // Debounced resize effect - only for window resize, not dev tools
  useEffect(() => {
    let resizeTimeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateCanvasSize, 300); // 300ms debounce
    };

    updateCanvasSize(); // Initial size
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []); // Only run once on mount

  // Separate effect for file processing (runs only when file changes)
  useEffect(() => {
    if (fileUploaded && !spectrogramDataRef.current) {
      processAudioFile(fileUploaded);
    }
  }, [fileUploaded]);

  // Separate effect for canvas rendering (only when data or canvas size changes)
  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed) {
      renderSpectrogramFromData(spectrogramDataRef.current);
    }
  }, [canvasSize, isProcessed]);

  const processAudioFile = async (file) => {
    try {
      console.log("=== STARTING SPECTRUM PROCESSING ===");
      setIsProcessed(false);

      // Compute spectrogram data once
      const spectrogramData = await computeSpectogram(file);
      console.log(
        "Spectrogram dimensions:",
        spectrogramData.length,
        "x",
        spectrogramData[0].length,
      );

      // Process and cache the data
      let displayData = spectrogramData;

      // Downsample if needed
      const maxDisplayFrames = 2000;
      const maxDisplayFreqs = 256;

      if (spectrogramData.length > maxDisplayFrames) {
        console.log(
          `Downsampling time: ${spectrogramData.length} → ${maxDisplayFrames}`,
        );
        const timeStep = Math.floor(spectrogramData.length / maxDisplayFrames);
        displayData = spectrogramData.filter(
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

  const renderSpectrogramFromData = useCallback(
    (normalizedData) => {
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

      // Add labels
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
    const fontSize = Math.max(10, canvasSize.width * 0.012);
    const labelFontSize = Math.max(12, canvasSize.width * 0.014);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

    // Frequency labels (left)
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const sampleRate = 44100;
    const nyquistFreq = sampleRate / 2;

    const freqLabels = [
      { freq: 0, label: "0" },
      { freq: 100, label: "100" },
      { freq: 200, label: "200" },
      { freq: 500, label: "500" },
      { freq: 1000, label: "1k" },
      { freq: 2000, label: "2k" },
      { freq: 5000, label: "5k" },
      { freq: 10000, label: "10k" },
      { freq: 15000, label: "15k" },
      { freq: 20000, label: "20k" },
      { freq: 22000, label: "22k" },
    ];

    freqLabels.forEach(({ freq, label }) => {
      if (freq <= nyquistFreq) {
        const y = topMargin + plotHeight - (freq / nyquistFreq) * plotHeight;
        ctx.fillText(label, leftMargin - 8, y);

        // Grid lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(leftMargin + plotWidth, y);
        ctx.stroke();
      }
    });

    // dB labels (right)
    ctx.textAlign = "left";
    const dbLabels = [0, -20, -40, -60, -80, -100, -120];

    dbLabels.forEach((db) => {
      const y = topMargin + plotHeight - ((db + 120) / 120) * plotHeight;
      ctx.fillText(`${db}`, leftMargin + plotWidth + 8, y);
    });

    // Time labels (bottom)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const estimatedDuration = 256; // Should get from metadata
    const timeLabels = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

    timeLabels.forEach((minutes) => {
      if (minutes * 60 <= estimatedDuration) {
        const x = leftMargin + ((minutes * 60) / estimatedDuration) * plotWidth;
        const label =
          minutes === Math.floor(minutes)
            ? `${Math.floor(minutes)}:00`
            : `${Math.floor(minutes)}:30`;
        ctx.fillText(label, x, topMargin + plotHeight + 8);
      }
    });

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${labelFontSize}px 'JetBrains Mono', monospace`;

    // "Frequency (Hz)" label (left)
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(18, topMargin + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Frequency (Hz)", 0, 0);
    ctx.restore();

    // "Amplitude (dB)" label (right)
    ctx.save();
    ctx.translate(canvas.width - 18, topMargin + plotHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("Amplitude (dB)", 0, 0);
    ctx.restore();

    // "Time" label (bottom)
    ctx.textAlign = "center";
    ctx.fillText("Time", leftMargin + plotWidth / 2, canvas.height - 8);
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
    <div ref={containerRef} className="spectrum-canvas-container">
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
