# Browser DSP boundary

No WebAssembly module is built here yet. Reuse the validated scalar DSP
implementation only after defining a shared test-vector suite and checking
numerical equivalence between native and browser builds. Do not treat
client-side results as verified sensor data or use them to issue warnings.
