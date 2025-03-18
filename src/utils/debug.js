export const DEBUG = true; // Set this to false to disable debug logs

export function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

export function debugError(...args) {
  if (DEBUG) {
    console.error(...args);
  }
}
