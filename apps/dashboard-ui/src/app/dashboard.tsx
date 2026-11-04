"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import OfflineComms from "./offline-comms";
import TrainingLab from "./training-lab";

type Locale = "en-US" | "ja-JP";
type VisualKind = "topology" | "wave" | "radar" | "device" | "globe" | "ambient" | "walkthrough";
type PreviewChannel = "mobile" | "web" | "watch" | "signage";
type DrillProfile = "baseline" | "noise" | "dropout";
type JapanRegion = "Hokkaido" | "Tohoku" | "Kanto" | "Chubu" | "Kansai" | "Chugoku" | "Shikoku" | "Kyushu & Okinawa";
type CatalogEvent = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depthKm: number;
  url: string;
};
type CatalogState = {
  status: "loading" | "ready" | "error";
  events: CatalogEvent[];
  fetchedAt: number | null;
  feedGeneratedAt: number | null;
};
type ResearchQuestion = "preparedness" | "prediction" | "catalog" | "warning" | "data";
type VoiceResult = { transcript: string };
type VoiceRecognitionResult = ArrayLike<VoiceResult> & { isFinal: boolean };
type VoiceRecognitionEvent = Event & { resultIndex: number; results: ArrayLike<VoiceRecognitionResult> };
type VoiceRecognitionErrorEvent = Event & { error: string };
interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const sourceReferences = [
  { id: "jma-eew", url: "https://www.jma.go.jp/jma/en/Activities/eew1.html" },
  { id: "jma-limits", url: "https://www.jma.go.jp/jma/en/Activities/eew3.html" },
  { id: "usgs-feed", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/" },
  { id: "usgs-api", url: "https://earthquake.usgs.gov/fdsnws/event/1/" },
  { id: "hinet-terms", url: "https://www.hinet.bosai.go.jp/about_data/?LANG=en" },
  { id: "jma-earthquake", url: "https://www.jma.go.jp/jma/en/Activities/earthquake.html" },
  { id: "tokyo-119", url: "https://www.tfd.metro.tokyo.lg.jp/lfe/119/index.html" },
] as const;
type SourceId = (typeof sourceReferences)[number]["id"];
const sourceLibraryIds = ["jma-eew", "jma-limits", "usgs-feed", "hinet-terms"] as const;

const answerSources: Record<ResearchQuestion, readonly SourceId[]> = {
  preparedness: ["jma-earthquake", "tokyo-119"],
  prediction: ["jma-eew", "jma-limits"],
  catalog: ["usgs-feed", "usgs-api"],
  warning: ["jma-eew", "jma-limits"],
  data: ["hinet-terms"],
};

const japanRegions: ReadonlyArray<{ en: JapanRegion; ja: string }> = [
  { en: "Hokkaido", ja: "北海道" },
  { en: "Tohoku", ja: "東北" },
  { en: "Kanto", ja: "関東" },
  { en: "Chubu", ja: "中部" },
  { en: "Kansai", ja: "関西" },
  { en: "Chugoku", ja: "中国" },
  { en: "Shikoku", ja: "四国" },
  { en: "Kyushu & Okinawa", ja: "九州・沖縄" },
];

const japanPrefectures = [
  { id: "hokkaido", en: "Hokkaido", ja: "北海道", capitalEn: "Sapporo", capitalJa: "札幌市", region: "Hokkaido", lat: 43.0621, lon: 141.3544 },
  { id: "aomori", en: "Aomori", ja: "青森県", capitalEn: "Aomori", capitalJa: "青森市", region: "Tohoku", lat: 40.8222, lon: 140.7474 },
  { id: "iwate", en: "Iwate", ja: "岩手県", capitalEn: "Morioka", capitalJa: "盛岡市", region: "Tohoku", lat: 39.7036, lon: 141.1527 },
  { id: "miyagi", en: "Miyagi", ja: "宮城県", capitalEn: "Sendai", capitalJa: "仙台市", region: "Tohoku", lat: 38.2682, lon: 140.8694 },
  { id: "akita", en: "Akita", ja: "秋田県", capitalEn: "Akita", capitalJa: "秋田市", region: "Tohoku", lat: 39.7199, lon: 140.1026 },
  { id: "yamagata", en: "Yamagata", ja: "山形県", capitalEn: "Yamagata", capitalJa: "山形市", region: "Tohoku", lat: 38.2554, lon: 140.3396 },
  { id: "fukushima", en: "Fukushima", ja: "福島県", capitalEn: "Fukushima", capitalJa: "福島市", region: "Tohoku", lat: 37.7503, lon: 140.4676 },
  { id: "ibaraki", en: "Ibaraki", ja: "茨城県", capitalEn: "Mito", capitalJa: "水戸市", region: "Kanto", lat: 36.3659, lon: 140.4712 },
  { id: "tochigi", en: "Tochigi", ja: "栃木県", capitalEn: "Utsunomiya", capitalJa: "宇都宮市", region: "Kanto", lat: 36.5551, lon: 139.8828 },
  { id: "gunma", en: "Gunma", ja: "群馬県", capitalEn: "Maebashi", capitalJa: "前橋市", region: "Kanto", lat: 36.3895, lon: 139.0634 },
  { id: "saitama", en: "Saitama", ja: "埼玉県", capitalEn: "Saitama", capitalJa: "さいたま市", region: "Kanto", lat: 35.8617, lon: 139.6455 },
  { id: "chiba", en: "Chiba", ja: "千葉県", capitalEn: "Chiba", capitalJa: "千葉市", region: "Kanto", lat: 35.6073, lon: 140.1063 },
  { id: "tokyo", en: "Tokyo", ja: "東京都", capitalEn: "Shinjuku", capitalJa: "新宿区", region: "Kanto", lat: 35.6938, lon: 139.7034 },
  { id: "kanagawa", en: "Kanagawa", ja: "神奈川県", capitalEn: "Yokohama", capitalJa: "横浜市", region: "Kanto", lat: 35.4437, lon: 139.6380 },
  { id: "niigata", en: "Niigata", ja: "新潟県", capitalEn: "Niigata", capitalJa: "新潟市", region: "Chubu", lat: 37.9161, lon: 139.0364 },
  { id: "toyama", en: "Toyama", ja: "富山県", capitalEn: "Toyama", capitalJa: "富山市", region: "Chubu", lat: 36.6953, lon: 137.2113 },
  { id: "ishikawa", en: "Ishikawa", ja: "石川県", capitalEn: "Kanazawa", capitalJa: "金沢市", region: "Chubu", lat: 36.5613, lon: 136.6562 },
  { id: "fukui", en: "Fukui", ja: "福井県", capitalEn: "Fukui", capitalJa: "福井市", region: "Chubu", lat: 36.0641, lon: 136.2196 },
  { id: "yamanashi", en: "Yamanashi", ja: "山梨県", capitalEn: "Kofu", capitalJa: "甲府市", region: "Chubu", lat: 35.6642, lon: 138.5684 },
  { id: "nagano", en: "Nagano", ja: "長野県", capitalEn: "Nagano", capitalJa: "長野市", region: "Chubu", lat: 36.6513, lon: 138.1810 },
  { id: "gifu", en: "Gifu", ja: "岐阜県", capitalEn: "Gifu", capitalJa: "岐阜市", region: "Chubu", lat: 35.4233, lon: 136.7607 },
  { id: "shizuoka", en: "Shizuoka", ja: "静岡県", capitalEn: "Shizuoka", capitalJa: "静岡市", region: "Chubu", lat: 34.9756, lon: 138.3828 },
  { id: "aichi", en: "Aichi", ja: "愛知県", capitalEn: "Nagoya", capitalJa: "名古屋市", region: "Chubu", lat: 35.1815, lon: 136.9066 },
  { id: "mie", en: "Mie", ja: "三重県", capitalEn: "Tsu", capitalJa: "津市", region: "Kansai", lat: 34.7303, lon: 136.5086 },
  { id: "shiga", en: "Shiga", ja: "滋賀県", capitalEn: "Otsu", capitalJa: "大津市", region: "Kansai", lat: 35.0179, lon: 135.8546 },
  { id: "kyoto", en: "Kyoto", ja: "京都府", capitalEn: "Kyoto", capitalJa: "京都市", region: "Kansai", lat: 35.0116, lon: 135.7681 },
  { id: "osaka", en: "Osaka", ja: "大阪府", capitalEn: "Osaka", capitalJa: "大阪市", region: "Kansai", lat: 34.6937, lon: 135.5023 },
  { id: "hyogo", en: "Hyogo", ja: "兵庫県", capitalEn: "Kobe", capitalJa: "神戸市", region: "Kansai", lat: 34.6901, lon: 135.1956 },
  { id: "nara", en: "Nara", ja: "奈良県", capitalEn: "Nara", capitalJa: "奈良市", region: "Kansai", lat: 34.6851, lon: 135.8050 },
  { id: "wakayama", en: "Wakayama", ja: "和歌山県", capitalEn: "Wakayama", capitalJa: "和歌山市", region: "Kansai", lat: 34.2305, lon: 135.1708 },
  { id: "tottori", en: "Tottori", ja: "鳥取県", capitalEn: "Tottori", capitalJa: "鳥取市", region: "Chugoku", lat: 35.5011, lon: 134.2351 },
  { id: "shimane", en: "Shimane", ja: "島根県", capitalEn: "Matsue", capitalJa: "松江市", region: "Chugoku", lat: 35.4681, lon: 133.0484 },
  { id: "okayama", en: "Okayama", ja: "岡山県", capitalEn: "Okayama", capitalJa: "岡山市", region: "Chugoku", lat: 34.6551, lon: 133.9195 },
  { id: "hiroshima", en: "Hiroshima", ja: "広島県", capitalEn: "Hiroshima", capitalJa: "広島市", region: "Chugoku", lat: 34.3853, lon: 132.4553 },
  { id: "yamaguchi", en: "Yamaguchi", ja: "山口県", capitalEn: "Yamaguchi", capitalJa: "山口市", region: "Chugoku", lat: 34.1785, lon: 131.4737 },
  { id: "tokushima", en: "Tokushima", ja: "徳島県", capitalEn: "Tokushima", capitalJa: "徳島市", region: "Shikoku", lat: 34.0703, lon: 134.5548 },
  { id: "kagawa", en: "Kagawa", ja: "香川県", capitalEn: "Takamatsu", capitalJa: "高松市", region: "Shikoku", lat: 34.3428, lon: 134.0466 },
  { id: "ehime", en: "Ehime", ja: "愛媛県", capitalEn: "Matsuyama", capitalJa: "松山市", region: "Shikoku", lat: 33.8416, lon: 132.7657 },
  { id: "kochi", en: "Kochi", ja: "高知県", capitalEn: "Kochi", capitalJa: "高知市", region: "Shikoku", lat: 33.5597, lon: 133.5311 },
  { id: "fukuoka", en: "Fukuoka", ja: "福岡県", capitalEn: "Fukuoka", capitalJa: "福岡市", region: "Kyushu & Okinawa", lat: 33.5902, lon: 130.4017 },
  { id: "saga", en: "Saga", ja: "佐賀県", capitalEn: "Saga", capitalJa: "佐賀市", region: "Kyushu & Okinawa", lat: 33.2494, lon: 130.2988 },
  { id: "nagasaki", en: "Nagasaki", ja: "長崎県", capitalEn: "Nagasaki", capitalJa: "長崎市", region: "Kyushu & Okinawa", lat: 32.7503, lon: 129.8777 },
  { id: "kumamoto", en: "Kumamoto", ja: "熊本県", capitalEn: "Kumamoto", capitalJa: "熊本市", region: "Kyushu & Okinawa", lat: 32.8031, lon: 130.7079 },
  { id: "oita", en: "Oita", ja: "大分県", capitalEn: "Oita", capitalJa: "大分市", region: "Kyushu & Okinawa", lat: 33.2396, lon: 131.6093 },
  { id: "miyazaki", en: "Miyazaki", ja: "宮崎県", capitalEn: "Miyazaki", capitalJa: "宮崎市", region: "Kyushu & Okinawa", lat: 31.9077, lon: 131.4202 },
  { id: "kagoshima", en: "Kagoshima", ja: "鹿児島県", capitalEn: "Kagoshima", capitalJa: "鹿児島市", region: "Kyushu & Okinawa", lat: 31.5966, lon: 130.5571 },
  { id: "okinawa", en: "Okinawa", ja: "沖縄県", capitalEn: "Naha", capitalJa: "那覇市", region: "Kyushu & Okinawa", lat: 26.2124, lon: 127.6809 },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parseCatalogPayload(value: unknown): {
  events: CatalogEvent[];
  fetchedAt: number;
  feedGeneratedAt: number;
} {
  if (
    !isRecord(value) ||
    !Array.isArray(value.events) ||
    !isSafeTimestamp(value.fetchedAt) ||
    !isSafeTimestamp(value.feedGeneratedAt) ||
    value.events.length > 30
  ) {
    throw new Error("Unsupported catalog response.");
  }
  const events = value.events.map((event): CatalogEvent => {
    if (
      !isRecord(event) ||
      typeof event.id !== "string" ||
      event.id.length === 0 ||
      typeof event.magnitude !== "number" ||
      !Number.isFinite(event.magnitude) ||
      typeof event.place !== "string" ||
      event.place.length === 0 ||
      !isSafeTimestamp(event.time) ||
      typeof event.latitude !== "number" ||
      !Number.isFinite(event.latitude) ||
      event.latitude < 24 ||
      event.latitude > 46 ||
      typeof event.longitude !== "number" ||
      !Number.isFinite(event.longitude) ||
      event.longitude < 122 ||
      event.longitude > 154 ||
      typeof event.depthKm !== "number" ||
      !Number.isFinite(event.depthKm) ||
      typeof event.url !== "string"
    ) {
      throw new Error("Unsupported catalog event.");
    }
    const url = new URL(event.url);
    if (url.protocol !== "https:" || url.hostname !== "earthquake.usgs.gov") {
      throw new Error("Unsupported catalog event URL.");
    }
    return {
      id: event.id,
      magnitude: event.magnitude,
      place: event.place,
      time: event.time,
      latitude: event.latitude,
      longitude: event.longitude,
      depthKm: event.depthKm,
      url: url.toString(),
    };
  });
  return {
    events,
    fetchedAt: value.fetchedAt,
    feedGeneratedAt: value.feedGeneratedAt,
  };
}

function identifyQuestion(question: string): ResearchQuestion | null {
  const normalized = question.toLocaleLowerCase();
  if (/prepare|safety|what (?:should|do) i do|what to do|during (?:an? )?earthquake|in an earthquake|shaking|tsunami|evacuat|shelter|emergency|119|防災|避難|津波|揺れ|安全|救急|119番|地震が起きた時|地震が起きたとき|地震発生時|地震の時|地震のとき/.test(normalized)) return "preparedness";
  if (/predict|prediction|forecast|次の地震|予測|いつ地震/.test(normalized)) return "prediction";
  if (/official|warning|alert|eew|jma|公式|警報|気象庁/.test(normalized)) return "warning";
  if (/research|data|waveform|hi-net|hinet|研究|データ|波形|利用/.test(normalized)) return "data";
  if (/catalog|usgs|feed|live|show|カタログ|フィード|表示|ライブ/.test(normalized)) return "catalog";
  return null;
}

const copy = {
  "en-US": {
    eyebrow: "HYPERION CORE / REVIEW CONSOLE",
    title: "Regional seismic observability",
    description:
      "Interactive planetary-scale systems demo. All telemetry is synthetic; no field stations or infrastructure controls are connected.",
    language: "Language",
    english: "English",
    japanese: "日本語",
    simulation: "SYNTHETIC DATA • TRAINING ONLY",
    simulated: "SIMULATED",
    topology: "Service topology",
    topologyDescription: "Animated demonstration paths; not live packet traffic.",
    waveform: "Signal preview",
    waveformDescription: "Generated sample waveforms; not instrument readings.",
    radar: "Pipeline dimensions",
    radarDescription: "Illustrative axes only; not health or safety scores.",
    device: "Sensor concept view",
    deviceDescription: "Schematic illustration; no physical device is connected.",
    deviceType: "MEMS / CONCEPT",
    deviceAxes: "3-AXIS / SCHEMATIC",
    globeLabel: "Illustrative 3D globe centered on Japan",
    globeEyebrow: "PLANETARY VIEW / 01",
    globeCaption: "JAPAN REGION · CONCEPTUAL",
    globeStatus: "SIMULATION LAYER",
    ambientDescription: "Animated decorative network background",
    navLabel: "Dashboard sections",
    aboutEyebrow: "PROJECT PROFILE / 01",
    aboutTitle: "A clearer view of seismic information",
    aboutBody:
      "Hyperion Core brings a recent-event catalog, a fictional signal-training lab, and a curated research guide into one bilingual interface. It is designed to make the data source and the limits of each visualization visible—not to claim predictive capability.",
    aboutImageAlt:
      "Original concept illustration of a compact seismic sensor module, shown as a design visualization rather than a photograph of connected hardware.",
    aboutImageCaption: "ORIGINAL HARDWARE CONCEPT · NOT A CONNECTED DEVICE",
    aboutFacts: ["EN / 日本語", "SOURCE-LINKED", "SIMULATION CLEARLY LABELED"],
    howEyebrow: "SYSTEM TOUR / 02",
    howTitle: "How the experience works",
    howDescription:
      "A transparent path from a public event catalog to an illustrative training experience and cited research.",
    howSteps: [
      { title: "Fetch catalog", description: "A server route requests the USGS past-hour feed, validates its shape, and filters a broad Japan-region bounding box." },
      { title: "Review observed events", description: "Located catalog entries appear with event details and original USGS links; the feed is not a waveform or warning stream." },
      { title: "Explore a simulation", description: "An independent browser exercise renders generated waveforms and virtual stations that never enter the catalog." },
      { title: "Read cited guidance", description: "The offline research guide links answers to JMA, USGS, and NIED references. No alert or actuator path is connected." },
    ],
    howFootnote: "Catalog events and synthetic training visuals are separate data paths.",
    clockTitle: "LIVE CLOCKS",
    japanTime: "JAPAN STANDARD TIME",
    utcTime: "COORDINATED UNIVERSAL TIME",
    locationsEyebrow: "JAPAN INDEX / 04",
    locationsTitle: "Explore all 47 prefectures",
    locationsDescription:
      "Search the prefectures and their capital-city reference coordinates. Markers are geographic references only—not seismic stations, coverage, or risk indicators.",
    searchPrefectures: "Search prefecture or capital…",
    allRegions: "All regions",
    prefectureCount: "prefectures",
    capitalLabel: "CAPITAL REFERENCE",
    coordinateNote: "Approximate city-center coordinates · reference only",
    noPrefectures: "No prefectures match this search.",
    deskEyebrow: "SOURCE DESK / 05",
    deskTitle: "Official information & event updates",
    deskDescription:
      "Latest Japan-region catalog activity from USGS, alongside direct links to primary public agencies. This page does not aggregate JMA warning bulletins or breaking-news reporting.",
    latestCatalog: "LATEST CATALOG EVENT",
    noLatestCatalog: "No Japan-region events are currently listed in the past-hour catalog window.",
    officialLink: "Open official source",
    sourcesOnly: "PRIMARY SOURCES · NO UNVERIFIED HEADLINES",
    demoClipEyebrow: "INTERACTIVE DEMO / RENDERED LIVE",
    demoClipTitle: "A guided system walkthrough",
    demoClipDescription:
      "Play a short, generated visual tour of the catalog, illustrative signal, Japan view, and review boundary. This is a browser animation—not recorded field footage.",
    demoClipPlay: "Play walkthrough",
    demoClipPause: "Pause walkthrough",
    demoClipReset: "Restart walkthrough",
    demoClipStep: "SCENE",
    demoClipSteps: [
      { title: "Catalog first", description: "A server route validates a public past-hour event feed and filters the Japan-region view." },
      { title: "Signals are illustrative", description: "Waveforms and service paths are generated locally; no sensor stream is connected." },
      { title: "Japan in context", description: "The globe and prefecture index provide geographic orientation, not station coverage." },
      { title: "Review, never dispatch", description: "Citations and limitations stay visible. No public warning or infrastructure action is available." },
    ],
    statusTitle: "Connection status",
    status: "No field stations or model endpoints connected",
    reviewTitle: "Operational boundary",
    reviewBody:
      "Model estimates require independent validation and authorized human review. This interface cannot issue evacuation guidance or operate physical infrastructure.",
    online: "DEMO MODE",
    dimensions: ["Integrity", "Coverage", "Latency", "Quality", "Resilience"],
    nav: ["Overview", "Event catalog", "About", "How it works", "Prefectures", "Updates", "Offline app", "AI assistant", "ML lab", "Sources"],
    catalogEyebrow: "EXTERNAL CATALOG • OBSERVED EVENTS",
    catalogTitle: "Recent events near Japan",
    catalogDescription:
      "USGS catalog entries from the past hour filtered to Japan's region. Catalog reporting may be delayed; this is not a warning feed, a sensor waveform stream, or a prediction.",
    catalogStatus: {
      loading: "Connecting to USGS…",
      ready: "Catalog reachable",
      error: "Catalog unavailable",
    },
    catalogCount: "EVENTS IN REGION",
    catalogUpdated: "FEED GENERATED",
    catalogChecked: "LAST CHECKED",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    noEvents: "No qualifying catalog entries in this time window.",
    catalogError: "Live catalog data could not be loaded. Retry, or use the official source link.",
    catalogAttribution: "Source: U.S. Geological Survey • Past-hour GeoJSON",
    catalogNote:
      "Cataloged events describe earthquakes already detected and located. USGS data is not Japan's official Earthquake Early Warning, does not show live station waveforms, and cannot predict future earthquakes.",
    magnitude: "MAG",
    depth: "DEPTH",
    openEvent: "Open USGS event",
    safetyEyebrow: "EMERGENCY READINESS / SYSTEM BOUNDARIES",
    safetyTitle: "Emergency contacts & offline readiness",
    safetyDescription:
      "A verified public emergency contact and an honest view of what this prototype can—and cannot—do.",
    ambulanceLabel: "AMBULANCE / FIRE · JAPAN",
    call119: "Call 119",
    call119Description:
      "119 is Japan’s ambulance and fire emergency number. This link opens your device’s phone handler; Hyperion cannot place calls, and a working telephone connection is required.",
    emergencySource: "Tokyo Fire Department: 119 call guidance",
    systemBoundaryTitle: "Capability status",
    statusCatalog: "Public earthquake catalog",
    statusCatalogValue: "USGS past-hour feed · auto-refresh",
    statusTelemetry: "Field sensor telemetry",
    statusTelemetryValue: "Not connected",
    statusPrediction: "Calibrated earthquake prediction",
    statusPredictionValue: "Not available · no validated model",
    statusNotifications: "Emergency notifications",
    statusNotificationsValue: "Not connected · no alerts sent",
    offlineCommsTitle: "Communication when internet is down",
    offlineCommsDescription:
      "The 119 link opens your phone app but cannot place or dispatch an emergency call. The peer room below supports non-emergency text and voice only when both devices already share a working local Wi-Fi/hotspot; it cannot reach emergency services.",
    offlineCommsTip:
      "A browser page cannot create a radio network or bypass a loss of telephone service. Check local authority guidance and your device/provider emergency-call capabilities.",
    assistantEyebrow: "OFFLINE ASSISTANCE • CURATED SAFETY & RESEARCH",
    assistantTitle: "Japan safety & research guide",
    assistantMode: "CURATED / OFFLINE",
    assistantDescription:
      "Bilingual, offline-first guidance for earthquake basics, tsunami readiness, Japan's 119 number, official warning sources, and research. Answers are curated—not generated, location-aware, or a replacement for local authorities.",
    assistantPlaceholder: "Ask about earthquake safety, tsunami, 119, predictions, or official information…",
    ask: "Ask",
    suggestedQuestions: {
      preparedness: "What should I do during an earthquake in Japan?",
      prediction: "Can this predict the next earthquake?",
      catalog: "What does the live catalog show?",
      warning: "Is this Japan's official warning?",
      data: "How do I access research data?",
    },
    assistantFallback:
      "I can answer only the listed, source-backed topics in this offline guide. Try one of the suggested questions below.",
    voiceInput: "Ask by voice",
    voiceListening: "Listening… tap to stop",
    voiceSpeak: "Speak answer",
    voiceStop: "Stop speaking",
    voicePrivacy:
      "Voice input uses your browser’s speech-recognition service; support, network use, and audio processing vary by browser. Hyperion does not store audio. Use typed input if voice is unavailable or offline.",
    voiceUnsupported: "Voice recognition is not available in this browser. You can still type a question.",
    voiceDenied: "Microphone or speech permission was denied. Check browser permissions, or type your question instead.",
    voiceNoSpeech: "No speech was detected. Try again or type your question.",
    voiceError: "Speech recognition failed. Check your microphone and network, or type your question.",
    voiceOutputUnsupported: "Spoken answers are not available in this browser.",
    voiceOutputError: "The browser could not play the spoken answer.",
    assistantAnswers: {
      preparedness:
        "If shaking starts, Drop, Cover, and Hold On; protect your head and stay away from glass. Do not rush outside or use elevators while shaking. If you are near the coast and experience strong or long-lasting shaking, move to higher ground/inland immediately and follow JMA and local-authority tsunami information—do not wait for this app. For an immediate fire or medical emergency in Japan, call 119 from a working phone. Shelter and evacuation routes depend on your municipality. This guide is offline reference material, not emergency dispatch.",
      prediction:
        "No. This project cannot predict the time, location, and magnitude of a future earthquake, and no system can promise 100% accuracy. Japan's Earthquake Early Warning is issued after an earthquake has started, using observed seismic waves to estimate later shaking. This dashboard makes no prediction.",
      catalog:
        "The panel displays USGS catalog entries from its past-hour GeoJSON feed, filtered geographically to Japan. These are events the catalog has detected and located; the feed may be delayed or incomplete. It is not a live waveform stream and not an early-warning service.",
      warning:
        "No. This is not JMA's official Earthquake Early Warning system. JMA explains that its warnings are based on prompt analysis of seismic waves observed after an earthquake begins, and also documents limitations. Follow JMA and local authorities for official information.",
      data:
        "Research waveform access is governed by each data provider's policies. NIED Hi-net publishes its access and usage terms; review those terms and request appropriate authorization before using or redistributing data. The dashboard does not ingest Hi-net waveforms.",
    },
    researchEyebrow: "SOURCE LIBRARY • PRIMARY REFERENCES",
    researchTitle: "Japan seismic research & documentation",
    researchCount: "04 / SOURCES",
    researchDescription:
      "Official guidance and data documentation used to frame this prototype. Read the source terms and limitations before research or operational use.",
    sourceOpen: "Open source",
    citationTitles: {
      "jma-eew": "Earthquake Early Warning: overview",
      "jma-limits": "EEW: limitations and false alarms",
      "usgs-feed": "USGS real-time earthquake feeds",
      "usgs-api": "USGS Earthquake Catalog API",
      "hinet-terms": "Hi-net data access and usage terms",
      "jma-earthquake": "JMA earthquake information",
      "tokyo-119": "Tokyo Fire Department: calling 119",
    },
    sourcePublisher: "PUBLISHER",
    sourceLinks: [
      {
        title: "Earthquake Early Warning: overview",
        publisher: "Japan Meteorological Agency",
        description: "How Japan's official EEW estimates shaking after an earthquake begins.",
        tag: "OFFICIAL GUIDANCE",
      },
      {
        title: "EEW: limitations and false alarms",
        publisher: "Japan Meteorological Agency",
        description: "Official discussion of timing, estimation limits, and false alarms.",
        tag: "LIMITATIONS",
      },
      {
        title: "Real-time earthquake GeoJSON feeds",
        publisher: "U.S. Geological Survey",
        description: "Feed format, fields, update behavior, and lifecycle documentation.",
        tag: "DATA DOCUMENTATION",
      },
      {
        title: "Hi-net data access and usage terms",
        publisher: "NIED Hi-net",
        description: "Provider information and policies for high-sensitivity waveform data.",
        tag: "ACCESS POLICY",
      },
    ],
    byline: "Created by",
    drillEyebrow: "INTERACTIVE SCENARIO LAB",
    drillTitle: "Nankai Trough / training exercise",
    drillDescription: "Replay a fictional 38-second signal-to-review sequence. This is not a forecast or public alert.",
    scenarioTag: "DRILL 01",
    region: "JAPAN · SOUTHERN HONSHU",
    mapTitle: "Propagation visualization",
    mapDescription: "Illustrative wavefront • synthetic source location",
    mapLabel: "NANKAI TROUGH",
    sourceLabel: "SIMULATED SOURCE",
    stationsLabel: "VIRTUAL STATIONS",
    timelineLabel: "SIMULATION TIMELINE",
    elapsedLabel: "ELAPSED",
    remainingLabel: "SIMULATED S-WAVE TIMER",
    remainingUnit: "s",
    start: "Run scenario",
    pause: "Pause",
    resume: "Resume",
    restart: "Reset",
    scrub: "Seek simulation time",
    phase: "PIPELINE PHASE",
    phases: ["Standby", "Synthetic signal", "Model review", "Human review", "Drill complete"],
    phaseDescriptions: [
      "Ready to play fictional training data",
      "Generated P-wave pattern enters the demo pipeline",
      "Illustrative model candidate is assembled",
      "Candidate is routed to a simulated human-review stage",
      "Training sequence ended • no warning or action issued",
    ],
    quickStats: ["Virtual stations", "Demo services", "Mode"],
    connected: "16 / 16",
    active: "SIMULATED",
    profileTitle: "SYNTHETIC INPUT PROFILE",
    profiles: {
      baseline: "Nominal",
      noise: "Urban-noise stress",
      dropout: "Station dropout",
    },
    profileDescriptions: {
      baseline: "Reference demo signal",
      noise: "Adds synthetic interference",
      dropout: "Hides 3 virtual stations",
    },
    stationCount: "VIRTUAL NODES",
    waveformProfile: "Synthetic waveform changes with the selected test profile and replay time.",
    boundaryShort: "Training only. No live telemetry, calibrated predictions, emergency notifications, or infrastructure controls.",
    mapFootnote: "Map geometry is illustrative and not for navigation.",
    deliveryEyebrow: "PUBLIC-FACING EXPERIENCE / CONCEPT",
    deliveryTitle: "How a message could reach people",
    deliveryDescription:
      "A local preview of possible presentation formats. Real emergency messages must come from authorized public agencies; this demo cannot send them.",
    deliverySteps: ["Synthetic sensor input", "Independent validation", "Authorized agency", "Public channel"],
    deliveryDetails: [
      "Training data only",
      "Not implemented here",
      "Official source required",
      "Preview only • not connected",
    ],
    previewTitle: "Public message preview",
    previewLabel: "EXERCISE • NOT A REAL ALERT",
    previewOnly: "LOCAL PREVIEW · NOT SENT",
    previewBody:
      "This is a fictional training message. It is not an earthquake warning. No action is required from this demo. For real emergencies, follow announcements from your local authorities.",
    previewSource: "HYPERION TRAINING SIMULATOR",
    previewChannels: {
      mobile: "Mobile",
      web: "Web",
      watch: "Watch",
      signage: "Public display",
    },
    previewChannelDescriptions: {
      mobile: "Phone notification mockup",
      web: "Browser banner mockup",
      watch: "Watch card mockup",
      signage: "Public information screen mockup",
    },
    previewAvailable: "Choose a presentation format",
    footer: "Synthetic display • No live operational data",
  },
  "ja-JP": {
    eyebrow: "HYPERION CORE / レビューコンソール",
    title: "地域地震観測ダッシュボード",
    description:
      "惑星規模システムのインタラクティブデモです。テレメトリーはすべて合成データで、観測所やインフラ制御には接続されていません。",
    language: "言語",
    english: "English",
    japanese: "日本語",
    simulation: "合成データ • 訓練専用",
    simulated: "シミュレーション",
    topology: "サービス構成",
    topologyDescription: "アニメーションはデモ用です。実際の通信状況ではありません。",
    waveform: "信号プレビュー",
    waveformDescription: "生成した波形です。実際の観測データではありません。",
    radar: "パイプライン指標",
    radarDescription: "説明用の軸のみを表示します。稼働・安全スコアではありません。",
    device: "センサー概念図",
    deviceDescription: "模式図です。実機には接続されていません。",
    deviceType: "MEMS / 概念",
    deviceAxes: "3軸 / 模式図",
    globeLabel: "日本を中心とした説明用3D地球儀",
    globeEyebrow: "惑星ビュー / 01",
    globeCaption: "日本周辺 · 概念表示",
    globeStatus: "シミュレーション表示",
    ambientDescription: "背景用のネットワークアニメーション",
    navLabel: "ダッシュボードのセクション",
    aboutEyebrow: "プロジェクト概要 / 01",
    aboutTitle: "地震情報を、より明確に可視化",
    aboutBody:
      "Hyperion Coreは、最近の地震カタログ、架空の信号訓練ラボ、出典付きリサーチガイドを一つの二言語インターフェースにまとめたプロトタイプです。予測能力をうたうのではなく、データの出典と可視化の限界を明確にすることを重視しています。",
    aboutImageAlt:
      "小型地震センサーモジュールのオリジナル概念イラスト。実際に接続されたハードウェアの写真ではなく、設計イメージです。",
    aboutImageCaption: "オリジナル・ハードウェア概念図 · 実機未接続",
    aboutFacts: ["英語 / 日本語", "出典リンク付き", "シミュレーション表示"],
    howEyebrow: "システムツアー / 02",
    howTitle: "この体験の仕組み",
    howDescription:
      "公開カタログから、説明用の訓練体験、出典付きの研究資料までを透明な流れで紹介します。",
    howSteps: [
      { title: "カタログ取得", description: "サーバールートがUSGS過去1時間フィードを取得・検証し、日本周辺の広域座標範囲で抽出します。" },
      { title: "観測済みイベントを確認", description: "震源決定済みのカタログ情報をイベント詳細とUSGS原典リンク付きで表示します。波形や警報の配信ではありません。" },
      { title: "シミュレーションを体験", description: "独立したブラウザー訓練で生成波形と仮想観測点を表示します。これらは実カタログに混入しません。" },
      { title: "出典付き資料を読む", description: "オフラインのリサーチガイドがJMA、USGS、NIEDの資料を案内します。警報やアクチュエーターへの経路はありません。" },
    ],
    howFootnote: "カタログイベントと合成訓練ビジュアルは別々のデータ経路です。",
    clockTitle: "現在時刻",
    japanTime: "日本標準時",
    utcTime: "協定世界時",
    locationsEyebrow: "日本地域インデックス / 04",
    locationsTitle: "47都道府県を表示",
    locationsDescription:
      "都道府県名と県庁所在地の参考座標を検索できます。位置は地理的な参考情報であり、地震観測点・観測範囲・リスクを示しません。",
    searchPrefectures: "都道府県・所在地を検索…",
    allRegions: "すべての地方",
    prefectureCount: "都道府県",
    capitalLabel: "県庁所在地の参考情報",
    coordinateNote: "市街地のおおよその座標 · 参考情報",
    noPrefectures: "該当する都道府県がありません。",
    deskEyebrow: "情報ソース / 05",
    deskTitle: "公式情報・イベント更新",
    deskDescription:
      "USGS日本周辺カタログの最新情報と、公的機関の一次リンクを掲載します。気象庁の警報速報や速報ニュースをこのページで集約するものではありません。",
    latestCatalog: "最新カタログイベント",
    noLatestCatalog: "過去1時間のカタログに日本周辺のイベントはありません。",
    officialLink: "公式情報を開く",
    sourcesOnly: "一次情報 · 未確認見出しなし",
    demoClipEyebrow: "インタラクティブデモ / ライブ描画",
    demoClipTitle: "システムのガイド付きツアー",
    demoClipDescription:
      "カタログ、説明用信号、日本周辺の地図、レビュー境界を生成アニメーションで紹介します。録画された現地映像ではありません。",
    demoClipPlay: "ツアーを再生",
    demoClipPause: "ツアーを一時停止",
    demoClipReset: "ツアーを最初から再生",
    demoClipStep: "シーン",
    demoClipSteps: [
      { title: "カタログから開始", description: "サーバールートが公開された過去1時間のイベントフィードを検証し、日本周辺を抽出します。" },
      { title: "信号は説明用", description: "波形とサービス経路はローカルで生成され、センサーストリームには接続されていません。" },
      { title: "日本の位置を確認", description: "地球儀と都道府県一覧は地理的な参考用で、観測網の範囲ではありません。" },
      { title: "レビューのみ、配信なし", description: "出典と制約を表示します。一般向け警報やインフラ操作機能はありません。" },
    ],
    statusTitle: "接続状態",
    status: "観測所およびモデルの接続はありません",
    reviewTitle: "運用上の制限",
    reviewBody:
      "モデル推定値には独立した検証と権限を持つ担当者の確認が必要です。避難案内や物理インフラの操作は行いません。",
    online: "デモモード",
    dimensions: ["完全性", "観測範囲", "遅延", "品質", "耐障害性"],
    nav: ["概要", "地震カタログ", "プロジェクト", "仕組み", "都道府県", "情報ソース", "オフライン通信", "防災AI案内", "MLラボ", "参考資料"],
    catalogEyebrow: "外部カタログ • 観測済みイベント",
    catalogTitle: "日本周辺の最近の地震",
    catalogDescription:
      "過去1時間のUSGSカタログから日本周辺のイベントを表示します。掲載は遅れる場合があります。警報、波形ストリーム、予測ではありません。",
    catalogStatus: {
      loading: "USGSに接続中…",
      ready: "カタログ接続中",
      error: "カタログを利用できません",
    },
    catalogCount: "対象地域のイベント",
    catalogUpdated: "フィード生成時刻",
    catalogChecked: "最終確認",
    refresh: "更新",
    refreshing: "更新中…",
    noEvents: "この時間帯に該当するカタログイベントはありません。",
    catalogError: "カタログを読み込めません。再試行するか、公式ソースをご確認ください。",
    catalogAttribution: "出典：米国地質調査所 • 過去1時間のGeoJSON",
    catalogNote:
      "カタログ掲載情報は、すでに検知・震源決定された地震です。USGSデータは気象庁の緊急地震速報ではなく、リアルタイム波形でも将来の地震予測でもありません。",
    magnitude: "マグニチュード",
    depth: "深さ",
    openEvent: "USGSイベントを開く",
    safetyEyebrow: "緊急時の備え / システムの範囲",
    safetyTitle: "緊急連絡先・オフライン時の備え",
    safetyDescription:
      "公的な緊急連絡先と、この試作システムでできること・できないことを明確に示します。",
    ambulanceLabel: "救急車・消防車 · 日本",
    call119: "119番に電話",
    call119Description:
      "日本の救急車・消防車の緊急通報番号は119番です。このリンクは端末の電話機能を開きます。Hyperionから発信はできず、電話回線への接続が必要です。",
    emergencySource: "東京消防庁：119番通報の案内",
    systemBoundaryTitle: "機能の接続状況",
    statusCatalog: "公開地震カタログ",
    statusCatalogValue: "USGS過去1時間フィード · 自動更新",
    statusTelemetry: "現地センサーテレメトリー",
    statusTelemetryValue: "未接続",
    statusPrediction: "校正済み地震予測",
    statusPredictionValue: "利用不可 · 検証済みモデルなし",
    statusNotifications: "緊急通知",
    statusNotificationsValue: "未接続 · 通知送信なし",
    offlineCommsTitle: "インターネットが使えない場合の通信",
    offlineCommsDescription:
      "119番リンクは電話アプリを開きますが、発信や救急車の手配はできません。下のピアルームは、両端末が動作中の同じWi-Fi/テザリングに接続している場合に限り、緊急用途ではないテキスト・音声通信を行えます。緊急機関には接続されません。",
    offlineCommsTip:
      "ブラウザーだけで無線ネットワークを作ったり、電話回線の障害を回避したりすることはできません。自治体の案内と端末・通信事業者の緊急通報機能をご確認ください。",
    assistantEyebrow: "オフライン支援 • 防災・研究ガイド",
    assistantTitle: "日本の防災・研究ガイド",
    assistantMode: "出典付き / オフライン",
    assistantDescription:
      "地震の基本、津波への備え、日本の119番、公式情報、研究について二言語で案内します。回答は確認済みの定型情報です。生成AI、位置判定、自治体別避難情報は利用しません。",
    assistantPlaceholder: "地震の安全、津波、119番、予測、公式情報について質問…",
    ask: "質問",
    suggestedQuestions: {
      preparedness: "日本で地震が起きた時、どうすればよいですか？",
      prediction: "次の地震を予測できますか？",
      catalog: "ライブカタログには何が表示されますか？",
      warning: "これは日本の公式警報ですか？",
      data: "研究データにはどうアクセスしますか？",
    },
    assistantFallback:
      "このオフラインガイドでは、出典で確認した項目のみ回答できます。下の候補から質問を選択してください。",
    voiceInput: "音声で質問",
    voiceListening: "聞き取り中…停止するには再度タップ",
    voiceSpeak: "回答を音声で再生",
    voiceStop: "音声を停止",
    voicePrivacy:
      "音声入力はブラウザーの音声認識機能を使います。対応状況、通信、音声処理はブラウザーにより異なります。Hyperionは音声を保存しません。音声が使えない場合やオフライン時は文字で入力してください。",
    voiceUnsupported: "このブラウザーでは音声認識を利用できません。質問を文字で入力できます。",
    voiceDenied: "マイクまたは音声認識の許可がありません。ブラウザーの権限を確認するか、文字で質問してください。",
    voiceNoSpeech: "音声を検出できませんでした。再試行するか、文字で質問してください。",
    voiceError: "音声認識に失敗しました。マイクとネットワークを確認するか、文字で質問してください。",
    voiceOutputUnsupported: "このブラウザーでは回答の読み上げを利用できません。",
    voiceOutputError: "ブラウザーで回答を読み上げられませんでした。",
    assistantAnswers: {
      preparedness:
        "揺れを感じたら、まず姿勢を低くし、頭を守り、揺れが収まるまで動かないでください。窓ガラスから離れ、揺れている間は外へ駆け出したりエレベーターを使ったりしないでください。海岸付近で強い揺れや長い揺れを感じた場合は、このアプリを待たずに高台・内陸へ避難し、気象庁や自治体の津波情報に従ってください。日本で火災や急病などの緊急事態がある場合は、利用可能な電話から119番へ。避難所や経路は自治体により異なります。このガイドは参考情報であり、緊急通報や救助の手配はできません。",
      prediction:
        "いいえ。このプロジェクトは将来の地震の時刻・場所・規模を予測できず、100%の精度を保証するシステムもありません。日本の緊急地震速報は地震発生後、観測された地震波から後続の揺れを推定して発表されます。この画面は予測を行いません。",
      catalog:
        "過去1時間のUSGS GeoJSONカタログから、日本周辺のイベントを地理的に抽出して表示します。検知・震源決定済みのイベントで、掲載が遅れたり情報が不完全な場合があります。波形ストリームや早期警報ではありません。",
      warning:
        "いいえ。気象庁の公式な緊急地震速報システムではありません。気象庁は地震発生後に観測波形を分析して警報を発表し、制約事項も公開しています。公式情報は気象庁や自治体からご確認ください。",
      data:
        "研究用波形データへのアクセスは各機関の利用規約に従います。NIED Hi-netのデータ利用条件を確認し、適切な許可を得てください。このダッシュボードはHi-net波形を取得していません。",
    },
    researchEyebrow: "参考資料 • 一次情報",
    researchTitle: "日本の地震研究・公式資料",
    researchCount: "04 / 資料",
    researchDescription:
      "この試作の参考とした公式ガイダンスとデータ資料です。研究・運用の前に各ソースの利用条件と制約をご確認ください。",
    sourceOpen: "公式資料を開く",
    citationTitles: {
      "jma-eew": "緊急地震速報の概要",
      "jma-limits": "緊急地震速報の限界",
      "usgs-feed": "USGSリアルタイム地震フィード",
      "usgs-api": "USGS地震カタログAPI",
      "hinet-terms": "Hi-netデータへのアクセスと利用条件",
      "jma-earthquake": "気象庁：地震情報",
      "tokyo-119": "東京消防庁：119番通報",
    },
    sourcePublisher: "発行元",
    sourceLinks: [
      {
        title: "緊急地震速報の概要",
        publisher: "気象庁",
        description: "地震発生後に主要動を推定する日本の公式EEWについて。",
        tag: "公式ガイダンス",
      },
      {
        title: "緊急地震速報の限界",
        publisher: "気象庁",
        description: "時間、推定精度、誤報の可能性に関する公式説明。",
        tag: "制約事項",
      },
      {
        title: "リアルタイム地震GeoJSONフィード",
        publisher: "米国地質調査所",
        description: "フィード形式、データ項目、更新、ライフサイクル資料。",
        tag: "データ資料",
      },
      {
        title: "Hi-netデータへのアクセスと利用条件",
        publisher: "NIED Hi-net",
        description: "高感度地震観測波形の提供情報と利用方針。",
        tag: "利用条件",
      },
    ],
    byline: "作成者：",
    drillEyebrow: "インタラクティブ・シナリオラボ",
    drillTitle: "南海トラフ / 訓練シナリオ",
    drillDescription: "架空の信号からレビューまでの38秒を再生します。予測や一般向け警報ではありません。",
    scenarioTag: "訓練 01",
    region: "日本 · 本州南部",
    mapTitle: "波面伝播の可視化",
    mapDescription: "説明用の波面 • 合成震源位置",
    mapLabel: "南海トラフ",
    sourceLabel: "シミュレーション震源",
    stationsLabel: "仮想観測点",
    timelineLabel: "シミュレーション・タイムライン",
    elapsedLabel: "経過",
    remainingLabel: "模擬S波タイマー",
    remainingUnit: "秒",
    start: "シナリオ再生",
    pause: "一時停止",
    resume: "再開",
    restart: "リセット",
    scrub: "シミュレーション時刻を移動",
    phase: "パイプライン段階",
    phases: ["待機中", "合成信号", "モデルレビュー", "担当者レビュー", "訓練完了"],
    phaseDescriptions: [
      "架空の訓練データを再生できます",
      "生成されたP波パターンをデモ処理に投入",
      "説明用のモデル候補を作成",
      "候補を模擬の担当者レビュー段階へ送信",
      "訓練シーケンス終了 • 警報・操作なし",
    ],
    quickStats: ["仮想観測点", "デモサービス", "モード"],
    connected: "16 / 16",
    active: "シミュレーション",
    profileTitle: "合成入力プロファイル",
    profiles: {
      baseline: "標準",
      noise: "都市ノイズ試験",
      dropout: "観測点の停止",
    },
    profileDescriptions: {
      baseline: "基準デモ信号",
      noise: "合成干渉を追加",
      dropout: "仮想観測点3か所を非表示",
    },
    stationCount: "仮想ノード",
    waveformProfile: "合成波形は選択した試験プロファイルと再生時間に応じて変化します。",
    boundaryShort: "訓練専用です。実テレメトリー、検証済み予測、緊急通知、インフラ制御はありません。",
    mapFootnote: "地図形状は説明用であり、ナビゲーションには使用できません。",
    deliveryEyebrow: "市民向け表示 / コンセプト",
    deliveryTitle: "情報が届く仕組みのイメージ",
    deliveryDescription:
      "表示形式のローカルプレビューです。実際の緊急情報は権限を持つ公的機関から発信される必要があります。このデモから送信することはできません。",
    deliverySteps: ["合成センサー入力", "独立した検証", "公的機関", "市民向けチャネル"],
    deliveryDetails: [
      "訓練データのみ",
      "このデモでは未実装",
      "公式情報源が必要",
      "プレビューのみ • 未接続",
    ],
    previewTitle: "市民向けメッセージのプレビュー",
    previewLabel: "訓練 • 実際の警報ではありません",
    previewOnly: "ローカルプレビュー · 未送信",
    previewBody:
      "これは架空の訓練メッセージです。地震警報ではありません。このデモでの行動は必要ありません。実際の緊急時は自治体などの公式発表に従ってください。",
    previewSource: "HYPERION 訓練シミュレーター",
    previewChannels: {
      mobile: "モバイル",
      web: "ウェブ",
      watch: "ウォッチ",
      signage: "公共表示",
    },
    previewChannelDescriptions: {
      mobile: "スマートフォン通知のモックアップ",
      web: "ブラウザー表示のモックアップ",
      watch: "ウォッチカードのモックアップ",
      signage: "公共情報画面のモックアップ",
    },
    previewAvailable: "表示形式を選択",
    footer: "合成表示 • 実運用データなし",
  },
} as const;

const nodes = [
  "Rust", "Zig", "C++", "R++", "Julia", "Python", "Haskell", "Go",
  "Elixir", "Java", "R", "PHP", "TypeScript", "WASM", "Swift", "Dart",
];
const previewChannels: PreviewChannel[] = ["mobile", "web", "watch", "signage"];

function drawAmbient(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const horizon = height * 0.62;
  const centerX = width * 0.5;
  const nodes = Array.from({ length: 46 }, (_, index) => {
    const seedX = (index * 127.3) % width;
    const seedY = (index * 83.7) % (height * 0.76);
    const depth = 0.25 + ((index * 17) % 70) / 100;
    return {
      x: (seedX + Math.sin(time * 0.00012 + index * 1.7) * (12 + depth * 14) + width) % width,
      y: Math.min(height - 8, Math.max(12, seedY + Math.cos(time * 0.0001 + index) * 11)),
      depth,
    };
  });

  context.save();
  const haze = context.createRadialGradient(centerX, horizon, 0, centerX, horizon, width * 0.72);
  haze.addColorStop(0, "rgba(36, 124, 146, .08)");
  haze.addColorStop(0.52, "rgba(25, 82, 119, .035)");
  haze.addColorStop(1, "rgba(7, 17, 28, 0)");
  context.fillStyle = haze;
  context.fillRect(0, 0, width, height);

  const gridFade = context.createLinearGradient(0, horizon, 0, height);
  gridFade.addColorStop(0, "rgba(83, 180, 193, .02)");
  gridFade.addColorStop(1, "rgba(83, 180, 193, .14)");
  context.strokeStyle = gridFade;
  context.lineWidth = 0.7;
  for (let column = -12; column <= 12; column += 1) {
    context.beginPath();
    context.moveTo(centerX + column * 2, horizon);
    context.lineTo(centerX + column * width * 0.105, height);
    context.stroke();
  }
  const gridOffset = (time * 0.000018) % 1;
  for (let row = 0; row < 13; row += 1) {
    const progress = (row / 13 + gridOffset) % 1;
    const y = horizon + Math.pow(progress, 2.15) * (height - horizon);
    context.globalAlpha = 0.25 + progress * 0.55;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  for (let index = 0; index < nodes.length; index += 1) {
    const point = nodes[index];
    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      const other = nodes[otherIndex];
      const distance = Math.hypot(point.x - other.x, point.y - other.y);
      if (distance > 112) continue;
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(other.x, other.y);
      context.strokeStyle = `rgba(93, 165, 187, ${(1 - distance / 112) * 0.12 * point.depth})`;
      context.lineWidth = 0.7;
      context.stroke();
    }
  }

  nodes.forEach((point, index) => {
    const pulse = 0.65 + (Math.sin(time / 740 + index) + 1) * 0.28;
    context.beginPath();
    context.arc(point.x, point.y, 0.7 + point.depth * pulse, 0, Math.PI * 2);
    context.fillStyle = index % 8 === 0
      ? `rgba(181, 140, 255, ${0.24 + point.depth * 0.36})`
      : `rgba(105, 224, 195, ${0.14 + point.depth * 0.38})`;
    context.fill();
  });
  context.restore();
}

function drawWalkthrough(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  step: number,
  simulationLabel: string,
) {
  const scene = step % 4;
  if (scene === 0) drawTopology(context, width, height, time, simulationLabel);
  else if (scene === 1) drawWave(context, width, height, time, 15, "baseline");
  else if (scene === 2) drawGlobe(context, width, height, time);
  else drawDevice(context, width, height, time);

  const wash = context.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, "rgba(4, 13, 23, .42)");
  wash.addColorStop(0.35, "rgba(4, 13, 23, 0)");
  wash.addColorStop(1, "rgba(4, 13, 23, .25)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  context.save();
  context.strokeStyle = "rgba(105, 224, 195, .1)";
  context.setLineDash([3, 7]);
  context.beginPath();
  context.moveTo(18, height - 23);
  context.lineTo(width - 18, height - 23);
  context.stroke();
  context.setLineDash([]);
  const progress = (time % 5000) / 5000;
  context.beginPath();
  context.arc(18 + progress * (width - 36), height - 23, 3, 0, Math.PI * 2);
  context.fillStyle = "#69e0c3";
  context.shadowColor = "#69e0c3";
  context.shadowBlur = 12;
  context.fill();
  context.restore();
}

function drawTopology(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  simulationLabel: string,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(50, Math.min(width, height) * 0.34);
  const positions = nodes.map((_, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
  });

  positions.forEach((point, index) => {
    const next = positions[(index + 1) % positions.length];
    context.strokeStyle = "rgba(91, 157, 208, 0.22)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(next.x, next.y);
    context.stroke();

    const progress = (time * 0.00008 + index / positions.length) % 1;
    context.fillStyle = "#69e0c3";
    context.beginPath();
    context.arc(
      point.x + (next.x - point.x) * progress,
      point.y + (next.y - point.y) * progress,
      2.4,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.fillStyle = "#183048";
    context.beginPath();
    context.arc(point.x, point.y, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#5b9dd0";
    context.stroke();
    context.fillStyle = "#e9f4ff";
    context.font = "9px ui-monospace, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(nodes[index], point.x, point.y);
  });

  context.fillStyle = "#69e0c3";
  context.beginPath();
  context.arc(centerX, centerY, 7 + Math.sin(time / 500) * 1.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#b8cddd";
  context.font = "11px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(simulationLabel, centerX, centerY + 25);
}

function drawWave(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  elapsed: number,
  profile: DrillProfile,
) {
  context.strokeStyle = "rgba(109, 153, 183, 0.2)";
  context.lineWidth = 1;
  for (let row = 1; row < 5; row += 1) {
    const y = (height * row) / 5;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  ["#69e0c3", "#60a5fa", "#b58cff"].forEach((color, channel) => {
    const noiseScale = profile === "noise" ? 0.23 : profile === "dropout" ? 0.07 : 0.1;
    const signalScale = elapsed >= 5 ? Math.min(1, (elapsed - 4) / 4) : 0;
    const pulseCenter = width * (0.54 + 0.08 * Math.sin(time * 0.0003));
    context.strokeStyle = color;
    context.lineWidth = 1.7;
    context.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const distance = (x - pulseCenter) / Math.max(12, width * 0.055);
      const pulse = Math.exp(-(distance * distance)) * Math.sin(distance * 5 + channel) * signalScale;
      const noise = Math.sin(x * 0.19 + time * 0.013 + channel * 7) * noiseScale;
      const signal =
        Math.sin(x * 0.035 + time * 0.0014 + channel) * 0.11 +
        Math.sin(x * 0.012 - time * 0.0008) * 0.06 +
        pulse * 0.5 +
        noise;
      const y = height * (0.32 + channel * 0.19) + signal * height;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  });
}

function drawRadar(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(20, Math.min(width, height) * 0.31);
  const axes = 5;
  for (let ring = 1; ring <= 4; ring += 1) {
    context.beginPath();
    for (let index = 0; index < axes; index += 1) {
      const angle = (index / axes) * Math.PI * 2 - Math.PI / 2;
      const distance = (radius * ring) / 4;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = "rgba(91, 157, 208, 0.25)";
    context.stroke();
  }
  context.beginPath();
  for (let index = 0; index < axes; index += 1) {
    const angle = (index / axes) * Math.PI * 2 - Math.PI / 2;
    const variation = 0.7 + 0.08 * Math.sin(time / 700 + index);
    const x = centerX + Math.cos(angle) * radius * variation;
    const y = centerY + Math.sin(angle) * radius * variation;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fillStyle = "rgba(105, 224, 195, 0.14)";
  context.strokeStyle = "#69e0c3";
  context.fill();
  context.stroke();
}

function drawGlobe(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const centerX = width * 0.52;
  const centerY = height * 0.51;
  const radius = Math.max(52, Math.min(width * 0.34, height * 0.43));
  const rotation = Math.sin(time * 0.00016) * 0.18;
  const project = (latitude: number, longitude: number) => {
    const lat = (latitude * Math.PI) / 180;
    const lon = ((longitude - 140) * Math.PI) / 180 + rotation;
    const depth = Math.cos(lat) * Math.cos(lon);
    return {
      x: centerX + radius * Math.cos(lat) * Math.sin(lon),
      y: centerY - radius * Math.sin(lat),
      depth,
    };
  };

  context.save();
  context.shadowColor = "rgba(64, 190, 211, .42)";
  context.shadowBlur = 28;
  const atmosphere = context.createRadialGradient(
    centerX - radius * 0.32,
    centerY - radius * 0.38,
    radius * 0.08,
    centerX,
    centerY,
    radius * 1.12,
  );
  atmosphere.addColorStop(0, "#1b5367");
  atmosphere.addColorStop(0.65, "#0b293e");
  atmosphere.addColorStop(1, "#071522");
  context.fillStyle = atmosphere;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
  context.clip();
  context.strokeStyle = "rgba(113, 204, 211, .19)";
  context.lineWidth = 0.7;

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    context.beginPath();
    let active = false;
    for (let longitude = -180; longitude <= 180; longitude += 3) {
      const point = project(latitude, longitude);
      if (point.depth > 0) {
        if (!active) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
        active = true;
      } else {
        active = false;
      }
    }
    context.stroke();
  }
  for (let longitude = -180; longitude < 180; longitude += 30) {
    context.beginPath();
    let active = false;
    for (let latitude = -88; latitude <= 88; latitude += 3) {
      const point = project(latitude, longitude);
      if (point.depth > 0) {
        if (!active) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
        active = true;
      } else {
        active = false;
      }
    }
    context.stroke();
  }

  const japanArc = [
    [45.5, 141.5], [42.5, 141], [39, 140.5], [36, 140], [35, 138],
    [34.5, 136], [34, 133], [33.5, 131], [32, 130], [28, 129], [26, 128],
  ] as const;
  context.beginPath();
  japanArc.forEach(([latitude, longitude], index) => {
    const point = project(latitude, longitude);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "rgba(105, 224, 195, .72)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(105, 224, 195, .9)";
  context.shadowBlur = 8;
  context.stroke();
  context.shadowBlur = 0;

  const tokyo = project(35.7, 139.7);
  if (tokyo.depth > 0) {
    const pulse = 4 + (Math.sin(time / 420) + 1) * 2;
    context.beginPath();
    context.arc(tokyo.x, tokyo.y, pulse, 0, Math.PI * 2);
    context.fillStyle = "rgba(105, 224, 195, .85)";
    context.fill();
    context.beginPath();
    context.arc(tokyo.x, tokyo.y, pulse + 7, 0, Math.PI * 2);
    context.strokeStyle = "rgba(105, 224, 195, .36)";
    context.lineWidth = 1;
    context.stroke();
  }
  context.restore();

  context.beginPath();
  context.ellipse(centerX, centerY, radius * 1.25, radius * 0.34, -0.12, 0, Math.PI * 2);
  context.strokeStyle = "rgba(93, 165, 187, .26)";
  context.lineWidth = 1;
  context.stroke();
  const orbitAngle = time * 0.00055;
  context.beginPath();
  context.arc(
    centerX + Math.cos(orbitAngle) * radius * 1.25,
    centerY + Math.sin(orbitAngle) * radius * 0.34,
    2.4,
    0,
    Math.PI * 2,
  );
  context.fillStyle = "#b58cff";
  context.shadowColor = "#b58cff";
  context.shadowBlur = 10;
  context.fill();
  context.shadowBlur = 0;

  const rim = context.createRadialGradient(centerX, centerY, radius * 0.82, centerX, centerY, radius * 1.04);
  rim.addColorStop(0, "rgba(105, 224, 195, 0)");
  rim.addColorStop(0.86, "rgba(105, 224, 195, .02)");
  rim.addColorStop(1, "rgba(105, 224, 195, .44)");
  context.fillStyle = rim;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
}

function drawDevice(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const cx = width / 2;
  const cy = height / 2 + 7;
  const size = Math.min(width * 0.24, height * 0.34, 61);
  const yaw = Math.sin(time * 0.00045) * 0.18 + 0.62;
  const pitch = -0.22;
  const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ].map(([x, y, z]) => {
    const rotatedX = x * Math.cos(yaw) - z * Math.sin(yaw);
    const rotatedZ = x * Math.sin(yaw) + z * Math.cos(yaw);
    const rotatedY = y * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
    const depth = y * Math.sin(pitch) + rotatedZ * Math.cos(pitch);
    return { x: cx + rotatedX * size, y: cy + rotatedY * size * 0.74, depth };
  });
  const faces = [
    { points: [0, 1, 2, 3], fill: "#173249" },
    { points: [4, 5, 6, 7], fill: "#1d455c" },
    { points: [0, 1, 5, 4], fill: "#23516a" },
    { points: [1, 2, 6, 5], fill: "#123046" },
    { points: [2, 3, 7, 6], fill: "#10283b" },
    { points: [3, 0, 4, 7], fill: "#194057" },
  ].sort((left, right) => {
    const averageDepth = (indices: number[]) =>
      indices.reduce((total, index) => total + vertices[index].depth, 0) / indices.length;
    return averageDepth(left.points) - averageDepth(right.points);
  });

  context.beginPath();
  context.ellipse(cx, cy + size * 0.42, size * 1.55, size * 0.44, -0.1, 0, Math.PI * 2);
  context.strokeStyle = "rgba(105, 224, 195, .3)";
  context.lineWidth = 1;
  context.stroke();
  context.beginPath();
  context.ellipse(cx, cy + size * 0.42, size * 1.1, size * 0.28, -0.1, 0, Math.PI * 2);
  context.strokeStyle = "rgba(96, 165, 250, .19)";
  context.stroke();

  for (const face of faces) {
    context.beginPath();
    face.points.forEach((index, pointIndex) => {
      const point = vertices[index];
      if (pointIndex === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fillStyle = face.fill;
    context.fill();
    context.strokeStyle = "rgba(138, 207, 220, .66)";
    context.lineWidth = 1;
    context.stroke();
  }

  const topFace = [vertices[0], vertices[1], vertices[4], vertices[5]];
  const sensorX = topFace.reduce((total, point) => total + point.x, 0) / topFace.length;
  const sensorY = topFace.reduce((total, point) => total + point.y, 0) / topFace.length;
  const sensorPulse = 3 + (Math.sin(time / 380) + 1) * 1.6;
  context.beginPath();
  context.arc(sensorX, sensorY, sensorPulse + 5, 0, Math.PI * 2);
  context.strokeStyle = "rgba(105, 224, 195, .35)";
  context.stroke();
  context.beginPath();
  context.arc(sensorX, sensorY, sensorPulse, 0, Math.PI * 2);
  context.fillStyle = "#8fffe1";
  context.shadowColor = "#69e0c3";
  context.shadowBlur = 13;
  context.fill();
  context.shadowBlur = 0;

  const scanX = cx + Math.sin(time / 800) * width * 0.2;
  context.beginPath();
  context.moveTo(scanX, 17);
  context.lineTo(scanX, height - 19);
  context.strokeStyle = "rgba(105, 224, 195, .11)";
  context.setLineDash([3, 6]);
  context.stroke();
  context.setLineDash([]);
}

function AnimatedCanvas({
  kind,
  locale,
  label,
  elapsed = 0,
  profile = "baseline",
  step = 0,
}: {
  kind: VisualKind;
  locale: Locale;
  label: string;
  elapsed?: number;
  profile?: DrillProfile;
  step?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef({ elapsed, profile, step });

  useEffect(() => {
    simulationRef.current = { elapsed, profile, step };
  }, [elapsed, profile, step]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let animation = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (time: number) => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      if (canvas.width !== Math.floor(width * scale) || canvas.height !== Math.floor(height * scale)) {
        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      if (kind === "ambient") drawAmbient(context, width, height, time);
      if (kind === "walkthrough") {
        drawWalkthrough(context, width, height, time, simulationRef.current.step, copy[locale].simulated);
      }
      if (kind === "topology") drawTopology(context, width, height, time, copy[locale].simulated);
      if (kind === "wave") {
        drawWave(context, width, height, time, simulationRef.current.elapsed, simulationRef.current.profile);
      }
      if (kind === "radar") drawRadar(context, width, height, time);
      if (kind === "device") drawDevice(context, width, height, time);
      if (kind === "globe") drawGlobe(context, width, height, time);
      if (!reducedMotion) animation = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(animation);
      animation = window.requestAnimationFrame(render);
    });
    resizeObserver.observe(canvas);
    animation = window.requestAnimationFrame(render);
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animation);
    };
  }, [kind, locale]);

  return (
    <canvas
      ref={canvasRef}
      className={`visual-canvas visual-${kind}`}
      role={kind === "ambient" ? undefined : "img"}
      aria-label={kind === "ambient" ? undefined : label}
      aria-hidden={kind === "ambient"}
    />
  );
}

function PropagationMap({
  progress,
  active,
  locale,
  profile,
  labels,
}: {
  progress: number;
  active: boolean;
  locale: Locale;
  profile: DrillProfile;
  labels: (typeof copy)["en-US"] | (typeof copy)["ja-JP"];
}) {
  const stations = [
    [120, 154], [192, 111], [254, 184], [312, 137], [371, 97],
    [412, 167], [475, 126], [220, 256], [376, 244], [507, 219],
  ];
  const radius = 16 + progress * 130;

  return (
    <div className="map-frame">
      <div className="map-meta"><span>{labels.region}</span><span>{labels.mapDescription}</span></div>
      <svg
        className="japan-map"
        viewBox="0 0 620 330"
        role="img"
        aria-label={labels.mapDescription}
        lang={locale}
      >
        <defs>
          <pattern id="map-grid" width="31" height="31" patternUnits="userSpaceOnUse">
            <path d="M 31 0 L 0 0 0 31" fill="none" stroke="rgba(89,142,173,.12)" strokeWidth="1" />
          </pattern>
          <radialGradient id="map-glow">
            <stop offset="0" stopColor="#69e0c3" stopOpacity=".24" />
            <stop offset="1" stopColor="#69e0c3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="620" height="330" fill="url(#map-grid)" />
        <ellipse cx="330" cy="210" rx="200" ry="115" fill="url(#map-glow)" opacity=".55" />
        <path
          className="landmass"
          d="M100 48 C122 38 140 43 154 53 L169 66 161 76 147 74 138 88 124 86 119 73 105 68Z
             M180 82 C196 70 217 74 231 86 L246 99 241 110 226 109 217 121 201 116 194 104 181 101Z
             M252 124 C271 112 291 116 304 130 L314 145 307 155 291 151 285 166 271 159 264 145 251 142Z
             M317 161 C336 148 359 154 370 169 L376 184 368 195 351 190 342 205 328 199 325 185 312 180Z
             M370 197 C390 187 408 195 416 209 L418 224 408 233 393 226 384 240 370 232 371 216 361 211Z
             M407 237 C423 232 435 240 439 251 L435 262 423 262 417 274 407 269 409 256 400 251Z
             M213 186 C225 180 234 184 239 193 L235 201 226 201 221 209 213 204 215 195 208 193Z
             M457 147 C467 143 474 147 476 154 L470 161 461 159Z"
        />
        <path className="trench-line" d="M259 230 C309 242 365 250 438 276" />
        <text className="map-label" x="270" y="286">{labels.mapLabel}</text>
        {stations.map(([x, y], index) => (
          <g key={index}>
            <circle
              className={`station-halo ${profile === "dropout" && index >= 7 ? "station-offline" : ""}`}
              cx={x}
              cy={y}
              r="9"
            />
            <circle
              className={`station-dot ${profile === "dropout" && index >= 7 ? "station-offline" : ""}`}
              cx={x}
              cy={y}
              r="2.6"
            />
          </g>
        ))}
        <circle cx="330" cy="220" r={radius} className={active ? "wave-ring wave-ring-active" : "wave-ring"} />
        <circle cx="330" cy="220" r="7" className="source-core" />
        <circle cx="330" cy="220" r="2" fill="#effffb" />
        <text className="source-label" x="342" y="213">{labels.sourceLabel}</text>
      </svg>
      <div className="map-legend"><span><i className="legend-source" />{labels.sourceLabel}</span><span><i className="legend-station" />{labels.stationsLabel}</span></div>
      <p className="map-footnote">{labels.mapFootnote}</p>
    </div>
  );
}

export default function Dashboard() {
  const [locale, setLocale] = useState<Locale>("en-US");
  const [liveTime, setLiveTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>("mobile");
  const [profile, setProfile] = useState<DrillProfile>("baseline");
  const [catalog, setCatalog] = useState<CatalogState>({
    status: "loading",
    events: [],
    fetchedAt: null,
    feedGeneratedAt: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState<ResearchQuestion | "fallback" | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [prefectureQuery, setPrefectureQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<JapanRegion | "all">("all");
  const [selectedPrefectureId, setSelectedPrefectureId] = useState<string>("tokyo");
  const [tourStep, setTourStep] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const text = copy[locale];
  const filteredPrefectures = japanPrefectures.filter((prefecture) => {
    const query = prefectureQuery.trim().toLocaleLowerCase();
    const matchesRegion = regionFilter === "all" || prefecture.region === regionFilter;
    const matchesQuery =
      query.length === 0 ||
      prefecture.en.toLocaleLowerCase().includes(query) ||
      prefecture.ja.includes(prefectureQuery.trim()) ||
      prefecture.capitalEn.toLocaleLowerCase().includes(query) ||
      prefecture.capitalJa.includes(prefectureQuery.trim());
    return matchesRegion && matchesQuery;
  });
  const selectedPrefecture =
    japanPrefectures.find((prefecture) => prefecture.id === selectedPrefectureId) ?? japanPrefectures[12];
  const phaseIndex =
    elapsed === 0 ? 0 : elapsed < 5 ? 1 : elapsed < 14 ? 2 : elapsed < 30 ? 3 : 4;
  const progress = elapsed / 38;
  const remaining = Math.max(0, 38 - elapsed);

  useEffect(() => {
    const updateTime = () => setLiveTime(Date.now());
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => Math.min(38, current + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: number | undefined;

    const loadCatalog = async () => {
      setRefreshing(true);
      setCatalog((current) => ({
        ...current,
        status: current.fetchedAt === null ? "loading" : current.status,
      }));
      try {
        const response = await fetch("/api/japan-catalog", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
        const payload = parseCatalogPayload(await response.json());
        if (!active) return;
        setCatalog({
          status: "ready",
          events: payload.events,
          fetchedAt: payload.fetchedAt,
          feedGeneratedAt: payload.feedGeneratedAt,
        });
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        console.error("Japan catalog refresh failed", error);
        setCatalog((current) => ({ ...current, status: "error" }));
      } finally {
        if (active) {
          setRefreshing(false);
          timer = window.setTimeout(() => setRefreshKey((key) => key + 1), 60_000);
        }
      }
    };

    void loadCatalog();
    return () => {
      active = false;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (elapsed >= 38) setRunning(false);
  }, [elapsed]);

  useEffect(() => {
    if (!tourPlaying || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setTourStep((current) => (current + 1) % text.demoClipSteps.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [text.demoClipSteps.length, tourPlaying]);

  useEffect(() => {
    document.documentElement.lang = locale;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceListening(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoiceSpeaking(false);
  }, [locale]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function runScenario() {
    if (elapsed >= 38) setElapsed(0);
    setRunning(true);
  }

  function resetScenario() {
    setRunning(false);
    setElapsed(0);
  }

  function answerAssistantQuestion(question: string) {
    const boundedQuestion = question.slice(0, 200);
    setAssistantQuery(boundedQuestion);
    setAssistantAnswer(identifyQuestion(boundedQuestion) ?? "fallback");
    setVoiceMessage("");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoiceSpeaking(false);
  }

  function askAssistant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    answerAssistantQuestion(assistantQuery);
  }

  function chooseQuestion(question: ResearchQuestion) {
    answerAssistantQuestion(text.suggestedQuestions[question]);
  }

  function toggleVoiceInput() {
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition || !window.isSecureContext) {
      setVoiceMessage(text.voiceUnsupported);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcript) answerAssistantQuestion(transcript);
        else setVoiceMessage(text.voiceNoSpeech);
      };
      recognition.onerror = (event) => {
        if (event.error === "aborted") return;
        setVoiceMessage(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? text.voiceDenied
            : event.error === "no-speech"
              ? text.voiceNoSpeech
              : text.voiceError,
        );
      };
      recognition.onend = () => {
        setVoiceListening(false);
        if (recognitionRef.current === recognition) recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      setVoiceMessage("");
      setVoiceListening(true);
      recognition.start();
    } catch (recognitionError) {
      console.error("Could not start browser speech recognition", recognitionError);
      recognitionRef.current = null;
      setVoiceListening(false);
      setVoiceMessage(text.voiceError);
    }
  }

  function toggleAssistantSpeech() {
    if (!("speechSynthesis" in window)) {
      setVoiceMessage(text.voiceOutputUnsupported);
      return;
    }
    if (voiceSpeaking) {
      window.speechSynthesis.cancel();
      setVoiceSpeaking(false);
      return;
    }
    if (assistantAnswer === null) return;
    const answer = assistantAnswer === "fallback"
      ? text.assistantFallback
      : text.assistantAnswers[assistantAnswer];
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = locale;
      utterance.rate = 0.95;
      const languagePrefix = locale.split("-")[0].toLowerCase();
      const voices = window.speechSynthesis.getVoices();
      utterance.voice =
        voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase()) ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languagePrefix}-`)) ??
        null;
      utterance.onend = () => setVoiceSpeaking(false);
      utterance.onerror = (event) => {
        setVoiceSpeaking(false);
        if (event.error !== "canceled" && event.error !== "interrupted") {
          setVoiceMessage(text.voiceOutputError);
        }
      };
      setVoiceMessage("");
      setVoiceSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch (speechError) {
      console.error("Could not play browser speech synthesis", speechError);
      setVoiceSpeaking(false);
      setVoiceMessage(text.voiceOutputError);
    }
  }

  function refreshCatalog() {
    if (!refreshing) setRefreshKey((key) => key + 1);
  }

  const formatEventTime = (timestamp: number) =>
    new Intl.DateTimeFormat(locale === "ja-JP" ? "ja-JP" : "en-GB", {
      timeZone: "Asia/Tokyo",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(timestamp);

  const formatFeedTime = (timestamp: number | null) =>
    timestamp === null ? "—" : `${formatEventTime(timestamp)} JST`;
  const formatClock = (timeZone: string) =>
    liveTime === null
      ? "—:—:—"
      : new Intl.DateTimeFormat(locale, {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(liveTime);

  return (
    <main className="shell">
      <AnimatedCanvas kind="ambient" locale={locale} label={text.ambientDescription} />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand"><span className="brand-mark">H</span><span>HYPERION <b>CORE</b></span></div>
          <span className="creator-watermark">{text.byline} <strong>Aniruddha Dhibar</strong></span>
        </div>
        <nav className="section-nav" aria-label={text.navLabel}>
          {text.nav.map((item, index) => (
            <a key={item} href={["#overview", "#catalog", "#about", "#how-it-works", "#locations", "#updates", "#offline-comms", "#assistant", "#training-lab", "#research"][index]}>{item}</a>
          ))}
        </nav>
        <div className="header-controls">
          <span className="demo-pill"><i />{text.online}</span>
          <span className="language-label">{text.language}</span>
          <div className="language-switch" role="group" aria-label={text.language}>
            <button type="button" aria-pressed={locale === "en-US"} onClick={() => setLocale("en-US")}>{text.english}</button>
            <button type="button" aria-pressed={locale === "ja-JP"} onClick={() => setLocale("ja-JP")}>{text.japanese}</button>
          </div>
        </div>
      </header>

      <section className="hero" id="overview">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="hero-copy">{text.description}</p>
        </div>
        <div className="hero-globe" aria-label={text.globeLabel}>
          <div className="hero-globe-meta">
            <span>{text.globeEyebrow}</span>
            <i><b /></i>
          </div>
          <AnimatedCanvas kind="globe" locale={locale} label={text.globeLabel} />
          <div className="hero-globe-footer">
            <span>{text.globeCaption}</span>
            <span>{text.globeStatus}</span>
          </div>
        </div>
      </section>

      <section className="time-strip" aria-label={text.clockTitle}>
        <div className="time-strip-label"><span className="status-dot" />{text.clockTitle}</div>
        <div className="time-value"><small>{text.japanTime}</small><strong>{formatClock("Asia/Tokyo")}<i>JST</i></strong></div>
        <div className="time-divider" />
        <div className="time-value"><small>{text.utcTime}</small><strong>{formatClock("UTC")}<i>UTC</i></strong></div>
      </section>

      <section className="about-section panel" id="about">
        <div className="about-copy">
          <p className="eyebrow">{text.aboutEyebrow}</p>
          <h2>{text.aboutTitle}</h2>
          <p className="scenario-description">{text.aboutBody}</p>
          <div className="about-facts">
            {text.aboutFacts.map((fact, index) => (
              <span key={fact}><i>0{index + 1}</i>{fact}</span>
            ))}
          </div>
        </div>
        <figure className="about-visual">
          <Image
            src="/images/hyperion-sensor-concept.svg"
            alt={text.aboutImageAlt}
            width={960}
            height={600}
            sizes="(max-width: 800px) 100vw, 46vw"
            className="concept-image"
          />
          <figcaption>{text.aboutImageCaption}</figcaption>
        </figure>
      </section>

      <div className="status-banner"><span className="status-dot" /><div><strong>{text.online} · {text.statusTitle}</strong><p>{text.status}</p></div><span className="status-tail">{text.simulation}</span></div>

      <section className="catalog-panel panel" id="catalog">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">{text.catalogEyebrow}</p>
            <h2>{text.catalogTitle}</h2>
            <p className="scenario-description">{text.catalogDescription}</p>
          </div>
          <button className="refresh-button" type="button" onClick={refreshCatalog} disabled={refreshing}>
            <span className={refreshing ? "refresh-icon is-refreshing" : "refresh-icon"} aria-hidden="true">↻</span>
            {refreshing ? text.refreshing : text.refresh}
          </button>
        </div>
        <div className="catalog-summary">
          <div className={`catalog-connection catalog-${catalog.status}`}><i />{text.catalogStatus[catalog.status]}</div>
          <div><small>{text.catalogCount}</small><strong>{catalog.status === "loading" && catalog.fetchedAt === null ? "—" : catalog.events.length}</strong></div>
          <div><small>{text.catalogUpdated}</small><strong className="catalog-time">{formatFeedTime(catalog.feedGeneratedAt)}</strong></div>
          <div><small>{text.catalogChecked}</small><strong className="catalog-time">{formatFeedTime(catalog.fetchedAt)}</strong></div>
        </div>
        {catalog.status === "error" && (
          <div className="catalog-error" role="status">
            <span>{text.catalogError}</span>
            <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson" target="_blank" rel="noreferrer">{text.sourceOpen} ↗</a>
          </div>
        )}
        {catalog.events.length > 0 ? (
          <div className="event-list">
            {catalog.events.map((event) => (
              <article className="event-row" key={event.id}>
                <span className="event-magnitude"><small>{text.magnitude}</small><strong>{event.magnitude.toFixed(1)}</strong></span>
                <span className="event-place"><strong>{event.place}</strong><small>{event.latitude.toFixed(2)}°, {event.longitude.toFixed(2)}° · {text.depth} {event.depthKm.toFixed(0)} km</small></span>
                <span className="event-time">{formatEventTime(event.time)} JST</span>
                <a href={event.url} target="_blank" rel="noreferrer" aria-label={`${text.openEvent}: ${event.place}`}>{text.openEvent} ↗</a>
              </article>
            ))}
          </div>
        ) : catalog.status === "ready" ? (
          <p className="catalog-empty">{text.noEvents}</p>
        ) : catalog.status === "loading" ? (
          <p className="catalog-empty catalog-loading">{text.catalogStatus.loading}</p>
        ) : null}
        <div className="catalog-disclaimer">
          <span>i</span><p>{text.catalogNote}</p>
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/" target="_blank" rel="noreferrer">{text.catalogAttribution} ↗</a>
        </div>
      </section>

      <section className="how-section panel" id="how-it-works">
        <div className="how-heading">
          <div>
            <p className="eyebrow">{text.howEyebrow}</p>
            <h2>{text.howTitle}</h2>
            <p className="scenario-description">{text.howDescription}</p>
          </div>
          <span className="how-index">PIPELINE / 04</span>
        </div>
        <div className="demo-player">
          <div className="demo-screen">
            <AnimatedCanvas
              kind="walkthrough"
              locale={locale}
              label={text.demoClipTitle}
              step={tourStep}
            />
            <div className="demo-screen-overlay">
              <span className="demo-record-label"><i />{text.demoClipEyebrow}</span>
              <span className="demo-scene-counter">{text.demoClipStep} 0{tourStep + 1} / 04</span>
            </div>
            <div className="demo-screen-caption">
              <span>HYPERION CORE <i>·</i> {text.simulated}</span>
              <strong>{text.demoClipSteps[tourStep].title}</strong>
            </div>
          </div>
          <div className="demo-player-info">
            <p className="eyebrow">{text.demoClipEyebrow}</p>
            <h3>{text.demoClipSteps[tourStep].title}</h3>
            <p>{text.demoClipSteps[tourStep].description}</p>
            <div className="demo-progress" aria-label={`${text.demoClipStep} ${tourStep + 1} of 4`}>
              {text.demoClipSteps.map((step, index) => (
                <button
                  type="button"
                  key={step.title}
                  className={index === tourStep ? "demo-progress-step is-current" : "demo-progress-step"}
                  aria-label={`${text.demoClipStep} ${index + 1}: ${step.title}`}
                  aria-pressed={index === tourStep}
                  onClick={() => setTourStep(index)}
                />
              ))}
            </div>
            <div className="demo-player-controls">
              <button
                type="button"
                className="primary-button"
                aria-label={tourPlaying ? text.demoClipPause : text.demoClipPlay}
                onClick={() => setTourPlaying((playing) => !playing)}
              >
                <span aria-hidden="true">{tourPlaying ? "Ⅱ" : "▶"}</span>
                {tourPlaying ? text.demoClipPause : text.demoClipPlay}
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  setTourPlaying(false);
                  setTourStep(0);
                }}
              >
                {text.demoClipReset}
              </button>
            </div>
          </div>
        </div>
        <div className="how-grid">
          {text.howSteps.map((step, index) => (
            <article className="how-card" key={step.title}>
              <span className="how-card-index">0{index + 1}<i /></span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < text.howSteps.length - 1 && <span className="how-connector" aria-hidden="true">→</span>}
            </article>
          ))}
        </div>
        <p className="how-footnote"><span>i</span>{text.howFootnote}</p>
      </section>

      <section className="location-section panel" id="locations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.locationsEyebrow}</p>
            <h2>{text.locationsTitle}</h2>
            <p className="scenario-description">{text.locationsDescription}</p>
          </div>
          <span className="section-counter">47 / 47</span>
        </div>
        <div className="location-tools">
          <label className="prefecture-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={prefectureQuery}
              placeholder={text.searchPrefectures}
              aria-label={text.searchPrefectures}
              onChange={(event) => setPrefectureQuery(event.target.value)}
            />
          </label>
          <span className="location-result-count">{filteredPrefectures.length} / 47 {text.prefectureCount}</span>
        </div>
        <div className="region-filters" role="group" aria-label={text.allRegions}>
          <button type="button" className={regionFilter === "all" ? "region-filter is-active" : "region-filter"} aria-pressed={regionFilter === "all"} onClick={() => setRegionFilter("all")}>{text.allRegions}</button>
          {japanRegions.map((region) => (
            <button type="button" key={region.en} className={regionFilter === region.en ? "region-filter is-active" : "region-filter"} aria-pressed={regionFilter === region.en} onClick={() => setRegionFilter(region.en)}>
              {locale === "ja-JP" ? region.ja : region.en}
            </button>
          ))}
        </div>
        <div className="prefecture-grid" aria-live="polite">
          {filteredPrefectures.length > 0 ? filteredPrefectures.map((prefecture, index) => (
            <button
              type="button"
              className={selectedPrefectureId === prefecture.id ? "prefecture-card is-selected" : "prefecture-card"}
              key={prefecture.id}
              aria-pressed={selectedPrefectureId === prefecture.id}
              style={{ "--card-index": index } as React.CSSProperties}
              onClick={() => setSelectedPrefectureId(prefecture.id)}
            >
              <span className="prefecture-region">{locale === "ja-JP" ? japanRegions.find((region) => region.en === prefecture.region)?.ja : prefecture.region}</span>
              <strong>{locale === "ja-JP" ? prefecture.ja : prefecture.en}</strong>
              <span className="prefecture-capital">{text.capitalLabel} · {locale === "ja-JP" ? prefecture.capitalJa : prefecture.capitalEn}</span>
              <code>{prefecture.lat.toFixed(4)}°N&nbsp; {prefecture.lon.toFixed(4)}°E</code>
            </button>
          )) : <p className="prefecture-empty">{text.noPrefectures}</p>}
        </div>
        <p className="reference-note"><span>i</span>{text.coordinateNote} · {locale === "ja-JP" ? selectedPrefecture.ja : selectedPrefecture.en} / {locale === "ja-JP" ? selectedPrefecture.capitalJa : selectedPrefecture.capitalEn}: {selectedPrefecture.lat.toFixed(4)}°N, {selectedPrefecture.lon.toFixed(4)}°E</p>
      </section>

      <section className="updates-section panel" id="updates">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.deskEyebrow}</p>
            <h2>{text.deskTitle}</h2>
            <p className="scenario-description">{text.deskDescription}</p>
          </div>
          <span className="updates-trust-tag"><i />{text.sourcesOnly}</span>
        </div>
        <div className="updates-grid">
          <article className="latest-event-card">
            <div className="updates-card-heading"><span>{text.latestCatalog}</span><small>{catalog.feedGeneratedAt === null ? "—" : formatFeedTime(catalog.feedGeneratedAt)}</small></div>
            {catalog.events.length > 0 ? (
              <div className="latest-event-body">
                <span className="event-magnitude"><small>{text.magnitude}</small><strong>{catalog.events[0].magnitude.toFixed(1)}</strong></span>
                <div><h3>{catalog.events[0].place}</h3><p>{formatEventTime(catalog.events[0].time)} JST · {text.depth} {catalog.events[0].depthKm.toFixed(0)} km</p></div>
                <a href={catalog.events[0].url} target="_blank" rel="noreferrer">{text.sourceOpen} ↗</a>
              </div>
            ) : (
              <p className="no-update-copy">{catalog.status === "error" ? text.catalogError : text.noLatestCatalog}</p>
            )}
          </article>
          <div className="agency-links">
            <a href="https://www.jma.go.jp/jma/en/Activities/eew1.html" target="_blank" rel="noreferrer">
              <span><small>JMA / OFFICIAL GUIDANCE</small><strong>Earthquake Early Warning</strong></span><i>↗</i>
            </a>
            <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer">
              <span><small>JMA / EARTHQUAKE INFORMATION</small><strong>Japan Meteorological Agency map</strong></span><i>↗</i>
            </a>
            <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson" target="_blank" rel="noreferrer">
              <span><small>USGS / PAST-HOUR CATALOG</small><strong>Original GeoJSON feed</strong></span><i>↗</i>
            </a>
          </div>
        </div>
      </section>

      <section className="safety-section panel" id="safety">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.safetyEyebrow}</p>
            <h2>{text.safetyTitle}</h2>
            <p className="scenario-description">{text.safetyDescription}</p>
          </div>
          <span className="safety-status-tag">{text.simulation}</span>
        </div>
        <div className="safety-grid">
          <article className="emergency-call-card">
            <p className="safety-card-label">{text.ambulanceLabel}</p>
            <strong className="emergency-number">119</strong>
            <p>{text.call119Description}</p>
            <a className="emergency-call-button" href="tel:119">{text.call119}</a>
            <a
              className="emergency-source-link"
              href="https://www.tfd.metro.tokyo.lg.jp/lfe/119/index.html"
              target="_blank"
              rel="noreferrer"
            >
              {text.emergencySource} ↗
            </a>
          </article>
          <div className="capability-card">
            <h3>{text.systemBoundaryTitle}</h3>
            <dl>
              <div><dt>{text.statusCatalog}</dt><dd className="capability-connected">{catalog.status === "ready" ? text.statusCatalogValue : text.catalogStatus[catalog.status]}</dd></div>
              <div><dt>{text.statusTelemetry}</dt><dd>{text.statusTelemetryValue}</dd></div>
              <div><dt>{text.statusPrediction}</dt><dd>{text.statusPredictionValue}</dd></div>
              <div><dt>{text.statusNotifications}</dt><dd>{text.statusNotificationsValue}</dd></div>
            </dl>
          </div>
          <article className="offline-comms-card">
            <p className="safety-card-label">{text.offlineCommsTitle}</p>
            <p>{text.offlineCommsDescription}</p>
            <p className="offline-comms-tip"><span>i</span>{text.offlineCommsTip}</p>
          </article>
        </div>
      </section>

      <OfflineComms locale={locale} />
      <TrainingLab locale={locale} />

      <section className="scenario panel">
        <div className="scenario-heading">
          <div>
            <p className="eyebrow">{text.drillEyebrow}</p>
            <h2>{text.drillTitle}</h2>
            <p className="scenario-description">{text.drillDescription}</p>
          </div>
          <span className="scenario-tag">{text.scenarioTag}</span>
        </div>
        <div className="scenario-grid">
          <div className="scenario-controls">
            <div className="profile-picker">
              <span className="profile-title">{text.profileTitle}</span>
              <div role="group" aria-label={text.profileTitle}>
                {(["baseline", "noise", "dropout"] as const).map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={profile === option}
                    onClick={() => setProfile(option)}
                  >
                    {text.profiles[option]}
                  </button>
                ))}
              </div>
              <small>{text.profileDescriptions[profile]}</small>
            </div>
            <div className="scenario-state">
              <span className={running ? "state-indicator state-running" : "state-indicator"} />
              <span><small>{text.phase}</small><strong>{text.phases[phaseIndex]}</strong></span>
            </div>
            <p className="phase-description">{text.phaseDescriptions[phaseIndex]}</p>
            <div className="scenario-clock">
              <div><small>{text.elapsedLabel}</small><strong>00:{String(elapsed).padStart(2, "0")}</strong></div>
              <div className="clock-divider" />
              <div><small>{text.remainingLabel}</small><strong>{String(remaining).padStart(2, "0")}<i>{text.remainingUnit}</i></strong></div>
            </div>
            <div className="scenario-actions">
              <button className="primary-button" type="button" onClick={running ? () => setRunning(false) : runScenario}>
                <span aria-hidden="true">{running ? "Ⅱ" : "▶"}</span>{running ? text.pause : elapsed > 0 && elapsed < 38 ? text.resume : text.start}
              </button>
              <button className="reset-button" type="button" onClick={resetScenario}>{text.restart}</button>
            </div>
            <label className="timeline-control">
              <span>{text.timelineLabel}</span>
              <input
                type="range"
                min="0"
                max="38"
                step="1"
                value={elapsed}
                aria-label={text.scrub}
                onChange={(event) => {
                  setRunning(false);
                  setElapsed(Number(event.target.value));
                }}
                style={{ "--timeline-progress": `${progress * 100}%` } as React.CSSProperties}
              />
              <span className="timeline-ticks"><i>00:00</i><i>00:38</i></span>
            </label>
            <div className="scenario-disclaimer"><span>!</span>{text.boundaryShort}</div>
          </div>
          <div className="scenario-map">
            <div className="map-heading"><div><p className="eyebrow">{text.simulation}</p><h3>{text.mapTitle}</h3></div><span className="map-live-tag"><i />{text.active}</span></div>
            <PropagationMap progress={progress} active={running} locale={locale} profile={profile} labels={text} />
            <div className="map-node-count"><span>{text.stationCount}</span><strong>{profile === "dropout" ? "07 / 10" : "10 / 10"}</strong></div>
          </div>
        </div>
        <div className="pipeline-progress" aria-label={text.phase}>
          {text.phases.slice(1).map((phase, index) => (
            <div className={`pipeline-step ${phaseIndex > index ? "step-complete" : ""} ${phaseIndex === index + 1 ? "step-current" : ""}`} key={phase}>
              <span>{phaseIndex > index ? "✓" : `0${index + 1}`}</span><small>{phase}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="assistant-panel panel" id="assistant">
        <div className="assistant-heading">
          <div>
            <p className="eyebrow">{text.assistantEyebrow}</p>
            <h2>{text.assistantTitle}</h2>
            <p className="scenario-description">{text.assistantDescription}</p>
          </div>
          <span className="assistant-mode"><i />{text.assistantMode}</span>
        </div>
        <form className="assistant-form" onSubmit={askAssistant}>
          <label className="sr-only" htmlFor="assistant-query">{text.assistantPlaceholder}</label>
          <input
            id="assistant-query"
            value={assistantQuery}
            maxLength={200}
            placeholder={text.assistantPlaceholder}
            onChange={(event) => setAssistantQuery(event.target.value)}
          />
          <button type="submit">{text.ask}<span aria-hidden="true">↗</span></button>
        </form>
        <div className="assistant-voice-controls">
          <button
            type="button"
            className={voiceListening ? "voice-button voice-listening" : "voice-button"}
            onClick={toggleVoiceInput}
            aria-pressed={voiceListening}
          >
            <span aria-hidden="true">{voiceListening ? "■" : "◉"}</span>
            {voiceListening ? text.voiceListening : text.voiceInput}
          </button>
          <button
            type="button"
            className="voice-button voice-speak-button"
            onClick={toggleAssistantSpeech}
            aria-pressed={voiceSpeaking}
            disabled={assistantAnswer === null && !voiceSpeaking}
          >
            <span aria-hidden="true">{voiceSpeaking ? "■" : "◖))"}</span>
            {voiceSpeaking ? text.voiceStop : text.voiceSpeak}
          </button>
          <p>{text.voicePrivacy}</p>
        </div>
        {voiceMessage && <p className="assistant-voice-message" role="status">{voiceMessage}</p>}
        <div className="suggested-questions">
          {(Object.keys(text.suggestedQuestions) as ResearchQuestion[]).map((question) => (
            <button type="button" key={question} onClick={() => chooseQuestion(question)}>
              {text.suggestedQuestions[question]} <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="assistant-answer" aria-live="polite">
          <div className="assistant-avatar">H</div>
          <div>
            <strong>{text.assistantTitle}</strong>
            <p>{assistantAnswer === null
              ? text.assistantDescription
              : assistantAnswer === "fallback"
                ? text.assistantFallback
                : text.assistantAnswers[assistantAnswer]}</p>
            {assistantAnswer && assistantAnswer !== "fallback" && (
              <div className="answer-citations">
                {answerSources[assistantAnswer].map((id) => {
                  const source = sourceReferences.find((item) => item.id === id);
                  const title = text.citationTitles[id];
                  return source ? <a href={source.url} key={id} target="_blank" rel="noreferrer">{title} ↗</a> : null;
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="delivery-panel panel">
        <div className="delivery-heading">
          <div>
            <p className="eyebrow">{text.deliveryEyebrow}</p>
            <h2>{text.deliveryTitle}</h2>
            <p className="scenario-description">{text.deliveryDescription}</p>
          </div>
          <span className="preview-only-badge"><i />{text.previewOnly}</span>
        </div>
        <div className="delivery-path" aria-label={text.deliveryTitle}>
          {text.deliverySteps.map((step, index) => (
            <div className="delivery-step" key={step}>
              <span className="delivery-step-index">0{index + 1}</span>
              <strong>{step}</strong>
              <small>{text.deliveryDetails[index]}</small>
              {index < text.deliverySteps.length - 1 && <span className="delivery-connector" aria-hidden="true">→</span>}
            </div>
          ))}
        </div>
        <div className="delivery-preview">
          <div className="channel-picker">
            <p className="eyebrow">{text.previewTitle}</p>
            <h3>{text.previewAvailable}</h3>
            <div className="channel-tabs" role="group" aria-label={text.previewTitle}>
              {previewChannels.map((channel) => (
                <button
                  type="button"
                  key={channel}
                  aria-pressed={previewChannel === channel}
                  onClick={() => setPreviewChannel(channel)}
                >
                  <span className={`channel-icon icon-${channel}`} aria-hidden="true">
                    {channel === "mobile" ? "▯" : channel === "web" ? "▱" : channel === "watch" ? "◷" : "▤"}
                  </span>
                  {text.previewChannels[channel]}
                </button>
              ))}
            </div>
            <p className="channel-description">{text.previewChannelDescriptions[previewChannel]}</p>
            <div className="delivery-safety-note"><span>!</span>{text.boundaryShort}</div>
          </div>
          <article className={`mock-alert-card mock-${previewChannel}`} aria-label={text.previewChannelDescriptions[previewChannel]}>
            <div className="mock-alert-top">
              <span className="mock-brand"><i />HYPERION <b>DRILL</b></span>
              <span className="mock-local-tag">{text.previewOnly}</span>
            </div>
            <div className="exercise-ribbon"><span>!</span>{text.previewLabel}</div>
            <div className="mock-alert-content">
              <p>{text.region} <span>·</span> {text.scenarioTag}</p>
              <h3>{text.previewTitle}</h3>
              <div className="mock-message">{text.previewBody}</div>
            </div>
            <div className="mock-alert-footer">
              <span>{text.previewSource}</span>
              <span>{text.simulated}</span>
            </div>
          </article>
        </div>
      </section>

      <section className="research-panel panel" id="research">
        <div className="research-heading">
          <div>
            <p className="eyebrow">{text.researchEyebrow}</p>
            <h2>{text.researchTitle}</h2>
            <p className="scenario-description">{text.researchDescription}</p>
          </div>
          <span className="research-count">{text.researchCount}</span>
        </div>
        <div className="research-grid">
          {text.sourceLinks.map((source, index) => {
            const reference = sourceReferences.find((item) => item.id === sourceLibraryIds[index]);
            if (!reference) return null;
            return (
              <article className="source-card" key={reference.id}>
                <div className="source-card-top"><span>0{index + 1}</span><small>{source.tag}</small></div>
                <h3>{source.title}</h3>
                <p>{source.description}</p>
                <div className="source-card-bottom">
                  <span>{source.publisher}</span>
                  <a href={reference.url} target="_blank" rel="noreferrer">{text.sourceOpen} ↗</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid">
        <article className="panel topology-panel">
          <div className="panel-heading"><div><p className="eyebrow">{text.simulation}</p><h2>{text.topology}</h2></div><span className="panel-index">01 / 04</span></div>
          <p className="panel-copy">{text.topologyDescription}</p>
          <AnimatedCanvas kind="topology" locale={locale} label={text.topologyDescription} />
          <div className="node-list">{nodes.map((node) => <span key={node}>{node}</span>)}</div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">{text.simulation}</p><h2>{text.waveform}</h2></div><span className="panel-index">02 / 04</span></div>
          <p className="panel-copy">{text.waveformDescription} {text.waveformProfile}</p>
          <AnimatedCanvas kind="wave" locale={locale} label={`${text.waveformDescription} ${text.waveformProfile}`} elapsed={elapsed} profile={profile} />
          <div className="legend"><span><i className="mint" />X</span><span><i className="blue" />Y</span><span><i className="violet" />Z</span></div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">{text.simulation}</p><h2>{text.radar}</h2></div><span className="panel-index">03 / 04</span></div>
          <p className="panel-copy">{text.radarDescription}</p>
          <AnimatedCanvas kind="radar" locale={locale} label={text.radarDescription} />
          <div className="dimension-list">{text.dimensions.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, "0")}</i>{item}</span>)}</div>
        </article>
        <article className="panel device-panel">
          <div className="panel-heading"><div><p className="eyebrow">{text.simulation}</p><h2>{text.device}</h2></div><span className="panel-index">04 / 04</span></div>
          <p className="panel-copy">{text.deviceDescription}</p>
          <AnimatedCanvas kind="device" locale={locale} label={text.deviceDescription} />
          <div className="device-caption"><span>{text.deviceType}</span><span>{text.deviceAxes}</span></div>
        </article>
      </section>

      <section className="boundary"><div className="boundary-icon">i</div><div><h2>{text.reviewTitle}</h2><p>{text.reviewBody}</p></div></section>
      <footer><span>{text.footer}</span><span>HYPERION CORE <i>•</i> {locale}</span></footer>
    </main>
  );
}
