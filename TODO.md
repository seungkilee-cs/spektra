# TODO

## Implemented Features
- [x] File upload functionality for audio files
- [x] Display of basic audio metadata (bitrate, sample rate, etc.)
- [x] Canvas element for future spectrum visualization

## Features to be Implemented
### - [ ]  1. Fast Fourier Transform (FFT) Analysis of Audio Data
- [ ] Decode loaded audio file into time-domain samples.
- [ ] Normalize the audio samples to a range suitable for FFT processing.
- [ ] Implement an FFT algorithm using a library (e.g., Web Audio API, FFT.js, or DSP.js).
- [ ] Extract frequency-domain data (magnitude and phase) from the FFT results.
- [ ] Apply windowing functions (e.g., Hamming, Hann) to reduce spectral leakage.
- [ ] Verify FFT output by logging or visualizing raw frequency data.

### - [ ] 2. Real-Time Visualization of Frequency Spectrum on Canvas
- [ ] Set up a canvas element for drawing the spectrum.
- [ ] Use the FFT output to calculate magnitudes for each frequency bin.
- [ ] Map frequency magnitudes to bar heights or colors on the canvas.
- [ ] Continuously update the canvas with new FFT results in real-time.
- [ ] Optimize rendering performance using `requestAnimationFrame`.

### - [ ] 3. Adjustable Center Frequency, Frequency Resolution, and Frequency Span
- [ ] Add controls for adjusting the center frequency (e.g., slider or input field).
- [ ] Implement logic to recalculate displayed frequency bins based on resolution and span.
- [ ] Update the canvas to reflect changes in center frequency and span dynamically.

### - [ ] 4. Auto Bandwidth Adjustment
- [ ] Calculate optimal bandwidth based on input signal characteristics (e.g., Nyquist frequency).
- [ ] Dynamically adjust FFT size or resolution bandwidth to match the desired range.
- [ ] Ensure adjustments are reflected in both FFT calculations and visualizations.

### - [ ] 5. Multiple FFT Window Function Options
- [ ] Implement at least 4 window functions (e.g., Rectangular, Hamming, Hann, Blackman).
- [ ] Add a dropdown or toggle for selecting the window function.
- [ ] Apply the selected window function to the time-domain samples before performing FFT.

### - [ ] 6. Continuous and Block-Wise Acquisition with Different Averaging Types
- [ ] Implement continuous acquisition mode by streaming audio data in real-time.
- [ ] Add block-wise acquisition mode for processing fixed-length audio segments.
- [ ] Support averaging types such as linear averaging, exponential averaging, and peak hold.

### - [ ] 7. Noise Power Analysis
- [ ] Calculate noise power by integrating power spectral density over a specified range.
- [ ] Display noise floor levels on the spectrum visualization.
- [ ] Allow users to specify frequency ranges for noise analysis.

### - [ ] 8. Support for Input Scaling and Units
- [ ] Add support for scaling input values (e.g., dBFS to dBm).
- [ ] Provide options for displaying power in different units (e.g., Watts, dBm, dBW).

### - [ ] 9. Mathematical Toolbox for Signal Analysis
- [ ] Implement basic signal analysis tools (e.g., RMS calculation, peak detection).
- [ ] Add advanced tools like harmonic distortion analysis or signal-to-noise ratio (SNR).
- [ ] Provide an interface for users to apply these tools to selected frequency ranges.

### - [ ] 10. Waterfall Display Option
- [ ] Create a 2D waterfall plot showing frequency vs. time with amplitude as color intensity.
- [ ] Continuously update the waterfall plot as new FFT data is processed.
- [ ] Provide controls for adjusting time span and color mapping.

### - [ ] 11. Power Spectrum Display in Multiple Units
- [ ] Convert FFT magnitudes into power spectrum values in Watts, dBm, or dBW.
- [ ] Add a dropdown or toggle for selecting the display unit.
- [ ] Update spectrum visualization dynamically based on selected units.

### - [ ] 12. Customizable Bar Width, Gap, and Colors for Visualization
- [ ] Add controls for adjusting bar width and gap between bars in the spectrum display.
- [ ] Allow users to customize bar colors based on magnitude or frequency ranges.
- [ ] Implement dynamic updates of canvas rendering based on user preferences.

### - [ ] 13. Time Domain Visualization Alongside Frequency Domain
- [ ] Display raw time-domain waveforms alongside the frequency spectrum.
- [ ] Synchronize time-domain and frequency-domain displays in real-time.
- [ ] Allow toggling between time-domain and frequency-domain views.

### - [ ] 14. Ability to Adjust FFT Size, Max/Min Decibels, and Smoothing Time Constant
- [ ] Add controls for adjusting FFT size (e.g., 512, 1024, 2048 points).
- [ ] Provide sliders for setting max/min decibel levels in visualization.
- [ ] Implement smoothing time constants to stabilize real-time visualizations.

### - [ ] 15. Spectrogram View Option
- [ ] Create a spectrogram view showing frequency vs. time with amplitude as color intensity.
- [ ] Continuously update the spectrogram as new FFT data is processed.
- [ ] Provide controls for adjusting spectrogram resolution and color mapping.
