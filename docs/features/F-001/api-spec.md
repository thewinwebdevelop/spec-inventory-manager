---
doc: F-001 api-spec — auth contract (signup/login/refresh/logout/sessions/admin-reset)
owner: "@backend-api"
signoff: approved     # pending | approved
---

# F-001 — API design (Gate 2)

> Seam between FE↔BE (OpenAPI, [docs/02](../../02-architecture.md)). Drives ux wireframe +
> qa test plan. Grounded in [architecture.md](./architecture.md) + [data-model.md](./data-model.md).
> **All auth endpoints are org-agnostic** (arch §1): no `X-Org-Id`, no org in tokens. Org
> context begins in F-002/F-003, *after* these endpoints authenticate the user.

---

## 0. Token transport — LOCKED decision (resolves the pre-contract hold)

Per coordinator + frontend recommendation, locked:

0. **Client declares its transport at login** (fixes the XSS leak in H-1). The login request
   carries `{ tokenTransport: "cookie" | "body" }` (**default `body`** if omitted, for mobile
   / non-browser compatibility). The chosen transport governs how *both* `login` and the
   subsequent `refresh` responses deliver the refresh token — the server never emits the
   plaintext refresh token on both channels at once (see item 4).
1. **Web = httpOnly cookie for the refresh token.** With `tokenTransport: "cookie"`,
   `POST /auth/login` and `POST /auth/refresh` set the refresh token as an
   **`httpOnly; Secure; SameSite=Strict` cookie** (name `omni_rt`, **`Path=/auth`**,
   `Max-Age`=60d) and the JSON body field `refreshToken` is **`null`**. Out of JS reach →
   XSS-resistant (arch §9). **`Path=/auth`** (not `/auth/refresh`) is required so the browser
   also sends `omni_rt` to `/auth/logout` and `/auth/sessions` — otherwise web logout /
   session-current-marker silently no-op (C-1). The cookie is still off every domain route
   (only `/auth/*` matches).
2. **Mobile = secure storage.** With `tokenTransport: "body"` (mobile / F-006, and the
   default), the server sets **no** refresh cookie and returns the plaintext refresh token in
   the response **body** field `refreshToken`; the client stores it in Keychain/Keystore.
3. **`/auth/refresh` is dual-transport.** It accepts the refresh token from **either** the
   `omni_rt` cookie **or** a JSON body field, and routes accordingly. Resolution order:
   **cookie first, then body.** If both are present, cookie wins (web path); if neither →
   `401`. The refresh response follows the transport of the presented token (cookie in →
   cookie out + `refreshToken: null`; body in → body out, no cookie).
4. **One response schema, single active channel.** Login/refresh responses **always contain
   the `refreshToken` field** (single schema, no per-client branching), but it is **populated
   on exactly one transport**: `cookie` transport → cookie carries the token, body
   `refreshToken` is `null`; `body` transport → body `refreshToken` holds the token, no
   cookie set. This closes H-1: an XSS payload on the web origin can trigger `/auth/refresh`
   but the rotated plaintext is **never** in a JS-readable place (it's in the httpOnly cookie,
   body is `null`), so it cannot be exfiltrated.
5. **Access token** is **never** a cookie — it is always in the response body and sent by
   the client as `Authorization: Bearer <access>`. (It's used on every domain request across
   both platforms; Bearer keeps it uniform and cookie-CSRF-free.)

