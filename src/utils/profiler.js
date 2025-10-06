const PERF_PREFIX = "spektra";
const PERF_SUPPORTED =
  typeof performance !== "undefined" &&
  typeof performance.mark === "function" &&
  typeof performance.measure === "function" &&
  typeof performance.clearMarks === "function" &&
  typeof performance.clearMeasures === "function";

function computeProfilingEnabled() {
  if (!PERF_SUPPORTED || typeof window === "undefined") {
    return false;
  }

  if (window.SPEKTRA_PROFILING === true) {
    return true;
  }

  try {
    return window.localStorage?.getItem("spektra-profiler") === "enabled";
  } catch (error) {
    console.warn("Profiling flag lookup failed", error);
    return false;
  }
}

const PROFILING_ENABLED = computeProfilingEnabled();

export function isProfilingEnabled() {
  return PROFILING_ENABLED;
}

function addPrefix(label) {
  return `${PERF_PREFIX}:${label}`;
}

export function profileMark(label) {
  if (!PROFILING_ENABLED) {
    return;
  }

  performance.mark(addPrefix(label));
}

export function profileMeasure(name, startLabel, endLabel) {
  if (!PROFILING_ENABLED) {
    return;
  }

  const start = addPrefix(startLabel);
  const end = addPrefix(endLabel);
  try {
    performance.measure(addPrefix(name), start, end);
  } catch (error) {
    console.warn("Profiler measure failed", { name, error });
  }
}

export function profileFlush() {
  if (!PROFILING_ENABLED) {
    return;
  }

  const measures = performance
    .getEntriesByType("measure")
    .filter((entry) => entry.name.startsWith(`${PERF_PREFIX}:`));

  if (measures.length > 0 && console.table) {
    const tableData = measures.map((entry) => ({
      name: entry.name.replace(`${PERF_PREFIX}:`, ""),
      durationMs: entry.duration.toFixed(2),
    }));
    console.table(tableData);
  }

  performance.clearMarks();
  performance.clearMeasures();
}
