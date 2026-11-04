# Hyperion Core — Research & Development Brief

**Status:** prototype design note
**Scope:** Japan-focused earthquake catalog display, synthetic signal visualization, and research-oriented software scaffolding
**Not:** a seismological forecast, certified warning system, public bulletin, sensor network, or peer-reviewed research result

## 1. Research objective

Hyperion Core explores how a multilingual, multi-language software prototype can present earthquake catalog information and explain its own data lineage without confusing:

1. catalog events that have already been detected and located;
2. synthetic inputs and generated visualizations used in a browser exercise; and
3. official warnings issued by authorized agencies.

The current objective is interface and software experimentation. The browser now trains a small classifier on generated synthetic feature rows to demonstrate a local ML workflow. No model is trained on real waveforms, calibrated, evaluated for earthquake prediction, or connected to field observations in this repository.

## 2. System boundary and data flow

```text
USGS past-hour GeoJSON
        |
        v
Next.js server route
  - fixed upstream URL
  - timeout and response-shape validation
  - Japan-region coordinate filter
  - bounded event list
        |
        v
Bilingual event catalog UI

Browser-generated exercise input ---> Canvas illustrations
                                      (separate from catalog)

Curated question guide -----------> primary-source links
Opt-in Gemini Live voice --------> server-minted constrained token
                                    -> browser WebSocket + mic/audio
                                    (audio/text streamed to Gemini)
Synthetic feature generator ------> browser-local classifier
                                    (toy data; not a predictor)

Installed PWA shell --------------> browser cache
Local notes ----------------------> device-local browser storage

Manual offer/answer exchange -----> WebRTC local ICE candidates
                                    (shared Wi-Fi/hotspot; text + audio + opt-in location)
```

There is no JMA connection, Hi-net ingestion, gRPC runtime, sensor hardware, real-data machine-learning inference service, emergency-alert delivery, actuator interface, or public message channel. The PWA has a limited local peer-to-peer communication prototype; it is not an emergency service.

## 3. Current language-stack inventory

“Example” denotes code in the repository, not a supported or deployed service. A missing stack is shown as planned instead of being represented as available.

| Stack | Intended responsibility | Current artifact | Evidence boundary |
| --- | --- | --- | --- |
| Rust | Bounded edge-frame parsing and packet authentication | `services/edge-sensor/` | Parser/authentication example; no I2C/SPI driver |
| Zig | Bounded low-level frame decoding | `services/zig-kernel-driver/` | Decoder only; no kernel bypass, raw-socket privilege, or DPDK |
| C++20 | Signal filters and FFT | `services/dsp-engine/` | Scalar implementation; no SIMD benchmark claim |
| Julia | Numerical model experimentation | `services/julian-tectonics/` | Dimensionless diffusion example; not a fault model |
| Python | Async inference integration | `services/ai-core/` | Adapter and validation; no model weights or prediction |
| Haskell | Candidate review eligibility | `services/verifier/` | Deterministic rules; not proof of system safety |
| Go | Ingestion routing patterns | `services/ingestion-mesh/` | Small concurrency example; no demonstrated million-node throughput |
| Elixir | OTP connection supervision | Not scaffolded | Architectural idea only |
| Java | Human review queue | `services/infrastructure-orchestrator/` | Queue stub; no Modbus, OPC-UA, or actuator connections |
| R | Regional statistics | `services/analytics-r/` | Example only; no calibrated hazard contours |
| PHP | Administration portal | `services/admin-portal/` | Minimal scaffold; no production authentication or audit store |
| TypeScript | Bilingual dashboard | `apps/dashboard-ui/` | Next.js interface |
| WebAssembly | Browser-side DSP | `packages/wasm-dsp/` | Reserved package; no WASM artifact |
| JavaScript + HTML | Browser visualization | `apps/dashboard-ui/src/app/` | Synthetic Canvas scenes and local interactions |
| Swift | Mobile client concept | `services/mobile-alert/` | Async example; no push delivery |
| Dart + Flutter | Cross-platform client | Not scaffolded | Architectural idea only |

R++ is treated as the original Rcpp integration concept for C++/R. No Rcpp bridge is included. The 16-stack inventory belongs in the README, not the operator dashboard.

## 4. Japan geography index

The interface includes all 47 prefectures grouped into eight conventional regions. Each listed point is an approximate coordinate for the prefectural capital or administrative center, for interface orientation only.

These points are not sensor coordinates. The prefecture directory does not model administrative polygons, offshore areas, tsunami zones, fault geometry, station coverage, or municipal-level boundaries. The event API uses a broad rectangular coordinate filter; it is not an authoritative Japan boundary or a regional risk model.

## 5. Data and source ledger