### CSRF on `/auth/refresh` (cookie path only)
Because the web refresh path is cookie-borne, it needs CSRF protection (Bearer paths do
not — they're immune by construction):
- `SameSite=Strict` on `omni_rt` is the primary defense (browser won't send it cross-site).
- **Plus** a **double-submit CSRF token**: `/auth/login` (when `tokenTransport: "cookie"`)
  also sets a **non-httpOnly** `omni_csrf` cookie (`Secure; SameSite=Strict; Path=/auth`,
  matching `omni_rt`'s scope); the web client echoes it in an `X-CSRF-Token` header on
  `/auth/refresh`, `/auth/logout`, and `/auth/change-password`; server rejects (`403`) if
  header ≠ cookie.
- **When the CSRF check applies (N-3, precise rule):** the CSRF check applies **whenever the
  refresh token is resolved from the `omni_rt` cookie** (the web / cookie path) — it is keyed
  on *which transport authenticated the refresh token*, **not** on whether a body field
  happens to be present. So "mobile skips CSRF" is really "the **body-transport** path skips
  CSRF" (no ambient cookie authority to abuse); if `omni_rt` is presented, CSRF is enforced
  even if a body `refreshToken` is also sent (and per §0 item 3, cookie wins there anyway).
- **Dev-CORS:** browser origins are same-site in prod; for local dev the API allows the web
  dev origin with `credentials: true` (cookies) — exact origin list is **@devops** env
  config, flagged below. `SameSite=Strict` + explicit allowed-origin (never `*` with
  credentials) is the rule.

> Frontend confirmed non-blocking on CSRF/dev-CORS/response-shape — this section locks them
> so ux/qa can finalize.

---

## 1. Endpoints

| # | Method | Path | Description | Auth |
|---|--------|------|-------------|------|
| 1 | POST | `/auth/signup` | create user (email+password) | public (IP throttle) |
| 2 | POST | `/auth/login` | authenticate → tokens | public (IP+acct throttle) |
| 3 | POST | `/auth/refresh` | rotate refresh → new token pair | refresh token (cookie or body) |
| 4 | POST | `/auth/logout` | revoke current session (family) | refresh token (cookie or body) |
| 5 | POST | `/auth/logout-all` | revoke **all** the user's sessions | access token (Bearer) |
| 6 | GET | `/auth/sessions` | list the user's live sessions/devices | access token (Bearer) |
| 7 | POST | `/auth/change-password` | user changes own password (US-6, D-008) | access token (Bearer) |
| 8 | POST | `/orgs/{orgId}/members/{userId}/reset-password` | admin resets a member's password | access token + capability `manage_members` (F-003) |

> Endpoint 8 is org-scoped (arch §10) — it is the **one** auth-related action that lives
> under an org path because the admin's authority derives from a shared `Membership`. Its
> capability guard is F-003's; F-001 defines the effect (set hash + revoke all target
> families + audit event).

---

## 2. Schemas & behavior

### 2.1 `POST /auth/signup`  (US-1)
**Req** `{ email: string, password: string }`
**201** `{ userId, email, verified: false }` — no tokens (client then calls `/auth/login`,
or we may auto-issue; **MVP: no auto-login, return 201 then client logs in** to keep signup
and session issuance separate). *[open: auto-login on signup? small backend call — defaulting
to explicit login; ux confirm the flow copy.]*
**Validation:** email format + normalized (lowercase/trim); password ≥8 chars, ≤128, not in
breached list (arch §5.2).
**Errors:**
- `409 EMAIL_TAKEN` — duplicate email (the one *necessary* enumeration leak, Gate 1 §4;
  minimal Thai message).
- `422 PASSWORD_TOO_SHORT` / `422 PASSWORD_BREACHED` / `422 EMAIL_INVALID`.
- `429 RATE_LIMITED` (+`Retry-After`) — IP throttle.
- `415 UNSUPPORTED_MEDIA_TYPE` — non-JSON `Content-Type` (login-CSRF defense, §3 L-2).

### 2.2 `POST /auth/login`  (US-2)
**Req** `{ email, password, deviceId?: string, tokenTransport?: "cookie" | "body" }`
(`deviceId` = client session label, arch §4; `tokenTransport` = refresh-token delivery
channel per §0, **default `body`** — web sends `"cookie"`, mobile omits or sends `"body"`).
**200**
```
{ accessToken, refreshToken, expiresIn: 900, tokenType: "Bearer" }
```
- `tokenTransport: "cookie"` (web) → sets `omni_rt` (httpOnly, `Path=/auth`) + `omni_csrf`
  (readable, `Path=/auth`) cookies; body **`refreshToken: null`** (H-1 — token is in the
  cookie, never JS-readable).
- `tokenTransport: "body"` (mobile / default) → **no** cookies set; body `refreshToken`
  holds the plaintext token for secure-storage.

Login starts a new token family with an absolute **90-day lifetime cap** (`familyExpiresAt`,
D-007) that rotation inherits unchanged — the session forces re-login at most 90d after this
login regardless of activity (arch §2.3). Not surfaced in the response body; it manifests
later as an ordinary refresh expiry (§2.3).
**Errors (enumeration-safe — arch §9):**
- `401 INVALID_CREDENTIALS` — wrong password **or** unknown email: **identical** generic
  response + timing (dummy argon2 verify on unknown email). Never reveal which.
- `429 RATE_LIMITED` (+`Retry-After` seconds) — IP or account backoff tripped (**always
  `429`, never folded into the `401` above** — M-1). The account counter keys on the
  **submitted** normalized email whether or not a user exists, so a nonexistent email and a
  real one hit `429` identically → no 429-differential existence oracle. UX shows a
  **countdown** with copy "รอสักครู่แล้วลองใหม่" — **not** "บัญชีถูกล็อก" (per UX/product
  D-005; backoff self-heals, never a permanent lock).
- `415 UNSUPPORTED_MEDIA_TYPE` — non-JSON `Content-Type` (login-CSRF defense, §3 L-2).

### 2.3 `POST /auth/refresh`  (US-3) — dual-transport, rotation
**Req:** refresh token via **`omni_rt` cookie** (web) **or** body `{ refreshToken }` (mobile).
Web also sends `X-CSRF-Token` header (must equal `omni_csrf` cookie). Optional body
`{ deviceId }` echoed for continuity.
**200** — same shape as login (new `accessToken` + **new** rotated refresh token — rotation,
arch §3.1). Delivery follows the **presented** transport (§0 item 3): cookie in → re-sets
`omni_rt` with the rotated value, body `refreshToken: null`; body in → body `refreshToken`
holds the rotated token, no cookie. The rotated plaintext is thus never in a JS-readable
place on the cookie transport (H-1).
**Errors:**
- `401 INVALID_REFRESH` — token unknown / expired / not the current member of its family;
  **or** the **family-lifetime cap reached** (`familyExpiresAt` passed — D-007: the chain hit
  its absolute 90-day ceiling → rotation refused, client re-logins; ordinary session expiry,
  no family revocation, no audit event); **or** the immediate-predecessor **within the
  reuse-leeway window** (arch §3.5, D-011): a just-rotated predecessor replayed ≤60s after its
  rotation is a benign retry (lost response / multi-tab) → `401 INVALID_REFRESH` **without**
  family revocation (client re-refreshes with its current token / cookie and continues).
- `401 REFRESH_REUSE_DETECTED` — presented a **consumed/revoked** token **outside** the
  leeway window (older predecessor or any deeper ancestor) → server has **revoked the entire
  family** (arch §3.3, committed before responding — H-3) + emitted `auth.refresh.reuse_detected`
  for F-005. Client must re-login. *(Same-shape as `INVALID_REFRESH` on the wire to avoid
  signalling attackers; internally distinguished for audit. **Decision: return generic
  `401 INVALID_REFRESH` to the client**, log the reuse distinctly server-side.)*
- `403 CSRF_FAILED` — cookie path with missing/mismatched `X-CSRF-Token`.
- `401 NO_REFRESH_TOKEN` — neither cookie nor body present.
- `429 RATE_LIMITED` (+`Retry-After`) — **IP-level** rate cap tripped (L-5). Plain hygiene: a
  coarse per-IP sliding window (reusing `throttle:ip:{ip}`, arch §8.1 / data-model §4) so refresh
  can't be run as a free DB-lookup treadmill. **No account dimension** (256-bit token
  brute-force is infeasible), so this is IP-only.
- `415 UNSUPPORTED_MEDIA_TYPE` — non-JSON `Content-Type` (§3 L-2).

### 2.4 `POST /auth/logout`  (US-4)
Revokes the **current family** (from the presented refresh token; cookie or body). Clears
`omni_rt` + `omni_csrf` cookies (`Path=/auth`). Access token still lives ≤15 min by design
(arch §2.1). **204** always (idempotent — logging out an already-dead session still succeeds;
no leak). CSRF-checked on the cookie path.
**Optional body `{ familyId }`** (per-device logout of a *listed* non-current session, §2.6):
the `familyId` **must belong to the authenticated user** (the family's `userId` must equal
the caller's `userId`, resolved from the presented refresh token / — for the Bearer-less
cookie path — the family the cookie authenticates). A foreign or unknown `familyId` → the
same idempotent **`204`** (revokes nothing; no enumeration, no cross-user/cross-tenant
session kill — M-3). Without `familyId`, the default target is the caller's current family.

### 2.5 `POST /auth/logout-all`  (US-4)
Auth by **access token** (Bearer) → revokes **all** families for `req.user.userId` (arch §4).
Clears the caller's cookies (`Path=/auth`). **204**. Used for "log out everywhere" / suspected
compromise.

### 2.6 `GET /auth/sessions`  (US-3)
Auth by access token. **200** `{ sessions: [{ familyId, deviceId, createdAt, lastUsedAt,
current: bool }] }` — live (non-revoked, non-expired) families for the user. `current` marks
the family of the calling session (matched via the `omni_rt` refresh cookie, now sent here
because it is scoped `Path=/auth` — C-1; `null` if no cookie, e.g. a Bearer-only mobile call).
Powers "logged in on N devices" + per-device logout (client calls `/auth/logout` scoped to a
family — see note). *[contract note: per-device logout of a **non-current** device → optional
`{ familyId }` on `/auth/logout` body so a user can kill a specific listed session; the
`familyId` must belong to the caller (§2.4 ownership check); default (no familyId) = current
session. Locking this variant so ux can wire the list.]*

### 2.7 `POST /auth/change-password`  (US-6, D-008, arch §10)
Auth: **access token (Bearer)** — org-agnostic (a user changes their own **global**
`passwordHash`, not scoped to any org).
**Req** `{ currentPassword: string, newPassword: string }`. The web client also sends the
`omni_rt` cookie (ambient) + `X-CSRF-Token` (CSRF-checked, §0); mobile MAY send an optional
body `{ refreshToken }` to identify its current session (see "current family" below).
**Effect:** verify `currentPassword` against the caller's stored `passwordHash` (argon2
verify) → enforce the **same policy as signup** on `newPassword` (≥8, ≤128, NIST, breached
list — arch §5.2) → set the new `passwordHash` (argon2id) → **revoke all the caller's OTHER
refresh-token families**, sparing the caller's **current** family (see below) → emit
`auth.password.self_changed` (F-005).

