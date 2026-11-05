# Cloudflare security edge

This Worker proxies requests to the fixed Render origin and adds HTTPS, CSP,
anti-framing, MIME-sniffing, referrer, and browser-permission headers. It does
not modify the application source. HTML documents get a per-response nonce
added to their scripts; other response types get a same-origin CSP.

## Deploy to a free `workers.dev` URL

1. Sign in to a Cloudflare account and enable its `workers.dev` subdomain in
   **Workers & Pages**.
2. From the repository root, install Wrangler locally or use `npx` to invoke it:

   ```powershell
   npx wrangler login
   npx wrangler deploy --config security/cloudflare-worker/wrangler.toml
   ```

3. Open the `workers.dev` URL printed by Wrangler and verify the site, catalog,
   offline app shell, peer room, and Gemini Live flow (if configured).
4. Inspect the document response:

   ```powershell
   curl.exe -sS -D - -o NUL https://hyperion-core-secure-edge.<your-subdomain>.workers.dev/
   ```

The Worker URL gets security headers. The original Render URL remains directly
reachable and does **not** receive these edge headers; it must not be described
as fully protected by this proxy. This Worker does not configure DNS, MX/SPF,
Render firewall rules, or origin access restrictions. Do not disable the
Render URL unless you have another supported way to secure and restrict the
origin.

The CSP deliberately permits inline styles for the existing UI and allows
same-origin scripts alongside per-response nonces for inline scripts. Review
the policy again if the app adds third-party scripts, frames, or other external
resources.
