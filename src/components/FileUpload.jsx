import React, { useState } from "react";
import "../styles/FileUpload.css";
import { debugLog, debugError } from "../utils/debug";

const FileUpload = () => {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (
      selectedFile &&
      ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/flac"].includes(
        selectedFile.type,
      )
    ) {
      setFile(selectedFile);
      debugLog("File uploaded successfully. Details:", {
        fileObj: selectedFile,
        name: selectedFile.name,
        type: selectedFile.type,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        lastModified: new Date(selectedFile.lastModified).toLocaleString(),
      });
    } else {
      debugError("Invalid file type selected");
      alert("Please select an mp3, m4a, or flac file.");
    }
  };

  return (
    <div className="file-upload">
      <label htmlFor="file-input" className="file-input-label">
        Choose Audio File
        <input
          id="file-input"
          type="file"
          accept=".mp3,.m4a,.flac"
          onChange={handleFileChange}
        />
      </label>
      {file && (
        <div className="file-info">
          <p>File: {file.name}</p>
          <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
