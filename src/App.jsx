import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import AudioMetadataDisplay from "./components/AudioMetadataDisplay";
import SpectrumCanvas from "./components/SpectrumCanvas";
import { extractAudioMetadata } from "./utils/audioProcess";
import "./App.css";
import SpectrumAnalyzer from "./components/SpectrumAnalyzer";

function App() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    const metadata = await extractAudioMetadata(selectedFile);
    setMetadata(metadata);
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
