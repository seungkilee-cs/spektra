import React, { useRef, useEffect } from "react";
// import { fft, ifft, Complex } from "../utils/fastFourierTransform";
import { computeSpectogram } from "../utils/audioProcessor";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const drawSpectogram = async (file) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Clear and prepare the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Compute the spectogram
      const spectogramData = await computeSpectogram(file);

      // Normalize the magnitudes for visualization
      const maxMagnitude = Math.max(...spectogramData.flat());
      const normalizedData = spectogramData.map((frame) =>
        frame.map((magnitude) => magnitude / maxMagnitude),
      );

      // Visualize the Params
      const timeBins = normalizedData.length;
      const freqBins = normalizedData[0].length;
      const binWidth = canvas.width / timeBins;
      const binHeight = canvas.height / freqBins;

      // Draw the Spectogram
      normalizedData.forEach((frame, timeIndex) => {
        frame.forEach((magnitude, freqIndex) => {
          // Map the magnitude to greyscale (0-255)
          // const intensity = Math.floor(magnitude * 255);
          // flip frequency axis so the low freqs are at the bottom
          // Util for Coloring
          const magnitudeToColor = (magnitude) => {
            const heat = Math.floor(magnitude * 255);
            return `rgb(${heat}, ${Math.floor(heat * 0.8)}, ${64})`;
          };
          const y = canvas.height - freqIndex * binHeight;

          ctx.fillStyle = magnitudeToColor(magnitude);
          ctx.fillRect(timeIndex * binWidth, y, binWidth + 1, binHeight + 1);
        });
      });
    };

    if (fileUploaded) {
      drawSpectogram(fileUploaded).catch(console.error);
    } else {
      // Draw a message when no file is uploaded
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
