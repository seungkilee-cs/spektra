export const DEBUG = import.meta.env.DEV; // true in dev, false in production builds

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
