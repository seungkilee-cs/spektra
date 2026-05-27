export const SUPPORTED_AUDIO_FORMATS = [
  { mimeTypes: ["audio/mpeg"], extensions: ["mp3"], label: "MP3", color: "#4285f4" },
  { mimeTypes: ["audio/flac", "audio/x-flac"], extensions: ["flac"], label: "FLAC", color: "#0f9d58" },
  { mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"], extensions: ["wav"], label: "WAV", color: "#9c27b0" },
  { mimeTypes: ["audio/ogg"], extensions: ["ogg", "oga"], label: "OGG", color: "#f44336" },
  { mimeTypes: ["audio/mp4", "audio/aac"], extensions: ["aac", "mp4"], label: "AAC", color: "#ff9800" },
  { mimeTypes: ["audio/m4a", "audio/x-m4a"], extensions: ["m4a"], label: "M4A", color: "#ff9800" },
  { mimeTypes: ["audio/x-aiff", "audio/aiff"], extensions: ["aiff", "aif"], label: "AIFF", color: "#795548" },
  { mimeTypes: ["audio/webm"], extensions: ["webm"], label: "WEBM", color: "#607d8b" },
  { mimeTypes: ["audio/opus"], extensions: ["opus"], label: "OPUS", color: "#e91e63" },
];

const supportedMimeTypes = new Set(
  SUPPORTED_AUDIO_FORMATS.flatMap((format) => format.mimeTypes),
);
const supportedExtensions = new Set(
  SUPPORTED_AUDIO_FORMATS.flatMap((format) => format.extensions),
);

export function getAudioFileExtension(fileName = "") {
  const lastPathSegment = fileName.split(/[\\/]/).pop() || "";
  const dotIndex = lastPathSegment.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === lastPathSegment.length - 1) {
    return "";
  }
  return lastPathSegment.slice(dotIndex + 1).toLowerCase();
}

export function isSupportedAudioFile(file) {
  if (!file) return false;

  const mimeType = (file.type || "").toLowerCase();
  if (mimeType && supportedMimeTypes.has(mimeType)) {
    return true;
  }

  return supportedExtensions.has(getAudioFileExtension(file.name));
}

export function getAudioAcceptAttribute() {
  const mimeTypes = [...supportedMimeTypes];
  const extensions = [...supportedExtensions].map((extension) => `.${extension}`);
  return [...mimeTypes, ...extensions].join(",");
}

export function isUnsupportedAlacMetadata(metadata) {
  const codecLower = (metadata?.codec || "").toLowerCase();
  const containerLower = (metadata?.container || "").toLowerCase();
  return codecLower.includes("alac") || containerLower.includes("alac");
}
