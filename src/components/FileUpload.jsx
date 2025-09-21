import React, { useState, useRef } from "react";
import { debugLog, debugError } from "../utils/debug";
import "../styles/FileUpload.css";

const FileUpload = ({ onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  // Expandable file formats configuration
  const supportedFormats = [
    { type: "audio/mpeg", extension: "MP3", color: "#4285f4" },
    { type: "audio/flac", extension: "FLAC", color: "#0f9d58" },
    { type: "audio/x-m4a", extension: "M4A", color: "#ff6900" },
    { type: "audio/wav", extension: "WAV", color: "#9c27b0" },
    { type: "audio/ogg", extension: "OGG", color: "#f44336" },
    { type: "audio/mp4", extension: "AAC", color: "#ff9800" },
    { type: "audio/x-aiff", extension: "AIFF", color: "#795548" },
    { type: "audio/webm", extension: "WEBM", color: "#607d8b" },
    { type: "audio/opus", extension: "OPUS", color: "#e91e63" },
  ];

  const acceptedTypes = supportedFormats.map((format) => format.type);

  const handleFiles = (selectedFiles) => {
    const selectedFile = selectedFiles[0];

    if (acceptedTypes.includes(selectedFile.type)) {
      debugLog("File added successfully:", {
        name: selectedFile.name,
        type: selectedFile.type,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
      });
      onFileSelect(selectedFile);
    } else {
      debugError("Invalid file type");
      alert("Please select a supported audio file format.");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${dragActive ? "drag-active" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-input"
          multiple={false}
          onChange={handleChange}
          accept={acceptedTypes.join(",")}
        />

        <div className="upload-content">
          <div className="upload-icon">
            <div className="music-icon">♪</div>
            <div className="upload-platform"></div>
          </div>

          <div className="upload-text">
            <h3>Drop your audio file here</h3>
            <p>or click to browse</p>
          </div>

          <div className="file-types">
            {supportedFormats.map((format, index) => (
              <span
                key={format.extension}
                className="file-type-badge"
                style={{
                  "--badge-color": format.color,
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {format.extension}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
