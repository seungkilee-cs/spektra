/**
 * AudioControls — FEAT-001
 *
 * Playback controls for the decoded audio buffer.
 * Uses the existing singleton AudioContext from audioContextManager.
 *
 * Props:
 *   audioBuffer  {AudioBuffer|null}  — decoded audio buffer to play
 *   duration     {number}            — total duration in seconds
 *   onTimeUpdate {(t: number) => void} — called with current playback time each frame
 *   onStop       {() => void}         — called when playback ends or is stopped
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { getCurrentAudioContext } from "../utils/audioContextManager";
import "../styles/AudioControls.css";

const AudioControls = ({ audioBuffer, duration, onTimeUpdate, onStop }) => {
  const [playState, setPlayState] = useState("stopped"); // "stopped" | "playing" | "paused"
  const [currentTime, setCurrentTime] = useState(0);

  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0);   // audioContext.currentTime when play started
  const offsetRef = useRef(0);      // seconds into buffer where playback began
  const rafRef = useRef(null);

  // Cancel the rAF loop
  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // rAF loop — updates playhead position every frame
  const startRaf = useCallback(() => {
    stopRaf();
    const tick = () => {
      const ctx = getCurrentAudioContext();
      if (!ctx) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      const t = Math.min(offsetRef.current + elapsed, duration);
      setCurrentTime(t);
      onTimeUpdate?.(t);
      if (t < duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Playback reached end
        setCurrentTime(duration);
        setPlayState("stopped");
        onTimeUpdate?.(duration);
        onStop?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [duration, onTimeUpdate, onStop, stopRaf]);

  // Tear down current source node
  const disconnectSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (_) { /* already stopped */ }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  }, []);

  const play = useCallback((fromOffset = offsetRef.current) => {
    const ctx = getCurrentAudioContext();
    if (!ctx || !audioBuffer) return;

    disconnectSource();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      // Only act if we weren't already stopped manually
      if (playState === "playing") {
        setPlayState("stopped");
        setCurrentTime(duration);
        onTimeUpdate?.(duration);
        onStop?.();
      }
    };

    offsetRef.current = fromOffset;
    startTimeRef.current = ctx.currentTime;
    source.start(0, fromOffset);
    sourceNodeRef.current = source;

    setPlayState("playing");
    startRaf();
  }, [audioBuffer, disconnectSource, duration, onTimeUpdate, onStop, playState, startRaf]);

  const pause = useCallback(() => {
    const ctx = getCurrentAudioContext();
    if (ctx) {
      const elapsed = ctx.currentTime - startTimeRef.current;
      offsetRef.current = Math.min(offsetRef.current + elapsed, duration);
    }
    disconnectSource();
    stopRaf();
    setPlayState("paused");
  }, [disconnectSource, duration, stopRaf]);

  const stop = useCallback(() => {
    disconnectSource();
    stopRaf();
    offsetRef.current = 0;
    setCurrentTime(0);
    setPlayState("stopped");
    onTimeUpdate?.(0);
    onStop?.();
  }, [disconnectSource, onTimeUpdate, onStop, stopRaf]);

  const handlePlayPause = useCallback(() => {
    if (!audioBuffer) return;
    if (playState === "playing") {
      pause();
    } else {
      play(offsetRef.current);
    }
  }, [audioBuffer, pause, play, playState]);

  // Seek via progress bar
  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * duration;
    offsetRef.current = seekTime;
    setCurrentTime(seekTime);
    onTimeUpdate?.(seekTime);
    if (playState === "playing") {
      play(seekTime);
    }
  }, [duration, onTimeUpdate, play, playState]);

  // Stop and clean up when buffer changes or component unmounts
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  useEffect(() => {
    return () => {
      disconnectSource();
      stopRaf();
    };
  }, [disconnectSource, stopRaf]);

  if (!audioBuffer) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-controls" role="group" aria-label="Audio playback controls">
      {/* Play / Pause */}
      <button
        className="audio-controls__btn"
        onClick={handlePlayPause}
        aria-label={playState === "playing" ? "Pause" : "Play"}
        title={playState === "playing" ? "Pause" : "Play"}
      >
        {playState === "playing" ? "⏸" : "▶"}
      </button>

      {/* Stop */}
      <button
        className="audio-controls__btn"
        onClick={stop}
        aria-label="Stop"
        title="Stop"
        disabled={playState === "stopped"}
      >
        ⏹
      </button>

      {/* Time display */}
      <span className="audio-controls__time" aria-live="off">
        {formatTime(currentTime)}
      </span>

      {/* Progress / seek bar */}
      <div
        className="audio-controls__progress-track"
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={formatTime(currentTime)}
        tabIndex={0}
        onClick={handleSeek}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            const t = Math.min(currentTime + 5, duration);
            offsetRef.current = t;
            setCurrentTime(t);
            onTimeUpdate?.(t);
            if (playState === "playing") play(t);
          } else if (e.key === "ArrowLeft") {
            const t = Math.max(currentTime - 5, 0);
            offsetRef.current = t;
            setCurrentTime(t);
            onTimeUpdate?.(t);
            if (playState === "playing") play(t);
          }
        }}
      >
        <div
          className="audio-controls__progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Total duration */}
      <span className="audio-controls__duration">
        {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioControls;
