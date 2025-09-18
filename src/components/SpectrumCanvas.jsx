import React, { useRef, useEffect } from "react";
import { computeSpectogram } from "../utils/audioProcessor";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const drawSpectogram = async (file) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      console.log("=== STARTING SPECTRUM RENDERING ===");

      // Compute spectrogram data
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

      // ✅ FIXED: Convert to dB scale (like Spek)
      const dbData = displayData.map((frame) =>
        frame.map((magnitude) => {
          // Convert linear magnitude to dB, with noise floor
          const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -120;
          return Math.max(-120, db); // Clip at -120 dB noise floor
        }),
      );

      // ✅ FIXED: Normalize to dB range (like Spek: -120 dB to 0 dB)
      const minDb = -120;
      const maxDb = 0;
      const normalizedData = dbData.map(
        (frame) => frame.map((db) => (db - minDb) / (maxDb - minDb)), // Normalize to 0-1 range
      );

      // Compute drawing params
      const timeBins = normalizedData.length;
      const freqBins = normalizedData[0].length;
      const binWidth = canvas.width / timeBins;
      const binHeight = canvas.height / freqBins;

      console.log("Rendering params:", {
        timeBins,
        freqBins,
        binWidth,
        binHeight,
      });

      // Create ImageData buffer
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      // ✅ FIXED: Spek-style color mapping (black → blue → purple → red → yellow → white)
      const magnitudeToColor = (normalizedMagnitude) => {
        // Clamp to 0-1 range
        const t = Math.max(0, Math.min(1, normalizedMagnitude));

        let r, g, b;

        if (t < 0.2) {
          // Black to dark blue (0.0 - 0.2)
          const local = t / 0.2;
          r = 0;
          g = 0;
          b = Math.floor(local * 128); // 0 to 128
        } else if (t < 0.4) {
          // Dark blue to purple (0.2 - 0.4)
          const local = (t - 0.2) / 0.2;
          r = Math.floor(local * 128); // 0 to 128
          g = 0;
          b = 128 + Math.floor(local * 127); // 128 to 255
        } else if (t < 0.6) {
          // Purple to red (0.4 - 0.6)
          const local = (t - 0.4) / 0.2;
          r = 128 + Math.floor(local * 127); // 128 to 255
          g = Math.floor(local * 128); // 0 to 128
          b = 255 - Math.floor(local * 128); // 255 to 127
        } else if (t < 0.8) {
          // Red to orange/yellow (0.6 - 0.8)
          const local = (t - 0.6) / 0.2;
          r = 255;
          g = 128 + Math.floor(local * 127); // 128 to 255
          b = Math.max(0, 127 - Math.floor(local * 127)); // 127 to 0
        } else {
          // Orange to white (0.8 - 1.0)
          const local = (t - 0.8) / 0.2;
          r = 255;
          g = 255;
          b = Math.floor(local * 255); // 0 to 255
        }

        return { r, g, b };
      };

      // Fill pixels efficiently
      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          const color = magnitudeToColor(magnitude);
          const xStart = Math.floor(timeIndex * binWidth);
          const yStart = Math.floor(
            canvas.height - (freqIndex + 1) * binHeight,
          );

          // Fill bin rectangle
          for (
            let y = Math.max(0, yStart);
            y < Math.min(canvas.height, yStart + Math.ceil(binHeight));
            y++
          ) {
            for (
              let x = Math.max(0, xStart);
              x < Math.min(canvas.width, xStart + Math.ceil(binWidth));
              x++
            ) {
              const index = (y * canvas.width + x) * 4;
              data[index] = color.r;
              data[index + 1] = color.g;
              data[index + 2] = color.b;
              data[index + 3] = 255;
            }
          }
        });
      });

      // Draw the complete ImageData
      ctx.putImageData(imageData, 0, 0);
      console.log("✅ Spectrum rendering completed");
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
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
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
      width={800}
      height={400}
      style={{ border: "1px solid #ccc" }}
    />
  );
};

export default SpectrumCanvas;
