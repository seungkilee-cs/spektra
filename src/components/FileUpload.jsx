import React, { useState, useRef } from "react";
import "../styles/FileUpload.css";
import { debugLog, debugError } from "../utils/debug";

const FileUpload = ({ onFileSelect }) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (selectedFiles) => {
    const selectedFile = selectedFiles[0];
    if (
      ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/flac"].includes(
        selectedFile.type,
      )
    ) {
      setFile(selectedFile);
      debugLog("File added successfully. Details:", {
        name: selectedFile.name,
        type: selectedFile.type,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        lastModified: new Date(selectedFile.lastModified).toLocaleString(),
      });
      onFileSelect(selectedFile);
    } else {
      debugError("Invalid file type");
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
    <div className="file-upload">
      <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
        <input
          ref={inputRef}
          type="file"
          onChange={handleChange}
          accept=".mp3,.m4a,.flac"
        />
        <div
          className={`drop-area ${dragActive ? "drag-active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <p>Drag and drop your audio file here or</p>
          <button type="button" onClick={onButtonClick}>
            Upload file
          </button>
        </div>
      </form>
      {file && (
        <div className="file-list">
          <div className="file-item">
            <p>{file.name}</p>
            <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
