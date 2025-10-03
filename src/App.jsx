import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import AudioMetadataHeader from "./components/AudioMetadataHeader";
import SpectrumCanvas from "./components/SpectrumCanvas";
import { extractAudioMetadata } from "./utils/formatMetadata";
import { debugLog, debugError } from "./utils/debug";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (selectedFile) => {
    try {
      setIsProcessing(true);
      debugLog("=== FILE SELECTION START ===");
      setFile(selectedFile);

      // Define supported audio types (expandable)
      const supportedTypes = [
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/flac",
        "audio/wav",
        "audio/ogg",
      ];

      if (!supportedTypes.includes(selectedFile.type)) {
        debugError("Unsupported file type:", selectedFile.type);
        alert("Please select a supported audio file format.");
        return;
      }

      const metadata = await extractAudioMetadata(selectedFile);
      debugLog("Extracted metadata:", metadata);
      setMetadata(metadata);
      debugLog("=== FILE SELECTION END ===");
    } catch (error) {
      debugError("Error during file selection or metadata extraction:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewFile = () => {
    setFile(null);
    setMetadata(null);
    setIsProcessing(false);
  };

  // Landing page - matches the mockup design
  if (!file) {
    return (
      <div className="app-landing">
        <div className="background-gradient"></div>
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        <div className="landing-container">
          <div className="header-section">
            <h1 className="app-title">Spektra</h1>
            <p className="app-subtitle">Static Spectrum Analyzer</p>
            {/* <p className="app-description">
              Analyze audio files to verify their frequency content and quality
            </p> */}
          </div>

          <div className="upload-section">
            <FileUpload onFileSelect={handleFileSelect} />
          </div>

          <div className="info-section">
            <div className="privacy-note">
              🔒 Files are processed locally in your browser - nothing is
              uploaded to servers
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Analysis view
  return (
    <div className="app-root">
      <div className="app-analysis">
        <div className="analysis-header">
          <h1 className="app-title-small">Spektra</h1>
          <button
            className="new-file-btn"
            onClick={handleNewFile}
            title="Analyze a new file"
          >
            📁 New File
          </button>
        </div>

        <div className="analysis-body">
          {metadata && <AudioMetadataHeader metadata={metadata} file={file} />}

          <div className="spectrum-section">
            {isProcessing && (
              <div className="processing-overlay">
                <div className="processing-spinner"></div>
                <p>Processing audio file...</p>
              </div>
            )}
            <SpectrumCanvas fileUploaded={file} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
