import React, { useState } from "react";

const AudioMetadataHeader = ({ metadata, file }) => {
  const [expanded, setExpanded] = useState(false);

  if (!metadata || !file) return null;

  // Format the compact header like Spek
  const formatFileSize = (bytes) => {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  const compactFormat = `${file.name} | ${formatFileSize(file.size)} | ${metadata.codec || "Unknown"}, ${metadata.bitrate}, ${metadata.sampleRate} Hz, ${metadata.duration}`;

  const detailedInfo = {
    "File Name": file.name,
    "File Size": formatFileSize(file.size),
    Bitrate: metadata.bitrate,
    "Sample Rate": `${metadata.sampleRate} Hz`,
    "Bits Per Sample": metadata.bitsPerSample || "Unknown",
    Codec: metadata.codec || "Unknown",
    Duration: metadata.duration,
    Channels: metadata.channels || "Unknown",
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        color: "#cccccc",
        padding: "8px 12px",
        fontSize: "12px",
        fontFamily: "monospace",
        borderRadius: "4px",
        margin: "10px 0",
        cursor: "pointer",
        userSelect: "none",
        border: "1px solid #333",
        maxWidth: "900px",
      }}
      onClick={() => setExpanded(!expanded)}
      title="Click to toggle detailed metadata"
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        📊 {compactFormat}
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #333",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "8px",
          }}
        >
          {Object.entries(detailedInfo).map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioMetadataHeader;
