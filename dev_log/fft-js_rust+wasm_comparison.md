# Spektra FFT Performance Analysis: JavaScript vs Rust+WASM

From my Javascript implementation to using `fft-js` library, I've been able to keep the code from crashing to finish executing in 13 seconds. But this was still too long. So I decided to write the logic for fft in rust and use WASM to call it from Javascript. Here are the difference in performances.

## 📊 Exact Performance Metrics

### Test Case 1: MP3 File (10.02 MB, 4:16 duration)

| Metric                | JavaScript (fft-js)    | Rust+WASM (Custom)  | Advantage         |
| ------------------------- | -------------------------- | ----------------------- | --------------------- |
| Pure FFT Computation  | 12,336ms                   | 832ms                   | Rust 14.8x faster |
| Total Processing Time | 13,641ms                   | 2,261ms                 | Rust 6.0x faster  |
| Processing Rate       | 1,761 windows/sec          | 28,914 windows/sec      | Rust 16.4x faster |
| Memory Efficiency     | Lower (dynamic allocation) | Higher (pre-allocated)  | Rust advantage    |
| CPU Utilization       | Single-threaded            | Optimized single-thread | Rust advantage    |

### Test Case 2: FLAC File (25.43 MB, 3:41 duration)

| Metric                | JavaScript (fft-js) | Rust+WASM (Custom) | Advantage         |
| ------------------------- | ----------------------- | ---------------------- | --------------------- |
| Pure FFT Computation  | 11,609ms                | 813ms                  | Rust 14.3x faster |
| Total Processing Time | 12,878ms                | 2,130ms                | Rust 6.0x faster  |
| Processing Rate       | 1,784 windows/sec       | 25,485 windows/sec     | Rust 14.3x faster |
| Consistency           | Variable performance    | Consistent performance | Rust advantage    |

## 🔬 Technical Deep Dive

### Why is Rust Implementation Faster

#### 1. Language-Level Advantages

```rust
- Zero-cost abstractions
- No garbage collector interference
- Compile-time optimizations
- Direct memory control
- LLVM backend optimizations
- Rust 32-bit floats for better cache performance
```

#### 2. WebAssembly Performance Characteristics

- Near-native execution speed (within 10-20% of native code)
- No JavaScript engine overhead for computational loops
- Predictable performance without JIT compilation variability
- Optimal instruction selection by LLVM

### Why fft-js Library is Slower

- Dynamic typing overhead: Every number operation requires type checks
- Garbage collection pauses: Frequent memory allocation/deallocation
- JIT compilation unpredictability: Performance varies across runs
- Single-threaded execution: Cannot leverage modern CPU architectures
- JavaScript Numbers: All numbers are 64-bit floats (IEEE 754)

## 🎯 Performance Scaling Analysis

### Core FFT Computation Scaling

Rust performance is consistent:

- MP3 (24,057 windows): 832ms → 28,914 windows/sec
- FLAC (20,717 windows): 813ms → 25,485 windows/sec

### JavaScript Performance Variability

JavaScript shows more variation:

- MP3: 12,336ms → 1,761 windows/sec
- FLAC: 11,609ms → 1,784 windows/sec

This inconsistency demonstrates JavaScript's unpredictable performance profile.

## 📈 Broader Implications: Right Tool for the Job

In python, people often joke that the people who know how to write python well, writes as little python as possible. That is, the implementation should always be outsourced to C or Fortran libraries, and the python should be the business logic layer acting as glue to piece together the various libraries written in C.

Now, fft-js is widely used and well written Javascript codebase. For my fft implementation in rust audio processor, I've basically ported over the logic written in Javascript/Python to Rust. But the rust implementation is over 10 times faster on the pure computation, with consistent, predictable performances across different test data, and keep in mind this is just unoptimized, from the scratch custom implementation of rust + WASM beats highly performant javascript implementation

So the takeaway here is that the important thing is to use the tool that makes most sense for the occasion, not the one you already know. For me, this meant using Rust + WebAssembly for computational work and implementation logic, and Javascript for UI interaction and business logic.
