---
doc: test-plan
owner: "@qa"
signoff: approved     # pending | approved
---

# F-001 — Test Plan (Gate 2)

> Verifies: [F-001-authentication.md](../F-001-authentication.md) §2 (US-1..**US-6** AC — the source
> of truth for "correct"). Grounds against backend-api's FINAL (post-security-review)
> [api-spec.md](./api-spec.md) (**8 endpoints**, error codes, **transport-declaration** dual-transport,
> **always-429 throttle**, reuse→generic 401), [data-model.md](./data-model.md) (`RefreshToken` deltas
> incl. **`familyExpiresAt`**; concurrent-refresh = row-lock + **committed** family revoke; pinned
> breached-password fixture), and [architecture.md](./architecture.md) (reuse pure-fn in core-domain,
> **60s reuse-leeway D-011**, IP+account throttle, fail-open **+ degraded limiter + logged signal**,
> argon2id). Reflects the backend-review fixes **C-1 / H-1 / H-2 / H-3 / M-1 / M-2 / M-3 / M-7** and
> product scope decisions **D-007 / D-008 (US-6) / D-009 / D-010 / D-011**, plus the **Low-hardening**
> amendments **L-2** (strict `Content-Type: application/json` → `415` before credential processing,
> §5 I5c.1), **L-3** (`tokenHash` = keyed `HMAC-SHA-256(JWT_REFRESH_SECRET, value)`, not bare
> SHA-256 — U3.8 / I3.9), **L-5** (`/auth/refresh` IP-only rate cap → `429 + Retry-After` — I3.10).
>
> **Rule:** each Gate-1 AC maps to ≥1 concrete pass/fail check — an assertion on a pure-fn return,
> an API request with an asserted status/body/header/DB-side-effect, or a negative test that must
> fail the way we expect. qa owns the verdict; qa does **not** redefine an AC to make a check pass.
> Where the AC is ambiguous or an expected result is not derivable from the LOCKED contract, qa
> escalates (see §9) rather than guessing.

---

## 0. Scope boundary — money/stock matrix is N/A here (read first)

**Auth is identity, not money/stock.** F-001 touches **no** `StockMovement`, no `InventoryItem`,
no COGS/weighted-average, no Decimal money field. Therefore the **money-stock test matrix does NOT
apply** to this feature and is deliberately absent:

| Golden rule | Applies to F-001? | Why |
|---|---|---|
| #2 immutable stock ledger (append-only) | **N/A** | auth writes no ledger; `RefreshToken` rotation *is* append-only (insert successor, never mutate the value) but that is session state, not a stock ledger |
| #5 stock/money write in DB txn + ledger | **N/A** | the rotate/revoke txn (§US-3) is tested for *atomicity of session state*, not stock/money |
| #7 Decimal money / integer stock, no float | **N/A** | no monetary or stock quantity exists in the auth domain |
| #3 org-scoping every domain query | **Partial** | auth is the *one place org-scoping does NOT apply* (arch §1) — User is system-wide. The **only** org-scoped surface is admin-reset (endpoint 8, US-5); cross-tenant isolation is tested **there**. `change-password` (endpoint 7, US-6) is Bearer-only and org-agnostic |
| #4 unit tests on security-critical logic before merge | **APPLIES** | rotation/reuse decision, argon2 verify, password policy, email normalize are the hard-gate unit targets (replaces "money/stock unit tests" as the merge blocker for this feature) |
| #6 pure fn in core-domain | **APPLIES** | reuse-detection decision is a pure fn (arch §3.3) — unit-tested without a DB |

**Seed note (overrides the generic template):** the `_TEMPLATE.md` line "state via StockMovement"
does **not** apply. F-001 seeds state exclusively via **`User` + `RefreshToken` + `Membership`
(F-000)** rows and **Redis throttle keys**. No `StockMovement` is created anywhere in this plan.

