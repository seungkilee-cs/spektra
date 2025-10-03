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

  const rows = [
    [
      { label: "File Name", value: file.name },
      { label: "File Size", value: formatFileSize(file.size) },
      { label: "Bitrate", value: metadata.bitrate },
      {
        label: "Sample Rate",
        value:
          metadata.sampleRate && metadata.sampleRate !== "Unknown"
            ? `${metadata.sampleRate} Hz`
            : "Unknown",
      },
    ],
    [
      { label: "Bits Per Sample", value: metadata.bitsPerSample || "Unknown" },
      { label: "Channels", value: metadata.channels || "Unknown" },
      { label: "Codec", value: metadata.codec || "Unknown" },
      { label: "Codec Profile", value: metadata.codecProfile || "Unknown" },
      { label: "Container", value: metadata.container || "Unknown" },
    ],
    [
      { label: "Lossless", value: metadata.lossless || "Unknown" },
      { label: "Duration", value: metadata.duration },
    ],
  ];

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
        {rows.map((cells, rowIndex) => (
          <div key={rowIndex} className="metadata-row">
            {cells.map(({ label, value }) => (
              <div key={label} className="metadata-item">
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default AudioMetadataHeader;