| Source | Prototype use | Important limitation |
| --- | --- | --- |
| [USGS real-time feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/) | Past-hour GeoJSON catalog upstream | Catalog of detected/located events; reporting can be delayed or updated |
| [USGS FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/) | Catalog API documentation and event references | Not a Japanese early-warning or future-prediction service |
| [JMA Earthquake Early Warning overview](https://www.jma.go.jp/jma/en/Activities/eew1.html) | Curated explanatory reference | Hyperion does not receive or reproduce JMA EEW |
| [JMA EEW limitations](https://www.jma.go.jp/jma/en/Activities/eew3.html) | Limitations and warning context | Follow current JMA and local-authority information directly |
| [NIED Hi-net data information and terms](https://www.hinet.bosai.go.jp/about_data/?LANG=en) | Research-access pointer | No Hi-net waveform ingestion or rehosting; provider terms apply |
| [Tokyo Fire Department 119 call guidance](https://www.tfd.metro.tokyo.lg.jp/lfe/119/index.html) | Reference for the emergency-contact panel | Tokyo guidance; the dashboard does not dispatch calls or emergency services |

The dashboard’s “updates” area displays real catalog data returned by the existing USGS route, when available, and links to primary public sources. The catalog auto-refreshes every 60 seconds and displays the feed-generation and last-check timestamps. It does not create news headlines, scrape unverified social posts, or claim to aggregate JMA bulletins.

The offline training lab creates a deterministic, synthetic two-class feature dataset and trains a small logistic classifier in the browser. The held-out metrics describe only that generated toy dataset. They are not real-world accuracy, calibration, earthquake probabilities, or evidence of prediction ability. Nothing from this workflow is sent to a service.

Peer location sharing is off by default. After a user explicitly starts sharing and grants browser geolocation permission, coordinates are sent only to the currently paired peer over the existing local WebRTC data channel. Incoming coordinates are range-checked and stale updates expire; local and remote coordinates remain transient in component memory and are not written to local storage. Users can stop sharing, and peer disconnection clears location state. This is not a continuous background tracker or an emergency location service.

The bilingual voice room can start a Gemini Live session after a server operator configures `GEMINI_API_KEY`. Starting requires an explicit user action and microphone permission; live audio and typed messages stream to Google, where live responses and transcripts are returned to the browser. A Next.js route mints a one-use, short-lived ephemeral token constrained to an operator-selected model, audio response mode, transcription, and system instruction. The permanent key is not sent to the browser. The route checks request origin and has a basic in-process per-IP request cap; it is not user authentication or durable production rate limiting. Public deployment requires authenticated access, distributed abuse controls, privacy/retention review, and deployment secrets management. The assistant can produce errors or stale information; it is not a warning, predictor, dispatch, or safety-control system. The separate typed research guide remains curated and is not generative AI.

The emergency contact is a device `tel:119` link referencing Tokyo Fire Department guidance. The browser cannot place a call without the device's telephone service, and the website cannot dispatch an ambulance. Separately, the installed PWA can connect two browsers with manually exchanged WebRTC offer/answer descriptions over a shared, functioning local Wi-Fi/hotspot without an internet connection. Opt-in location is visible to the paired peer only while sharing is active and is not retained by the app. It does not create that network, use Wi-Fi Direct/Bluetooth, or provide cellular voice/SMS, satellite, radio/mesh, emergency dispatch, identity verification, or guaranteed delivery. Local notes use unencrypted browser storage. Pairing codes must be shared privately; network/router policy and browser candidate handling may prevent a connection.

## 6. Research questions and non-claims

The following are reasonable future research questions, not results produced by the prototype:

- How should catalog update time, event origin time, and later event revisions be shown so users do not mistake them for warnings?
- What spatial boundary and place-name policy should a Japan-focused catalog use, and how should offshore events be handled?
- How should missing, delayed, revised, or conflicting catalog records be represented in a bilingual interface?
- What reproducible dataset, licensing, station metadata, and preprocessing would be required for a legitimate signal-processing study?
- How should probability calibration, decision thresholds, abstention, uncertainty, and human review be evaluated before any operational claim?
- How can visual design remain legible on low-power devices and under reduced-motion preferences?

No system can be described as “100% accurate” or “zero false positive” without defensible evidence, definitions, and a validated operating domain. This project makes no earthquake-prediction claim.

## 7. Staged validation plan

| Stage | Work product | Exit evidence required before the next stage |
| --- | --- | --- |
| A. Interface correctness | Bilingual catalog, source links, simulation boundaries | Type-check/build, keyboard and screen-reader review, mobile checks |
| B. Catalog reliability | Contract tests for USGS shape changes, timeouts, empty feeds, malformed records | Fixture-based tests; clear stale/error state; upstream attribution |
| C. Geospatial accuracy | Explicit Japan boundary and source-recorded administrative coordinates | Cited boundary dataset, licensing review, geographic test fixtures |
| D. DSP experimentation | Reproducible, authorized waveform dataset and baseline signal-processing experiments | Data permissions, preprocessing record, deterministic evaluation |
| E. Model research | Pre-registered, region-appropriate scientific hypotheses | Independent datasets, uncertainty/calibration evaluation, peer/domain review |
| F. Safety case | Hazard analysis, operational interface design, failure-mode exercises | Independent review, agency authorization, certified process and hardware |

Stages D–F are research proposals only. Nothing in the current repository satisfies their exit conditions.

## 8. Engineering notes

- The USGS upstream endpoint is fixed in the server route; requests have a bounded timeout, response validation, geographic filtering, sorting, and a maximum number of returned events.
- Client refresh is periodic and manual. A failed refresh is surfaced; the UI does not generate pretend catalog records.
- Time displays use the browser clock for JST and UTC. They are interface clocks, not feed timestamps or precision timing sources.
- Canvas topology, globe, waveform, radar, and hardware scenes are deterministic or time-animated illustrations. They do not consume station observations.
- Motion should respect `prefers-reduced-motion`; interactive walkthrough playback should be user-controlled.
- Credentials, private data, and privileged network access are not required for the local dashboard.

## 9. Reproducibility checklist for future work

For any future analysis, record:

1. source organization, dataset version, access date, licensing, and permitted use;
2. station/event selection criteria, geographic boundary version, and excluded records;
3. preprocessing steps, units, sampling assumptions, missing data, and filters;
4. train/validation/test separation by event and time, to avoid leakage;
5. baseline methods, uncertainty, calibration, sensitivity, false-alarm rate, and confidence intervals;
6. independent review and a clear statement of the supported operating domain.

Until that evidence exists, model and risk language must remain exploratory and must not be used for emergency decisions.