**Legend:** `[auto]` = scripted (Track 1, hard gate). `[manual]` = human-executed once, reported
truthfully as done/skipped. `[agentic]` = Track 2 scheduled persona run (not a merge blocker).
Security-critical unit targets (golden rule #4 merge blocker) are marked ★.

---

## 1. Test pyramid & where each layer lives

| Layer | Home | What it proves |
|---|---|---|
| **Unit** | `packages/core-domain/src/auth/*` (pure fns) + `apps/api` service specs | reuse-decision matrix ★ (incl. leeway D-011 + family-cap D-007), password policy ★, email normalize ★, dummy-verify timing, argon2 params/rehash ★ |
| **Integration / API** | `apps/api` e2e (supertest against a test Postgres + Redis) | all **8** endpoints: status/body/headers/cookies + DB side-effects (family revoke **committed**, rotation chain, throttle keys, change-password revoke-others-keep-current) |
| **E2E** | `apps/web` Playwright · `apps/mobile` Flutter integration | real signup→login→refresh→logout across the cookie (web) and body (mobile) transports |
| **Manual** | human | throttle countdown copy, session-list render, mobile secure-storage wipe |
| **Agentic** | Track 2 (Browser Use) | non-tech Thai SME persona happy-path + throttle message |

---

## US-1 — Signup  (`POST /auth/signup`)

> AC: สมัคร→ได้บัญชี · อีเมลซ้ำ→ปฏิเสธ (ไม่รั่วเกินจำเป็น) · รหัส < 8 →ปฏิเสธ · เก็บ hash ไม่เก็บ plain ·
> สมัคร=ได้ user เท่านั้น + `verified=false`. (Note: api-spec §2.1 MVP = 201 then client logs in,
> **no auto-login** — DECIDED D-006(1), see §9; tests assert the 201-no-token behavior as a gate.)

### Unit ★
- **U1.1 email normalize** — `normalizeEmail("  User@Example.COM ")` → `"user@example.com"`
  (lowercase + trim). Table: leading/trailing space, mixed case, internal case preserved in
  local-part only per rule (lowercase whole address for MVP). Pass = exact normalized string.
- **U1.2 password policy — length** — `< 8` → `PASSWORD_TOO_SHORT`; `= 8` ok; `> 128` →
  `PASSWORD_TOO_LONG` (api-spec cap ≤128). Boundary cases 7/8/128/129.
- **U1.3 password policy — breached** ★ — reject any password present in the **version-pinned
  fixture** `packages/core-domain/src/auth/fixtures/common-passwords-top10k.txt` → `PASSWORD_BREACHED`.
  Assert against ≥5 known-listed samples (e.g. `password`, `123456`, `qwerty`) → rejected, and a
  strong random passphrase → accepted. **Fixture is pinned**: test also asserts the fixture file's
  recorded version/date (via its `SOURCE.md`) so the check is deterministic and diff-able. Offline —
  no external API call.
- **U1.4 hashing** ★ — `hashPassword(pw)` returns a PHC-format argon2id string
  (`$argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>`), salt **embedded** (no separate column),
  and the plaintext appears **nowhere** in the output. `verifyPassword(pw, hash)` → true;
  `verifyPassword(wrong, hash)` → false. Two hashes of the same password differ (unique salt).

### Integration / API `[auto]`
- **I1.1 happy signup** — `POST /auth/signup {email, strongPw}` → **201**
  `{ userId, email, verified: false }`, **no tokens in body** (session issuance is a separate
  `/auth/login` step). DB assert: exactly one `User` row, `email` stored normalized,
  `passwordHash` is argon2id PHC (never the plaintext), `verified = false`, **no `Membership`
  created** (US-1 AC: signup = user only).
- **I1.2 duplicate email → generic** — signup with an email that already exists (any case/spacing
  variant that normalizes to the same) → **409 `EMAIL_TAKEN`** with a minimal Thai message. This is
  the one *necessary* enumeration leak (Gate 1 §4) — assert the message does NOT reveal more than
  "email taken". No second `User` row created.
- **I1.3 policy rejections** — `422 PASSWORD_TOO_SHORT` / `422 PASSWORD_BREACHED` /
  `422 EMAIL_INVALID` each returned for the matching bad input; no `User` row created on any 422.
- **I1.4 IP throttle on signup** — exceed the IP window → **429 `RATE_LIMITED`** with a
  `Retry-After` header (see US-2 for the throttle detail; signup is IP-only, no account dimension).

### E2E
- **E1.1 web** `[auto]` (Playwright) — fill signup form with a strong password → success state →
  redirected to / lands on login (no auto-login, per contract).
- **E1.2 web — inline validation** `[auto]` — short password and breached password each show the
  Thai reason inline (maps I1.3 to UI).

---

## US-2 — Login  (`POST /auth/login`)

> AC: ถูก→access+refresh · ผิด→ข้อความกลางๆ (กัน enumeration) · ผิดซ้ำ 5 →throttle/backoff (ไม่ hard-lock) ·
> rate-limit IP + account.

### Unit ★
- **U2.1 dummy-verify on unknown email** — the login service performs a **dummy argon2 verify**
  against a fixed dummy hash when the email is unknown, so the code path does the same work whether
  or not the account exists (arch §9). Unit-assert the branch is taken (the verify fn is invoked on
  the not-found path). *(Timing itself is measured in I2.6 as best-effort, not a hard gate.)*
- **U2.2 argon2 rehash-on-login** ★ — seed a hash produced with **below-current** params; on a
  successful verify, `needsRehash(hash, currentParams)` → true → service upgrades `passwordHash`.
  A hash at current params → `needsRehash` false (no rewrite).
- **U2.3 backoff curve** — pure fn: given consecutive-failure count `n`, return the backoff/
  `retryAfter` seconds following `~1→2→4→8…` capped at the 15-min ceiling. Assert monotonic
  non-decreasing and clamped at ceiling. Assert **`n < 5` → no backoff** (threshold is 5).

### Integration / API `[auto]`
- **I2.1 correct login — transport declaration** (H-1, C-1) — the client declares its transport
  (api-spec §0). Two sub-cases:
  - **(a) `tokenTransport: "cookie"` (web)** — `POST /auth/login {email, pw, deviceId, tokenTransport:"cookie"}`
    → **200** `{ accessToken, refreshToken: null, expiresIn: 900, tokenType: "Bearer" }`. Assert the
    body `refreshToken` is **`null`** (H-1 — the plaintext is NOT in a JS-readable place). Sets
    `omni_rt` (httpOnly, Secure, SameSite=Strict, **`Path=/auth`** — C-1, not `/auth/refresh`) **and**
    `omni_csrf` (readable, `Secure; SameSite=Strict; Path=/auth`) cookies; the refresh token lives
    **only** in the `omni_rt` cookie.
  - **(b) `tokenTransport: "body"` (mobile / default when omitted)** — → **200** with the plaintext
    refresh token in body `refreshToken` (non-null) and **no** `omni_rt`/`omni_csrf` cookies set.
  DB assert (both): a new `RefreshToken` row with a **fresh `familyId`**, `rotatedFrom = null`,
  `tokenHash` = **`HMAC-SHA-256(JWT_REFRESH_SECRET, issuedValue)`** (keyed hash — L-3, data-model
  §2.1; the issued plaintext is never stored), `expiresAt` ~60d out, and **`familyExpiresAt` ~90d
  out** (D-007 absolute cap set on login). *(The keyed-HMAC guarantee is proven in detail by
  U3.8 / I3.9.)*
- **I2.1b cookie transport does NOT leak the token in the body** (H-1 explicit negative) — on the
  `tokenTransport: "cookie"` login, assert body `refreshToken === null` **and** the plaintext that
  the `omni_rt` cookie carries appears **nowhere** in the JSON body. This is the exact H-1 gap: the
  rotated/issued plaintext must never be exfiltratable by JS on the web path.
- **I2.2 wrong password → generic** — → **401 `INVALID_CREDENTIALS`**, generic Thai message; no
  token issued; the response is byte-identical shape to I2.3.
- **I2.3 unknown email → generic** — → **401 `INVALID_CREDENTIALS`**, **identical** body/shape to
  I2.2 (never reveals which factor was wrong). Assert equality of the two responses' bodies.
- **I2.4 throttle is ALWAYS 429, never folded into 401** (M-1) — 5 consecutive failed logins for one
  account → the next attempt → **429 `RATE_LIMITED`** with a `Retry-After` header (seconds).
  **Assert the throttled response is `429` — NOT a `401`** (api-spec §2.2/§3, arch §8.2: throttle is
  its own response, never "currently throttled" folded into `INVALID_CREDENTIALS`). It carries the
  generic throttle envelope + `Retry-After`, and never an "account locked" message. A **correct**
  password after the window clears → 200 (self-heal), and the account counter resets.
- **I2.9 no 429-vs-401 differential existence oracle** ★ (M-1) — 6 wrong-password attempts against a
  **nonexistent** email → the throttled attempt → **429** (identical to a real account's I2.4), **not**
  a `401`. Assert: a real account and a nonexistent email that both cross the threshold return the
  **same `429 + Retry-After`** shape — no 429-vs-401 differential that would reveal which emails exist.
  This proves the account counter keys on the **submitted normalized email whether or not a `User`
  exists** (arch §8.1, data-model §4). Pair with I2.2==I2.3 (credential-failure indistinguishability)
  so neither the 401 nor the 429 path is an oracle.
- **I2.5 IP + account dimensions independent** — two sub-cases proving the two keys don't bleed:
  - **account survives IP reset:** 5 failures for account A from many IPs (each below IP cap) still
    trips the **account** backoff (defends the distributed/botnet case, arch §8.3).
  - **IP survives account reset:** many failed logins from one IP across **different** emails (each
    account below 5) still trips the **IP** window. Confirms `throttle:ip:*` and `throttle:acct:*`
    are independent keys.
- **I2.6 timing consistency** `[auto, non-gating]` — measure median response time of I2.2 (wrong
  pw) vs I2.3 (unknown email); assert within a **loose** bound (best-effort, e.g. ratio within a
  generous margin). **NOT a hard CI gate** — flaky by nature; a breach logs a warning for review,
  it does not fail the build. (Hard guarantee is structural: dummy-verify U2.1 + identical response
  I2.2==I2.3.)
- **I2.7 fail-open on Redis-down — logged + degraded limiter** (M-7) — with the throttle store
  unreachable, a login attempt is **allowed** (auth availability > throttle, arch §8.3): a *correct*
  credential → 200 even though the throttle counter can't be read/written. Assert no 5xx from the
  throttle layer; the request falls through. (Wrong credential still → 401 — fail-open affects
  throttling, not auth itself.) **Extended assertions (M-7):**
  - **(a) fail-open is logged** — the fail-open decision emits the structured signal
    `auth.throttle.fail_open` (captured via log spy / test transport). Not silent.
  - **(b) degraded in-process IP limiter still bites** — with Redis down, hammer `/auth/login` from a
    single IP past the coarse per-process cap → the degraded local limiter → **429** (a dampener, not
    the shared control). Proves the outage is not a *fully* unthrottled brute-force window.
- **I2.8 per-device family creation** — two logins with **different** `deviceId` for the same user
  → **two distinct `familyId`s**, each independently rotatable/revocable (feeds US-3 session list
  and US-4 per-device logout).

### E2E
- **E2.1 web login** `[auto]` (Playwright) — login sends `tokenTransport: "cookie"` → app
  authenticated; `omni_rt` cookie present (`Path=/auth`) and **not** readable from JS (httpOnly
  assertion via context cookies, not `document.cookie`); the JSON body `refreshToken` is **`null`**
  (H-1 — web never sees the plaintext).
- **E2.2 web throttle countdown** `[auto]` — after tripping backoff, UI shows the countdown copy
  "รอสักครู่แล้วลองใหม่" driven by the `429 + Retry-After` (M-1), **not** "บัญชีถูกล็อก"
  (UX/product D-005).
- **E2.3 mobile login** `[auto]` (Flutter) — login sends `tokenTransport: "body"` (or omits it —
  `body` is the default) → reads `refreshToken` from the **response body** (no cookie set) and stores
  it in secure storage; access token used as `Authorization: Bearer`.

---

## US-3 — Refresh rotation, reuse detection, sessions  (`POST /auth/refresh`, `GET /auth/sessions`)

> AC: access หมด→ใช้ refresh ขอใหม่ · refresh หมุนทุกครั้ง ตัวเก่าใช้ไม่ได้ · **session cap = login+90d (D-007)** ·
> ตรวจ reuse→เพิกถอนทั้ง family (**นอก leeway 60s, D-011**) · ผูก device/session (เห็นกี่เครื่อง, logout รายเครื่อง).

### Unit ★ — reuse-decision pure fn (core-domain, the golden-rule-#4 merge blocker)
The decision fn takes the presented token's derived state + its family rows (incl. each successor's
`createdAt`, and `familyExpiresAt`) as **plain values** and returns an action enum
`{ ALLOW_ROTATE | REVOKE_FAMILY | REJECT_EXPIRED | REJECT_BENIGN_RETRY }` — the last two are both
generic-401 outcomes on the wire but differ in whether the family is burned (arch §3.3/§3.5,
data-model §2.3/§2.4). No DB.
- **U3.1 current → ALLOW_ROTATE** — presented token is newest, `revokedAt=null`, not expired,
  **family cap not reached (`familyExpiresAt > now`)**, no successor → rotate.
- **U3.2 consumed outside leeway → REVOKE_FAMILY** — a successor exists (`∃ row.rotatedFrom =
  presented.id`) **and** that successor was minted **>60s ago** → reuse signal → revoke whole family.
- **U3.3 revoked → REVOKE_FAMILY** — `revokedAt != null` presented → reuse/replay → revoke family.
- **U3.4 expired → REJECT_EXPIRED** — `expiresAt <= now` → reject (no family burn required; expiry
  is benign). Boundary at exactly `now`.
- **U3.5 immediate-predecessor within leeway → REJECT_BENIGN_RETRY** ★ (M-2/D-011) — presented is the
  **immediate predecessor** of the current token (`∃ current row WHERE rotatedFrom = presented.id`)
  **and** `now − successor.createdAt ≤ 60s` → benign retry: generic 401 **WITHOUT** family revocation
  (family stays live). Boundary cases: successor age **59s → benign**, **61s → REVOKE_FAMILY** (reuse).
  A **deeper ancestor** (grandparent+, never held by a correct client) → **REVOKE_FAMILY** even inside
  60s — the leeway is only for the *immediate* predecessor.
- **U3.6 family cap reached → REJECT_EXPIRED** (D-007) — `familyExpiresAt <= now` on the presented
  token → reject as **ordinary expiry**, **no** family burn, **no** audit event (the family aged out,
  not reuse). Distinct from U3.2/U3.3. Boundary at exactly `now`.
- **U3.7 state-matrix table** — exhaustive combination table over {current, consumed, revoked,
  expired, family-cap-reached} × {has-successor y/n} × {successor-age ≤60s / >60s} × {immediate-
  predecessor / deeper-ancestor} asserting the returned enum for each cell. This is the definition of
  "correct" for rotation (incl. the leeway carve-out and the family-cap expiry) and must be complete.
- **U3.8 tokenHash is keyed HMAC-SHA-256, NOT bare SHA-256** ★ (L-3, data-model §2.1, arch §2.3/§9)
  — unit-assert the hashing fn that computes the stored `tokenHash`: for a given token value and the
  configured `JWT_REFRESH_SECRET`, `hashRefreshToken(value)` **equals** `HMAC-SHA-256(secret, value)`
  (recompute independently with Node `crypto.createHmac('sha256', secret)`) **and does NOT equal**
  bare `SHA-256(value)` (`crypto.createHash('sha256')`). Also assert **key-sensitivity**: the same
  value under a **different** secret yields a **different** `tokenHash` (proves the secret actually
  keys the digest — a bare-SHA-256 regression would be secret-insensitive). This is the regression
  guard for the free-hardening guarantee: a DB dump alone cannot verify a guessed token without the
  env secret. (Pairs with the on-the-wire/DB proof in I3.9.)

### Integration / API `[auto]`
- **I3.1 rotation happy path** — login → `/auth/refresh` (cookie or body) → **200** new pair; the
  **old** refresh token no longer works (present it again → **401**). DB: successor row inserted,
  `familyId` **inherited**, `rotatedFrom = presented.id`, `lastUsedAt` set; old row now "consumed".
- **I3.2 reuse → generic 401 + family revoked (COMMITTED) + post-commit audit** ★ (H-3) — rotate
  once (RT1→RT2), **advance the controllable clock >60s** (so RT1 is outside the leeway window — this
  is genuine reuse, not a benign retry), then present the **consumed RT1** again → **generic
  `401 INVALID_REFRESH`** to the client (the wire must NOT reveal `REFRESH_REUSE_DETECTED` —
  api-spec §2.3 LOCKED). **Committed-revoke assertions (H-3):**
  - **re-query in a FRESH transaction/connection** (after the 401 returns) confirms **all** rows in
    that `familyId` have `revokedAt` set (including current RT2 — the legit client is burned too).
    The point of the fresh read is to prove the revoke **committed** and was not rolled back by a
    throw-inside-the-rotation-txn (the exact H-3 trap; data-model §2.4).
  - the `auth.refresh.reuse_detected` event was emitted **post-commit** for F-005 (captured via test
    spy/outbox) — assert it fires **after** the revoke is durable, so a rollback could never have
    swallowed both. (F-005 consumption is out of scope — assert the emission only.)
  - **Other families** of the same user remain live (per-device isolation).
- **I3.3 concurrent refresh — deterministic via row-lock, loser is BENIGN (family survives)** ★
  (M-2/D-011) — fire **two** parallel `/auth/refresh` with the **same** current token. Per data-model
  §2.4 (row lock, leeway carve-out, no serializable-retry loop), assert **exactly `1×200` + `1×401
  INVALID_REFRESH`**; the loser hits its lock **immediately after** the winner minted the successor
  (age ≪ 60s) → **benign retry, NOT reuse** → the **family is NOT revoked** and the **winner's
  successor stays valid** (assert: re-query confirms no `revokedAt` on the family, and the winner's
  new token still refreshes). No `auth.refresh.reuse_detected` emitted. The test does **not** retry
  and does **not** depend on scheduling luck (first acquirer wins, second sees a fresh <60s
  successor). Run the pair N times (e.g. 20) to confirm the 1-success / 1-benign-401 split is stable
  **and** the family survives every time (this is the web-multi-tab / mobile-lost-response fix).
- **I3.4 expired refresh → 401** — present a token whose `expiresAt` is in the past → **401
  `INVALID_REFRESH`**; family is **not** burned (benign expiry, U3.4). No new tokens issued.
- **I3.4a leeway benign-retry: predecessor replayed ≤60s → 401 WITHOUT family revocation** ★
  (M-2/D-011) — rotate RT1→RT2; **within 60s** replay the consumed **RT1** (the immediate
  predecessor) → **generic `401 INVALID_REFRESH`**; assert (fresh re-query) the **family is NOT
  revoked** — RT2 (current) still works: a subsequent `/auth/refresh` with RT2 → 200. No
  `auth.refresh.reuse_detected` emitted. This is the lost-response / multi-tab safety net.
- **I3.4b reuse after leeway OR deeper ancestor → full family revocation** ★ (M-2/D-011) — two
  sub-cases, both burn the family (contrast with I3.4a):
  - **(a) predecessor replayed >60s later:** rotate RT1→RT2, advance clock **>60s**, replay RT1 →
    `401` + **family revoked (committed)** + audit event (this is the I3.2 path, restated as the
    leeway boundary's far side).
  - **(b) deeper ancestor inside 60s:** rotate RT1→RT2→RT3; **within 60s** replay **RT1** (a
    grandparent — never held by a correct client) → `401` + **family revoked** + audit event. The
    leeway protects only the *immediate* predecessor, never a deeper ancestor.
- **I3.4c family-lifetime cap expiry → generic 401, NOT reuse** ★ (D-007) — seed (or advance the
  controllable clock past) a family whose **`familyExpiresAt` has passed** while its current token's
  own `expiresAt` is still in the future, then `/auth/refresh` → **generic `401 INVALID_REFRESH`**
  (ordinary session expiry — client re-logins). Assert the family is **NOT** "burned": `revokedAt`
  is **not** set as a reuse action and **no** `auth.refresh.reuse_detected` event fires (D-007: cap
  expiry ≠ reuse). Also assert **`familyExpiresAt` is INHERITED UNCHANGED across rotations** — rotate
  a fresh family a few times and confirm every successor row carries the **same** `familyExpiresAt`
  as the login token (it does **not** slide like `expiresAt`); the successors' `expiresAt` do slide.
- **I3.5 dual-transport resolution** — (a) cookie-only (`omni_rt`) → rotates via web path, response
  re-sets `omni_rt` with the rotated value and body `refreshToken: null`; (b) body-only
  `{refreshToken}` → rotates via mobile path, response body carries the rotated token, no cookie set;
  (c) **both present → cookie wins** (web path); (d) **neither → 401 `NO_REFRESH_TOKEN`** (api-spec
  §0 resolution order: cookie first, then body).
- **I3.6 CSRF on cookie path** — cookie refresh **without** matching `X-CSRF-Token` (or mismatched)
  → **403 `CSRF_FAILED`**; with header == `omni_csrf` cookie → 200. Body (mobile) path **skips**
  CSRF (no ambient cookie authority) → 200 without any CSRF header.
- **I3.7 cross-tenant token at auth layer** — a user belonging to **Org-A only** logs in and refreshes
  successfully. **Boundary note:** the org-access boundary lives in **F-002** (org resolution), not
  here. This plan asserts **only** "token valid + login/refresh OK regardless of org membership"
  (arch §1.1: removed-from-all-orgs user still authenticates). It does **NOT** assert org-data
  isolation — that is F-002's test-plan.
- **I3.8 GET /auth/sessions** — after 3 logins on 3 `deviceId`s → **200** `{ sessions: [...] }` lists
  **3 live families** with `familyId, deviceId, createdAt, lastUsedAt, current`. The family matching
  the caller's refresh cookie is marked `current: true`; revoked/expired families are excluded.
- **I3.9 stored `tokenHash` is the keyed HMAC — DB-side proof + lookup uses HMAC** ★ (L-3, data-model
  §2.1/§2.4) — end-to-end complement to U3.8: log in (or rotate), capture the issued plaintext refresh
  token, then read the persisted `RefreshToken` row and assert `row.tokenHash ===
  HMAC-SHA-256(JWT_REFRESH_SECRET, issuedPlaintext)` (recomputed in-test) **and** `row.tokenHash !==
  SHA-256(issuedPlaintext)`. Also assert **lookup is by HMAC, not plaintext**: presenting the token on
  `/auth/refresh` resolves the row (200), while a value whose *bare SHA-256* would collide but whose
  *HMAC* differs would not resolve — i.e. the lookup key is the keyed digest (data-model §2.4 step 1:
  `SELECT ... WHERE tokenHash = HMAC(...)`). Confirms a bare-SHA-256 regression is caught at the
  storage/lookup layer, not just in the pure fn.
- **I3.10 `/auth/refresh` IP rate cap → 429 + Retry-After (IP dimension ONLY)** ★ (L-5, api-spec §2.3,
  arch §8.1) — exceed the **IP-level** sliding window on `/auth/refresh` (reusing `throttle:ip:{ip}`)
  → the next `/auth/refresh` from that IP → **`429 RATE_LIMITED` + `Retry-After`** (seconds). Assert:
  - **IP dimension only, no account dimension** — the cap is keyed **solely** on `throttle:ip:{ip}`;
    there is **no** `throttle:acct:*` increment for refresh (256-bit token brute-force is infeasible,
    so refresh has no account counter — api-spec §2.3, arch §8.1). Assert (Redis-key inspection) no
    account-keyed counter is touched by the refresh path, and refreshes from a **different** IP under
    the cap still succeed (proving the cap is per-IP, not global/per-user).
  - **deterministic via the controllable-clock / Redis-TTL helper** — use fixture (d) (read
    `Retry-After` + advance the clock/TTL); **no real waits**. After the window elapses, a valid
    `/auth/refresh` from the same IP → **200** (the cap self-heals, like the login IP window).
  - **it's a plain hygiene cap, not reuse** — a `429`-throttled refresh makes **no** state change:
    assert (fresh re-query) **no rotation** occurred (no successor row minted) and **no** family was
    revoked; the throttle short-circuits before the rotate txn.

### E2E
- **E3.1 web silent refresh** `[auto]` (Playwright) — let the access token expire (or force it) →
  the app transparently refreshes via the `omni_rt` cookie + `X-CSRF-Token` and continues without a
  re-login prompt.
- **E3.2 mobile long-session** `[auto]` (Flutter) — access expiry → refresh from secure-storage body
  token → new pair stored → request retried. No re-login.
- **E3.3 session list render** `[manual]` — "logged in on N devices" renders the live families and
  marks the current one (spot-checked by a human; also in Track 2 §CI).

---

## US-4 — Logout  (`POST /auth/logout`, `POST /auth/logout-all`)

> AC: logout→refresh ปัจจุบันใช้ไม่ได้ + รองรับ logout ทุกเครื่อง · (มือถือ) token ถูกลบจาก secure storage.

### Integration / API `[auto]`
- **I4.1 logout current family — cookie-path row IS revoked in the DB** ★ (C-1) — `/auth/logout`
  (presented refresh, cookie or body) → **204**. **The DB-side-effect assertion is the whole point of
  C-1:** on the **cookie path**, because `omni_rt` is now `Path=/auth` the browser actually sends the
  cookie to `/auth/logout`, so the family is identified and revoked. Assert (fresh re-query) the
  current family's rows **have `revokedAt` set** — NOT merely that the endpoint returned 204 (a 204
  with **no** cookie sent, which was the C-1 bug under `Path=/auth/refresh`, would revoke **nothing**
  yet still return 204 — invisible to a status-only test). A subsequent `/auth/refresh` with that
  token → 401. Cookies `omni_rt` + `omni_csrf` cleared (`Path=/auth`). **Other families stay live**
  (still refreshable).
- **I4.2 logout is idempotent** — logout again on an already-dead session → **204** (no leak, no
  error). Confirms api-spec §2.4.
- **I4.3 per-device logout (non-current)** — with 3 live families, `/auth/logout {familyId: X}` for a
  **non-current** listed session **owned by the caller** → only family X revoked; caller's own + the
  third stay live (api-spec §2.6 optional `familyId`; D-006 per-device logout is in MVP).
- **I4.3a logout `familyId` ownership — no cross-user session kill** ★ (M-3) — authenticated **user
  A** passes a `familyId` belonging to **user B** → **same idempotent `204`** (no error, no
  enumeration); assert (fresh re-query) **B's family is NOT revoked** (`revokedAt` unchanged) and none
  of A's own families are touched. Also assert an **unknown/garbage `familyId`** → same `204`, nothing
  revoked. The revoke must be scoped `WHERE familyId = :input AND userId = :callerUserId` — a foreign
  cuid must never let A kill B's session (cross-user / cross-tenant, since auth tables are
  org-agnostic).
