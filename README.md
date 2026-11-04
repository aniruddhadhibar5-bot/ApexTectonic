# Hyperion Core

### Japan-focused seismic observability, research, and training interface

**Created by Aniruddha Dhibar**

Hyperion Core is a bilingual English/Japanese prototype that brings a Japan-region earthquake catalog, cited background research, and interactive synthetic signal visualizations together in one operator-oriented dashboard. It is built as an educational systems-engineering project—not as an earthquake predictor or public warning service.

![Original Hyperion Core seismic sensor concept illustration; this is a design render, not a photograph of connected hardware.](apps/dashboard-ui/public/images/hyperion-sensor-concept.svg)

> **Safety notice:** This project is not connected to field sensors, JMA's Earthquake Early Warning (EEW), emergency dispatch, sirens, or infrastructure controls. It must not be used to make emergency or operational decisions. Follow official information from the Japan Meteorological Agency (JMA) and local authorities.

## What you can explore

- **Japan event catalog:** a server-side proxy retrieves the USGS past-hour GeoJSON feed, filters events to a broad Japan-region bounding box, and presents event time, magnitude, depth, coordinates, and a source link. Refresh and unavailable-feed states are shown explicitly.
- **Animated interface:** a procedural network-field backdrop, a Japan-centered orbiting globe, service topology, waveform, radar-style visualization, and a rotating isometric sensor concept.
- **About and system tour:** bilingual project context plus a four-step walkthrough separating the USGS catalog from generated training visuals and cited research.
- **Original hardware concept art:** an in-repository SVG design illustration for a hypothetical sensor module. It is an illustration, not a photograph of real hardware.
- **Synthetic Nankai training exercise:** replay, pause, reset, and scrub a fictional signal-review sequence; select generated input-noise and station-dropout profiles.
- **Bilingual research guide:** switch the interface between English and Japanese, browse cited JMA, USGS, and NIED Hi-net documentation, and ask supported questions of an offline, curated answer guide.
- **Local-only message previews:** inspect mock mobile, web, watch, and signage presentations. These are never sent.
- **Polyglot engineering examples:** explore bounded examples and starter modules for sensor framing, DSP, asynchronous inference, scientific modeling, and review eligibility.

All Canvas scenes and the training scenario are illustrative. Animations are not measurements, sensor-status reports, or predictions. The USGS feed contains catalog events that have already been detected and located; it is not a real-time waveform feed or an official Japanese warning channel.

## Run the dashboard

### Requirements

- Node.js 20 or later
- npm

### Development

```powershell
cd apps/dashboard-ui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Japan-region catalog is fetched through the Next.js server route at `/api/japan-catalog`; the route contacts the USGS past-hour feed. An internet connection is needed for catalog data. If the external feed is unavailable, the dashboard shows an error rather than substituting synthetic events.

### Production build

```powershell
cd apps/dashboard-ui
npm run typecheck
npm run build
npm run start
```

## Repository map

| Path | Purpose | Scope |
| --- | --- | --- |
| `apps/dashboard-ui/` | Bilingual Next.js dashboard and Japan catalog API route | Interactive review and training UI |
| `apps/dashboard-ui/src/app/api/japan-catalog/` | USGS feed fetch, validation, Japan-region filter | Catalog proxy; not an alert API |
| `services/edge-sensor/` | Borrowed-frame parser and keyed HMAC-SHA3 authentication-tag example | No I2C/SPI hardware driver |
| `services/zig-kernel-driver/` | Bounded fixed-frame decoder | No raw sockets, kernel driver, or network bypass |
| `services/dsp-engine/` | Scalar radix-2 FFT and cascaded Butterworth sections | C++ example; no SIMD guarantee |
| `services/julian-tectonics/` | Stable, dimensionless diffusion example | Not a geophysical forecast |
| `services/ai-core/` | Bounded asynchronous inference adapter | No model weights or validated predictor |
| `services/verifier/` | Deterministic candidate review-eligibility checks | Not a formal safety proof |
| `proto/sentinel.proto` | Shared telemetry and review contract | Code generation is not configured |
| `packages/wasm-dsp/` | Reserved for a future separately validated WASM build | No WASM binary is shipped |
| `config/` | Local development configuration | Not production secrets or deployment settings |
| `docker-compose.yml` | Local Redpanda development broker | No actuator or public-warning integration |
| `Makefile` | Available polyglot test commands | Requires the corresponding language toolchains |

This is a deliberately scoped starter, not a finished implementation of every language or service in the original concept. Hardware interfaces, production gRPC services, trained models, authentication, deployment hardening, observability, and emergency integrations are not provided.

## Checks

The dashboard checks can be run independently:

```powershell
cd apps/dashboard-ui
npm run typecheck
npm run build
```

The repository-level `make test` target runs the available Rust, Python, C++, Zig, Julia, Haskell, and dashboard checks. Install the relevant toolchains first; the aggregate target will fail when a required compiler or runtime is missing. Individual commands are listed in the [Makefile](./Makefile).

## Data sources

- [USGS Earthquake Hazards Program — real-time feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/)
- [USGS FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/)
- [JMA — Earthquake Early Warning overview](https://www.jma.go.jp/jma/en/Activities/eew1.html)
- [JMA — EEW limitations](https://www.jma.go.jp/jma/en/Activities/eew3.html)
- [NIED Hi-net — data information and terms](https://www.hinet.bosai.go.jp/about_data/?LANG=en)

The catalog API uses the USGS `all_hour.geojson` feed and filters coordinates to latitude 24–46° N and longitude 122–154° E. This broad geographic filter is a display convenience, not an authoritative Japan boundary. Feed reporting may be delayed or incomplete. Respect each provider's terms; this project does not ingest or republish Hi-net waveforms.

## Safety and scientific limits

- No earthquake prediction is made. Neither this prototype nor its example models can promise a future event's time, location, magnitude, or a zero false-positive rate.
- The USGS catalog is not JMA EEW. EEW is an official service based on observed seismic waves after an earthquake has begun; this project neither receives nor reproduces it.
- The UI has no live station telemetry, calibrated model, evacuation guidance, public push delivery, siren control, or infrastructure actuator.
- The Nankai scenario, waveforms, topology links, radar dimensions, sensor rendering, and public-message cards are locally generated demonstrations.
- The Python adapter has no validated model weights or field dataset. The Julia example is not a tectonic forecast, and the Haskell checks do not prove zero-false-positive behavior or actuator safety.
- The Zig example does not bypass host network controls or attach privileged kernel/network drivers.

Any operational or public-safety use would require qualified seismological review, validated and calibrated models, field testing, independent safety assessment, secure device provisioning, authorization by relevant agencies, and fail-safe procedures.

## Development broker

`docker-compose.yml` starts a local Redpanda broker for development only. Do not expose it to untrusted networks. It is not connected to public warnings or infrastructure controls.

---

**Hyperion Core · Created by Aniruddha Dhibar**
