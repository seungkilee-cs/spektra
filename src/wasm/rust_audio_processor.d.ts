/* tslint:disable */
/* eslint-disable */
export function main(): void;
export function greet(name: string): string;
export function multiply_array(numbers: Float32Array, factor: number): Float32Array;
export class SpectrogramBatch {
  private constructor();
  free(): void;
  readonly data: Float32Array;
  readonly num_windows: number;
  readonly freq_bins: number;
}
export class WasmSpectrogramProcessor {
  free(): void;
  constructor(fft_size: number);
  process_window(audio_data: Float32Array): Float32Array;
  compute_spectrogram(audio_data: Float32Array, overlap: number): Float32Array;
  process_windows(audio_data: Float32Array, overlap: number, time_stride?: number | null, freq_stride?: number | null): SpectrogramBatch;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly main: () => void;
  readonly __wbg_spectrogrambatch_free: (a: number, b: number) => void;
  readonly spectrogrambatch_data: (a: number) => [number, number];
  readonly spectrogrambatch_num_windows: (a: number) => number;
  readonly spectrogrambatch_freq_bins: (a: number) => number;
  readonly __wbg_wasmspectrogramprocessor_free: (a: number, b: number) => void;
  readonly wasmspectrogramprocessor_new: (a: number) => number;
  readonly wasmspectrogramprocessor_process_window: (a: number, b: number, c: number) => [number, number];
  readonly wasmspectrogramprocessor_compute_spectrogram: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasmspectrogramprocessor_process_windows: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly greet: (a: number, b: number) => [number, number];
  readonly multiply_array: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