- **I4.4 logout-all atomicity** — with **≥3 families**, `/auth/logout-all` (Bearer access) → **204**;
  assert **every** family for that `userId` is revoked in one transaction — no partial "some devices
  still logged in". Re-refresh on any of the 3 → 401.
- **I4.5 CSRF on cookie logout** — cookie-path logout without valid `X-CSRF-Token` → **403**.

### E2E
- **E4.1 web logout** `[auto]` — logout clears cookies; protected route redirects to login.
- **E4.2 mobile secure-storage wipe** `[manual]` — after logout, confirm the refresh token is
  **removed** from Keychain/Keystore (US-4 AC; F-006 implements — verified on device by a human).

---

## US-5 — Admin reset  (`POST /orgs/{orgId}/members/{userId}/reset-password`)

> AC: MVP = Owner/Admin รีเซ็ตรหัสให้สมาชิก (ไม่ต้องมี email infra) · ห้ามล็อกตัวเองออกถาวร (self-heal) ·
> solo-owner ยอมรับรอ backoff ~15 นาที.

### Integration / API `[auto]` — org-scoped (the one org-scoped auth surface)
- **I5.1 in-org reset happy path** — Org-A admin (capability `manage_members`) resets an Org-A member
  → **200** `{ ok: true }`. DB: target `User.passwordHash` updated to a new argon2id hash (old hash
  no longer verifies, new password does); **all target families revoked** (kicked out everywhere,
  api-spec §2.8); `auth.password.admin_reset` event emitted for F-005 (asserted via spy/outbox).
  Caller (admin) and target are **both `status=active`** members of Org-A (H-2 precondition).
