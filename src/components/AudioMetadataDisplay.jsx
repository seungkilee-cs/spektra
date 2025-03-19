import React from "react";
import "../styles/AudioMetadataDisplay.css";

const AudioMetadataDisplay = ({ metadata }) => {
  if (!metadata) return null;

  return (
    <div className="audio-metadata">
      <p>Bitrate: {metadata.bitrate} bps</p>
      <p>Sample Rate: {metadata.sampleRate} Hz</p>
      <p>Bits Per Sample: {metadata.bitsPerSample}</p>
      <p>Codec: {metadata.codec}</p>
      <p>Duration: {metadata.duration.toFixed(2)} seconds</p>
    </div>
  );
};

export default AudioMetadataDisplay;
