import { parseBlob } from "music-metadata";
import { debugLog, debugError } from "./debug";

// Helper function to convert seconds to mm:ss format
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export async function extractAudioMetadata(file) {
  try {
    debugLog("Extracting metadata for file:", file);

    const metadata = await parseBlob(file);
    debugLog("Raw metadata from music-metadata:", metadata);

    if (!metadata.format) {
      debugError("No format data found in metadata.");
    }

    // Convert bitrate to kbps and duration to mm:ss
    const rawSampleRate = metadata.format.sampleRate;
    const sampleRate = rawSampleRate
      ? Math.round(rawSampleRate)
      : null;

    return {
      bitrate: metadata.format.bitrate
        ? `${(metadata.format.bitrate / 1000).toFixed(1)} kbps`
        : "Unknown",
      sampleRate: sampleRate || "Unknown",
      bitsPerSample:
        metadata.format.bitsPerSample ?? metadata.format.bitDepth ?? "Unknown",
      channels: metadata.format.numberOfChannels ?? metadata.format.channels ?? "Unknown",
      codec: metadata.format.codec || "Unknown",
      duration: metadata.format.duration
        ? formatDuration(metadata.format.duration)
        : "Unknown",
    };
  } catch (error) {
    debugError("Error extracting audio metadata:", error);
    return null;
  }
}