- **I5.2 cross-tenant isolation → 403/404** ★ (golden rule #3 for this surface) — Org-A admin attempts
  to reset a user who belongs to **Org-B only** → rejected. Per api-spec §2.8: `403 FORBIDDEN`
  (no capability / not in org) or `404` (target not a member of `orgId` — same-shape, no cross-org
  enumeration). Assert the Org-B user's `passwordHash` is **unchanged** and their families are
  **not** revoked. **Note:** the capability *guard* is F-003's; this plan asserts the F-001 **effect
  boundary** — an out-of-org actor produces **no side effect**. (Guard-internals testing = F-003.)
- **I5.2a admin-reset requires target `status=active` — revoked/invited ex-member → 404, no effect**
  ★ (H-2) — Org-A admin resets a target who **is** in Org-A but whose `Membership(target, Org-A)` is
  **`revoked`** (ex-member who now works only at Org-B) → **same-shape `404`** (no status enumeration,
  api-spec §2.8). Assert the target's **`passwordHash` is UNCHANGED** and their families are **NOT**
  revoked — the reset must produce **no side effect**. Repeat the sub-case for an **`invited`** target
  (never accepted) → same `404`, no effect. This is the exact H-2 cross-tenant-account-takeover fix:
  a mere-existence check (F-000 keeps rows on removal) would have let Org-A reset the **global**
  `passwordHash` of someone no longer active there. Keep the existing cross-tenant (I5.2, Org-B-only)
  test alongside this one.
- **I5.3 post-reset kick** — after I5.1, the target's previously-issued refresh tokens all → 401 on
  refresh (they were revoked); target must log in with the new password → 200.
- **I5.4 reset clears account throttle** — an admin reset clears the target account's throttle
  counter (arch §8.2) → target can immediately log in with the new password even if they were in
  backoff. Supports the anti-lockout guarantee.

### Anti-lockout / self-heal (US-5 AC "ห้ามล็อกตัวเองออกถาวร")
- **I5.5 backoff self-heals** — an account in backoff, with **no** external action, becomes loginable
  again once the window elapses (correct password → 200). Proves the lock is **temporary**, never
  permanent. (Deterministic via a controllable clock/Redis TTL in the test, not a real 15-min wait.)
- **I5.6 solo-owner path back** `[manual]` — document/verify that a sole Owner throttled out has a
  path back (wait-out backoff ~15 min OR admin/break-glass) — the residual MVP gap is a **product**
  call (arch §10); qa asserts only that no state requires a *permanent* external action to recover.

### E2E
- **E5.1 admin reset flow** `[auto]` (Playwright) — Org-A admin opens a member, sets a new password,
  member is signed out everywhere and can log in with the new password.

---

## US-6 — Change own password  (`POST /auth/change-password`)  *(NEW — D-008)*

> AC (F-001 §2 US-6): Bearer · ต้องยืนยัน `currentPassword` ก่อน · `newPassword` ผ่านนโยบายเดิม
> (≥8 / breached list) มิฉะนั้นปฏิเสธ · สำเร็จ → **เพิกถอน refresh family อื่นทั้งหมด ยกเว้นเครื่องปัจจุบัน**
> (กันเครื่องที่รู้รหัสเก่า รวมถึง admin ที่ตั้งรหัสให้) · `currentPassword` ผิด → ข้อความกลางๆ (ไม่รั่ว),
> ไม่กระทบ session ปัจจุบัน. Grounds against api-spec §2.7 (endpoint 7), arch §4.

### Unit ★
- **U6.1 policy reuse on `newPassword`** — the same policy fns exercised in U1.2/U1.3 gate
  `newPassword`: `< 8` → `PASSWORD_TOO_SHORT`; breached-list hit → `PASSWORD_BREACHED`; `> 128` →
  `PASSWORD_TOO_LONG`. (No new policy code — assert change-password calls the shared signup policy.)
- **U6.2 verify-current then rehash** ★ — service verifies `currentPassword` via `verifyPassword`
  against the stored hash **before** any mutation; on success the new hash is a fresh argon2id PHC
  string (unique salt ⇒ differs from the old hash), and the plaintext appears nowhere.

### Integration / API `[auto]`
- **I6.1 happy change — current session survives, ALL OTHER families revoked** ★ — seed the caller
  with **≥3 live families** (the current one + 2 others). `POST /auth/change-password
  {currentPassword, newPassword}` (Bearer access of the current session) with a **correct** current
  password + a **strong** new password → **200** `{ ok: true }`. Assert:
  - DB: `User.passwordHash` **updated** (old password no longer verifies; the new one does).
  - **caller's current family stays LIVE** — the caller can still `/auth/refresh` on its current
    refresh token → 200 (do **not** log the user out of the device they changed it on).
  - **every OTHER family is revoked** (`revokedAt` set) — the 2 other devices' refresh tokens → 401
    on `/auth/refresh`. (This evicts a device that knew the old / admin-set password — the D-008
    structural fix for the admin-reset residual D-010.)
  - `auth.password.self_changed` event emitted for F-005 (spy/outbox).
- **I6.2 wrong current password → generic 401, no effect** — correct Bearer but **wrong**
  `currentPassword` → **`401 INVALID_CREDENTIALS`** (generic, same shape as login — no leak about the
  hash/account state, api-spec §2.7). Assert **no** mutation: `passwordHash` unchanged, **no** family
  revoked (the current session and all others untouched), no event emitted.
- **I6.3 weak/breached new password → 422, no effect** — correct current password but `newPassword`
  fails policy → **`422 PASSWORD_TOO_SHORT`** / **`422 PASSWORD_BREACHED`** (matching the bad input).
  Assert `passwordHash` unchanged and **no** families revoked (policy failure must not partially apply
  the change or evict devices).
- **I6.4 admin-reset → self-rotate closes the window (D-008/D-010 chain)** — sequence: Org-A admin
  resets member M (I5.1) to an admin-known value → M logs in with it → M calls
  `/auth/change-password` to a value the admin does **not** know → 200. Assert the admin-known
  password **no longer verifies**, M's current (post-change-login) session survives, and any other M
  families are revoked. Proves the residual admin-knowledge window (D-010) is closeable by the member.
- **I6.5 org-agnostic (Bearer only, no F-003 guard)** — change-password requires **only** a valid
  access token; a user belonging to **no org** (the I3.7 fixture user) can change their own password
  → 200. No `X-Org-Id`, no capability check (api-spec §1 endpoint 7, arch §10 — contrast with the
  org-scoped admin-reset endpoint 8).
- **I6.6 current-family identification — resolved from the PRESENTED refresh token, safe-direction
  fallback, no IDOR** ★ (N-1) — the family spared by I6.1 is resolved **only** from the presented
  refresh token (`omni_rt` cookie web / optional body `{refreshToken}` mobile), never a Bearer/client
  claim (mirrors the M-3 ownership rule). Three sub-cases, all with a **correct** current password +
  **strong** new password so the change itself succeeds — the assertion is *which* family survives:
  - **(a) valid current refresh token presented → that family survives, all OTHERS revoked**
    (sharpens I6.1) — seed the caller with **≥3 live families**; call `/auth/change-password` **with**
    the current session's refresh token presented (cookie *and* body sub-variants, per §0 resolution:
    cookie first, then body). Assert (fresh re-query): the **resolved** family's rows have `revokedAt`
    **null** (still `/auth/refresh` → 200) and **every OTHER** family is revoked (their tokens →
    401). Assert the surviving family is the one the presented refresh token belongs to — not merely
    "some family survived".
  - **(b) NO resolvable refresh token (access-token-only request) → ALL families revoked** — call
    `/auth/change-password` with a valid Bearer access token but **no** `omni_rt` cookie and **no**
    body `{refreshToken}` (the mobile/Bearer-only shape). Password change still succeeds (**200**),
    but assert (fresh re-query) **EVERY** family for the caller — including the one the access token
    was minted under — is revoked; a subsequent `/auth/refresh` on any seeded token → **401**. This
    is the **safe-direction fallback** (§2.7 N-1: absent a resolvable refresh token, change-password
    behaves like logout-all + new password; the caller re-logs in on this device). Assert this is a
    deliberate revoke-all, distinct from I6.6(a)'s spare-one.
  - **(c) client-supplied `familyId` NOT backed by the presented refresh token → IGNORED (no IDOR)**
    ★ — call `/auth/change-password` presenting user A's current refresh token (so A's current family
    *is* resolvable and survives) **while** also supplying a `familyId` that A does not present a
    refresh token for — both a **foreign** family (belonging to user B) **and** a *different own*
    family of A that A did **not** present. Assert (fresh re-query): the client-supplied `familyId`
    has **no** effect — **B's family is untouched** (`revokedAt` unchanged; no cross-user session
    kill / no IDOR, mirrors M-3), and A's *presented* family is the one spared while A's other own
    families are revoked per the resolved-from-token rule (the bare `familyId` never spares nor kills
    anything). The spared family is determined **solely** by the presented refresh token.
