// testSpectrum.js - Test the audio processing pipeline
import { computeSpectogram } from "../utils/audioProcessor";

export const testSpectrumFunction = async (file) => {
  console.log("=== TESTING COMPUTESPECTOGRAM ===");

  try {
    const startTime = performance.now();
    const result = await computeSpectogram(file);
    const endTime = performance.now();

    console.log("✅ computeSpectogram SUCCESS");
    console.log(`Processing time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Result dimensions: ${result.length} x ${result[0]?.length}`);
    console.log("Sample data:", result[0]?.slice(0, 5));

    return result;
  } catch (error) {
    console.error("❌ computeSpectogram FAILED:", error);
    throw error;
  }
};
