"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ja-JP";
type Speaker = "user" | "assistant";
type SessionStatus = "idle" | "connecting" | "connected" | "error";
type TranscriptLine = { id: number; speaker: Speaker; text: string };
type VoiceConfig = {
  responseModalities: string[];
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  systemInstruction: { parts: Array<{ text: string }> };
};
type JsonRecord = Record<string, unknown>;

const copy = {
  "en-US": {
    launch: "Talk to voice AI",
    launcherStatus: "GEMINI LIVE · REAL-TIME",
    title: "Hyperion Voice",
    subtitle: "Bilingual conversational assistant",
    close: "Close voice assistant",
    mode: "LIVE VOICE CONVERSATION",
    model: "Gemini Live API",
    idle: "Start a live conversation when you are ready",
    connecting: "Connecting securely to Gemini…",
    connected: "Connected · audio is sent to Gemini",
    error: "The live session could not be started. Please try again.",
    ready: "READY",
    live: "LIVE",
    connectingLabel: "CONNECTING",
    offline: "OFFLINE",
    intro:
      "Speak in English or Japanese, or use the text box. Your microphone audio and messages are sent to Google Gemini while the session is active.",
    start: "Start conversation",
    stop: "End conversation",
    starting: "Starting…",
    textLabel: "Message",
    textPlaceholder: "Type a message in English or Japanese",
    send: "Send",
    emptyTranscript: "Your live conversation will appear here.",
    userLabel: "YOU",
    assistantLabel: "GEMINI · AI RESPONSE",
    privacy:
      "Live AI can be wrong and is not an official warning or earthquake prediction service. For emergencies, follow JMA/local-authority guidance; call 119 when safe and available.",
    consent: "Starting requests microphone access and sends audio to Google Gemini. Use only if you agree.",
    footer: "LIVE SESSION · NO INFRASTRUCTURE CONTROLS",
    configMissing: "Live voice is not configured. Set GEMINI_API_KEY on the server.",
    insecure: "Live voice requires HTTPS, or localhost during development.",
    microphoneUnavailable: "Microphone access is unavailable in this browser.",
    microphoneDenied: "Microphone access was not granted.",
    language: "VOICE LANGUAGES",
    languages: "English · 日本語",
  },
  "ja-JP": {
    launch: "音声AIと会話",
    launcherStatus: "GEMINI LIVE · リアルタイム",
    title: "Hyperion Voice",
    subtitle: "英語・日本語対応の会話アシスタント",
    close: "音声アシスタントを閉じる",
    mode: "リアルタイム音声会話",
    model: "Gemini Live API",
    idle: "準備ができたら会話を開始してください",
    connecting: "Geminiに安全に接続しています…",
    connected: "接続中 · 音声をGeminiに送信しています",
    error: "ライブセッションを開始できませんでした。もう一度お試しください。",
    ready: "待機中",
    live: "接続中",
    connectingLabel: "接続中",
    offline: "オフライン",
    intro:
      "英語または日本語で話すか、テキストを入力してください。セッション中、マイク音声とメッセージはGoogle Geminiに送信されます。",
    start: "会話を開始",
    stop: "会話を終了",
    starting: "接続中…",
    textLabel: "メッセージ",
    textPlaceholder: "英語または日本語で入力",
    send: "送信",
    emptyTranscript: "ライブ会話がここに表示されます。",
    userLabel: "あなた",
    assistantLabel: "GEMINI · AI応答",
    privacy:
      "ライブAIの回答は誤る可能性があり、公式警報や地震予測ではありません。緊急時は気象庁・自治体の案内に従い、安全が確保できる場合は119に連絡してください。",
    consent: "開始するとマイクへのアクセスを求め、音声をGoogle Geminiに送信します。同意する場合のみ開始してください。",
    footer: "ライブセッション · インフラ制御なし",
    configMissing: "ライブ音声は未設定です。サーバーに GEMINI_API_KEY を設定してください。",
    insecure: "ライブ音声にはHTTPSが必要です（開発中はlocalhostを使用できます）。",
    microphoneUnavailable: "このブラウザーではマイクを利用できません。",
    microphoneDenied: "マイクへのアクセスが許可されませんでした。",
    language: "音声言語",
    languages: "English · 日本語",
  },
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function isVoiceConfig(value: unknown): value is VoiceConfig {
  if (!isRecord(value)) return false;
  const instruction = value.systemInstruction;
  return (
    Array.isArray(value.responseModalities) &&
    value.responseModalities.every((item) => typeof item === "string") &&
    isRecord(value.inputAudioTranscription) &&
    isRecord(value.outputAudioTranscription) &&
    isRecord(instruction) &&
    Array.isArray(instruction.parts) &&
    instruction.parts.every((part) => isRecord(part) && typeof part.text === "string")
  );
}

function encodeBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < view.length; offset += 0x8000) {
    binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodePcm(data: string, mimeType: string, context: AudioContext) {
  const sampleRate = Number(mimeType.match(/rate=(\d+)/)?.[1] || 24_000);
  const binary = atob(data);
  const samples = new Int16Array(binary.length / 2);
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    view.setUint8(index, binary.charCodeAt(index));
  }
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true);
  }
  const audio = context.createBuffer(1, samples.length, sampleRate);
  const channel = audio.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    channel[index] = samples[index] / (samples[index] < 0 ? 32768 : 32767);
  }
  return audio;
}