- **I6.7 `currentPassword` is account-throttled — its own 429, resets on success** ★ (N-2) — an
  authenticated caller (live Bearer) submitting **wrong `currentPassword`** repeatedly must hit the
  **login-grade account backoff** keyed on `throttle:acct:{userId}` (data-model §4), so a stolen
  device / XSS loop cannot brute-force the current credential at full argon2 speed. Assert:
  - **N wrong-`currentPassword` attempts → `429 RATE_LIMITED` + `Retry-After`** — after the 5-failure
    threshold, the next wrong-current attempt → **429** with a `Retry-After` header (seconds). Uses
    the controllable-clock / Redis-TTL helper — **no real waits** (reuse the I2.4/I5.5 rate-limit
    sequence + clock helpers).
  - **its own 429, NEVER folded into the 401** (mirrors M-1) — assert the throttled response is
    **`429`, NOT `401 INVALID_CREDENTIALS`**; the two are separate responses (a wrong-but-not-yet-
    throttled current password → 401; a throttled attempt → 429 regardless of whether *this* current
    password would have been right). Pair with I6.2 (the plain wrong-current 401) so neither path is
    conflated.
  - **a correct `currentPassword` resets the counter** — after some (sub-threshold) wrong attempts, a
    **correct** `currentPassword` + strong new password → **200** and the account throttle counter is
    **reset** (as login does, arch §8.1): a subsequent wrong-current attempt starts the count from
    zero, not from the pre-success total. Assert (Redis key inspection or a follow-up sequence) the
    counter cleared on success.
  - **no partial effect on a throttled attempt** — assert a `429`-throttled call makes **no**
    mutation: `passwordHash` unchanged and **no** family revoked (the throttle short-circuits before
    the verify/mutation, exactly like the login 429 precedes the credential path).

