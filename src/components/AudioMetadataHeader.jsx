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

  const handlePanelClick = (event) => {
    if (event.target.closest(".metadata-detailed")) {
      return;
    }
    handleToggle();
  };

  const handlePanelKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  };

  const sampleRateLabel =
    metadata.sampleRate && metadata.sampleRate !== "Unknown"
      ? `${metadata.sampleRate} Hz`
      : "Unknown";
  const profileLabel =
    metadata.codecProfile && metadata.codecProfile !== "Unknown"
      ? metadata.codecProfile
      : null;

  const codecBase =
    metadata.codec && metadata.codec !== "Unknown" ? metadata.codec : null;

  const codecDisplay = (() => {
    if (codecBase && profileLabel) {
      const lowerCodec = codecBase.toLowerCase();
      const lowerProfile = profileLabel.toLowerCase();
      if (!lowerCodec.includes(lowerProfile)) {
        return `${codecBase} (${profileLabel})`;
      }
    }
    return codecBase || profileLabel || "Unknown";
  })();

  const containerDisplay = (() => {
    const container = metadata.container;
    if (!container || container === "Unknown") return null;
    if (codecBase && container.toLowerCase() === codecBase.toLowerCase()) {
      return null;
    }
    return container;
  })();

  const losslessDisplay =
    metadata.lossless && metadata.lossless !== "Unknown"
      ? metadata.lossless
      : null;

  const fileExtension = (() => {
    const parts = file.name.split(".");
    if (parts.length < 2) return null;
    return parts.pop();
  })();

  const formatDisplay = (() => {
    if (codecBase) {
      return codecBase;
    }
    if (fileExtension) {
      return fileExtension.toUpperCase();
    }
    return "Unknown";
  })();

  const qualityDisplay = (() => {
    if (losslessDisplay) {
      return losslessDisplay;
    }
    if (metadata.lossless === "No (lossy)") {
      return metadata.lossless;
    }
    if (profileLabel) {
      return `Lossy (${profileLabel})`;
    }
    return metadata.lossless || "Unknown";
  })();

  const summaryMetaItems = [
    formatDisplay,
    metadata.bitrate,
    sampleRateLabel,
    formatFileSize(file.size),
    metadata.duration,
  ];

  const detailItems = [
    { label: "File Name", value: file.name },
    { label: "Format", value: codecDisplay },
    { label: "Duration", value: metadata.duration },
    { label: "File Size", value: formatFileSize(file.size) },
    { label: "Bitrate", value: metadata.bitrate },
    { label: "Sample Rate", value: sampleRateLabel },
    { label: "Bits Per Sample", value: metadata.bitsPerSample || "Unknown" },
    { label: "Channels", value: metadata.channels || "Unknown" },
  ];

  const isLossless = losslessDisplay === "Yes (lossless)" || metadata.lossless === "Yes (lossless)";

  if (containerDisplay && isLossless) {
    detailItems.push({ label: "Container", value: containerDisplay });
  }

  return (
    <section
      className={`metadata-panel ${expanded ? "metadata-panel--expanded" : ""}`}
      aria-expanded={expanded}
      aria-controls={detailsId}
      role="button"
      tabIndex={0}
      onClick={handlePanelClick}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="metadata-header" aria-live="polite">
        <div className="metadata-summary-line">
          <span className="metadata-summary-line__file">📊 {file.name}</span>
          <span className="metadata-summary-line__meta">
            {summaryMetaItems.map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="metadata-summary-line__meta-item"
              >
                {value}
              </span>
            ))}
          </span>
        </div>
        <span
          className={`metadata-header__chevron ${expanded ? "metadata-header__chevron--open" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </div>

      <div
        id={detailsId}
        className="metadata-detailed"
        hidden={!expanded}
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="metadata-details-grid">
          {detailItems.map(({ label, value }, index) => (
            <div
              key={label}
              className={`metadata-detail ${index < Math.ceil(detailItems.length / 2) ? "metadata-detail--row-one" : "metadata-detail--row-two"}`}
            >
              <span className="metadata-detail__label">{label}</span>
              <span className="metadata-detail__value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudioMetadataHeader;
