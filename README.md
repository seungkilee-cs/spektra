# Spektra

<!--![Spektra Screenshot](https://example.com/spektra Replace with actual screenshot URL or path -->

Spektra is a static web-based spectrum analyzer that visualizes audio files using Fast Fourier Transform (FFT) to display frequency content over time. Inspired by tools like Spek, it allows users to upload audio files and view detailed spectrograms with professional-grade features like dB scaling, color mapping, and metadata display. Built as a single-page application (SPA) for easy deployment on platforms like GitHub Pages.

## Features

- **Audio File Upload**: Supports MP3, M4A, FLAC, and more via drag-and-drop or file selection.
- **Spectrogram Visualization**: Displays frequency spectrum with logarithmic dB scaling and customizable color mapping.
- **Metadata Display**: Shows file details like bitrate, sample rate, codec, and duration in a compact, expandable header.
- **Professional Labels**: Frequency (Hz) on left, dB on right, time on bottom – matching industry standards.
- **Performance Optimizations**: Downsampling for large files to ensure smooth rendering.
- **Cross-Browser Compatibility**: Uses Web Audio API with fallbacks for broad support.
- **Static Deployment**: Runs entirely client-side with no backend required.

## Demo

Check out [Spektra](seungkilee-cs.github.io/Spektra) or install and run it yourself.

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/seungkilee-cs/Spektra.git
   cd Spektra
   ```

2. Install dependencies:

   ```
   npm install
   ```

   - Key dependencies: `fft-js` for FFT computations, `music-metadata-browser` for audio metadata extraction.

3. Run locally:

   ```
   npm start
   ```

   Open http://localhost:3000 in your browser.

4. Build for production:
   ```
   npm run build
   ```
   Deploy the `build/` folder to any static host (e.g., GitHub Pages, Netlify).

## Usage

1. Open the app in your browser.
2. Drag-and-drop or select an audio file (e.g., MP3).
3. View the generated spectrogram with metadata header.
4. Click the header to expand detailed file info.

Example metadata display:

- Compact: "file.mp3 | 10.0 MB | MPEG 1 Layer 3, 320.0 kbps, 44100 Hz, 4:16"
- Expanded: Full JSON-like details for advanced users.

For developers:

- Customize FFT parameters in `audioProcessor.js` (e.g., `fftSize = 1024`).
- Modify color mapping in `SpectrumCanvas.jsx` for different visual styles.

## Technologies

- **Frontend**: React.js for UI components and state management.
- **Audio Processing**: Web Audio API for decoding, fft-js for FFT computations.
- **Metadata**: music-metadata-browser for extracting audio tags.
- **Visualization**: HTML Canvas for efficient pixel rendering.
- **Build Tools**: Vite for fast development and bundling.

## Current Improvements

Spektra is a prototype with room for enhancement.

- **Rust + WASM for FFT**: Javascript FFT is feasible but slow. Even the native JS FFT library is not performant for larger files, and un-optimized high level implementation will definitely crash.
  So I'm working to replace JavaScript FFT with a high-performance Rust implementation compiled to WebAssembly. This could improve processing speed by 3-10x for large files, enabling near-native performance in the browser.

- **Revamp the Looks**: Modernize the UI with a dark theme, responsive design, zoom/pan functionality for spectrograms, and customizable color schemes (e.g., presets matching Spek, Audacity).

- **Real-Time Analysis**: Add microphone input for live audio visualization, with options for real-time spectrograms and peak detection.
- **Advanced Features**:
  - Support for more file formats (e.g., WAV, OGG).
  - Export options (PNG/JPG of spectrogram, CSV of frequency data).
  - Comparative analysis (overlay multiple audio files).
  - Mobile optimization and PWA support.
- **Performance Enhancements**: Multi-threading via Web Workers, GPU acceleration with WebGL for rendering.
- **Accessibility**: Add ARIA labels, keyboard navigation, and high-contrast modes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Built by [seungkilee-cs](https://github.com/seungkilee-cs). Inspired by Spek and the need for a lightweight, web-based audio analyzer.
