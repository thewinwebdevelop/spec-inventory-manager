---
name: client-security
description: >-
  Secure client-side handling of credentials and sensitive data in OmniStock's
  Next.js web app and Flutter mobile app. Use for any client code touching
  tokens, auth flows, session state, sensitive rendering, deep links, or file
  uploads — mandatory on ★ tasks. Owned by frontend; reviewed by
  security-reviewer before merge on ★ work.
---

# Client security — the client is enemy territory

Anything in the client can be read by whoever holds the device or injects a
script. Design so that a compromised page/phone leaks as little as possible for
as short as possible.

## Web (Next.js)
- **Access token lives in memory only** (module/state). Never localStorage,
  sessionStorage, or non-httpOnly cookies — XSS reads those.
- **Refresh token: httpOnly cookie only** (server sets flags; client never
  reads it). Send the CSRF header (`X-CSRF-Token`) on every cookie-borne
  mutation, per the feature's api-spec.
- Silent refresh on 401 → retry **once**; on second failure route to login.
  Never loop, never surface raw 401 bodies.
- **No tokens/PII in URLs, query params, console.log, or error reporters.**
  Scrub before sending anything to telemetry.
- XSS surface: no `dangerouslySetInnerHTML`/raw HTML unless sanitized with an
  allowlist; user-supplied strings render as text. Keep the CSP baseline from
  devops intact — don't add `unsafe-inline`/`unsafe-eval` to make something work.
- Validate/allowlist any redirect target (`?next=` etc.) — no open redirects.

## Mobile (Flutter)
- Tokens in **flutter_secure_storage (Keychain/Keystore) only** — never
  SharedPreferences, files, or logs.
- **Clear all auth state on logout** (storage + in-memory + any cached client),
  per F-001/F-006 architecture.
- **Deep links are untrusted input**: validate route + params against an
  allowlist before acting; a link must never trigger an authenticated mutation
  directly.
- Never hand tokens to a WebView; if a flow needs web (e.g. OAuth), use the
  system browser + app-link callback.
- TLS only; no cert-validation bypass even in dev builds that could ship.
  (Cert pinning = forward-commitment, don't improvise it.)
- Consider `FLAG_SECURE`/screenshot obscuring on sensitive screens (tokens,
  financials) — flag to ux if it affects the experience.

## Both
- Client-side validation mirrors the server but **authorizes nothing** — the
  server decision is the only real one.
- No secret of any kind compiled into the client bundle (API keys, HMAC
  secrets). If a value must be secret, it belongs server-side — escalate to
  backend-api.

## Before merge (★ tasks)
- [ ] Walked this checklist against the diff; violations fixed.
- [ ] `security-reviewer` pass done (mandatory for ★ — WEB_TEAM §3.6).
- [ ] Tests cover: logout clears state; 401→refresh→retry-once; deep-link
      rejection (mobile).
