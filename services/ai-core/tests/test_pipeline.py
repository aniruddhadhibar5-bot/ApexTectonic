import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import InferencePipeline, ModelEstimate, SensorWindow


class FixedBackend:
    async def infer(self, window: SensorWindow) -> ModelEstimate:
        await asyncio.sleep(0)
        return ModelEstimate(window.event_id, 2.0, 10.0, 35.0, 139.0, 0.7)


class FailingBackend:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.fail = asyncio.Event()

    async def infer(self, window: SensorWindow) -> ModelEstimate:
        self.started.set()
        await self.fail.wait()
        raise RuntimeError("model backend failed")


class InferencePipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_validated_window_produces_model_estimate(self) -> None:
        pipeline = InferencePipeline(FixedBackend(), capacity=1)
        worker = asyncio.create_task(pipeline.run())
        window = SensorWindow(
            event_id="synthetic-1",
            station_id="station-1",
            captured_ns=1,
            sample_rate_hz=100,
            channels=((0.1, 0.2), (0.0, 0.1), (-0.1, 0.0)),
        )
        await pipeline.submit(window)
        estimate = await asyncio.wait_for(pipeline.next_estimate(), timeout=1)
        self.assertEqual(estimate.event_id, "synthetic-1")
        self.assertEqual(estimate.model_score, 0.7)
        await pipeline.close()
        await worker
        with self.assertRaises(RuntimeError):
            await pipeline.submit(window)

    async def test_rejects_bad_shapes_and_non_finite_model_output(self) -> None:
        pipeline = InferencePipeline(FixedBackend())
        with self.assertRaises(ValueError):
            await pipeline.submit(
                SensorWindow("e", "s", 1, 100, ((float("nan"),), (), ()))
            )
        with self.assertRaises(ValueError):
            ModelEstimate("e", float("nan"), 1, 0, 0, 0.5).validate("e")
        with self.assertRaises(ValueError):
            SensorWindow(
                "oversized",
                "station",
                1,
                100,
                ((0.0,) * 65_537, (0.0,) * 65_537, (0.0,) * 65_537),
            ).validate()

    async def test_close_does_not_hang_if_worker_fails_with_full_queue(self) -> None:
        backend = FailingBackend()
        pipeline = InferencePipeline(backend, capacity=1)
        worker = asyncio.create_task(pipeline.run())
        first = SensorWindow("first", "station", 1, 100, ((0.0,), (0.0,), (0.0,)))
        second = SensorWindow("second", "station", 2, 100, ((0.0,), (0.0,), (0.0,)))
        await pipeline.submit(first)
        await backend.started.wait()
        await pipeline.submit(second)
        closing = asyncio.create_task(pipeline.close())
        await asyncio.sleep(0)
        backend.fail.set()
        with self.assertRaisesRegex(RuntimeError, "model backend failed"):
            await asyncio.wait_for(worker, timeout=1)
        await asyncio.wait_for(closing, timeout=1)


if __name__ == "__main__":
    unittest.main()
