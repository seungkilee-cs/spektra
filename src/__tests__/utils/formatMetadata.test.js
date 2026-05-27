import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("music-metadata", () => ({
  parseBlob: vi.fn(),
}));

const { parseBlob } = await import("music-metadata");
const { extractAudioMetadata } = await import("../../utils/formatMetadata.js");

describe("extractAudioMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats common lossless metadata", async () => {
    parseBlob.mockResolvedValue({
      format: {
        bitrate: 1411200,
        sampleRate: 44100,
        bitsPerSample: 16,
        numberOfChannels: 2,
        codec: "FLAC",
        container: "FLAC",
        lossless: true,
        duration: 256.7,
      },
      common: { encoder: "reference encoder" },
    });

    const metadata = await extractAudioMetadata(new Blob(["audio"]));

    expect(metadata).toMatchObject({
      bitrate: "1411.2 kbps",
      sampleRate: 44100,
      bitsPerSample: "16-bit",
      channels: 2,
      codec: "FLAC",
      codecProfile: "Lossless",
      container: "FLAC",
      encoder: "reference encoder",
      lossless: "Yes (lossless)",
      duration: "4:16",
    });
  });

  it("infers lossy fields when the parser omits explicit lossless metadata", async () => {
    parseBlob.mockResolvedValue({
      format: {
        bitrate: 320000,
        sampleRate: 48000,
        numberOfChannels: 2,
        codec: "MPEG 1 Layer 3",
        container: "MPEG",
        duration: 61,
      },
      common: {},
    });

    const metadata = await extractAudioMetadata(new Blob(["audio"]));

    expect(metadata).toMatchObject({
      bitrate: "320.0 kbps",
      sampleRate: 48000,
      bitsPerSample: "Not applicable (lossy)",
      codecProfile: "Lossy",
      lossless: "No (lossy)",
      duration: "1:01",
    });
  });

  it("returns null when metadata parsing fails", async () => {
    parseBlob.mockRejectedValue(new Error("bad file"));

    await expect(extractAudioMetadata(new Blob(["not audio"]))).resolves.toBeNull();
  });
});
