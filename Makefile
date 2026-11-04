.PHONY: test test-rust test-python test-dsp test-zig test-julia test-verifier test-dashboard format-rust

test: test-rust test-python test-dsp test-zig test-julia test-verifier test-dashboard

test-rust:
	cargo fmt --check --manifest-path services/edge-sensor/Cargo.toml
	cargo test --manifest-path services/edge-sensor/Cargo.toml

test-python:
	python -m unittest discover -s services/ai-core/tests -v

test-dsp:
	cmake -S services/dsp-engine -B .build/dsp
	cmake --build .build/dsp
	ctest --test-dir .build/dsp --output-on-failure

test-zig:
	zig test services/zig-kernel-driver/src/frame.zig

test-julia:
	julia services/julian-tectonics/test/runtests.jl

test-verifier:
	runghc services/verifier/Main.hs

test-dashboard:
	npm --prefix apps/dashboard-ui run typecheck

format-rust:
	cargo fmt --manifest-path services/edge-sensor/Cargo.toml
