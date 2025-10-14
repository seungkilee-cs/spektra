let audioContext = null;
let resumePromise = null;
let unlockHandler = null;
let unlockListenersAttached = false;

const userGestureEvents = ["pointerdown", "touchstart", "keydown", "click"];

function getAudioContextClass() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

function removeUnlockListeners() {
  if (!unlockListenersAttached || typeof window === "undefined") {
    unlockListenersAttached = false;
    unlockHandler = null;
    return;
  }

  userGestureEvents.forEach((event) => {
    window.removeEventListener(event, unlockHandler);
  });

  unlockListenersAttached = false;
  unlockHandler = null;
}

function setupUnlockListeners(ctx, resolve) {
  if (typeof window === "undefined") {
    resolve(ctx);
    return;
  }

  if (unlockListenersAttached) {
    return;
  }

  unlockListenersAttached = true;
  unlockHandler = async () => {
    try {
      await ctx.resume();
    } catch (error) {
      if (ctx.state !== "running") {
        return;
      }
    }

    if (ctx.state === "running") {
      removeUnlockListeners();
      resolve(ctx);
    }
  };

  userGestureEvents.forEach((event) => {
    window.addEventListener(event, unlockHandler, { passive: true });
  });
}

async function resumeContext(ctx) {
  if (!ctx) {
    return null;
  }

  if (ctx.state === "running") {
    return ctx;
  }

  try {
    await ctx.resume();
    return ctx;
  } catch (error) {
    if (error && (error.name === "NotAllowedError" || error.name === "InvalidStateError")) {
      return new Promise((resolve) => {
        setupUnlockListeners(ctx, resolve);
      });
    }
    throw error;
  }
}

export function getCurrentAudioContext() {
  return audioContext;
}

export async function ensureAudioContext() {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextClass();
  }

  if (!resumePromise) {
    resumePromise = resumeContext(audioContext)
      .then((ctx) => {
        resumePromise = null;
        return ctx;
      })
      .catch((error) => {
        resumePromise = null;
        throw error;
      });
  }

  return resumePromise;
}
