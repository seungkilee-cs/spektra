import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import AudioMetadataDisplay from "./components/AudioMetadataDisplay";
import SpectrumCanvas from "./components/SpectrumCanvas";
import { extractAudioMetadata } from "./utils/audioProcess";
import { debugLog, debugError } from "./utils/debug";
import "./App.css";
import SpectrumAnalyzer from "./components/SpectrumAnalyzer";

function App() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    try {
      setFile(selectedFile);
      debugLog("Selected file:", selectedFile);

      if (
        !["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/flac"].includes(
          selectedFile.type,
        )
      ) {
        console.error("Unsupported file type:", selectedFile.type);
        alert("Please select a valid audio file (mp3, m4a, flac).");
        return;
      }

      const metadata = await extractAudioMetadata(selectedFile);
      debugLog("Extracted metadata:", metadata);

      if (!metadata) {
        debugError("Metadata extraction failed or returned null.");
      }

      setMetadata(metadata);
    } catch (error) {
      debugError("Error during file selection or metadata extraction:", error);
    }
  };

  return (
    <div className="App">
      <h1>Spektra</h1>
      <h4>Static Spectrum Analyzer</h4>
      <FileUpload onFileSelect={handleFileSelect} />
      <AudioMetadataDisplay metadata={metadata} />
      <SpectrumCanvas />
    </div>
  );
}

export default App;
