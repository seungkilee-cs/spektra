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

      // Normalize data
      const maxMagnitude =
        displayData.reduce((max, frame) => {
          return Math.max(max, ...frame);
        }, 0) || 1;
      const normalizedData = displayData.map((frame) =>
        frame.map((mag) => mag / maxMagnitude),
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

      // ✅ FIXED: Create ONE ImageData buffer for entire canvas
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      // Color helper
      const magnitudeToColor = (magnitude) => {
        const heat = Math.floor(magnitude * 255);
        return { r: heat, g: Math.floor(heat * 0.8), b: 64 };
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
              data[index] = color.r; // Red
              data[index + 1] = color.g; // Green
              data[index + 2] = color.b; // Blue
              data[index + 3] = 255; // Alpha
            }
          }
        });
      });

      // ✅ FIXED: Draw the complete ImageData ONCE
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
          ctx.fillText(error.message, canvas.width / 2, canvas.height / 2 + 25);
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
