import { parseBlob } from "music-metadata";

export async function extractAudioMetadata(file) {
  try {
    const metadata = await parseBlob(file);
    return {
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      bitsPerSample: metadata.format.bitsPerSample,
      codec: metadata.format.codec,
      duration: metadata.format.duration,
    };
  } catch (error) {
    console.error("Error extracting audio metadata:", error);
    return null;
  }
}
