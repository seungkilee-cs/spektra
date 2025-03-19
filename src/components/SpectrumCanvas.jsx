import React, { useRef, useEffect } from "react";
import "../styles/SpectrumCanvas.css";

const SpectrumCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // Placeholder: Draw a blank canvas or add spectrum visualization logic here
    ctx.fillStyle = "#242424";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

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