**Identifying the "current" family to spare (N-1).** The Bearer access token carries **no**
`familyId`, so the server must **not** trust a client-supplied one (that would re-open the
M-3 IDOR). Instead it resolves the current family from the **presented refresh token** —
`omni_rt` cookie (web) or optional body `{ refreshToken }` (mobile) — looks up its
`RefreshToken` row, and spares exactly that family; the resolved family **must belong to the
caller** (`RefreshToken.userId === req.user.userId`, the M-3 ownership rule) or it is ignored.
If no current family can be resolved (no refresh token presented, or it doesn't resolve to a
live family owned by the caller), the server **revokes ALL** the caller's families — the safe
direction: the user simply re-logs in on this device. (So "keep current session" is
best-effort on presenting a valid refresh token; absent that, change-password behaves like
logout-all + new password.)

**Throttling `currentPassword` (N-2).** The `currentPassword` check is **account-throttled**
with the **same backoff machinery as login** (arch §8.1) — keyed on the authenticated
`req.user.userId` (`throttle:acct:{userId}`, data-model §4) — so a holder of a live access
token (stolen device / XSS-driven loop) cannot brute-force `currentPassword` with zero
backoff to recover the victim's global credential. A wrong `currentPassword` increments the
counter; a correct one resets it (as login does).
**200** `{ ok: true }`.
**Errors:**
- `401 INVALID_CREDENTIALS` — `currentPassword` wrong (generic, same shape as login; do not
  reveal account/hash state).
