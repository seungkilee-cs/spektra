import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import { processAudioWithRustFFT } from "../utils/wasmAudioProcessor";
import { ensureAudioContext } from "../utils/audioContextManager";
import { GpuSpectrogramRenderer } from "../utils/gpuSpectrogramRenderer";
import { debugLog, debugError } from "../utils/debug";
import AudioControls from "./AudioControls";
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

/** FFT sizes available in the UI selector (FEAT-003) */
const FFT_SIZE_OPTIONS = [256, 512, 1024, 2048, 4096];

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
  const webglCanvasRef = useRef(null);   // FEAT-004: offscreen canvas for WebGL
  const containerRef = useRef(null);
  const spectrogramDataRef = useRef(null);
  const audioMetadataRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);   // FEAT-001: decoded AudioBuffer for playback
  const gpuRendererRef = useRef(null);   // FEAT-004: GpuSpectrogramRenderer instance

  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 450 });
  const [isProcessed, setIsProcessed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // ENH-001: surface processing errors to the user instead of silently blanking
  const [processingError, setProcessingError] = useState(null);

  // FEAT-003: FFT size selector
  const [fftSize, setFftSize] = useState(1024);

  // FEAT-004: renderer toggle — "canvas2d" | "webgl"
  const [renderer, setRenderer] = useState("canvas2d");
  const [webglAvailable, setWebglAvailable] = useState(true);

  // FEAT-001: playhead state
  const [playheadTime, setPlayheadTime] = useState(null);

  // FEAT-005: zoom/pan view state { t0, t1 } fraction of [0,1] over time axis
  const viewRef = useRef({ t0: 0, t1: 1 });
  const [viewVersion, setViewVersion] = useState(0); // bump to trigger re-render
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, t0: 0, t1: 1 });

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
        // processAudioWithRustFFT returns { spectrogram, duration, sampleRate, audioBuffer }
        // so we don't need to decode the audio a second time just for metadata
        const { spectrogram: spectrogramData, duration, sampleRate, audioBuffer } = await processAudioWithRustFFT(
          file,
          fftSize,   // FEAT-003: use selected FFT size
          0.5,
          audioContext,
        );
        // FEAT-001: store decoded buffer for playback
        audioBufferRef.current = audioBuffer ?? null;
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
        viewRef.current = { t0: 0, t1: 1 };   // FEAT-005: reset zoom on new file
        setPlayheadTime(null);                  // FEAT-001: reset playhead
        setViewVersion(0);
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
    [getOrCreateAudioContext, isProcessing, fftSize],
  );

  // File processing trigger
  useEffect(() => {
    if (fileUploaded && !isProcessing && !isProcessed) {
      processAudioFile(fileUploaded);
    }
  }, [fileUploaded, isProcessing, isProcessed, processAudioFile]);

  // FEAT-003: re-process when FFT size changes (only if a file is already loaded)
  useEffect(() => {
    if (fileUploaded && isProcessed) {
      setIsProcessed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fftSize]);

  // FEAT-004: detect WebGL availability once on mount
  useEffect(() => {
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      setWebglAvailable(!!gl);
    } catch (_) {
      setWebglAvailable(false);
    }
  }, []);

  // FEAT-005: wheel handler for zoom
  const handleWheel = useCallback((e) => {
    if (!isProcessed) return;
    e.preventDefault();
    const { t0, t1 } = viewRef.current;
    const span = t1 - t0;
    const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
    const newSpan = Math.min(1, Math.max(0.02, span * zoomFactor));
    // Zoom toward the cursor position on the time axis
    const rect = canvasRef.current?.getBoundingClientRect();
    const ratio = rect ? (e.clientX - rect.left) / rect.width : 0.5;
    const center = t0 + ratio * span;
    const newT0 = Math.max(0, center - ratio * newSpan);
    const newT1 = Math.min(1, newT0 + newSpan);
    viewRef.current = { t0: newT0, t1: newT1 };
    setViewVersion((v) => v + 1);
  }, [isProcessed]);

  // Attach wheel listener with { passive: false } so preventDefault works
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // FEAT-005: pan handlers
  const handlePointerDown = useCallback((e) => {
    if (!isProcessed) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, ...viewRef.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isProcessed]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { t0, t1 } = panStartRef.current;
    const span = t1 - t0;
    const dx = (e.clientX - panStartRef.current.x) / canvas.getBoundingClientRect().width;
    const shift = -dx * span;
    const newT0 = Math.max(0, Math.min(1 - span, t0 + shift));
    viewRef.current = { t0: newT0, t1: newT0 + span };
    setViewVersion((v) => v + 1);
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // FEAT-002: export spectrogram canvas as PNG
  const handleExportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = fileUploaded?.name?.replace(/\.[^.]+$/, "") || "spectrogram";
      a.download = `${name}-spectrogram.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [fileUploaded]);

  // FEAT-001: double-click on canvas to reset zoom
  const handleDoubleClick = useCallback(() => {
    viewRef.current = { t0: 0, t1: 1 };
    setViewVersion((v) => v + 1);
  }, []);

  const renderSpectrogramFromData = useCallback(
    (normalizedData, { progressive = true } = {}) => {
      if (!normalizedData || !normalizedData.length) return;

      // FEAT-004: WebGL renderer path
      if (renderer === "webgl") {
        const glCanvas = webglCanvasRef.current;
        if (!glCanvas) return;
        try {
          if (!gpuRendererRef.current) {
            gpuRendererRef.current = new GpuSpectrogramRenderer(glCanvas);
          }
          // FEAT-005: slice data to current view window
          const { t0, t1 } = viewRef.current;
          const totalFrames = normalizedData.length;
          const startFrame = Math.floor(t0 * totalFrames);
          const endFrame = Math.ceil(t1 * totalFrames);
          const viewData = normalizedData.slice(startFrame, endFrame);
          gpuRendererRef.current.render(viewData, canvasSize.width, canvasSize.height);
        } catch (err) {
          debugError("WebGL render failed, falling back to Canvas 2D:", err);
          setRenderer("canvas2d");
          setWebglAvailable(false);
        }
        return;
      }

      // Canvas 2D path
      const canvas = canvasRef.current;
      if (!canvas) return;

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

      // FEAT-005: slice to current view window
      const { t0, t1 } = viewRef.current;
      const totalFrames = normalizedData.length;
      const startFrame = Math.floor(t0 * totalFrames);
      const endFrame = Math.ceil(t1 * totalFrames);
      const viewData = normalizedData.slice(startFrame, endFrame);

      const timeBins = viewData.length;
      const freqBins = viewData[0]?.length ?? 0;
      if (!timeBins || !freqBins) return;

      const binWidth = plotWidth / timeBins;
      const binHeight = plotHeight / freqBins;

      const chunkSize = progressiveDraw
        ? Math.max(32, Math.floor(timeBins / 40))
        : timeBins;

      const drawChunk = (startIndex) => {
        const endIndex = Math.min(startIndex + chunkSize, timeBins);

        for (let timeIndex = startIndex; timeIndex < endIndex; timeIndex += 1) {
          const frame = viewData[timeIndex];
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
          pendingRenderRef.current.idle = scheduleIdleCallback(() => {
            pendingRenderRef.current.frame = requestAnimationFrame(() => {
              drawChunk(endIndex);
            });
          }, { timeout: 32 });
        } else {
          // ── Axes & labels ──────────────────────────────────────────────
          const fontSize = Math.max(10, Math.min(12, canvasSize.width / 80));
          ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
          ctx.fillStyle = "#94a3b8";

          const totalDuration = audioMetadataRef.current?.duration || 240;
          const maxFreq = audioMetadataRef.current?.nyquistFreq || 22050;

          // Visible time window in seconds
          const visStart = t0 * totalDuration;
          const visEnd   = t1 * totalDuration;
          const visDuration = visEnd - visStart;

          ctx.textAlign = "center";
          const timeSteps = Math.min(10, Math.floor(plotWidth / 80));
          for (let i = 0; i <= timeSteps; i += 1) {
            const x = leftMargin + (i * plotWidth) / timeSteps;
            const timeValue = visStart + (i * visDuration) / timeSteps;
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
            ctx.fillText(`${dbValue}dB`, leftMargin + plotWidth + 10, y + fontSize / 2);

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

          // FEAT-001: draw playhead line
          if (playheadTime !== null && totalDuration > 0) {
            const phFraction = (playheadTime / totalDuration - t0) / (t1 - t0);
            if (phFraction >= 0 && phFraction <= 1) {
              const phX = leftMargin + phFraction * plotWidth;
              ctx.save();
              ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(phX, topMargin);
              ctx.lineTo(phX, canvas.height - bottomMargin);
              ctx.stroke();
              ctx.restore();
            }
          }

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
    [audioMetadataRef, cancelPendingRender, canvasSize, renderer, playheadTime],
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

  // FEAT-005: re-render on zoom/pan view change
  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed) {
      renderSpectrogramFromData(spectrogramDataRef.current, { progressive: false });
    }
  // viewVersion is the trigger; renderSpectrogramFromData is stable enough
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewVersion]);

  // FEAT-001: re-render on playhead update (non-progressive to avoid chunking flicker)
  useEffect(() => {
    if (spectrogramDataRef.current && isProcessed) {
      renderSpectrogramFromData(spectrogramDataRef.current, { progressive: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadTime]);

  // Reset cached data when file changes
  useEffect(() => {
    if (!fileUploaded) {
      cancelPendingRender();
      spectrogramDataRef.current = null;
      audioMetadataRef.current = null;
      audioBufferRef.current = null;     // FEAT-001
      gpuRendererRef.current = null;     // FEAT-004
      setIsProcessed(false);
      setIsProcessing(false);
      setProcessingError(null);
      setPlayheadTime(null);             // FEAT-001
      viewRef.current = { t0: 0, t1: 1 }; // FEAT-005
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

  const isZoomed = viewRef.current.t0 > 0.001 || viewRef.current.t1 < 0.999;

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

      {/* ENH-001: user-visible error panel */}
      {processingError && !isProcessing && (
        <div className="spectrum-error-panel" role="alert" aria-live="assertive">
          <span className="spectrum-error-panel__icon">⚠️</span>
          <span className="spectrum-error-panel__message">{processingError}</span>
        </div>
      )}

      {/* ── Toolbar (shown when spectrogram is ready) ─────────────────── */}
      {isProcessed && (
        <div className="spectrum-toolbar">
          {/* FEAT-003: FFT size selector */}
          <label className="spectrum-toolbar__label" htmlFor="fft-size-select">
            FFT
          </label>
          <select
            id="fft-size-select"
            className="spectrum-toolbar__select"
            value={fftSize}
            onChange={(e) => setFftSize(Number(e.target.value))}
            disabled={isProcessing}
            title="FFT window size — larger = better frequency resolution, smaller = better time resolution"
          >
            {FFT_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* FEAT-004: renderer toggle */}
          <label className="spectrum-toolbar__label" htmlFor="renderer-select">
            Renderer
          </label>
          <select
            id="renderer-select"
            className="spectrum-toolbar__select"
            value={renderer}
            onChange={(e) => setRenderer(e.target.value)}
            title="Canvas 2D (CPU) or WebGL2 (GPU)"
          >
            <option value="canvas2d">Canvas 2D</option>
            <option value="webgl" disabled={!webglAvailable}>
              WebGL2{!webglAvailable ? " (unavailable)" : ""}
            </option>
          </select>

          {/* FEAT-005: zoom reset */}
          {isZoomed && (
            <button
              className="spectrum-toolbar__btn"
              onClick={handleDoubleClick}
              title="Reset zoom to full view"
            >
              ⟲ Reset zoom
            </button>
          )}

          <span className="spectrum-toolbar__spacer" />

          {/* FEAT-002: export PNG */}
          <button
            className="spectrum-toolbar__btn"
            onClick={handleExportPng}
            title="Save spectrogram as PNG"
          >
            ⬇ Export PNG
          </button>
        </div>
      )}

      <p id={canvasDescriptionId} className="sr-only">
        {audioMetadataRef.current
          ? `Spectrogram visualization. Duration ${audioMetadataRef.current.duration.toFixed(1)} seconds at ${audioMetadataRef.current.sampleRate} hertz.`
          : "Spectrogram visualization of uploaded audio."}
      </p>

      {/* Canvas 2D — shown when renderer is canvas2d */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`spectrum-canvas${renderer === "webgl" ? " spectrum-canvas--hidden" : ""}`}
        role="img"
        aria-label="Audio spectrogram visualization"
        aria-describedby={canvasDescriptionId}
        style={{ cursor: isProcessed ? (isPanningRef.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* WebGL canvas — shown when renderer is webgl */}
      <canvas
        ref={webglCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`spectrum-canvas${renderer === "canvas2d" ? " spectrum-canvas--hidden" : ""}`}
        role="img"
        aria-label="Audio spectrogram visualization (WebGL)"
        aria-describedby={canvasDescriptionId}
        style={{ cursor: isProcessed ? (isPanningRef.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* FEAT-001: audio playback controls */}
      {isProcessed && audioBufferRef.current && (
        <AudioControls
          audioBuffer={audioBufferRef.current}
          duration={audioMetadataRef.current?.duration ?? 0}
          onTimeUpdate={setPlayheadTime}
          onStop={() => setPlayheadTime(null)}
        />
      )}

      {/* FEAT-005: zoom hint */}
      {isProcessed && (
        <p className="spectrum-zoom-hint">
          Scroll to zoom · Drag to pan · Double-click to reset
        </p>
      )}
    </div>
  );
};

export default SpectrumCanvas;
