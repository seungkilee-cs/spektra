import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import { processAudioWithRustFFT } from "../utils/wasmAudioProcessor";
import { ensureAudioContext } from "../utils/audioContextManager";
import { debugLog, debugError } from "../utils/debug";
import "../styles/SpectrumCanvas.css";

// ---------------------------------------------------------------------------
// ENH-002: spekColorMap hoisted to module scope + 256-entry LUT pre-computed
// once at load time so it is never recreated inside the render loop.
// ---------------------------------------------------------------------------
function spekColorMap(normalizedMagnitude) {
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
}

/**
 * Pre-computed 256-entry lookup table: index 0–255 maps to { r, g, b }.
 * Avoids per-pixel branch evaluation during canvas fill — a ~3–5× speedup
 * on large spectrograms (2000 × 256 = 512 000 pixels per render).
 */
const SPEK_LUT = Array.from({ length: 256 }, (_, i) => spekColorMap(i / 255));

const scheduleIdleCallback =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback.bind(window)
    : (cb) => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 16);

const cancelIdle =
  typeof window !== "undefined" && typeof window.cancelIdleCallback === "function"
    ? window.cancelIdleCallback.bind(window)
    : clearTimeout;

const SpectrumCanvas = ({ fileUploaded }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const spectrogramDataRef = useRef(null);
  const audioMetadataRef = useRef(null);
  const audioContextRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 450 });
  const [isProcessed, setIsProcessed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // ENH-001: surface processing errors to the user instead of silently blanking
  const [processingError, setProcessingError] = useState(null);
  const canvasDescriptionId = useId();
  const pendingRenderRef = useRef({ frame: null, idle: null });
  const hasRenderedInitialRef = useRef(false);

  const getOrCreateAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return null;

    try {
      const ctx = await ensureAudioContext();
      audioContextRef.current = ctx;
      return ctx;
    } catch (resumeError) {
      debugError("Failed to ensure AudioContext", resumeError);
      return null;
    }
  }, []);

  // Debounced resize handler
  const updateCanvasSize = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(container);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const horizontalPadding = paddingLeft + paddingRight;
    const minWidth = 280;
    const maxWidth = 1200;
    const availableWidth = Math.max(rect.width - horizontalPadding, minWidth);
    const width = Math.min(Math.max(availableWidth, minWidth), maxWidth);
    const aspectRatio = width <= 640 ? 0.75 : 0.55;
    const minHeight = 220;
    const maxHeight = 560;
    const height = Math.min(
      Math.max(width * aspectRatio, minHeight),
      maxHeight,
    );

    setCanvasSize((prev) => {
      if (
        Math.abs(prev.width - width) > 10 ||
        Math.abs(prev.height - height) > 10
      ) {
        return { width, height };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateCanvasSize, 300);
    };

    updateCanvasSize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [updateCanvasSize]);

  const cancelPendingRender = useCallback(() => {
    const pending = pendingRenderRef.current;
    if (pending.frame) {
      cancelAnimationFrame(pending.frame);
    }
    if (pending.idle) {
      cancelIdle(pending.idle);
    }
    pendingRenderRef.current = { frame: null, idle: null };
  }, []);

  const processAudioFile = useCallback(
    async (file) => {
      // ENH-003: guard against concurrent processing — log a clear message
      // instead of silently dropping the call so it's visible during debugging.
      if (isProcessing) {
        debugLog("⚠️ processAudioFile called while already processing — ignoring duplicate trigger");
        return;
      }

      try {
        debugLog("=== STARTING WASM SPECTRUM PROCESSING ===");
        setIsProcessing(true);
        setIsProcessed(false);
        setProcessingError(null); // ENH-001: clear any previous error

        const audioContext = await getOrCreateAudioContext();
        if (!audioContext) {
          throw new Error("AudioContext could not be initialised");
        }

        const wasmStart = performance.now();
        // processAudioWithRustFFT returns { spectrogram, duration, sampleRate }
        // so we don't need to decode the audio a second time just for metadata
        const { spectrogram: spectrogramData, duration, sampleRate } = await processAudioWithRustFFT(
          file,
          1024,
          0.5,
          audioContext,
        );
        const wasmTime = performance.now() - wasmStart;

        audioMetadataRef.current = {
          duration,
          sampleRate,
          nyquistFreq: sampleRate / 2,
        };

        debugLog(`🦀 Rust+WASM FFT completed in ${wasmTime.toFixed(2)}ms`);
        if (spectrogramData.length > 0) {
          debugLog(
            `📊 Generated spectrogram: ${spectrogramData.length} x ${spectrogramData[0].length}`,
          );
        }

        // Process and cache the data
        let displayData = spectrogramData.length ? spectrogramData : [];

        // Downsample if needed
        const maxDisplayFrames = 2000;
        const maxDisplayFreqs = 256;

        if (spectrogramData.length > maxDisplayFrames) {
          debugLog(
            `⬇️ Downsampling time: ${spectrogramData.length} → ${maxDisplayFrames}`,
          );
          const timeStep = Math.floor(
            spectrogramData.length / maxDisplayFrames,
          );
          displayData = spectrogramData.filter(
            (_, index) => index % timeStep === 0,
          );
        }

        if (displayData.length && displayData[0].length > maxDisplayFreqs) {
          debugLog(
            `⬇️ Downsampling frequency: ${displayData[0].length} → ${maxDisplayFreqs}`,
          );
          const freqStep = Math.floor(displayData[0].length / maxDisplayFreqs);
          displayData = displayData.map((frame) =>
            frame.filter((_, index) => index % freqStep === 0),
          );
        }

        if (!displayData.length || !displayData[0]?.length) {
          spectrogramDataRef.current = [];
          setIsProcessed(true);
          debugLog("✅ WASM audio processing completed (no FFT frames)");
          return;
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

        spectrogramDataRef.current = normalizedData;
        hasRenderedInitialRef.current = false;
        setIsProcessed(true);
        debugLog("✅ WASM audio processing completed");
      } catch (error) {
        debugError("❌ Error processing audio:", error);
        spectrogramDataRef.current = null;
        setIsProcessed(false);
        // ENH-001: surface the error to the user with a helpful message
        const message = error?.message?.includes("timed out")
          ? "Processing timed out. The file may be too large or the browser is under heavy load."
          : error?.message?.includes("AudioContext")
            ? "Could not initialise audio — try clicking the page first to satisfy autoplay policy."
            : `Processing failed: ${error?.message || "unknown error"}`;
        setProcessingError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [getOrCreateAudioContext, isProcessing],
  );

  // File processing trigger
  useEffect(() => {
    if (fileUploaded && !isProcessing && !isProcessed) {
      processAudioFile(fileUploaded);
    }
  }, [fileUploaded, isProcessing, isProcessed, processAudioFile]);

  const renderSpectrogramFromData = useCallback(
    (normalizedData, { progressive = true } = {}) => {
      const canvas = canvasRef.current;
      if (!canvas || !normalizedData || !normalizedData.length) return;

      cancelPendingRender();
      const progressiveDraw = progressive;

      if (progressiveDraw) {
        debugLog("=== RENDERING SPECTROGRAM (progressive) ===");
      }
      const ctx = canvas.getContext("2d");

      const leftMargin = 70;
      const rightMargin = 60;
      const bottomMargin = 50;
      const topMargin = 30;
      const plotWidth = canvas.width - leftMargin - rightMargin;
      const plotHeight = canvas.height - topMargin - bottomMargin;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const timeBins = normalizedData.length;
      const freqBins = normalizedData[0].length;
      const binWidth = plotWidth / timeBins;
      const binHeight = plotHeight / freqBins;

      const chunkSize = progressiveDraw
        ? Math.max(32, Math.floor(timeBins / 40))
        : timeBins;

      const drawChunk = (startIndex) => {
        const endIndex = Math.min(startIndex + chunkSize, timeBins);

        for (let timeIndex = startIndex; timeIndex < endIndex; timeIndex += 1) {
          const frame = normalizedData[timeIndex];
          for (let freqIndex = 0; freqIndex < freqBins; freqIndex += 1) {
            const magnitude = frame[freqIndex];
            // ENH-002: use pre-computed LUT — O(1) index lookup, no branch evaluation per pixel
            const color = SPEK_LUT[Math.round(magnitude * 255)];
            const x = leftMargin + timeIndex * binWidth;
            const y = topMargin + (freqBins - freqIndex - 1) * binHeight;

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x, y, Math.ceil(binWidth), Math.ceil(binHeight));
          }
        }

        if (progressiveDraw && endIndex < timeBins) {
          const scheduleNext = () => {
            pendingRenderRef.current.frame = requestAnimationFrame(() => {
              drawChunk(endIndex);
            });
          };

          pendingRenderRef.current.idle = scheduleIdleCallback(() => {
            scheduleNext();
          }, { timeout: 32 });
        } else {
          const fontSize = Math.max(10, Math.min(12, canvasSize.width / 80));
          ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
          ctx.fillStyle = "#94a3b8";

          const duration = audioMetadataRef.current?.duration || 240;
          const maxFreq = audioMetadataRef.current?.nyquistFreq || 22050;

          ctx.textAlign = "center";
          const timeSteps = Math.min(10, Math.floor(plotWidth / 80));
          for (let i = 0; i <= timeSteps; i += 1) {
            const x = leftMargin + (i * plotWidth) / timeSteps;
            const timeValue = (i * duration) / timeSteps;
            const minutes = Math.floor(timeValue / 60);
            const seconds = Math.floor(timeValue % 60);
            const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

            ctx.fillText(timeLabel, x, canvas.height - bottomMargin / 2);

            if (i > 0 && i < timeSteps) {
              ctx.strokeStyle = "rgba(71, 85, 105, 0.2)";
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.moveTo(x, topMargin);
              ctx.lineTo(x, canvas.height - bottomMargin);
              ctx.stroke();
            }
          }

          ctx.textAlign = "right";
          const freqSteps = Math.min(8, Math.floor(plotHeight / 40));
          for (let i = 0; i <= freqSteps; i += 1) {
            const y = canvas.height - bottomMargin - (i * plotHeight) / freqSteps;
            const freqValue = (i * maxFreq) / freqSteps;
            const freqLabel =
              freqValue >= 1000
                ? `${(freqValue / 1000).toFixed(1)}k`
                : `${Math.floor(freqValue)}`;

            ctx.fillText(freqLabel, leftMargin - 10, y + fontSize / 2);

            if (i > 0 && i < freqSteps) {
              ctx.strokeStyle = "rgba(71, 85, 105, 0.2)";
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.moveTo(leftMargin, y);
              ctx.lineTo(leftMargin + plotWidth, y);
              ctx.stroke();
            }
          }

          ctx.textAlign = "left";
          const dbSteps = 6;
          const dbRange = 120;
          for (let i = 0; i <= dbSteps; i += 1) {
            const y = topMargin + (i * plotHeight) / dbSteps;
            const dbValue = -(dbRange * (dbSteps - i)) / dbSteps;
            const dbLabel = `${dbValue}dB`;

            ctx.fillText(dbLabel, leftMargin + plotWidth + 10, y + fontSize / 2);

            if (i > 0 && i < dbSteps) {
              ctx.strokeStyle = "rgba(71, 85, 105, 0.1)";
              ctx.lineWidth = 1;
              ctx.setLineDash([1, 3]);
              ctx.beginPath();
              ctx.moveTo(leftMargin, y);
              ctx.lineTo(leftMargin + plotWidth, y);
              ctx.stroke();
            }
          }

          ctx.setLineDash([]);
          ctx.textAlign = "center";
          ctx.fillStyle = "#e2e8f0";
          ctx.font = `${fontSize + 1}px 'JetBrains Mono', monospace`;
          ctx.fillText("Time", canvas.width / 2, canvas.height - 8);

          ctx.save();
          ctx.translate(20, canvas.height / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText("Frequency (Hz)", 0, 0);
          ctx.restore();

          ctx.save();
          ctx.translate(canvas.width - 20, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.fillText("Amplitude (dB)", 0, 0);
          ctx.restore();

          debugLog(
            progressiveDraw
              ? "✅ Spectrogram rendering completed (progressive)"
              : "✅ Spectrogram rendering completed",
          );
        }
      };

      if (progressiveDraw) {
        pendingRenderRef.current.frame = requestAnimationFrame(() => drawChunk(0));
      } else {
        drawChunk(0);
      }
    },
    [audioMetadataRef, cancelPendingRender, canvasSize],
  );

  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed && !hasRenderedInitialRef.current) {
      renderSpectrogramFromData(spectrogramDataRef.current, { progressive: true });
      hasRenderedInitialRef.current = true;
    }
  }, [isProcessed, renderSpectrogramFromData]);

  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed && hasRenderedInitialRef.current) {
      renderSpectrogramFromData(spectrogramDataRef.current, { progressive: false });
    }
  }, [canvasSize, isProcessed, renderSpectrogramFromData]);

  // Reset cached data when file changes
  useEffect(() => {
    if (!fileUploaded) {
      cancelPendingRender();
      spectrogramDataRef.current = null;
      audioMetadataRef.current = null;
      setIsProcessed(false);
      setIsProcessing(false);
      setProcessingError(null); // ENH-001: clear error when user picks a new file
      hasRenderedInitialRef.current = false;
    }
  }, [cancelPendingRender, fileUploaded]);

  useEffect(() => {
    return () => {
      cancelPendingRender();
      audioContextRef.current = null;
    };
  }, [cancelPendingRender]);

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
      ctx.strokeRect(70, 30, canvas.width - 130, canvas.height - 80);
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
    <div
      className="spectrum-canvas-container"
      ref={containerRef}
      aria-busy={isProcessing}
    >
      {/* Processing indicator */}
      {isProcessing && (
        <div className="processing-indicator" role="status" aria-live="polite">
          🦀 Processing with Rust+WASM...
        </div>
      )}

      {/* ENH-001: user-visible error panel shown when processing fails */}
      {processingError && !isProcessing && (
        <div className="spectrum-error-panel" role="alert" aria-live="assertive">
          <span className="spectrum-error-panel__icon">⚠️</span>
          <span className="spectrum-error-panel__message">{processingError}</span>
        </div>
      )}

      <p id={canvasDescriptionId} className="sr-only">
        {audioMetadataRef.current
          ? `Spectrogram visualization. Duration ${audioMetadataRef.current.duration.toFixed(1)} seconds at ${audioMetadataRef.current.sampleRate} hertz.`
          : "Spectrogram visualization of uploaded audio."}
      </p>

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="spectrum-canvas"
        role="img"
        aria-label="Audio spectrogram visualization"
        aria-describedby={canvasDescriptionId}
      />
    </div>
  );
};

export default SpectrumCanvas;
