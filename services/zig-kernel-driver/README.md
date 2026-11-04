# Bounded packet framing

This module decodes one fixed-size sensor frame from an already-provided byte
slice. It intentionally does not open raw sockets, attach a kernel driver,
configure DPDK/io_uring, or bypass host network controls. A privileged packet
path needs a separate threat model, hardware compatibility review, and
operations approval; this decoder is not such a driver.

Run its unit test with `zig test src/frame.zig` using a Zig compiler compatible
with the source.
