# Rust Audio Processor

This crate provides the FFT engine that powers Spektra. The goal was to build the transform from the ground up while following the math in the Fast Fourier transform article on Wikipedia. The implementation focuses on the iterative radix 2 Cooley–Tukey decomposition, twiddle factor reuse, and the windowing steps that drive a spectrogram pipeline.

## Module layout

- `src/lib.rs` exposes the public modules and re-exports the main WASM interface.
- `src/utils.rs` defines `Complex`, bit reversal, twiddle generation, and butterfly helpers.
- `src/fft.rs` runs the radix 2 iterative FFT with an optional SIMD path and an `ifft` helper.
- `src/hann_window.rs` applies the Hann window used prior to each transform.
- `src/audio_processor.rs` wraps the FFT for spectrogram use, manages hop sizes, strides, and WASM bindings.

## Algorithm references

- Radix 2 Cooley–Tukey: [Wikipedia - Fast Fourier transform, Cooley–Tukey FFT algorithm](https://en.wikipedia.org/wiki/Fast_Fourier_transform#Cooley%E2%80%93Tukey_FFT_algorithm)
- Bit reversal ordering: [Wikipedia - Fast Fourier transform, Butterfly diagram](https://en.wikipedia.org/wiki/Fast_Fourier_transform#Butterfly_diagram)
- Complex roots of unity and twiddle factors: [Wikipedia - Fast Fourier transform, Twiddle factors](https://en.wikipedia.org/wiki/Fast_Fourier_transform#Twiddle_factors)
- Windowing with Hann weights: [Wikipedia - Hann function](https://en.wikipedia.org/wiki/Hann_function)
- Spectrogram construction concepts: [Wikipedia - Spectrogram, Short-time Fourier transform](https://en.wikipedia.org/wiki/Spectrogram#Short-time_Fourier_transform)

## Implementation notes

1. `Sudden` bit reversal stage matches the permutation described under the butterfly diagram reference. The `bit_reverse` helper builds the address permutation a single bit at a time.
2. `TwiddleCache` stores the per-stage complex roots so the inner butterfly loop can index the factors directly without recomputing sine or cosine.
3. The SIMD path in `butterfly_pair_simd` packs pairs of butterflies when the WebAssembly target supports `simd128`, mirroring the textbook butterfly flow but executed with vector intrinsics.
4. `ifft` uses the conjugate-forward-conjugate pattern from the inverse FFT section to reuse the forward transform.
5. `SpectrogramProcessor` applies a Hann window, runs the FFT, and returns only the positive frequencies. Optional time and frequency strides let the caller decimate the output before batching it back to JavaScript.

## Testing

- Unit tests cover the expected FFT behaviors: impulse response, DC input, and FFT followed by inverse FFT.
- Additional tests in `audio_processor.rs` exercise sliding windows, stride handling, and the WASM facing API.

## Build and usage

- Build for development: `wasm-pack build --target web`
- Run the Rust tests: `cargo test`
- The generated WASM bindings are consumed by the web worker in `src/workers/spectrogramWorker.js`.
