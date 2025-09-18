import React, { useRef, useEffect } from "react";
import { computeSpectogram } from "../utils/audioProcessor";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const drawSpectogram = async (file) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Reserve space for labels
      const leftMargin = 50;
      const rightMargin = 50;
      const bottomMargin = 30;
      const topMargin = 10;

      const plotWidth = canvas.width - leftMargin - rightMargin;
      const plotHeight = canvas.height - topMargin - bottomMargin;

      // Clear canvas with black background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      console.log("=== STARTING SPECTRUM RENDERING ===");

      // Compute spectogram data
      const spectogramData = await computeSpectogram(file);
      console.log(
        "Spectogram dimensions:",
        spectogramData.length,
        "x",
        spectogramData[0].length,
      );

      // Performance optimization: Downsample if too large
      const maxDisplayFrames = 2000;
      const maxDisplayFreqs = 256;

      let displayData = spectogramData;

      // Downsample time dimension
      if (spectogramData.length > maxDisplayFrames) {
        console.log(
          `Downsampling time: ${spectogramData.length} → ${maxDisplayFrames}`,
        );
        const timeStep = Math.floor(spectogramData.length / maxDisplayFrames);
        displayData = spectogramData.filter(
          (_, index) => index % timeStep === 0,
        );
      }

      // Downsample frequency dimension
      if (displayData[0].length > maxDisplayFreqs) {
        console.log(
          `Downsampling frequency: ${displayData[0].length} → ${maxDisplayFreqs}`,
        );
        const freqStep = Math.floor(displayData[0].length / maxDisplayFreqs);
        displayData = displayData.map((frame) =>
          frame.filter((_, index) => index % freqStep === 0),
        );
      }

      // Convert to dB scale (like Spek)
      const dbData = displayData.map((frame) =>
        frame.map((magnitude) => {
          const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -120;
          return Math.max(-120, db); // Clip at -120 dB noise floor
        }),
      );

      // Normalize to 0-1 range for color mapping
      const minDb = -120;
      const maxDb = 0;
      const normalizedData = dbData.map((frame) =>
        frame.map((db) => (db - minDb) / (maxDb - minDb)),
      );

      // Compute drawing params (only for plot area)
      const timeBins = normalizedData.length;
      const freqBins = normalizedData[0].length;
      const binWidth = plotWidth / timeBins;
      const binHeight = plotHeight / freqBins;

      console.log("Rendering params:", {
        timeBins,
        freqBins,
        binWidth,
        binHeight,
      });

      // Create ImageData buffer for plot area only
      const imageData = ctx.createImageData(plotWidth, plotHeight);
      const data = imageData.data;

      // ✅ FIXED: Spek-accurate color scheme (dark → bright)
      const spekColorMap = (normalizedMagnitude) => {
        const t = Math.max(0, Math.min(1, normalizedMagnitude));

        let r, g, b;

        if (t < 0.1) {
          // Very dark blue to dark blue (silence to very quiet)
          const local = t / 0.1;
          r = Math.floor(local * 20);
          g = 0;
          b = 20 + Math.floor(local * 60); // 20 to 80
        } else if (t < 0.3) {
          // Dark blue to bright blue
          const local = (t - 0.1) / 0.2;
          r = 20 + Math.floor(local * 30); // 20 to 50
          g = Math.floor(local * 50); // 0 to 50
          b = 80 + Math.floor(local * 175); // 80 to 255
        } else if (t < 0.5) {
          // Blue to purple/magenta
          const local = (t - 0.3) / 0.2;
          r = 50 + Math.floor(local * 150); // 50 to 200
          g = 50 - Math.floor(local * 50); // 50 to 0
          b = 255;
        } else if (t < 0.7) {
          // Purple to red
          const local = (t - 0.5) / 0.2;
          r = 200 + Math.floor(local * 55); // 200 to 255
          g = Math.floor(local * 100); // 0 to 100
          b = 255 - Math.floor(local * 100); // 255 to 155
        } else if (t < 0.9) {
          // Red to orange/yellow
          const local = (t - 0.7) / 0.2;
          r = 255;
          g = 100 + Math.floor(local * 155); // 100 to 255
          b = Math.max(0, 155 - Math.floor(local * 155)); // 155 to 0
        } else {
          // Orange/yellow to white (loudest)
          const local = (t - 0.9) / 0.1;
          r = 255;
          g = 255;
          b = Math.floor(local * 255); // 0 to 255
        }

        return { r, g, b };
      };

      // Fill pixels for spectogram data
      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          const color = spekColorMap(magnitude);
          const xStart = Math.floor(timeIndex * binWidth);
          const yStart = Math.floor(plotHeight - (freqIndex + 1) * binHeight);

          // Fill bin rectangle
          for (
            let y = Math.max(0, yStart);
            y < Math.min(plotHeight, yStart + Math.ceil(binHeight));
            y++
          ) {
            for (
              let x = Math.max(0, xStart);
              x < Math.min(plotWidth, xStart + Math.ceil(binWidth));
              x++
            ) {
              const index = (y * plotWidth + x) * 4;
              data[index] = color.r;
              data[index + 1] = color.g;
              data[index + 2] = color.b;
              data[index + 3] = 255;
            }
          }
        });
      });

      // Draw the spectogram in the plot area
      ctx.putImageData(imageData, leftMargin, topMargin);

      // ✅ ADD PROFESSIONAL LABELS LIKE SPEK

      // **FREQUENCY LABELS (LEFT SIDE - PRIMARY FOCUS)**
      ctx.fillStyle = "#cccccc";
      ctx.font = "11px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      // Calculate sample rate from audio data (assume 44.1kHz for now, ideally get from audioBuffer)
      const sampleRate = 44100; // This should ideally come from your audio buffer
      const nyquistFreq = sampleRate / 2; // 22050 Hz

      // Frequency labels - using logarithmic spacing like Spek
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
          // Linear frequency mapping (you could make this logarithmic like Spek)
          const y = topMargin + plotHeight - (freq / nyquistFreq) * plotHeight;
          ctx.fillText(label, leftMargin - 5, y);

          // Draw grid line
          ctx.strokeStyle = "#333333";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(leftMargin, y);
          ctx.lineTo(leftMargin + plotWidth, y);
          ctx.stroke();
        }
      });

      // **dB LABELS (RIGHT SIDE)**
      ctx.textAlign = "left";
      const dbLabels = [0, -20, -40, -60, -80, -100, -120];

      dbLabels.forEach((db) => {
        const y =
          topMargin +
          plotHeight -
          ((db - minDb) / (maxDb - minDb)) * plotHeight;
        ctx.fillText(`${db}`, leftMargin + plotWidth + 5, y);
      });

      // **TIME LABELS (BOTTOM)**
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // Estimate duration (4:16 = 256 seconds, but should come from actual audio)
      const estimatedDuration = 256; // This should come from your audio metadata
      const timeLabels = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

      timeLabels.forEach((minutes) => {
        if (minutes * 60 <= estimatedDuration) {
          const x =
            leftMargin + ((minutes * 60) / estimatedDuration) * plotWidth;
          const label =
            minutes === Math.floor(minutes)
              ? `${Math.floor(minutes)}:00`
              : `${Math.floor(minutes)}:30`;
          ctx.fillText(label, x, topMargin + plotHeight + 5);
        }
      });

      // **AXIS LABELS**
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px Arial";

      // "Hz" label (left)
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(15, topMargin + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Hz", 0, 0);
      ctx.restore();

      // "dB" label (right)
      ctx.save();
      ctx.translate(canvas.width - 15, topMargin + plotHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText("dB", 0, 0);
      ctx.restore();

      console.log("✅ Spectrum rendering completed with labels");
    };

    if (fileUploaded) {
      drawSpectogram(fileUploaded).catch((error) => {
        console.error("❌ Error rendering spectrum:", error);

        // Show error on canvas
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ff0000";
          ctx.font = "16px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            "Error rendering spectrum",
            canvas.width / 2,
            canvas.height / 2,
          );
        }
      });
    } else {
      // Show placeholder
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 10, canvas.width - 100, canvas.height - 40);
        ctx.fillStyle = "#cccccc";
        ctx.font = "1rem Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "Upload an audio file to see the spectrum",
          canvas.width / 2,
          canvas.height / 2,
        );
      }
    }
  }, [fileUploaded]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={450}
      style={{
        border: "1px solid #333",
        backgroundColor: "#000",
        borderRadius: "4px",
      }}
    />
  );
};

export default SpectrumCanvas;