export default function AiVoiceRoom({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const connectionTimerRef = useRef<number | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const lineIdRef = useRef(0);

  const addTranscript = (speaker: Speaker, value: string) => {
    const addition = value.trim();
    if (!addition) return;
    setTranscript((current) => {
      const last = current.at(-1);
      if (last?.speaker === speaker) {
        return [...current.slice(0, -1), { ...last, text: `${last.text}${addition}` }];
      }
      return [...current, { id: ++lineIdRef.current, speaker, text: addition }].slice(-30);
    });
  };

  const stopSession = () => {
    if (connectionTimerRef.current !== null) {
      window.clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Session ended");
    captureNodeRef.current?.port.close();
    captureNodeRef.current?.disconnect();
    captureSourceRef.current?.disconnect();
    muteGainRef.current?.disconnect();
    captureNodeRef.current = null;
    captureSourceRef.current = null;
    muteGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    for (const source of playbackSourcesRef.current) {
      source.stop();
      source.disconnect();
    }
    playbackSourcesRef.current.clear();
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
    nextPlaybackTimeRef.current = 0;
    setStatus("idle");
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopSession();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => () => {
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
  }, []);

  const closeRoom = () => {
    stopSession();
    setOpen(false);
  };

  const beginCapture = async (stream: MediaStream, context: AudioContext) => {
    await context.audioWorklet.addModule("/gemini-pcm-capture.js");
    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "gemini-pcm-capture");
    const muteGain = context.createGain();
    muteGain.gain.value = 0;
    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: { data: encodeBase64(event.data), mimeType: "audio/pcm;rate=16000" },
          },
        }));
      }
    };
    source.connect(capture);
    capture.connect(muteGain);
    muteGain.connect(context.destination);
    captureSourceRef.current = source;
    captureNodeRef.current = capture;
    muteGainRef.current = muteGain;
  };

  const playAudio = (data: string, mimeType: string) => {
    const context = audioContextRef.current;
    if (!context) return;
    const buffer = decodePcm(data, mimeType, context);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    playbackSourcesRef.current.add(source);
    source.onended = () => {
      playbackSourcesRef.current.delete(source);
      source.disconnect();
    };
  };

  const startSession = async () => {
    setError("");
    setTranscript([]);
    if (!window.isSecureContext) {
      setError(text.insecure);
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(text.microphoneUnavailable);
      setStatus("error");
      return;
    }

    setStatus("connecting");
    try {
      const tokenResponse = await fetch("/api/gemini-live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const payload: unknown = await tokenResponse.json();
      if (!tokenResponse.ok) {
        const detail = isRecord(payload) && typeof payload.error === "string" ? payload.error : "";
        throw new Error(tokenResponse.status === 503 ? text.configMissing : detail || text.error);
      }
      if (
        !isRecord(payload) ||
        typeof payload.token !== "string" ||
        typeof payload.model !== "string"
      ) {
        throw new Error(text.error);
      }
      const config = payload.config;
      if (!isVoiceConfig(config)) throw new Error(text.error);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      await context.resume();

      const socket = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(payload.token)}`,
      );
      socketRef.current = socket;
      connectionTimerRef.current = window.setTimeout(() => {
        if (socketRef.current === socket) {
          stopSession();
          setError(text.error);
          setStatus("error");
        }
      }, 15_000);
      socket.onopen = () => {
        socket.send(JSON.stringify({
          setup: {
            model: `models/${payload.model}`,
            ...config,
          },
        }));
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let response: JsonRecord;
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!isRecord(parsed)) return;
          response = parsed;
        } catch {
          stopSession();
          setError(text.error);
          setStatus("error");
          return;
        }

        if ("setupComplete" in response) {
          if (connectionTimerRef.current !== null) {
            window.clearTimeout(connectionTimerRef.current);
            connectionTimerRef.current = null;
          }
          setStatus("connected");
          void beginCapture(stream, context).catch(() => {
            setError(text.error);
            setStatus("error");
            stopSession();
          });
        }
        if (isRecord(response.error)) {
          stopSession();
          setError(text.error);
          setStatus("error");
          return;
        }
        const serverContent = isRecord(response.serverContent) ? response.serverContent : null;
        if (!serverContent) return;
        const inputTranscription = isRecord(serverContent.inputTranscription)
          ? serverContent.inputTranscription.text
          : null;
        const outputTranscription = isRecord(serverContent.outputTranscription)
          ? serverContent.outputTranscription.text
          : null;
        if (typeof inputTranscription === "string") addTranscript("user", inputTranscription);
        if (typeof outputTranscription === "string") addTranscript("assistant", outputTranscription);
        if (serverContent.interrupted === true) {
          for (const source of playbackSourcesRef.current) {
            source.stop();
            source.disconnect();
          }
          playbackSourcesRef.current.clear();
          nextPlaybackTimeRef.current = 0;
        }
        const modelTurn = isRecord(serverContent.modelTurn) ? serverContent.modelTurn : null;
        if (Array.isArray(modelTurn?.parts)) {
          for (const part of modelTurn.parts) {
            if (!isRecord(part) || !isRecord(part.inlineData)) continue;
            const audioData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            if (typeof audioData === "string") {
              playAudio(audioData, typeof mimeType === "string" ? mimeType : "audio/pcm;rate=24000");
            }
          }
        }
      };
      socket.onerror = () => {
        stopSession();
        setError(text.error);
        setStatus("error");
      };
      socket.onclose = () => {
        if (connectionTimerRef.current !== null) {
          window.clearTimeout(connectionTimerRef.current);
          connectionTimerRef.current = null;
        }
        if (socketRef.current === socket) {
          stopSession();
          setError(text.error);
          setStatus("error");
        }
      };
    } catch (caught) {
      stopSession();
      setStatus("error");
      if (caught instanceof DOMException && caught.name === "NotAllowedError") {
        setError(text.microphoneDenied);
      } else {
        setError(caught instanceof Error ? caught.message : text.error);
      }
    }
  };

  const sendText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    const socket = socketRef.current;
    if (!content || socket?.readyState !== WebSocket.OPEN || status !== "connected") return;
    socket.send(JSON.stringify({ realtimeInput: { text: content } }));
    addTranscript("user", `${content}\n`);
    setMessage("");
  };

  const statusText = status === "connected"
    ? text.connected
    : status === "connecting"
      ? text.connecting
      : status === "error"
        ? error || text.error
        : text.idle;
  const statusLabel = status === "connected"
    ? text.live
    : status === "connecting"
      ? text.connectingLabel
      : status === "error"
        ? text.offline
        : text.ready;

  return (
    <>
      <button className="voice-room-launcher" type="button" onClick={() => setOpen(true)}>
        <span className="voice-launcher-icon" aria-hidden="true"><i /><i /><i /></span>
        <span className="voice-launcher-copy"><strong>{text.launch}</strong><small>{text.launcherStatus}</small></span>
        <span className="voice-launcher-arrow" aria-hidden="true">↗</span>
      </button>
      {open && (
        <div
          className="voice-room-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRoom();
          }}
        >
          <section
            aria-describedby="voice-room-description"
            aria-labelledby="voice-room-title"
            aria-modal="true"
            className="voice-room-dialog"
            role="dialog"
          >
            <header className="voice-room-topbar">
              <div className="voice-room-brand">
                <span className="voice-room-brand-mark" aria-hidden="true">H</span>
                <span><strong>HYPERION <i>VOICE</i></strong><small>{text.subtitle}</small></span>
              </div>
              <div className="voice-room-topbar-actions">
                <span className="voice-room-model-tag"><i />{text.model}</span>
                <button
                  aria-label={text.close}
                  className="voice-room-close"
                  onClick={closeRoom}
                  ref={closeButtonRef}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </header>

            <div className="voice-room-content">
              <div className="voice-room-stage">
                <div className="voice-room-heading">
                  <p className="voice-room-eyebrow">{text.mode}</p>
                  <span className={`voice-room-status voice-status-${status}`}><i />{statusLabel}</span>
                </div>
                <div aria-hidden="true" className={`voice-orb-scene ${status === "connected" ? "voice-orb-speaking" : ""}`}>
                  <div className="voice-orb-grid" />
                  <div className="voice-orb-ring voice-orb-ring-outer" />
                  <div className="voice-orb-ring voice-orb-ring-mid" />
                  <div className="voice-orb-halo" />
                  <div className="voice-orb-core"><span>H</span></div>
                  <div className="voice-orb-spark voice-orb-spark-a" />
                  <div className="voice-orb-spark voice-orb-spark-b" />
                  <div className="voice-orb-spark voice-orb-spark-c" />
                </div>
                <h1 id="voice-room-title">{text.title}</h1>
                <p className="voice-room-intro" id="voice-room-description">{text.intro}</p>
                <div className="voice-room-status-card" role="status">
                  <span className="voice-room-status-light" />
                  <span><strong>{statusText}</strong><small>{status === "idle" ? text.consent : text.languages}</small></span>
                </div>
                <div className="voice-session-controls">
                  {status === "connected" ? (
                    <button className="voice-session-button voice-session-stop" onClick={stopSession} type="button">{text.stop}</button>
                  ) : (
                    <button className="voice-session-button" disabled={status === "connecting"} onClick={() => void startSession()} type="button">
                      {status === "connecting" ? text.starting : text.start}
                    </button>
                  )}
                </div>
              </div>

              <aside className="voice-room-side">
                <div className="voice-room-side-heading">
                  <p className="voice-room-eyebrow">{text.language}</p>
                  <span>{text.languages}</span>
                </div>
                <div aria-live="polite" aria-relevant="additions text" className="voice-room-transcript">
                  {transcript.length === 0 ? (
                    <div className="voice-room-empty"><span aria-hidden="true">◇</span><p>{text.emptyTranscript}</p></div>
                  ) : transcript.map((line) => (
                    <article className={`voice-room-bubble ${line.speaker === "user" ? "voice-room-user" : "voice-room-assistant"}`} key={line.id}>
                      <small>{line.speaker === "user" ? text.userLabel : text.assistantLabel}</small>
                      <p>{line.text}</p>
                    </article>
                  ))}
                </div>
                <form className="voice-text-form" onSubmit={sendText}>
                  <label className="sr-only" htmlFor="voice-message">{text.textLabel}</label>
                  <input
                    autoComplete="off"
                    disabled={status !== "connected"}
                    id="voice-message"
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={text.textPlaceholder}
                    value={message}
                  />
                  <button disabled={status !== "connected" || !message.trim()} type="submit">{text.send}</button>
                </form>
                <p className="voice-room-privacy"><span aria-hidden="true">!</span>{text.privacy}</p>
              </aside>
            </div>

            <footer className="voice-room-footer">
              <span><i />{text.footer}</span>
              <span>EN / 日本語</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
