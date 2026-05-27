import { describe, expect, it } from "vitest";
import {
  getAudioAcceptAttribute,
  getAudioFileExtension,
  isSupportedAudioFile,
  isUnsupportedAlacMetadata,
} from "../../utils/audioFileSupport.js";

describe("audio file support", () => {
  it("accepts known audio MIME types", () => {
    expect(isSupportedAudioFile(new File([""], "track.bin", { type: "audio/flac" }))).toBe(true);
    expect(isSupportedAudioFile(new File([""], "track.bin", { type: "audio/x-m4a" }))).toBe(true);
  });

  it("falls back to extension when browsers omit the file MIME type", () => {
    expect(isSupportedAudioFile(new File([""], "Track.FLAC", { type: "" }))).toBe(true);
    expect(isSupportedAudioFile(new File([""], "voice.aif", { type: "" }))).toBe(true);
    expect(isSupportedAudioFile(new File([""], "cover.png", { type: "" }))).toBe(false);
  });

  it("extracts extensions safely", () => {
    expect(getAudioFileExtension("song.name.mp3")).toBe("mp3");
    expect(getAudioFileExtension(".hidden")).toBe("");
    expect(getAudioFileExtension("no-extension")).toBe("");
  });

  it("keeps ALAC as a metadata-level rejection", () => {
    expect(isUnsupportedAlacMetadata({ codec: "ALAC", container: "M4A" })).toBe(true);
    expect(isUnsupportedAlacMetadata({ codec: "AAC", container: "M4A" })).toBe(false);
  });

  it("includes both MIME types and extensions in the input accept attribute", () => {
    const accept = getAudioAcceptAttribute();
    expect(accept).toContain("audio/mpeg");
    expect(accept).toContain(".flac");
    expect(accept).toContain(".m4a");
  });
});
