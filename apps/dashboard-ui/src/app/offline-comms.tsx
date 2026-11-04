"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ja-JP";
type Message = {
  id: string;
  body: string;
  createdAt: number;
  direction: "local" | "remote";
  delivery: "draft" | "sent" | "received";
};
type SignalDescription = { type: "offer" | "answer"; sdp: string };
type PeerStatus = "idle" | "preparing" | "waiting" | "connecting" | "connected" | "failed";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const STORAGE_KEY = "hyperion-offline-messages-v1";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_SIGNAL_LENGTH = 20000;
const MAX_WIRE_LENGTH = MAX_MESSAGE_LENGTH * 6 + 100;

const copy = {
  "en-US": {
    eyebrow: "LOCAL-FIRST COMMUNICATION / NO CLOUD SIGNALING",
    title: "Offline-ready peer room",
    description:
      "Save notes on this device and, when both devices share a local Wi-Fi or hotspot, pair them with a one-time copy/paste code for peer-to-peer text and browser audio. The local network must be working; internet access is not required.",
    install: "Install app",
    installUnavailable: "Install from browser menu",
    installError: "Could not start app installation. Try the browser's Install or Add to Home Screen menu.",
    installHint: "Install while online first. On iPhone/iPad, use Share → Add to Home Screen; on Android/desktop, use the browser install option.",
    online: "Network available",
    offline: "Offline",
    appReady: "Offline app shell ready",
    appNotReady: "Offline app shell not installed yet",
    offlineCaveat: "Saved in this browser only (not encrypted). Clear history on shared devices. Peer delivery needs the same local network.",
    localNotes: "Device notes",
    localOnly: "LOCAL TO THIS DEVICE",
    noMessages: "No saved messages yet. Send to a connected peer or save a note locally.",
    compose: "Write a message or note…",
    send: "Send",
    saveLocal: "Save note",
    clear: "Clear local history",
    you: "You",
    peer: "Peer",
    draft: "Saved locally",
    sent: "Sent peer-to-peer",
    received: "Received peer-to-peer",
    connectTitle: "Pair devices without a server",
    connectStep1: "Both devices must be on the same Wi-Fi or personal hotspot. No STUN, TURN, cloud signaling, or account is used.",
    createInvite: "Create invite",
    createInviteHelp: "Device A creates an offer and shares the code with Device B.",
    inviteCode: "Your invite / response code",
    copyCode: "Copy code",
    shareCode: "Share code",
    pastedCode: "Paste peer code here",
    respond: "Accept invite · create response",
    applyAnswer: "Apply peer response",
    applyAnswerHelp: "Device A pastes Device B’s response here.",
    peerStatus: {
      idle: "Not paired",
      preparing: "Preparing a local connection…",
      waiting: "Waiting for peer code",
      connecting: "Connecting over local network…",
      connected: "Peer connected · local network",
      failed: "Connection failed",
    },
    peerConnected: "Connection established directly between browsers. No server relays text or audio.",
    audioTitle: "Voice call",
    call: "Start voice call",
    hangUp: "End call",
    callNeedsPeer: "Pair with a peer before starting a call.",
    micDenied: "Microphone unavailable or permission denied. Check browser permissions and try again.",
    audioNote: "Each person should start the call to send microphone audio. Requires HTTPS (or localhost), microphone permission, and a working local network; keep the app open.",
    localNetworkNote: "Offline means no internet—not no connection. This browser app cannot create a Wi-Fi network or use Wi-Fi Direct/Bluetooth calling.",
    signalError: "Could not complete local pairing. Check that the codes were exchanged correctly and both devices share the same reachable Wi-Fi/hotspot.",
    invalidSignal: "That code is not a valid invite or response.",
    storageError: "Browser storage is unavailable. Notes may not persist after closing this tab.",
    callDisconnected: "Call ended.",
    characterCount: "characters",
  },
  "ja-JP": {
    eyebrow: "ローカル優先通信 / クラウド中継なし",
    title: "オフライン対応ピアルーム",
    description:
      "メモはこの端末に保存されます。両端末が同じWi-Fiまたはテザリングに接続している場合、使い切りコードをコピーして貼り付けることで、P2Pテキストとブラウザー音声通話を利用できます。ローカルネットワークが必要ですが、インターネット接続は不要です。",
    install: "アプリをインストール",
    installUnavailable: "ブラウザーのメニューからインストール",
    installError: "インストールを開始できません。ブラウザーのインストールまたはホーム画面に追加メニューをお試しください。",
    installHint: "インターネット接続中にインストールしてください。iPhone/iPadは共有 → ホーム画面に追加、Android/デスクトップはブラウザーのインストール機能を使います。",
    online: "ネットワーク接続あり",
    offline: "オフライン",
    appReady: "オフライン用アプリを準備済み",
    appNotReady: "オフライン用アプリは未インストール",
    offlineCaveat: "このブラウザー内に保存（暗号化なし）。共有端末では履歴を削除してください。相手への送信には同じローカルネットワークが必要です。",
    localNotes: "端末内メモ",
    localOnly: "この端末内のみ",
    noMessages: "保存済みメッセージはありません。接続した相手に送信するか、端末内にメモを保存してください。",
    compose: "メッセージまたはメモを入力…",
    send: "送信",
    saveLocal: "メモを保存",
    clear: "端末内の履歴を削除",
    you: "自分",
    peer: "相手",
    draft: "端末内に保存",
    sent: "P2P送信済み",
    received: "P2P受信",
    connectTitle: "サーバーなしで端末をペアリング",
    connectStep1: "両端末を同じWi-Fiまたはテザリングに接続します。STUN、TURN、クラウド中継、アカウントは使用しません。",
    createInvite: "招待コードを作成",
    createInviteHelp: "端末Aが接続コードを作成し、端末Bに共有します。",
    inviteCode: "招待コード / 応答コード",
    copyCode: "コードをコピー",
    shareCode: "コードを共有",
    pastedCode: "相手のコードを貼り付け",
    respond: "招待を受けて応答を作成",
    applyAnswer: "相手の応答を適用",
    applyAnswerHelp: "端末Aは端末Bの応答をここに貼り付けます。",
    peerStatus: {
      idle: "未接続",
      preparing: "ローカル接続を準備中…",
      waiting: "相手のコードを待機中",
      connecting: "ローカルネットワークで接続中…",
      connected: "相手と接続済み · ローカルネットワーク",
      failed: "接続できません",
    },
    peerConnected: "ブラウザー間で直接接続しました。テキストや音声はサーバーを中継しません。",
    audioTitle: "音声通話",
    call: "音声通話を開始",
    hangUp: "通話を終了",
    callNeedsPeer: "通話の前に相手とペアリングしてください。",
    micDenied: "マイクを利用できないか、許可されていません。ブラウザーの権限を確認してください。",
    audioNote: "双方が通話を開始するとマイク音声を送れます。HTTPS（またはlocalhost）、マイクの許可、動作中のローカルネットワークが必要です。通話中はアプリを開いたままにしてください。",
    localNetworkNote: "ここでのオフラインはインターネット未接続を指します。ブラウザーアプリはWi-Fi網を作成したり、Wi-Fi Direct/Bluetooth通話を行ったりできません。",
    signalError: "ペアリングに失敗しました。コードを正しく交換し、両端末が通信可能な同じWi-Fi/テザリング上にあることを確認してください。",
    invalidSignal: "有効な招待コードまたは応答コードではありません。",
    storageError: "ブラウザーの保存領域を利用できません。タブを閉じるとメモが消える場合があります。",
    callDisconnected: "通話を終了しました。",
    characterCount: "文字",
  },
} as const;