### E2E
- **E6.1 web change-password** `[auto]` (Playwright) — logged-in user changes password with correct
  current + strong new → success state → **stays logged in** on the current tab; a second device's
  session (seeded family) is signed out on its next action.
- **E6.2 mobile change-password** `[manual]` — after change on device A, device B (secure-storage
  token) gets 401 on its next refresh and is bounced to login; device A continues. (F-006 surface —
  verified on device by a human.)

---

## 5. Cross-cutting contract rules (all `/auth/*`)

> Grounded in api-spec §3 (cross-cutting rules) + arch §9. These assert transport-level
> guards that apply uniformly across the endpoints above, independent of any single US.

### Integration / API `[auto]`
- **I5c.1 strict `Content-Type: application/json` → 415, BEFORE credential processing** ★ (L-2 —
  login-CSRF defense) — every `/auth/*` POST requires `Content-Type: application/json`; a request
  with any other content-type (assert at least `application/x-www-form-urlencoded`, `text/plain`,
  and a real form-`multipart/form-data` POST — the shapes an HTML `<form>` can emit) → **`415
  UNSUPPORTED_MEDIA_TYPE`**. Cover a **representative set of `/auth/*`**: at minimum **`/auth/login`
  and `/auth/signup`** (plus a spot-check on `/auth/refresh`), since the rule is uniform (api-spec
  §3). **The load-bearing assertion is that the 415 fires *before* any credential processing:**
  - **no throttle increment** — send a non-JSON `/auth/login` with a **valid** email past its
    account/IP threshold-minus-one, then assert the counter did **not** advance (Redis-key
    inspection: `throttle:acct:*` / `throttle:ip:*` unchanged) and a subsequent legitimate JSON
    login still succeeds — i.e. a form-POST flood cannot be used to throttle a victim out.
  - **no user lookup / no credential work** — assert (service spy / DB-query spy) that neither the
    `User` lookup nor `verifyPassword`/dummy-verify ran on the 415 path; the request is rejected at
    the transport guard. This proves the 415 is a genuine pre-auth short-circuit, closing the
    login-CSRF residue (an HTML form cannot set `application/json`; a cross-origin scripted `fetch`
    trips a CORS preflight the API does not allow — api-spec §3, arch §9).
  - well-formed `Content-Type: application/json` on the same request → proceeds normally (200/401/
    422 per the case), confirming 415 is content-type-specific, not a blanket reject.

