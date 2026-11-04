"""Bounded async inference adapter; model scores are review inputs, not warnings."""

from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass
from typing import Protocol

MAX_WINDOW_SAMPLES = 65_536


@dataclass(frozen=True)
class SensorWindow:
    event_id: str
    station_id: str
    captured_ns: int
    sample_rate_hz: int
    channels: tuple[tuple[float, ...], ...]

    def validate(self) -> None:
        if not self.event_id.strip() or not self.station_id.strip():
            raise ValueError("event_id and station_id are required")
        if len(self.event_id) > 128 or len(self.station_id) > 128:
            raise ValueError("event and station identifiers must be at most 128 characters")
        if self.captured_ns <= 0 or not 1 <= self.sample_rate_hz <= 1_000_000:
            raise ValueError("timestamp must be positive and sample rate within supported bounds")
        if len(self.channels) != 3 or not self.channels[0]:
            raise ValueError("exactly three non-empty sensor channels are required")
        sample_count = len(self.channels[0])
        if sample_count > MAX_WINDOW_SAMPLES:
            raise ValueError("sensor window exceeds the configured sample limit")
        if any(len(channel) != sample_count for channel in self.channels):
            raise ValueError("sensor channels must have equal lengths")
        if any(not math.isfinite(value) for channel in self.channels for value in channel):
            raise ValueError("sensor samples must be finite")


@dataclass(frozen=True)
class ModelEstimate:
    event_id: str
    magnitude: float
    depth_km: float
    latitude_deg: float
    longitude_deg: float
    model_score: float

    def validate(self, expected_event_id: str) -> None:
        if self.event_id != expected_event_id:
            raise ValueError("model returned an estimate for a different event")
        values = (
            self.magnitude,
            self.depth_km,
            self.latitude_deg,
            self.longitude_deg,
            self.model_score,
        )
        if any(not math.isfinite(value) for value in values):
            raise ValueError("model estimate must contain finite values")
        if not -2.0 <= self.magnitude <= 10.0:
            raise ValueError("magnitude estimate outside supported bounds")
        if not 0.0 <= self.depth_km <= 800.0:
            raise ValueError("depth estimate outside supported bounds")
        if not -90.0 <= self.latitude_deg <= 90.0:
            raise ValueError("latitude outside valid bounds")
        if not -180.0 <= self.longitude_deg <= 180.0:
            raise ValueError("longitude outside valid bounds")
        if not 0.0 <= self.model_score <= 1.0:
            raise ValueError("model score outside [0, 1]")


class InferenceBackend(Protocol):
    async def infer(self, window: SensorWindow) -> ModelEstimate: ...


class InferencePipeline:
    """Applies bounded back-pressure and validates estimates from a supplied model."""

    def __init__(self, backend: InferenceBackend, capacity: int = 128) -> None:
        if capacity < 1:
            raise ValueError("capacity must be positive")
        self._backend = backend
        self._input: asyncio.Queue[SensorWindow | None] = asyncio.Queue(capacity)
        self._output: asyncio.Queue[ModelEstimate] = asyncio.Queue(capacity)
        self._lifecycle_lock = asyncio.Lock()
        self._finished = asyncio.Event()
        self._accepting = True
        self._started = False

    async def submit(self, window: SensorWindow) -> None:
        window.validate()
        async with self._lifecycle_lock:
            if not self._accepting:
                raise RuntimeError("inference pipeline is closed")
            await self._input.put(window)

    async def next_estimate(self) -> ModelEstimate:
        return await self._output.get()

    async def close(self) -> None:
        async with self._lifecycle_lock:
            if not self._accepting:
                return
            self._accepting = False
            started = self._started

        if not started:
            await self._input.put(None)
            return

        enqueue_stop = asyncio.create_task(self._input.put(None))
        wait_for_worker = asyncio.create_task(self._finished.wait())
        _, pending = await asyncio.wait(
            (enqueue_stop, wait_for_worker),
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

    async def run(self) -> None:
        async with self._lifecycle_lock:
            if self._started:
                raise RuntimeError("inference worker may only be started once")
            self._started = True
        try:
            while True:
                window = await self._input.get()
                try:
                    if window is None:
                        return
                    estimate = await self._backend.infer(window)
                    estimate.validate(window.event_id)
                    await self._output.put(estimate)
                finally:
                    self._input.task_done()
        finally:
            async with self._lifecycle_lock:
                self._accepting = False
            self._finished.set()
