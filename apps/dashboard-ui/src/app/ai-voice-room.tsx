"use client";

import { useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ja-JP";

const copy = {
  "en-US": {
    launch: "Open voice AI",
    launcherStatus: "GEMINI LIVE · PREVIEW",
    title: "Hyperion Voice",
    subtitle: "Bilingual conversational assistant",
    close: "Close voice assistant",
    connected: "MODEL NOT CONNECTED",
    mode: "REAL-TIME VOICE EXPERIENCE",
    model: "Gemini Live API",
    waiting: "Awaiting secure model configuration",
    intro:
      "A Gemini-style voice room is ready to preview. A live conversation is not connected yet.",
    privacy:
      "Preview mode does not request microphone access, record audio, or send messages to Google. A live Gemini session needs a secure server-side integration and credentials.",
    preview: "Show sample conversation",
    hidePreview: "Hide sample",
    sampleTag: "SCRIPTED UI PREVIEW · NOT A LIVE AI RESPONSE",
    userLabel: "YOU · SAMPLE",
    assistantLabel: "HYPERION · PREVIEW",
    sampleQuestion: "How will this assistant help during an earthquake?",
    sampleAnswer:
      "This is a scripted interface preview, not a Gemini response. Follow Japan Meteorological Agency and local-authority guidance for real emergencies.",
    liveDisabled: "Live voice will be available after Gemini is configured",
    language: "VOICE LANGUAGES",
    languages: "English · 日本語",
    footer: "NO AUDIO CAPTURED · NO MODEL CONNECTION",
  },
  "ja-JP": {
    launch: "音声AIを開く",
    launcherStatus: "GEMINI LIVE · プレビュー",
    title: "Hyperion Voice",
    subtitle: "二言語対応の会話型アシスタント",
    close: "音声アシスタントを閉じる",
    connected: "モデル未接続",
    mode: "リアルタイム音声体験",
    model: "Gemini Live API",
    waiting: "安全なモデル設定を待機中",
    intro:
      "Gemini風の音声ルームをプレビューできます。現在、ライブ会話には接続されていません。",
    privacy:
      "プレビューモードではマイク許可を求めず、音声の録音やGoogleへのメッセージ送信を行いません。ライブGeminiセッションには安全なサーバー側連携と認証情報が必要です。",
    preview: "会話サンプルを表示",
    hidePreview: "サンプルを閉じる",
    sampleTag: "画面用の台本プレビュー · AIの実回答ではありません",
    userLabel: "あなた · サンプル",
    assistantLabel: "HYPERION · プレビュー",
    sampleQuestion: "地震の時、このアシスタントはどう役立ちますか？",
    sampleAnswer:
      "これは画面表示用の台本であり、Geminiの回答ではありません。実際の緊急時は、気象庁や自治体の案内に従ってください。",
    liveDisabled: "Geminiの設定後にライブ音声を利用できます",
    language: "音声言語",
    languages: "English · 日本語",
    footer: "音声取得なし · モデル未接続",
  },
} as const;

export default function AiVoiceRoom({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

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
            if (event.target === event.currentTarget) setOpen(false);
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
                  onClick={() => setOpen(false)}
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
                  <span className="voice-room-status"><i />{text.connected}</span>
                </div>
                <div aria-hidden="true" className={`voice-orb-scene ${showPreview ? "voice-orb-speaking" : ""}`}>
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
                <div className="voice-room-status-card">
                  <span className="voice-room-status-light" />
                  <span><strong>{text.waiting}</strong><small>{text.liveDisabled}</small></span>
                </div>
              </div>

              <aside className="voice-room-side">
                <div className="voice-room-side-heading">
                  <p className="voice-room-eyebrow">{text.language}</p>
                  <span>{text.languages}</span>
                </div>
                <div aria-live="polite" className="voice-room-transcript">
                  {showPreview ? (
                    <>
                      <p className="voice-room-preview-tag">{text.sampleTag}</p>
                      <article className="voice-room-bubble voice-room-user">
                        <small>{text.userLabel}</small>
                        <p>{text.sampleQuestion}</p>
                      </article>
                      <article className="voice-room-bubble voice-room-assistant">
                        <small>{text.assistantLabel}</small>
                        <p>{text.sampleAnswer}</p>
                      </article>
                    </>
                  ) : (
                    <div className="voice-room-empty">
                      <span aria-hidden="true">◇</span>
                      <p>{text.intro}</p>
                    </div>
                  )}
                </div>
                <button
                  aria-expanded={showPreview}
                  className="voice-room-preview-button"
                  onClick={() => setShowPreview((visible) => !visible)}
                  type="button"
                >
                  <span aria-hidden="true">{showPreview ? "−" : "＋"}</span>
                  {showPreview ? text.hidePreview : text.preview}
                </button>
                <p className="voice-room-privacy"><span aria-hidden="true">i</span>{text.privacy}</p>
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
