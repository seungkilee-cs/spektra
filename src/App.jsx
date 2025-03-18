import React, { useState } from "react";
import "./App.css";
import SpectrumAnalyzer from "./components/SpectrumAnalyzer";
import FileUpload from "./components/FileUpload";

function App() {
  return (
    <div className="App">
      <h1>Spektra</h1>
      <h5> Static Spectrum Analyzer </h5>
      <SpectrumAnalyzer />
      <FileUpload />
    </div>
  );
}

export default App;