---

## 6. Seed data / fixtures

State is built from **`User` + `RefreshToken` + `Membership` (F-000)** rows and **Redis throttle
keys** only. **No `StockMovement`** — auth does not touch stock (see §0).

- **Orgs & members (multi-tenant isolation):** **≥2 orgs** (Org-A, Org-B). Each has **≥1 Owner + ≥1
  Staff** (via F-000 `Membership`/`Role`). A user who belongs to **Org-B only** exists specifically
  for the cross-tenant reset test (I5.2). A user belonging to **no org** exists for I3.7 and I6.5
  (authenticates + can change own password, but sees no org data — boundary is F-002).
- **Non-active membership fixtures (H-2):** in Org-A, a target user with `Membership(target, Org-A)`
  = **`revoked`** (ex-member now active only in Org-B) **and** a separate target with `= invited`
  (never accepted) — both for I5.2a (admin-reset must no-op on non-active targets). F-000 keeps these
  rows on removal (`MembershipStatus { active invited revoked }`), which is exactly the hole H-2 pins.
- **Breached-password fixture:** version-pinned **top-10k** list at
  `packages/core-domain/src/auth/fixtures/common-passwords-top10k.txt` with a sibling `SOURCE.md`
  (origin + version/date). Offline; the test pins and asserts the recorded version (U1.3). No
  external HIBP call in MVP.
- **argon2 params fixture:** a **below-current** param hash seeded so U2.2/I-rehash can assert the
  transparent upgrade-on-login; plus the single current-params config constant.
