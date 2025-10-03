// AudioMetadataHeader.jsx
import React, { useState, useId } from "react";

const AudioMetadataHeader = ({ metadata, file }) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  if (!metadata || !file) return null;

  const formatFileSize = (bytes) => {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const compactFormat = `📊 ${file.name} | ${formatFileSize(file.size)} | ${
    metadata.codec || "Unknown"
  }, ${metadata.bitrate}, ${metadata.sampleRate} Hz, ${metadata.duration}`;

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
    <section
      className={`metadata-panel ${expanded ? "metadata-panel--expanded" : ""}`}
      aria-labelledby={detailsId}
    >
      <button
        type="button"
        className="metadata-header"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <span className="metadata-compact">{compactFormat}</span>
        <span
          className={`metadata-header__chevron ${expanded ? "metadata-header__chevron--open" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      <div
        id={detailsId}
        className="metadata-detailed"
        hidden={!expanded}
        aria-live="polite"
      >
        {Object.entries(detailedInfo).map(([key, value]) => (
          <div key={key} className="metadata-item">
            <strong>{key}:</strong> {value}
          </div>
        ))}
      </div>
    </section>
  );
};

export default AudioMetadataHeader;
