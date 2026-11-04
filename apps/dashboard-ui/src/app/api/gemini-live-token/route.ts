import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const SYSTEM_INSTRUCTION = [
  "You are Hyperion Voice, a general bilingual English/Japanese information assistant.",
  "You are not an earthquake prediction, monitoring, warning, emergency dispatch, or safety-control system.",
  "Never claim to detect, predict, or verify an earthquake or to provide official alerts.",
  "For immediate danger, tell the user to follow Japan Meteorological Agency and local-authority instructions and call 119 for fire or ambulance emergencies when safe and available.",
  "Give concise, calm, practical preparedness information. Clearly say when information may be incomplete or out of date.",
  "Do not operate infrastructure, contact authorities, or make decisions on the user's behalf.",
].join(" ");
const LIVE_CONFIG = {
  responseModalities: ["AUDIO"],
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  systemInstruction: {
    parts: [{ text: SYSTEM_INSTRUCTION }],
  },
};

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isRateLimited(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientKey = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  for (const [key, window] of requestWindows) {
    if (now - window.startedAt >= WINDOW_MS) requestWindows.delete(key);
  }
  const current = requestWindows.get(clientKey);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    if (!current && requestWindows.size >= 1_000) {
      const oldestKey = requestWindows.keys().next().value;
      if (typeof oldestKey === "string") requestWindows.delete(oldestKey);
    }
    requestWindows.set(clientKey, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request origin was rejected.", 403);
  if (isRateLimited(request)) {
    return jsonError("Too many voice sessions were requested. Please wait a minute.", 429);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError("Live voice is not configured. Add GEMINI_API_KEY on the server.", 503);
  }

  const now = Date.now();
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 10 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model: `models/${MODEL}`,
          config: LIVE_CONFIG,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("Gemini Live token service returned a non-success status", response.status);
      return jsonError("Gemini could not start a live session. Check the server configuration.", 502);
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("name" in payload) ||
      typeof payload.name !== "string"
    ) {
      console.error("Gemini Live token response did not contain a token name");
      return jsonError("Gemini returned an unsupported session response.", 502);
    }

    return NextResponse.json(
      { token: payload.name, model: MODEL, config: LIVE_CONFIG },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to create a Gemini Live session", error);
    return jsonError("Unable to reach Gemini. Check your connection and try again.", 502);
  }
}