- `429 RATE_LIMITED` (+`Retry-After`) — account backoff tripped on repeated wrong
  `currentPassword` (N-2; always its own `429`, never folded into the `401` — same rule as
  login, §3).
- `403 CSRF_FAILED` — cookie path with missing/mismatched `X-CSRF-Token` (§0).
- `422 PASSWORD_TOO_SHORT` / `422 PASSWORD_BREACHED` — `newPassword` policy failure.
> This is the member-side structural fix for the admin-reset residual (§2.8 / arch §10,
> D-010): after an admin sets a member's password, the member rotates it here and evicts the
> admin's knowledge. "Current session spared (when resolvable, N-1), all others revoked" is
> deliberate — a password change is a natural point to kick *other* devices (matches "I think
> I'm hacked" without the self-logout footgun of `logout-all`).

### 2.8 `POST /orgs/{orgId}/members/{userId}/reset-password`  (US-5, arch §10)
Auth: access token + capability `manage_members` **within `orgId`** (F-003 guard).
**Both memberships must be `status = active` in `orgId`** (H-2): (a) the acting admin's
`Membership(callerUserId, orgId)` is `active` **and** carries the capability, **and** (b) the
target's `Membership(userId, orgId)` is `active`. A `revoked` or `invited` target membership
(F-000 keeps the row on removal — `MembershipStatus { active invited revoked }`, "deactivate
ไม่ delete") does **not** qualify: a revoked ex-member must **not** be resettable by an org
they no longer belong to, since `User.passwordHash` is system-wide and a reset would hand the
old org's admin a credential valid across the ex-member's *other* orgs (cross-tenant account
takeover). Any failure of (a) or (b) → the **same-shape `404`** (no cross-org / status
enumeration).
**Req** `{ newPassword: string }` (same policy as signup).
**Effect:** set target `User.passwordHash` (argon2id) → **revoke all target's refresh-token
families** (kicks all their sessions) → emit `auth.password.admin_reset` (F-005).
**200** `{ ok: true }`.
**Errors:** `403 FORBIDDEN` (authenticated but lacks the capability — F-003), `404` (target
not an **active** member of `orgId`, **or** caller not an active member — same-shape guard,
no cross-org/status enumeration), `422` password policy.

> **Residual multi-tenant trade-off + its fix (D-008/D-010):** even after the active-status
> fix, an org admin resetting a shared **active** member briefly learns a credential valid in
> that member's *other* orgs (`passwordHash` is global). The structural fix is now in the
> contract: the member calls **`POST /auth/change-password`** (§2.7, US-6/D-008) to rotate the
> admin-chosen password and evict the admin's knowledge. The remaining sliver (member never
> changes it) is accepted for dogfood and logged as **D-010** (F-081 self-serve email reset
> later removes even this).

---

## 3. Cross-cutting contract rules
- **Strict `Content-Type: application/json` on all `/auth/*` POST endpoints (L-2 — login-CSRF
  defense).** Every POST under `/auth/*` (`signup`, `login`, `refresh`, `logout`, `logout-all`,
  `change-password`) **must** carry `Content-Type: application/json`; a request with any other
  content-type (notably `application/x-www-form-urlencoded` / `multipart/form-data`, which is all
  an HTML `<form>` can emit) is rejected with **`415 UNSUPPORTED_MEDIA_TYPE`** *before* any
  credential processing. This closes login-CSRF residue: `/auth/login` has (and can have) no CSRF
  token, so a cross-site auto-submitting HTML form could otherwise log a victim into an
  **attacker's** account. An HTML form cannot set `Content-Type: application/json`; a scripted
  `fetch(..., {headers:{'Content-Type':'application/json'}})` from another origin trips a CORS
  **preflight** the API does not allow cross-origin — so no cross-site caller can reach these
  endpoints with a valid body. Free, one-rule defense; applies uniformly (the `/orgs/.../reset-password`
  admin endpoint is Bearer-authenticated and not a login-CSRF target, but SHOULD follow the same
  JSON-only rule for consistency).
- **Error envelope** follows the project standard `{ error: { code, message } }` with Thai
  `message` for user-facing copy (throttle/credentials); machine-readable `code` (uppercase
  enum above) for clients. *(If F-000 defined a global error shape, this conforms to it —
  backend to align in build.)*
- **`Retry-After`** header on all `429` (seconds until the backoff window clears) → UX
  countdown source.
- **Throttle applies pre-auth** on signup/login (arch §8); `429` can precede `401`. A
  throttled attempt is **always** `429 + Retry-After` — never a `401` (M-1); credential
  failures (`401`) and throttle (`429`) are separate, and the account throttle counter keys
  on the submitted normalized email regardless of whether the account exists (no
  429-differential enumeration). **`/auth/refresh` also carries a plain IP-level cap (L-5)** —
  no account dimension, just the `throttle:ip:{ip}` sliding window as anti-treadmill hygiene
  (arch §8.1); trip → `429 + Retry-After` like the other endpoints.
- **No pagination** needed (`/auth/sessions` is bounded — a user has few devices).
- **All over TLS**; cookies `Secure`; access token Bearer only.

---

## 4. Open items to confirm with ux/qa before final sign-off
1. **Auto-login on signup?** Defaulting to **no** (201 → client logs in). ux to confirm the
   onboarding flow doesn't need immediate tokens. (Trivial to flip to issuing tokens on
   signup if ux wants one-step.)