function isSignalDescription(value: unknown): value is SignalDescription {
  if (typeof value !== "object" || value === null) return false;
  const signal = value as Record<string, unknown>;
  return (
    (signal.type === "offer" || signal.type === "answer") &&
    typeof signal.sdp === "string" &&
    signal.sdp.length > 0 &&
    signal.sdp.length <= MAX_SIGNAL_LENGTH
  );
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", handleState);
    };
    const handleState = () => {
      if (peer.iceGatheringState !== "complete") return;
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Local network candidate gathering timed out."));
    }, 12000);
    peer.addEventListener("icegatheringstatechange", handleState);
  });
}

export default function OfflineComms({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [signalCode, setSignalCode] = useState("");
  const [peerCode, setPeerCode] = useState("");
  const [peerStatus, setPeerStatus] = useState<PeerStatus>("idle");
  const [isOnline, setIsOnline] = useState(true);
  const [appInstalled, setAppInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const installPromptRef = useRef<InstallPrompt | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messagesDataRef = useRef<Message[]>([]);

  const saveMessages = useCallback((next: Message[]) => {
    messagesDataRef.current = next;
    setMessages(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageAvailable(true);
    } catch (storageError) {
      console.error("Could not persist offline messages", storageError);
      setStorageAvailable(false);
    }
  }, []);

  const appendMessage = useCallback((message: Message) => {
    const next = [...messagesDataRef.current, message].slice(-200);
    messagesDataRef.current = next;
    setMessages(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageAvailable(true);
    } catch (storageError) {
      console.error("Could not persist offline messages", storageError);
      setStorageAvailable(false);
    }
  }, []);

  const closePeer = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    audioSenderRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setCallActive(false);
  }, []);

  const configurePeer = useCallback((peer: RTCPeerConnection) => {
    peerRef.current = peer;
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setPeerStatus("connected");
        setError("");
      } else if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        setPeerStatus("failed");
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setCallActive(false);
      } else if (peer.connectionState === "connecting" || peer.connectionState === "disconnected") {
        setPeerStatus("connecting");
      }
    };
    peer.ondatachannel = (event) => {
      channelRef.current = event.channel;
      event.channel.onopen = () => {
        setPeerStatus("connected");
        setError("");
      };
      event.channel.onclose = () => {
        if (peer.connectionState !== "closed") setPeerStatus("failed");
      };
      event.channel.onmessage = (messageEvent) => {
        if (typeof messageEvent.data !== "string" || messageEvent.data.length > MAX_WIRE_LENGTH) return;
        try {
          const incoming: unknown = JSON.parse(messageEvent.data);
          if (
            typeof incoming === "object" &&
            incoming !== null &&
            "type" in incoming &&
            incoming.type === "hyperion-text" &&
            "body" in incoming &&
            typeof incoming.body === "string" &&
            incoming.body.length > 0 &&
            incoming.body.length <= MAX_MESSAGE_LENGTH
          ) {
            appendMessage({
              id: crypto.randomUUID(),
              body: incoming.body,
              createdAt: Date.now(),
              direction: "remote",
              delivery: "received",
            });
          }
        } catch (parseError) {
          console.error("Ignored malformed peer message", parseError);
        }
      };
    };
    peer.ontrack = (event) => {
      const audio = remoteAudioRef.current;
      if (!audio) return;
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch((playError: unknown) => {
        console.error("Remote audio autoplay was blocked", playError);
        setError(text.audioNote);
      });
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        setPeerStatus("failed");
        setError(text.signalError);
      }
    };
  }, [appendMessage, text.audioNote, text.signalError]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    const installed = () => setAppInstalled(true);
    const installable = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPrompt;
      setCanInstall(true);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("beforeinstallprompt", installable);
    if (window.matchMedia("(display-mode: standalone)").matches) setAppInstalled(true);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setAppInstalled(true))
        .catch((registrationError: unknown) => {
          console.error("Offline app-shell registration failed", registrationError);
          const currentLocale = document.documentElement.lang === "ja-JP" ? "ja-JP" : "en-US";
          setError(copy[currentLocale].appNotReady);
        });
    }
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        const validMessages = stored.filter((message): message is Message =>
          typeof message === "object" &&
          message !== null &&
          "id" in message &&
          typeof message.id === "string" &&
          "body" in message &&
          typeof message.body === "string" &&
          message.body.length <= MAX_MESSAGE_LENGTH &&
          "createdAt" in message &&
          typeof message.createdAt === "number" &&
          "direction" in message &&
          (message.direction === "local" || message.direction === "remote") &&
          "delivery" in message &&
          (message.delivery === "draft" || message.delivery === "sent" || message.delivery === "received")
        ).slice(-200);
        messagesDataRef.current = validMessages;
        setMessages(validMessages);
      }
    } catch (storageError) {
      console.error("Could not load offline messages", storageError);
      setStorageAvailable(false);
    }
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("beforeinstallprompt", installable);
      closePeer();
    };
  }, [closePeer]);

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function installApp() {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") setAppInstalled(true);
      installPromptRef.current = null;
      setCanInstall(false);
    } catch (installError) {
      console.error("Could not prompt to install the offline app", installError);
      setError(text.installError);
    }
  }

  function makePeerConnection(): RTCPeerConnection {
    closePeer();
    const peer = new RTCPeerConnection({ iceServers: [] });
    configurePeer(peer);
    const audio = peer.addTransceiver("audio", { direction: "sendrecv" });
    audioSenderRef.current = audio.sender;
    return peer;
  }

  async function createInvite() {
    setError("");
    setPeerStatus("preparing");
    setSignalCode("");
    try {
      const peer = makePeerConnection();
      const channel = peer.createDataChannel("hyperion-text", { ordered: true });
      channelRef.current = channel;
      channel.onopen = () => {
        setPeerStatus("connected");
        setError("");
      };
      channel.onclose = () => {
        if (peer.connectionState !== "closed") setPeerStatus("failed");
      };
      channel.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data.length > MAX_WIRE_LENGTH) return;
        try {
          const incoming: unknown = JSON.parse(event.data);
          if (
            typeof incoming === "object" &&
            incoming !== null &&
            "type" in incoming &&
            incoming.type === "hyperion-text" &&
            "body" in incoming &&
            typeof incoming.body === "string" &&
            incoming.body.length > 0 &&
            incoming.body.length <= MAX_MESSAGE_LENGTH
          ) {
            appendMessage({ id: crypto.randomUUID(), body: incoming.body, createdAt: Date.now(), direction: "remote", delivery: "received" });
          }
        } catch (parseError) {
          console.error("Ignored malformed peer message", parseError);
        }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      if (!peer.localDescription) throw new Error("Local offer could not be created.");
      setSignalCode(JSON.stringify(peer.localDescription));
      setPeerStatus("waiting");
    } catch (pairingError) {
      console.error("Could not create peer invite", pairingError);
      closePeer();
      setPeerStatus("failed");
      setError(text.signalError);
    }
  }

  function readSignalCode(): SignalDescription | null {
    if (peerCode.length > MAX_SIGNAL_LENGTH) return null;
    try {
      const signal: unknown = JSON.parse(peerCode.trim());
      return isSignalDescription(signal) ? signal : null;
    } catch (parseError) {
      console.error("Could not parse peer pairing code", parseError);
      return null;
    }
  }

  async function acceptInvite() {
    setError("");
    const signal = readSignalCode();
    if (!signal || signal.type !== "offer") {
      setError(text.invalidSignal);
      return;
    }
    setPeerStatus("preparing");
    setSignalCode("");
    try {
      const peer = makePeerConnection();
      await peer.setRemoteDescription(signal);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGathering(peer);
      if (!peer.localDescription) throw new Error("Local response could not be created.");
      setSignalCode(JSON.stringify(peer.localDescription));
      setPeerStatus("waiting");
    } catch (pairingError) {
      console.error("Could not accept peer invite", pairingError);
      closePeer();
      setPeerStatus("failed");
      setError(text.signalError);
    }
  }

  async function applyResponse() {
    setError("");
    const signal = readSignalCode();
    const peer = peerRef.current;
    if (!signal || signal.type !== "answer" || !peer || peer.signalingState !== "have-local-offer") {
      setError(text.invalidSignal);
      return;
    }
    try {
      await peer.setRemoteDescription(signal);
      setPeerStatus("connecting");
      setPeerCode("");
    } catch (pairingError) {
      console.error("Could not apply peer response", pairingError);
      setPeerStatus("failed");
      setError(text.signalError);
    }
  }

  async function copySignalCode() {
    if (!signalCode) return;
    try {
      await navigator.clipboard.writeText(signalCode);
      setError("");
    } catch (clipboardError) {
      console.error("Could not copy pairing code", clipboardError);
      setError(text.invalidSignal);
    }
  }

  async function shareSignalCode() {
    if (!signalCode) return;
    if (!navigator.share) {
      await copySignalCode();
      return;
    }
    try {
      await navigator.share({ title: "Hyperion Core peer pairing", text: signalCode });
      setError("");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      console.error("Could not share the peer pairing code", shareError);
      setError(text.invalidSignal);
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`${MAX_MESSAGE_LENGTH} ${text.characterCount}`);
      return;
    }
    const channel = channelRef.current;
    const connected = channel?.readyState === "open";
    if (connected) {
      try {
        channel.send(JSON.stringify({ type: "hyperion-text", body }));
      } catch (sendError) {
        console.error("Could not send peer message", sendError);
        setError(text.signalError);
        return;
      }
    }
    appendMessage({
      id: crypto.randomUUID(),
      body,
      createdAt: Date.now(),
      direction: "local",
      delivery: connected ? "sent" : "draft",
    });
    setDraft("");
    setError("");
  }

  async function toggleCall() {
    if (callActive) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      try {
        await audioSenderRef.current?.replaceTrack(null);
      } catch (audioError) {
        console.error("Could not stop the local audio track", audioError);
      }
      setCallActive(false);
      setError(text.callDisconnected);
      return;
    }
    if (peerStatus !== "connected" || !audioSenderRef.current) {
      setError(text.callNeedsPeer);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(text.audioNote);
      return;
    }
    if (remoteAudioRef.current) {
      void remoteAudioRef.current.play().catch((playError: unknown) => {
        console.error("Remote audio playback could not start", playError);
      });
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      await audioSenderRef.current.replaceTrack(stream.getAudioTracks()[0] ?? null);
      setCallActive(true);
      setError("");
      if (remoteAudioRef.current) void remoteAudioRef.current.play().catch((playError: unknown) => {
        console.error("Remote audio playback requires a user gesture", playError);
      });
    } catch (audioError) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      console.error("Could not start local voice call", audioError);
      setError(text.micDenied);
    }
  }

  const connected = peerStatus === "connected";

  return (
    <section className="offline-comms-section panel" id="offline-comms">
      <div className="section-heading offline-comms-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.title}</h2>
          <p className="scenario-description">{text.description}</p>
        </div>
        <button className="install-app-button" type="button" onClick={installApp} disabled={!canInstall}>
          {appInstalled ? text.appReady : canInstall ? text.install : text.installUnavailable}
        </button>
      </div>
      <div className={`offline-app-state ${isOnline ? "is-online" : "is-offline"}`}>
        <span className="offline-state-dot" />
        <strong>{isOnline ? text.online : text.offline}</strong>
        <span>{storageAvailable ? text.offlineCaveat : text.storageError}</span>
      </div>
      <div className="offline-comms-grid">
        <section className="local-chat-panel">
          <div className="offline-panel-heading">
            <div><p className="safety-card-label">{text.localOnly}</p><h3>{text.localNotes}</h3></div>
            <button type="button" className="clear-history-button" onClick={() => saveMessages([])} disabled={messages.length === 0}>{text.clear}</button>
          </div>
          <div className="local-message-list" ref={messageListRef} aria-live="polite">
            {messages.length === 0 ? <p className="local-message-empty">{text.noMessages}</p> : messages.map((message) => (
              <article className={`local-message ${message.direction === "local" ? "message-outgoing" : "message-incoming"}`} key={message.id}>
                <div className="local-message-meta">
                  <strong>{message.direction === "local" ? text.you : text.peer}</strong>
                  <time dateTime={new Date(message.createdAt).toISOString()}>{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(message.createdAt)}</time>
                </div>
                <p>{message.body}</p>
                <small>{text[message.delivery]}</small>
              </article>
            ))}
          </div>
          <form className="local-message-form" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="offline-message">{text.compose}</label>
            <textarea id="offline-message" value={draft} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => setDraft(event.target.value)} placeholder={text.compose} rows={2} />
            <div className="local-message-actions">
              <span>{draft.length} / {MAX_MESSAGE_LENGTH} {text.characterCount}</span>
              <button type="submit" className="send-local-button" disabled={!draft.trim()}>{connected ? text.send : text.saveLocal}</button>
            </div>
          </form>
        </section>
        <section className="peer-connect-panel">
          <div className="offline-panel-heading">
            <div><p className="safety-card-label">{text.connectTitle}</p><h3>{text.peerStatus[peerStatus]}</h3></div>
            <span className={`peer-status-indicator ${connected ? "peer-connected" : ""}`} />
          </div>
          <p className="peer-step-note">{text.connectStep1}</p>
          <button type="button" className="create-invite-button" onClick={createInvite} disabled={peerStatus === "preparing"}>{text.createInvite}</button>
          <p className="peer-help-text">{text.createInviteHelp}</p>
          <label className="signal-label" htmlFor="peer-code">{text.pastedCode}</label>
          <textarea id="peer-code" value={peerCode} onChange={(event) => setPeerCode(event.target.value)} placeholder={text.pastedCode} rows={4} maxLength={MAX_SIGNAL_LENGTH} spellCheck={false} />
          <div className="peer-code-actions">
            <button type="button" onClick={acceptInvite} disabled={!peerCode.trim() || peerStatus === "preparing"}>{text.respond}</button>
            <button type="button" onClick={applyResponse} disabled={!peerCode.trim() || peerStatus === "preparing"}>{text.applyAnswer}</button>
          </div>
          <p className="peer-help-text">{text.applyAnswerHelp}</p>
          {signalCode && (
            <div className="signal-output">
              <label className="signal-label" htmlFor="signal-code">{text.inviteCode}</label>
              <textarea id="signal-code" readOnly value={signalCode} rows={4} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="copy-signal-button" onClick={shareSignalCode}>{text.shareCode}</button>
              <button type="button" className="copy-signal-button" onClick={copySignalCode}>{text.copyCode}</button>
            </div>
          )}
          {connected && (
            <div className="peer-connected-note">
              <p>{text.peerConnected}</p>
              <h4>{text.audioTitle}</h4>
              <button type="button" className={callActive ? "hangup-call-button" : "start-call-button"} onClick={toggleCall}>
                {callActive ? text.hangUp : text.call}
              </button>
              <p className="peer-help-text">{text.audioNote}</p>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay playsInline />
        </section>
      </div>
      <p className="offline-network-limit"><span>i</span>{canInstall || !appInstalled ? text.installHint : text.localNetworkNote}</p>
      {error && <p className="offline-comms-error" role="status">{error}</p>}
    </section>
  );
}
