function isDebugEnabled() {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage?.getItem("spektra-debug") === "enabled";
  } catch {
    return false;
  }
}

export const DEBUG = isDebugEnabled();

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
