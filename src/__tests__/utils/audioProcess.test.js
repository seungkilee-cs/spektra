import {
  generateHannWindow,
  applyHannWindow,
} from "../../utils/audioProcessor";

describe("Audio Processor Tests", () => {
  // Test case for Hann window generation
  describe("generateHannWindow()", () => {
    it("should generate a Hann window of correct length", () => {
      const N = 8; // Example window size
      const hannWindow = generateHannWindow(N);

      expect(hannWindow).toHaveLength(N);
    });

    it("should have first and last values close to zero", () => {
      const N = 8;
      const hannWindow = generateHannWindow(N);

      expect(hannWindow[0]).toBeCloseTo(0, 5); // First value should be near zero
      expect(hannWindow[N - 1]).toBeCloseTo(0, 5); // Last value should be near zero
    });

    it("should peak at the center of the window", () => {
      const N = 9; // Odd length to have a clear center
      const hannWindow = generateHannWindow(N);

      const centerIndex = Math.floor(N / 2);
      expect(hannWindow[centerIndex]).toBeCloseTo(1, 5); // Peak value should be near 1
    });
  });

  // Test case for applying Hann window
  describe("applyHannWindow()", () => {
    it("should apply the Hann window correctly to a signal segment", () => {
      const segment = [1, 2, 3, 4, 5]; // Example signal segment
      const windowedSegment = applyHannWindow(segment);

      expect(windowedSegment).toHaveLength(segment.length); // Output length should match input length

      // Check that values are scaled correctly by the Hann window
      const hannWindow = generateHannWindow(segment.length);
      segment.forEach((value, index) => {
        expect(windowedSegment[index]).toBeCloseTo(
          value * hannWindow[index],
          5,
        );
      });
    });

    it("should return all zeros for a zero signal segment", () => {
      const segment = [0, 0, 0, 0]; // Zero signal segment
      const windowedSegment = applyHannWindow(segment);

      windowedSegment.forEach((value) => {
        expect(value).toBeCloseTo(0, 5); // All values should remain zero
      });
    });

    it("should handle edge cases like an empty signal segment", () => {
      const segment = []; // Empty signal segment
      const windowedSegment = applyHannWindow(segment);

      expect(windowedSegment).toEqual([]); // Output should also be empty
    });
  });
});
