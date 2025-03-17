import React, { useState } from "react";
import "./App.css";
import SpectrumAnalyzer from "./components/SpectrumAnalyzer";

function App() {
  return (
    <div className="App">
      <h1>Spektra</h1>
      <h4> Static Spectrum Analyzer </h4>
      <SpectrumAnalyzer />
    </div>
  );
}

export default App;
