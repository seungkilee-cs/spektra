/**
 * Legacy FFT test — skipped.
 *
 * The JavaScript FFT implementation (fastFourierTransform.js) was removed
 * when the codebase migrated to Rust/WASM for audio processing.
 * These tests are preserved as documentation of the removed functionality.
 *
 * The equivalent logic is now tested in Rust unit tests inside:
 *   rust-audio-processor/src/fft.rs  (#[cfg(test)] blocks)
 *
 * To run Rust tests:  cd rust-audio-processor && cargo test
 */
import { describe, it } from "vitest";

describe.skip("fastFourierTransform (legacy JS — removed)", () => {
  it("should perform forward FFT on a simple signal", () => {
    // Was: fft([{real:1,imag:0}, {real:-1,imag:0}, ...])
    // Module no longer exists — see rust-audio-processor/src/fft.rs
  });

  it("should reconstruct original signal via IFFT", () => {
    // Was: ifft(fft(signal)) ≈ signal within Number.EPSILON
    // Module no longer exists — see rust-audio-processor/src/fft.rs
  });
});
