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
      const maxMagnitude = Math.max(...spectogramData.flat());
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

      // Draw the Spectogram
      console.time("Canvas drawing");
      const magnitudeToColor = (magnitude) => {
        const heat = Math.floor(magnitude * 255);
        return `rgb(${heat}, ${Math.floor(heat * 0.8)}, ${64})`;
      };

      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          const y = canvas.height - freqIndex * binHeight;
          ctx.fillStyle = magnitudeToColor(magnitude);
          ctx.fillRect(timeIndex * binWidth, y, binWidth + 1, binHeight + 1);
        });
      });
      console.timeEnd("Canvas drawing");
    };

    if (fileUploaded) {
      console.log("Starting spectogram rendering");
      console.time("Total render time");
      drawSpectogram(fileUploaded)
        .catch(console.error)
        .finally(() => console.timeEnd("Total render time"));
    } else {
      // Clear canvas logic
      console.log("Resetting canvas");
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#cccccc";
      ctx.font = "1rem Courier New";
      ctx.textAlign = "center";
      ctx.fillText(
        "Upload an audio file to see the spectrum",
        canvas.width / 2,
        canvas.height / 2,
      );
    }
  }, [fileUploaded]);

  return (
    <canvas
      ref={canvasRef}
      width="800"
      height="400"
      className="spectrum-canvas"
    ></canvas>
  );
};

export default SpectrumCanvas;
