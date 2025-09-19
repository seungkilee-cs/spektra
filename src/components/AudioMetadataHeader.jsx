// AudioMetadataHeader.jsx
import React, { useState } from "react";

const AudioMetadataHeader = ({ metadata, file }) => {
  const [expanded, setExpanded] = useState(false);

  if (!metadata || !file) return null;

  const formatFileSize = (bytes) => {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  const compactFormat = `📊 ${file.name} | ${formatFileSize(file.size)} | ${metadata.codec || "Unknown"}, ${metadata.bitrate}, ${metadata.sampleRate} Hz, ${metadata.duration}`;

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
      className="metadata-header"
      onClick={() => setExpanded(!expanded)}
      title="Click to toggle detailed metadata"
    >
      <div className="metadata-compact">{compactFormat}</div>

      {expanded && (
        <div className="metadata-detailed">
          {Object.entries(detailedInfo).map(([key, value]) => (
            <div key={key} className="metadata-item">
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioMetadataHeader;
