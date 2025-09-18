import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import AudioMetadataDisplay from "./components/AudioMetadataDisplay";
import SpectrumCanvas from "./components/SpectrumCanvas";
import { extractAudioMetadata } from "./utils/formatMetadata";
import { debugLog, debugError } from "./utils/debug";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    try {
      debugLog("=== FILE SELECTION START ===");
      setFile(selectedFile);
      debugLog("Selected file:", selectedFile);

      debugLog("File details:", {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        lastModified: new Date(selectedFile.lastModified),
      });

      if (
        !["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/flac"].includes(
          selectedFile.type,
        )
      ) {
        debugError("Unsupported file type:", selectedFile.type);
        alert("Please select a valid audio file (mp3, m4a, flac).");
        return;
      }

      debugLog("File state updated, should trigger SpectrumCanvas re-render");

      const metadata = await extractAudioMetadata(selectedFile);
      debugLog("Extracted metadata:", metadata);

      if (!metadata) {
        debugError("Metadata extraction failed or returned null.");
      }

      setMetadata(metadata);

      debugLog("=== FILE SELECTION END ===");
    } catch (error) {
      debugError("Error during file selection or metadata extraction:", error);
    }
  };

  console.log("App.jsx - Current file state:", file);
  return (
    <div className="App">
      <h1>Spektra</h1>
      <h4>Static Spectrum Analyzer</h4>
      <FileUpload onFileSelect={handleFileSelect} />
      {metadata && <AudioMetadataDisplay metadata={metadata} />}
      <SpectrumCanvas fileUploaded={file} />
    </div>
  );
}

export default App;