2. **Reuse-detection wire response:** locked to **generic `401 INVALID_REFRESH`** to clients
   (don't tip off attackers); distinct audit event server-side. qa tests assert family
   revoked + audit event, client sees generic 401.
3. **Per-device logout of a non-current session** via optional `{ familyId }` on
   `/auth/logout` (§2.6) — confirm ux wants this in MVP session-list, or defer to view-only.

## 5. Hand-off
- Contract stable for **ux** (wireframe: signup, login, throttle countdown, session list,
  admin reset, **change-own-password**) + **qa** (test plan: enumeration-safety,
  rotation/reuse **+ leeway window** **+ family-cap expiry (D-007)**, throttle backoff +
  fail-open **+ degraded in-process limiter + log/alert assertion**, dual-transport **with
  body `refreshToken: null` on the cookie path**, CSRF, admin-reset cross-tenant **incl.
  revoked-membership 404**, logout `familyId` ownership 204, **change-password: wrong-current
  401 + revokes-other-families-but-keeps-current-via-presented-refresh-token / revoke-all when
  none resolvable (N-1) + account-throttle on repeated wrong `currentPassword` → 429 (N-2)**,
  **Low-hardening: `415 UNSUPPORTED_MEDIA_TYPE` on non-JSON `Content-Type` for every `/auth/*`
  POST (L-2); `/auth/refresh` IP-throttle → `429 + Retry-After` (L-5); `tokenHash` computed as
  **HMAC-SHA-256 keyed on `JWT_REFRESH_SECRET`, not bare SHA-256** — a test must assert the keyed
  HMAC so a regression to plain SHA-256 is caught (L-3)**).
- **@frontend / @ux informed (contract changes):** (1) web must send
  `tokenTransport: "cookie"` at login and treat body `refreshToken` as `null` — the token is
  only ever in the httpOnly cookie (H-1); (2) `omni_rt`/`omni_csrf` are now `Path=/auth` so
  logout / sessions carry the cookie (C-1); (3) the reuse-leeway window (D-011 / arch §3.5)
  means a benign predecessor-replay returns a generic `401` **without** logging the user out
  — the client should single-flight refreshes and, on `401 INVALID_REFRESH`, re-attempt once
  with its current token before forcing re-login (M-2).
- **@devops** flag: dev-CORS allowed-origins + `credentials: true` for the cookie path (§0);
  Redis-down alerting + fail-open decision logging (arch §8.3, M-7).
- Depends on F-003 capability guard for endpoint 8 (admin reset) — F-001 assumes the guard
  exists or is stubbed; the reset *effect* + the active-membership constraint (§2.8, H-2) are
  F-001's. Endpoint 7 (change-password, §2.7) is Bearer-only and needs no F-003 guard.