- **Rate-limit sequences:** helpers to (a) fail N times for one account across varied IPs, (b) fail
  N times from one IP across varied emails, (c) fail N times for a **nonexistent** email (I2.9 —
  429-differential oracle), (d) read `Retry-After` and advance a controllable clock/Redis TTL to test
  window expiry, **(e) fail N times on `currentPassword` for an authenticated caller** keyed on
  `throttle:acct:{userId}` (I6.7 — N-2 change-password backoff, reuses the same 5-failure/backoff
  machinery + clock helper as login), **(f) hammer `/auth/refresh` from a single IP past the IP
  sliding-window cap** keyed on `throttle:ip:{ip}` (I3.10 — L-5 refresh IP cap; IP dimension only, no
  account key; reuses the same clock/TTL helper (d) — no real waits) — supports
  I2.4/I2.5/I2.7/I2.9/I5.5/I6.7/**I3.10** **without real waits**.
- **Refresh-token HMAC recompute helper (L-3):** an in-test `HMAC-SHA-256(JWT_REFRESH_SECRET, value)`
  computed with Node `crypto.createHmac` (reading the same `JWT_REFRESH_SECRET` the API uses), plus a
  bare `SHA-256(value)` computed with `crypto.createHash`, so U3.8/I3.9 can assert the stored
  `tokenHash` equals the keyed HMAC and **not** the bare SHA-256 (and is secret-sensitive). No new
  seed rows — this is a pure crypto helper over the token plaintext captured from login/rotate.
- **Controllable clock (reuse-leeway + family-cap):** a test clock / injectable `now()` so the plan
  can (a) advance **>60s** to turn a benign predecessor-replay into genuine reuse (I3.2/I3.4b), (b)
  stay **<60s** for the benign-retry cases (I3.3/I3.4a), and (c) advance past `familyExpiresAt` for
  the family-cap expiry (I3.4c). No real waits. `familyExpiresAt` can also be seeded already-past.
- **Family fixtures:** a user with **≥3 live families** (3 `deviceId`s) for per-device logout (I4.3),
  logout-all atomicity (I4.4), the session list (I3.8), and **change-password revoke-others-keep-
  current** (I6.1). A **second user (B) with a live family** for the M-3 cross-user ownership test
  (I4.3a).
- **Family-cap fixture (D-007):** a family whose `familyExpiresAt` is in the past while its current
  token's `expiresAt` is still future — for I3.4c (cap expiry ≠ reuse; inherited-unchanged assertion).
- **Dummy hash:** the fixed dummy argon2 hash used by the unknown-email dummy-verify path (U2.1/I2.6).

---

## 7. CI tracks

### Track 1 — scripted (hard gate, blocks merge)
- **Unit** (core-domain + service) — reuse-decision matrix ★ (incl. **leeway D-011** + **family-cap
  D-007** cells, U3.5/U3.6/U3.7), password policy ★ (shared by signup + change-password), email
  normalize ★, argon2 hash/verify/rehash ★, change-password verify-current ★, **tokenHash keyed-HMAC
  vs bare-SHA-256 ★ (U3.8 — L-3)**, backoff curve, dummy-verify branch. **These are the
  golden-rule-#4 merge blockers for F-001.** Note: **no money-stock unit tests apply** (auth ≠
  money — §0).
- **Integration / API** — the `Ix.y` supertest cases above against a test Postgres + Redis (all
  **8** endpoints, incl. change-password I6.x — the N-1 current-family-from-presented-token +
  safe-direction revoke-all + no-IDOR (I6.6) and N-2 `currentPassword` account-throttle (I6.7) — and
  the C-1 committed-revoke / H-3 committed-family-revoke / M-1 always-429 assertions, plus the
  **Low-hardening** cases: **415-before-credential-processing on non-JSON `Content-Type` (I5c.1 —
  L-2)**, **keyed-HMAC `tokenHash` DB/lookup proof (I3.9 — L-3)**, and **`/auth/refresh` IP-only rate
  cap → 429 + Retry-After (I3.10 — L-5)**).
- **E2E** — **Playwright** (web: signup, login, throttle countdown, silent refresh, logout, admin
  reset, **change-password**) + **Flutter** integration (mobile: login-from-body, long-session
  refresh).
- **Non-gating within Track 1:** **I2.6 timing consistency** logs a warning on breach but does **not**
  fail the build (timing is best-effort; structural guarantees U2.1 + I2.2==I2.3 are the real gate).

### Track 2 — agentic (scheduled, non-blocking)
- **Browser Use**, **non-tech Thai SME persona:** signup → login → logout happy path;
  trigger the throttle and read the **countdown message** (must be reassuring "รอสักครู่…", not
  "ถูกล็อก"); spot-check the **session list** ("logged in on N devices"). Findings are triaged into
  Track-1 cases or defects, not a direct merge gate.

---

## 8. Verdict & defect routing

- **Green requires:** all Track-1 unit ★ + integration + E2E pass; every **US-1..US-6** AC has ≥1
  passing mapped case above; reuse-detection determinism (I3.3, loser is benign / family survives)
  stable across repeats; **committed** family revoke on genuine reuse (I3.2, fresh re-query — H-3);
  **cookie-path logout actually revokes the DB row** (I4.1 — C-1); throttle **always 429** with no
  429/401 existence oracle (I2.4/I2.9 — M-1); reuse-leeway benign-retry vs burn boundary (I3.4a/b —
  M-2/D-011); family-cap expiry ≠ reuse + inherited-unchanged (I3.4c — D-007); logout `familyId`
  ownership no-op on foreign family (I4.3a — M-3); fail-open **logged + degraded limiter** (I2.7 —
  M-7); admin-reset **no-op on non-active target** (I5.2a — H-2) and cross-tenant isolation (I5.2);
  change-password **revokes others but keeps current** (I6.1 — D-008/US-6), current-family
  **resolved from the presented refresh token** with safe-direction revoke-all fallback + no-IDOR on
  a client-supplied `familyId` (I6.6 a/b/c — N-1), and `currentPassword` **its-own-429 account
  throttle** that resets on success (I6.7 — N-2) proven; **Low-hardening** all green: non-JSON
  `Content-Type` → **415 before any credential work** (no throttle increment, no user lookup) on
  representative `/auth/*` (I5c.1 — L-2), stored `tokenHash` is the **keyed HMAC-SHA-256, not bare
  SHA-256** and lookup uses it (U3.8 + I3.9 — L-3), and `/auth/refresh` carries an **IP-only** rate
  cap → **429 + Retry-After** that self-heals and mutates no state (I3.10 — L-5).
- **Red loops back to Build**, routed to the owner: domain-logic/rotation/throttle defects →
  `@backend-api`; web transport/CSRF/UI copy → `@frontend`/`@ux`; capability-guard internals →
  `@F-003`/`@backend-api`; CI wiring of the gate → `@devops`.
- qa reports failing tests **as failing with output**, and states any `[manual]`/`[agentic]` step
  that was **skipped** as skipped — never auto-claimed.

---

## 9. Open items — RESOLVED (plan is now final against the 8-endpoint contract)

The two contract ambiguities qa previously flagged are **decided** (D-006) — no BLOCKED items remain;
both cases are now **gating** and their expected results are fixed:

- **~~Auto-login on signup~~ → RESOLVED (D-006(1)): no auto-login.** Signup → `201` (no tokens) →
  client logs in (email pre-filled). **E1.1 / I1.1 assert the 201-no-token behavior as a gate.**
- **~~Per-device logout of a non-current session (`{ familyId }`)~~ → RESOLVED (D-006(3)): IN MVP,
  interactive.** Each non-current session row has a "log out this device" action calling
  `/auth/logout { familyId }`. **I4.3 is a gate** (per-device revoke works); **I4.3a** (M-3 ownership
  no-op on a foreign family) gates alongside it.

Also folded in and no longer open (product scope decisions):
- **Reuse wire response** → generic `401 INVALID_REFRESH` (D-006(2)) — I3.2/I3.4a/b assert generic
  401 + the internal audit event.
- **Session-lifetime cap** → `familyExpiresAt` = login+90d (D-007) — I3.4c.
- **Change-password** → in scope as US-6 (D-008) — I6.x / U6.x.
- **Identifier abstraction** → service-layer seam only, schema unchanged (D-009) — no test-surface
  change (still `email` in requests); U1.1 normalize is expressed through that seam.
- **Admin-reset cross-org residual** → accepted dogfood trade-off (D-010), member closes it via
  change-password — I6.4 demonstrates the closing path.

> With D-006..D-011 decided, **every** expected result is now derivable from the FINAL contract —
> the plan reads as final. qa's remaining job is execution + the truthful verdict (§8), not further
> escalation. Frontmatter stays `signoff: pending` until qa runs the gate.
