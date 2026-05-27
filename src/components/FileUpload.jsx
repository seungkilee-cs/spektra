import React, { useState, useRef } from "react";
import { debugLog, debugError } from "../utils/debug";
import {
  SUPPORTED_AUDIO_FORMATS,
  getAudioAcceptAttribute,
  isSupportedAudioFile,
} from "../utils/audioFileSupport";
import "../styles/FileUpload.css";

const FileUpload = ({ onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const supportedFormats = SUPPORTED_AUDIO_FORMATS.map((format) => ({
    extension: format.label,
    color: format.color,
  }));

  const acceptedTypes = getAudioAcceptAttribute();

  const handleFiles = (selectedFiles) => {
    const selectedFile = selectedFiles[0];

    if (isSupportedAudioFile(selectedFile)) {
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
          accept={acceptedTypes}
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
                key={`${format.extension}-${index}`}
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
