import React, { useRef, useEffect } from "react";
import { computeSpectogram } from "../utils/audioProcessor";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const drawSpectogram = async (file) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Clear and prepare the canvas
      console.time("Canvas preparation");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      console.timeEnd("Canvas preparation");

      // Compute the spectogram
      console.time("Spectogram computation");
      const spectogramData = await computeSpectogram(file);
      console.timeEnd("Spectogram computation");

      console.log(
        "Spectogram data dimensions:",
        spectogramData.length,
        "x",
        spectogramData[0].length,
      );

      // Normalization
      console.time("Normalization");
      const maxMagnitude = Math.max(...spectogramData.flat()) || 1; // Fallback to avoid division by zero
      console.log("Max magnitude:", maxMagnitude);
      const normalizedData = spectogramData.map((frame) =>
        frame.map((magnitude) => magnitude / maxMagnitude),
      );
      console.timeEnd("Normalization");

      // Visualization parameters
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

      // Draw the Spectogram using ImageData for efficiency
      console.time("Canvas drawing");
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      const magnitudeToColor = (magnitude) => {
        const heat = Math.floor(magnitude * 255);
        return { r: heat, g: Math.floor(heat * 0.8), b: 64 };
      };

      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          const color = magnitudeToColor(magnitude);
          const xStart = Math.floor(timeIndex * binWidth);
          const yStart = Math.floor(
            canvas.height - (freqIndex + 1) * binHeight,
          ); // Flip Y-axis for low freq at bottom

          // Fill the bin rectangle with pixels
          for (let y = yStart; y < yStart + Math.ceil(binHeight); y++) {
            for (let x = xStart; x < xStart + Math.ceil(binWidth); x++) {
              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                const index = (y * canvas.width + x) * 4;
                data[index] = color.r; // Red
                data[index + 1] = color.g; // Green
                data[index + 2] = color.b; // Blue
                data[index + 3] = 255; // Alpha (opaque)
              }
            }
          }
        });
      });

      // Apply the ImageData to the canvas
      ctx.putImageData(imageData, 0, 0);
      console.timeEnd("Canvas drawing");
    };
  }, [fileUploaded]);

  let isMounted = true;

  if (fileUploaded) {
    console.log("=== SPECTRUM RENDERING START ===");
    console.log("FileUploaded prop received:", {
      name: fileUploaded.name,
      type: fileUploaded.type,
      size: fileUploaded.size,
    });
    console.time("Total render time");

    drawSpectogram(fileUploaded)
      .then(() => {
        console.log("✅ Spectrum rendering completed successfully");
      })
      .catch((error) => {
        console.error("❌ Error rendering spectrum:", error);
        console.error("Full error stack:", error.stack);

        // Display detailed error on canvas
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
          // Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw error background
          ctx.fillStyle = "#330000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw error border
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 3;
          ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

          // Main error message
          ctx.fillStyle = "#ff4444";
          ctx.font = "bold 18px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            "❌ Error Loading Spectrum",
            canvas.width / 2,
            canvas.height / 2 - 40,
          );

          // Error details
          ctx.fillStyle = "#ffaaaa";
          ctx.font = "14px Arial";
          const errorMsg =
            error.message.length > 50
              ? error.message.substring(0, 47) + "..."
              : error.message;
          ctx.fillText(errorMsg, canvas.width / 2, canvas.height / 2 - 10);

          // Help text
          ctx.fillStyle = "#cccccc";
          ctx.font = "12px Arial";
          ctx.fillText(
            "Check browser console for details",
            canvas.width / 2,
            canvas.height / 2 + 20,
          );

          // Error type
          ctx.fillStyle = "#888888";
          ctx.font = "11px monospace";
          ctx.fillText(
            `Error Type: ${error.name || "Unknown"}`,
            canvas.width / 2,
            canvas.height / 2 + 40,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          console.timeEnd("Total render time");
          console.log("=== SPECTRUM RENDERING END ===");
        }
      });
  } else {
    // Clear canvas and show placeholder
    console.log("Resetting canvas - no file uploaded");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      // Clear everything
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw border
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.setLineDash([]); // Reset to solid line

      // Main placeholder text
      ctx.fillStyle = "#666666";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        "🎵 Audio Spectrum Analyzer",
        canvas.width / 2,
        canvas.height / 2 - 20,
      );

      // Instructions
      ctx.fillStyle = "#999999";
      ctx.font = "14px Arial";
      ctx.fillText(
        "Upload an audio file to see the spectrum",
        canvas.width / 2,
        canvas.height / 2 + 10,
      );

      // Supported formats
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px Arial";
      ctx.fillText(
        "Supports: MP3, M4A, FLAC",
        canvas.width / 2,
        canvas.height / 2 + 35,
      );
    }
  }

  return () => {
    isMounted = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      className="spectrum-canvas"
    />
  );
};

export default SpectrumCanvas;
