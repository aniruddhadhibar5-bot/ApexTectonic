const RENDER_ORIGIN = "https://hyperion-core-dashboard.onrender.com";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function createContentSecurityPolicy(nonce) {
  const scriptPolicy = nonce
    ? `'self' 'nonce-${nonce}'`
    : "'self'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptPolicy}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://earthquake.usgs.gov https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function secureHeaders(headers) {
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(self), camera=(), display-capture=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()",
  );
  headers.delete("X-Powered-By");
}

function rewriteLocation(headers, workerOrigin) {
  const location = headers.get("Location");
  if (!location) return;

  try {
    const target = new URL(location, RENDER_ORIGIN);
    if (target.origin === RENDER_ORIGIN) {
      headers.set(
        "Location",
        `${workerOrigin}${target.pathname}${target.search}${target.hash}`,
      );
    }
  } catch {
    headers.delete("Location");
  }
}

function addNonce(element, nonce) {
  element.setAttribute("nonce", nonce);
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const workerOrigin = incomingUrl.origin;

    if (!ALLOWED_METHODS.has(request.method)) {
      const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
      secureHeaders(headers);
      headers.set("Content-Security-Policy", createContentSecurityPolicy());
      return new Response("Method not allowed", { status: 405, headers });
    }

    const upstreamUrl = new URL(
      `${incomingUrl.pathname}${incomingUrl.search}`,
      RENDER_ORIGIN,
    );
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("Host");
    upstreamHeaders.set("X-Forwarded-Host", incomingUrl.host);
    upstreamHeaders.set("X-Forwarded-Proto", "https");

    upstreamHeaders.delete("X-Forwarded-For");
    const clientIp = request.headers.get("CF-Connecting-IP");
    if (clientIp) upstreamHeaders.set("X-Forwarded-For", clientIp);

    const origin = upstreamHeaders.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).origin === workerOrigin) {
          upstreamHeaders.set("Origin", RENDER_ORIGIN);
        }
      } catch {
        // Preserve invalid origins so the upstream same-origin validation rejects them.
      }
    }

    const referer = upstreamHeaders.get("Referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.origin === workerOrigin) {
          upstreamHeaders.set(
            "Referer",
            `${RENDER_ORIGIN}${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`,
          );
        }
      } catch {
        // Leave non-URL referrers unchanged.
      }
    }

    if (
      request.method === "GET" &&
      request.headers.get("Accept")?.includes("text/html")
    ) {
      upstreamHeaders.delete("If-None-Match");
      upstreamHeaders.delete("If-Modified-Since");
    }

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      duplex: "half",
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    secureHeaders(responseHeaders);
    rewriteLocation(responseHeaders, workerOrigin);

    const isHtml = responseHeaders.get("Content-Type")?.toLowerCase().includes("text/html");
    if (!isHtml) {
      responseHeaders.set("Content-Security-Policy", createContentSecurityPolicy());
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    const nonce = createNonce();
    responseHeaders.set("Content-Security-Policy", createContentSecurityPolicy(nonce));
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.delete("Content-Length");
    responseHeaders.delete("ETag");
    responseHeaders.delete("Last-Modified");

    if (!upstreamResponse.body) {
      return new Response(null, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    const htmlResponse = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });

    return new HTMLRewriter()
      .on("script", { element: (element) => addNonce(element, nonce) })
      .transform(htmlResponse);
  },
};
