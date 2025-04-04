import React, { useRef, useEffect } from "react";
import { fft, ifft, Complex } from "../utils/fastFourierTransform";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a blank canvas with a border when a file is uploaded
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    if (fileUploaded) {
      // Add text to indicate spectrum will be shown here
      ctx.fillStyle = "#cccccc";
      ctx.font = "1rem Courier New";
      ctx.textAlign = "center";
      ctx.fillText(
        "Spectrum will be displayed here",
        canvas.width / 2,
        canvas.height / 2,
      );
    } else {
      // Draw a message when no file is uploaded
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
