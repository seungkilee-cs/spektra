import React, { useState, useRef } from "react";
import "../styles/FileUpload.css";
import { debugLog, debugError } from "../utils/debug";

const FileUpload = ({ onFileSelect }) => {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter((file) =>
      ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/flac"].includes(
        file.type,
      ),
    );

    if (validFiles.length !== selectedFiles.length) {
      debugError("Some files were invalid and not added");
    }

    setFiles((prevFiles) => [...prevFiles, ...validFiles]);
    validFiles.forEach((file) => {
      debugLog("File added successfully. Details:", {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        lastModified: new Date(file.lastModified).toLocaleString(),
      });
      onFileSelect(file); // Call the prop function for each valid file
    });
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
          multiple
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
          <p>Drag and drop your audio files here or</p>
          <button type="button" onClick={onButtonClick}>
            Upload files
          </button>
        </div>
      </form>
      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div className="file-item" key={index}>
              <p>{file.name}</p>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
