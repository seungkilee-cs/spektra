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
    const sampleRate = rawSampleRate ? Math.round(rawSampleRate) : null;

    const rawBitsPerSample =
      metadata.format.bitsPerSample ?? metadata.format.bitDepth ?? null;

    const parseBitDepth = (value) => {
      if (typeof value === "number" && value > 0) {
        return value;
      }
      if (typeof value === "string") {
        const match = value.match(/\d+/);
        if (match) {
          const parsed = parseInt(match[0], 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
          }
        }
      }
      return null;
    };

    const parsedBitsPerSample = parseBitDepth(rawBitsPerSample);

    const codecLower = (metadata.format.codec || "").toLowerCase();
    const inferredLossless = (() => {
      if (!codecLower) return null;
      const losslessKeywords = [
        "flac",
        "alac",
        "pcm",
        "wav",
        "aiff",
        "dsd",
        "ape",
        "wv",
      ];
      const lossyKeywords = ["mp3", "aac", "ogg", "opus", "vorbis", "wma"];
      if (losslessKeywords.some((kw) => codecLower.includes(kw))) return true;
      if (lossyKeywords.some((kw) => codecLower.includes(kw))) return false;
      return null;
    })();

    const isLossless =
      metadata.format.lossless ?? inferredLossless ?? null;

    const bitsPerSample = (() => {
      if (parsedBitsPerSample) {
        return `${parsedBitsPerSample}-bit`;
      }
      if (isLossless === false) {
        return "Not applicable (lossy)";
      }
      return "Unknown";
    })();

    const encoder = (() => {
      const common = metadata.common || {};
      if (common.encoder) return common.encoder;
      if (common.encodedBy) return common.encodedBy;
      if (Array.isArray(common.comment)) {
        const encoderComment = common.comment.find((entry) =>
          /encoder|encoding/i.test(entry || ""),
        );
        if (encoderComment) {
          return encoderComment;
        }
      }
      return metadata.format.encoder || metadata.format.encoding || "Unknown";
    })();

    const codecProfile =
      metadata.format.codecProfile ||
      metadata.format.profile ||
      (isLossless === true
        ? "Lossless"
        : isLossless === false
        ? "Lossy"
        : "Unknown");

    return {
      bitrate: metadata.format.bitrate
        ? `${(metadata.format.bitrate / 1000).toFixed(1)} kbps`
        : "Unknown",
      sampleRate: sampleRate || "Unknown",
      bitsPerSample,
      channels:
        metadata.format.numberOfChannels ?? metadata.format.channels ?? "Unknown",
      codec: metadata.format.codec || "Unknown",
      codecProfile,
      container: metadata.format.container || "Unknown",
      encoder,
      lossless:
        isLossless === true
          ? "Yes (lossless)"
          : isLossless === false
          ? "No (lossy)"
          : "Unknown",
      duration: metadata.format.duration
        ? formatDuration(metadata.format.duration)
        : "Unknown",
    };
  } catch (error) {
    debugError("Error extracting audio metadata:", error);
    return null;
  }
}
