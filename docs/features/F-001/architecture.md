---
doc: F-001 architecture — authentication (JWT access/refresh, rotation + reuse detection, throttle, argon2id)
owner: "@backend-api"
signoff: approved     # pending | approved
---

# F-001 — Architecture (Gate 2)

> Scope contract = [F-001-authentication.md](../F-001-authentication.md) Gate 1 (US-1..US-5, 5 golden rules referenced from [CLAUDE.md](../../../CLAUDE.md)).
> Builds on F-000 schema: `User`, `RefreshToken`, `Membership` already exist ([F-000/data-model.md](../F-000/data-model.md) §Tenancy & Auth, D-004).
> Infra already provisioned by F-000: Redis + `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL` env ([F-000/infra.md](../F-000/infra.md) §8/§9).
> Authoritative model = [docs/01-data-model.md](../../01-data-model.md) §Tenancy & Auth.

**Scope of this doc:** the *technical & security design* — token model, rotation/reuse
algorithm, throttle model, hashing choice, admin-reset flow, storage split. It is FIRST
of the Gate-2 chain → drives `data-model.md` (the `RefreshToken`/`User` deltas I flag in
§6 become concrete Prisma there) → drives `api-spec.md` (the endpoints in §7). No
implementation code here (brief pseudocode only where an algorithm needs it). UX (§8) and
test plan (§11) are owned by `ux` / `qa`.

**Golden-rule note:** auth touches no stock/money ledger, so golden rules 2/5/7 (ledger,
money-stock txn, Decimal) do not apply. The rules that *do* bite here: **#3 org-scoping** —
and the key architectural constraint is that **auth is the one place org-scoping does NOT
apply** (User is system-wide, see §1.1); **#4 unit tests on security-critical logic**
(rotation/reuse/hash-verify) before merge; **#6 pure functions in `core-domain`** for the
token-family reuse-detection decision logic.

---

## 1. Core constraint: auth ≠ membership (org-scoping boundary)

### 1.1 Where `organizationId` enters (and where it must NOT)
`User` is a **system-wide identity** — no `organizationId` (F-000 AC6 allowlist, D-004).
A user can log in while belonging to **0..* organizations**. This produces a hard
architectural seam:

```
  ┌─────────────────── AUTHENTICATION (F-001) ───────────────────┐
  │  identify the human · issue tokens · no org context at all    │
  │  claims carry: userId (sub) — NOT organizationId, NOT role     │
  └───────────────────────────────────────────────────────────────┘
                              │ authenticated principal = { userId }
                              ▼
  ┌────────────────── AUTHORIZATION (F-002 / F-003) ──────────────┐
  │  resolve Membership(userId, orgId) → role → capabilities       │
  │  org-scoping (golden rule #3) begins HERE, per request         │
  └───────────────────────────────────────────────────────────────┘
```

- **Access/refresh tokens contain `userId` only** (`sub`). They deliberately carry **no**
  `organizationId` and **no** role/capabilities. Rationale: (a) a token would otherwise go
  stale the instant membership/role changes (revoke lag = security hole); (b) org switching
  (docs/01: "1 User → หลาย Org, org switcher") must not require re-login; (c) keeps the
  token small and the auth layer ignorant of the domain.
- **Org selection is a per-request concern, not a token concern.** The client sends the
  active org via an `X-Org-Id` header (or path param) on domain requests; an `OrgContext`
  guard (F-002/F-003 territory) resolves `Membership(userId, X-Org-Id)` fresh from the DB
  each request and rejects if there is no `active` membership. F-001 stops at proving
  "who" — it does not resolve "which org / what may they do".
- **Consequence for the removed-from-all-orgs edge (Gate 1 §4):** such a user still
  authenticates successfully (valid tokens) but every domain request fails org resolution
  → they see no org data. This falls out for free from the seam above; F-001 needs **no
  special handling** for it. Login itself must never check membership.

### 1.2 What F-001 owns vs defers
| Owns (F-001) | Defers |
|---|---|
| signup / login / logout / refresh | membership resolution, org switch (F-002) |
| issue + verify + rotate tokens, reuse detection | capability/permission checks (F-003) |
| password hashing + policy | self-serve email reset (F-081 — no SMTP yet) |
| IP + account throttle | 2FA/OTP, social login, SSO (out, Gate 1 §3) |
| admin reset (owner/admin sets member pw) | audit-log emission wiring (F-005 consumes our events) |
| self-serve change-password (US-6, D-008) | self-serve *forgot*-password via email (F-081) |

### 1.3 Identifier abstraction (D-009 — doc-note, no schema/contract change)
Gate-1 §3 promised an abstract identifier (`identifier + type`, seam for future phone+OTP).
**Decision D-009:** honor it as a **service-layer abstraction only** — the login/lookup path
treats the credential as an `identifier { type, value }` where `type = "email"` is the sole
type in MVP; normalization and throttle keys are expressed in terms of that abstraction. The
**database stays `User.email`** (no `Identifier` table, no schema change, no contract change —
requests still send `email`). Adding a second type (e.g. `phone`) later plugs in at the
service layer; only *then* would a schema change be evaluated, and that is out of F-001. This
keeps the scope promise honest without shipping an empty table. (data-model §1 carries the
same note.)

---

## 2. Token strategy

### 2.1 Two-token model (why, not just "JWT is standard")
We split a **short-lived stateless access token** from a **long-lived stateful refresh
token** because the two have opposite requirements:

- **Access token** is checked on *every* API request → must be verifiable **without a DB
  hit** (latency budget). → **stateless JWT**, signed, ~15 min TTL. We accept that it
  cannot be revoked mid-life; the short TTL bounds the blast radius of a leaked access
  token to ≤15 min. We do **not** run an access-token blacklist in the hot path (a
  per-request Redis lookup would defeat the point of a stateless token); "logout" and
  "revoke" act on the *refresh* side (§4), and the access token simply expires.
- **Refresh token** is presented rarely (only when access expires, ~every 15 min per
  device) → we can afford a DB round-trip → **stateful, stored, revocable, rotated**. This
  is where all the security machinery lives (rotation, reuse detection, per-device/per-
  family revocation).

This asymmetry is the whole point: cheap stateless checks on the frequent path, expensive
stateful control on the rare path.

### 2.2 Access token — JWT structure
- **Type:** signed JWT (JWS), **HS256** for MVP. Rationale: single API service signs and
  verifies (no third party needs to verify our tokens), so a shared secret (`JWT_ACCESS_SECRET`,
  already in F-000 env) is simpler than key distribution. **Migration path to RS256/EdDSA**
  is noted for when mobile/edge or a separate service must verify without holding the signing
  secret — we keep the `alg` in the header and never trust client-supplied `alg` (§9).
- **TTL:** **15 minutes** (`exp`). Balances revoke-lag vs refresh chattiness.
- **Claims (deliberately minimal):**
  ```
  { sub: userId, iat, exp, jti, typ: "access" }
  ```
  - `sub` = `User.id`. **No org, no role, no email** (see §1.1; email is PII, keep it out).
  - `jti` = unique id (for tracing/log correlation; access tokens are not individually
    revocable, so `jti` is not looked up on the hot path).
  - `typ: "access"` — explicit token-type claim so a refresh token can never be replayed
    as an access token and vice-versa (checked on verify; defends against type confusion).
- **Verification (hot path):** signature + `exp` + `typ==="access"` only. No I/O. A NestJS
  `JwtAuthGuard` (passport-jwt strategy, §7 tech stack) populates `req.user = { userId }`.

### 2.3 Refresh token — value & storage
- **The token value is a high-entropy opaque random string** (≥256 bits from a CSPRNG),
  **not a JWT.** Rationale: a refresh token's authority comes from matching a stored
  server-side record, not from self-contained claims — making it a JWT would add parsing
  surface and tempt us to trust its claims. Opaque + server lookup is simpler and safer.
- **We store only a keyed hash of the token** — **`HMAC-SHA-256(JWT_REFRESH_SECRET,
  tokenValue)`** (L-3). We don't need a *slow* password hash (the token is already high-entropy
  random, so a fast hash gives "DB leak ≠ usable tokens"), but we **key** the fast hash with the
  F-000 `JWT_REFRESH_SECRET` env secret as free hardening: with plain SHA-256 an attacker holding
  only a DB dump could still *verify* guessed tokens offline; with an HMAC key held in the env
  (not the DB), a dump **alone** cannot even verify a guess — offline attack now requires both the
  DB and the env secret. This also gives the otherwise-idle `JWT_REFRESH_SECRET` a real purpose
  (the refresh token is opaque, not a JWT, so the secret is no longer a JWT signer — see §9). The
  plaintext is returned to the client once and never persisted. Lookup = compute the HMAC of the
  presented plaintext and match `tokenHash` (data-model §2.2/§2.4).
- **Per-token TTL:** **60 days** default (`expiresAt`). This **slides** — each rotation mints
  a successor with a fresh 60-day `expiresAt`. It bounds how long a single un-rotated token is
  usable, not the session as a whole.
- **Absolute family-lifetime cap (D-007):** **90 days** from the original login
  (`familyExpiresAt` = login time + 90d), **inherited unchanged on every rotation** (unlike
  `expiresAt`, it does *not* slide). Rotation is refused once `now() > familyExpiresAt`
  (§3.1), so a rotation chain — however often it refreshes — dies at most 90 days after login
  and the user must re-login. This gives the Gate-1 30–90d band a real ceiling instead of
  sliding-forever, and ages out a stolen-but-unnoticed device session. Surfaced to the client
  as ordinary session expiry (generic `401 INVALID_REFRESH`, no family revocation, no audit
  event — the family simply aged out). Both `expiresAt` and `familyExpiresAt` live in one
  config constant so the 60d/90d values are tunable.
- Stored in the existing `RefreshToken` table (§6 / data-model §2.1 list the deltas F-001
  requires).

---

## 3. Refresh-token rotation + reuse detection (the security core)

### 3.1 Token *family* (chain) model
Every login creates a new **family** (a rotation chain) bound to one device/session. Each
refresh mints the next token in the same family and invalidates the current one:

```
login → RT1 ─rotate→ RT2 ─rotate→ RT3 ─rotate→ RT4  (family F, deviceId D)
        (used)        (used)        (used)     (current, only valid one)
```

- On **login:** create `RefreshToken{ familyId: new, rotatedFrom: null, deviceId,
  expiresAt: now()+60d, familyExpiresAt: now()+90d }`. The new `familyId` groups the whole
  chain and `familyExpiresAt` fixes its absolute death (D-007); both are F-001 deltas to the
  F-000 schema — see §6 / data-model §2.1.
- On **refresh (rotation):** in **one DB transaction** (row-locked on the presented token,
  data-model §2.4) — (a) verify the presented token is the *current, non-revoked, non-expired*
  member of its family **and that the family cap has not been reached** (`familyExpiresAt >
  now()`, D-007 — else refuse rotation → generic `401`, ordinary session expiry, no family
  revocation); (b) mark it rotated/consumed; (c) insert the successor `RefreshToken{ familyId:
  same, rotatedFrom: presentedId, deviceId, expiresAt: now()+60d, familyExpiresAt: inherited
  unchanged }`; (d) return the new access + new refresh token. Rotation is atomic so two
  concurrent refreshes can't both "win" (the `rotatedFrom`/consumed check inside the txn
  serializes them — the loser sees an already-consumed token → **within the reuse-leeway
  window** it's a benign retry (§3.5), else treated as reuse (§3.3)).
- **The reuse branch does NOT roll the rotation txn back onto itself.** Signalling reuse by
  *throwing* inside the rotation `$transaction` would undo the family revocation (H-3) — so
  the family-wide `revokedAt` is written in a transaction that **commits** and the 401 is
  returned *after* the commit. Exact structure + the leeway carve-out are in data-model §2.4.

### 3.2 Consumed vs current
A stored token is in exactly one state, derived (no redundant column beyond what's needed):
- **current** — newest in family, `revokedAt = null`, not yet superseded, not expired → the
  only token that may be exchanged.
- **consumed** — already rotated (a successor with `rotatedFrom = thisId` exists). Presenting
  a consumed token is the reuse signal.
- **revoked** — `revokedAt != null` (logout, family revocation, or admin action).

### 3.3 Reuse detection → family revocation
**Invariant:** a correctly-behaving client only ever holds the *current* token — after
rotation it discards the old one. Therefore **presentation of a consumed (or revoked) token
means the chain leaked** (an attacker used a token the legit client already rotated past, or
the legit client is racing an attacker). Response:

1. **Revoke the *entire family*** (`revokedAt = now()` on all `RefreshToken` where
   `familyId = F`) — including the current one. This logs the legitimate client out of that
   device too, which is correct: we cannot tell attacker from victim, so we burn the whole
   session and force a fresh login. **This revoke MUST commit** — it runs in a transaction
   that is committed *before* the 401 is returned (never a throw-to-rollback inside the
   rotation txn), otherwise reuse detection is detection-without-response (H-3; see the exact
   two-option structure in data-model §2.4).
2. **Do not** revoke other families → other devices stay logged in (per-device isolation).
3. **Emit a security event** (`auth.refresh.reuse_detected`, `{ userId, familyId, deviceId }`)
   for F-005 audit-log to consume — emitted **post-commit** so it is never lost with a
   rollback.

**Scope of "reuse":** presenting a consumed/revoked token is the reuse signal *only outside*
the reuse-leeway window (§3.5). A just-rotated immediate predecessor replayed within the
window is a benign client retry, not an attack, and does **not** trigger family revocation.

The **decision** ("given this token's state + family state, allow / rotate / revoke-family")
is a **pure function in `core-domain`** (golden rule #6) — it takes token+family state as
plain values and returns an action enum, so it is unit-testable without a DB (golden rule
#4). The service layer executes the returned action inside the transaction.

### 3.4 Why chain-based, not a simple deny-list
Chain/family revocation gives **automatic compromise containment**: we don't need to know
*which* token leaked or maintain a global blacklist — the first replay of any superseded
token trips the wire and nukes the session. It also self-limits storage (one live token per
family; consumed rows are prunable after `expiresAt`).

### 3.5 Reuse-leeway window — DECISION (M-2, logged as D-011)
**Decision: adopt a bounded reuse-leeway window (option (a) in the review), ~60s.**
Presenting the **immediate predecessor** of the current token — i.e. `∃ current row WHERE
rotatedFrom = presented.id` — **within 60s** of that successor's creation is treated as a
**benign retry**, not reuse: the server responds `401 INVALID_REFRESH` **without** revoking
the family, and the client re-refreshes with its current token (web) / cookie and continues.
Anything **older** (predecessor replayed after the window) or any **deeper ancestor** (a
grandparent+ token, which a correct client never holds) still trips the full family
revocation of §3.3.

**Rationale.** Strict zero-grace rotation turns two *legitimate* patterns into forced logout:
(1) mobile on a flaky link commits the rotation server-side but the response is lost → the
client retries with the only token it has, now consumed; (2) web multi-tab shares one
`omni_rt` cookie and two tabs refresh at access-expiry → the loser burns the family for both.
Both are safe-direction failures (logout, not breach), but they antagonize US-3 ("stay logged
in") and would demand flawless client single-flight to avoid self-DoS. A 60s leeway absorbs
lost-response retries and cross-tab races while keeping the security property intact: an
attacker replaying a token the victim rotated past **more than 60s ago**, or replaying any
non-immediate ancestor, is still caught and the family is burned. The window is bounded and
small, so the widened race surface (attacker + victim both refreshing the same token inside
60s) only costs one side a benign `401`, never a missed compromise of a stale token.

*Alternative rejected:* strict rotation + mandatory frontend single-flight + mobile
retry-then-relogin — pushes correctness onto every client and still self-DoSes on genuine
lost responses. **Logged in DECISIONS.md as D-011;**
frontend informed (client still single-flights as defense-in-depth, but is no longer required
to be flawless to avoid logout).

---

## 4. Session / device tracking

- **Each family = one device session.** `deviceId` (already on `RefreshToken`) is supplied
  by the client at login: a stable per-install id (mobile: from secure storage; web: a
  persisted random id in an httpOnly cookie or localStorage). It is a **convenience label
  for "log out this device", not a security boundary** — we never grant authority based on a
  client-claimed `deviceId` (it's spoofable); authority always comes from possessing the
  current token of a non-revoked family.
- **Multi-device login:** N logins = N families for the same user, each independently
  rotating and revocable.
- **List sessions:** query live families for `userId` (current token per family +
  `deviceId`, `createdAt`, last-used) → "logged in on 3 devices" (Gate 1 US-3 AC).
- **Per-device logout:** revoke the family for that `deviceId`/`familyId`.
- **Logout current device:** revoke the caller's family (from the presented/known refresh
  token). Access token still lives ≤15 min by design (§2.1) — acceptable; there's no
  server-side access-token kill in MVP.
- **Logout all devices** (Gate 1 US-4, also the natural response to "I think I'm hacked"):
  revoke **all** families for `userId`. Also the correct action after an **admin password
  reset** (§5) — resetting the password revokes every family so old sessions die.
- **Change own password** (US-6, D-008): revoke **all families *except* the caller's current
  one** — a self-initiated password change should evict other devices (natural "secure my
  account" moment) without logging the user out of the device they're actively on. Contrast
  with admin-reset, which revokes *all* families (the target isn't the one initiating).

---

## 5. Password hashing & policy

### 5.1 Algorithm — argon2id (decided Gate 1, params decided here)
- **argon2id** (hybrid: resists both GPU and side-channel/cache-timing attacks) via the
  `argon2` native binding. Chosen over bcrypt (72-byte truncation, weaker against GPU) and
  scrypt; argon2id is the OWASP/PHC first recommendation.
- **Params (starting point, OWASP-aligned, tune to hardware):**
  `memoryCost = 19 MiB (19456 KiB)`, `timeCost = 2`, `parallelism = 1`. Re-benchmark on the
  target host to keep a single verify near ~50–100 ms (attacker-cost vs login-latency
  balance). Params live in one config constant so they can be raised over time.
- **Salt:** per-password, ≥16 bytes, generated by the library and **embedded in the encoded
  hash string** (PHC format `$argon2id$v=19$m=...,t=...,p=...$salt$hash`). We store that one
  string in `User.passwordHash` — no separate salt column.
- **Rehash-on-login:** on successful login, if the stored hash's params are below current
  config, transparently re-hash the just-verified plaintext and update `passwordHash`. Lets
  us raise cost over time without a mass migration.

### 5.2 Policy — NIST SP 800-63B (Gate 1 §4)
- **Minimum length 8** (US-1 AC); allow long passphrases (cap ~64–128 to bound hashing cost);
  accept all Unicode incl. spaces; **no composition rules** (no forced upper/digit/symbol —
  they harm usability without helping, per 800-63B).
- **Breached/common-password check:** reject against a known-compromised/top-common list.
  MVP = a bundled top-N common-password set (offline, no external call). A HaveIBeenPwned
  k-anonymity range check is a fast-follow, not MVP (avoids an external dependency on the
  signup hot path).
- **Verification is constant-time by construction** (argon2 verify) — see §9 timing.

---

## 6. Data-model deltas this architecture requires (hand-off to data-model.md)

> This is the *architectural requirement list*, not the final schema — `data-model.md`
> (next in the Gate-2 chain) makes these concrete Prisma + migration. F-000 shipped the
> base `RefreshToken{ id, userId, deviceId, rotatedFrom?, revokedAt?, createdAt }`.

**`RefreshToken` — add:**
- `familyId String` (indexed) — groups a rotation chain for family-wide revocation (§3).
  On login `familyId` = a fresh id; on rotation, inherited from predecessor.
- `tokenHash String @unique` — **`HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue)`** (keyed hash,
  L-3); lookup key (§2.3). Never store plaintext.
- `expiresAt DateTime` — per-token 60-day expiry (§2.3), **slides** on rotation, independent
  of `revokedAt`.
- `familyExpiresAt DateTime` — absolute family-lifetime cap = login + 90d (§2.3, D-007),
  **inherited unchanged** on rotation; rotation refused once passed.
- (optional) `lastUsedAt DateTime?` — for the session list UX (§4); nice-to-have, not
  security-critical.
- Indexes: `@@index([familyId])`, `@@index([userId, revokedAt])` (list live sessions),
  keep existing `@@index([rotatedFrom])`.

**`User` — no structural change required.** `email`, `passwordHash`, `verified` already
exist (F-000). We only *use* them. Email is normalized (lowercase+trim, Gate 1 §4) **before**
hitting the existing `@unique(email)` — normalization is a service-layer concern, not a new
column.

**No new tables.** Throttle state and (future) any short-lived auth state live in **Redis**
(§7), not Postgres — they are ephemeral counters, not records of truth.

---

## 7. Tech stack & storage split

| Concern | Choice | Why |
|---|---|---|
| Framework wiring | NestJS **guards + passport** (`passport-jwt` for access, custom strategy for refresh) | idiomatic Nest; guard is the single choke-point that populates `req.user` |
| Access-token sign/verify | `@nestjs/jwt` (HS256, `JWT_ACCESS_SECRET`) | already an env in F-000; no extra infra |
| Refresh token value | Node `crypto.randomBytes` (opaque, ≥256-bit) + **HMAC-SHA-256(`JWT_REFRESH_SECRET`, value)** for storage (L-3) | not a JWT (§2.3); keyed hash so a DB dump alone can't verify guesses |
| Password hash | `argon2` (argon2id) | §5.1 |
| Throttle / rate-limit state | **Redis** (atomic `INCR`+TTL / sliding window) | F-000 already boots Redis; counters are ephemeral & must be shared across API instances |
| Refresh-token store | **Postgres** (`RefreshToken`) | stateful, needs the rotation chain + family joins + durability |
| Reuse-decision logic | **`packages/core-domain`** pure fn | golden rules #4/#6 |

**Storage split rationale — Postgres vs Redis:** durable, relational, must-survive-restart
state (the refresh chain, who's logged in where) → **Postgres**. Ephemeral, high-write,
auto-expiring counters (failed-login tallies, throttle windows) → **Redis** (a DB write per
failed login attempt is both wasteful and a self-inflicted DoS amplifier). We do **not** use
Redis as an access-token blacklist (§2.1). BullMQ is **not** needed for F-001 (no async
external work; everything is request-synchronous).

**Transaction boundaries:** the rotate-and-mint step (§3.1) and family/all-device revocation
(§4) run in a single Prisma `$transaction` so the "consume old + mint new" (or "revoke all
in family") is atomic — no window where zero or two current tokens exist.

---

## 8. Rate-limiting & brute-force protection

### 8.1 Two independent dimensions (both required, Gate 1 US-2 AC)
- **IP-level** (defends the *endpoint* against volumetric brute-force / credential
  stuffing): sliding-window cap on `POST /auth/login`, `/auth/signup` **and `/auth/refresh`**
  per source IP — e.g. **~20 attempts / 5 min / IP**, then throttle. Coarse; a shared NAT/office
  IP tolerates several users. **`/auth/refresh` is included as plain hygiene (L-5):** token
  brute-force is infeasible (256-bit opaque value), so refresh needs **no account dimension** —
  just a coarse IP cap (reusing the same `throttle:ip:{ip}` sliding window, data-model §4) so
  the endpoint can't be run as a free DB-lookup treadmill. Trip → `429 + Retry-After` like the
  other pre-auth endpoints.
- **Account-level** (defends a *specific account* against targeted guessing): counter keyed
  by the **submitted normalized email**, incremented on each failed login for that submitted
  identity **whether or not it resolves to a real `User`** (M-1 — if the counter only
  incremented for existing users, the differential `429`-vs-`401` on the Nth attempt would be
  a clean existence oracle that bypasses the dummy-verify timing defense), reset on success.
  Exceeding the threshold triggers backoff **regardless of source IP** — this is what stops a
  distributed/botnet attack that rotates IPs (§8.3).
- **Same account-level machinery guards `POST /auth/change-password` (N-2).** The
  `currentPassword` verification on change-password is a password check too, and a live access
  token would otherwise let an attacker brute-force it with zero backoff (reopening the
  credential-theft vector H-1 closed). It reuses the identical backoff, but keyed on the
  **authenticated `userId`** (`throttle:acct:{userId}`) — there's no submitted email and the
  caller identity is already proven by the Bearer token, so no enumeration concern applies
  here. A wrong `currentPassword` increments; a correct one resets; trip → `429 + Retry-After`
  (api-spec §2.7).

### 8.2 Threshold + backoff curve (not hard-lock)
- After **5** consecutive failures for an account (Gate 1 US-2), apply **exponential backoff**
  on subsequent attempts for that account: e.g. delay/deny windows growing
  `~1s → 2s → 4s → 8s …` capped at a ceiling (e.g. 15 min). Backoff is enforced by "reject
  with `retryAfter` until window elapses", not by sleeping the request thread (thread-sleep
  is a DoS vector).
- **Never a permanent hard-lock** (Gate 1 US-5 AC: "ห้ามมีเคสล็อกตัวเองออกถาวร"). Backoff
  is **self-healing**: the window always expires, and a successful login (or admin reset,
  §5) clears the counter. This is the explicit anti-lockout guarantee.
- **Throttle is always its own response: `429 RATE_LIMITED` + `Retry-After`** — it is **not**
  folded into the credential-failure `401` (M-1: a self-contradictory "throttled ⇒ 401 *and*
  429" is an enumeration trap and UX needs the 429 countdown, D-005). The enumeration
  guarantee is therefore scoped precisely: **the *credential* failures are indistinguishable**
  — wrong password vs unknown email both return the identical `401 INVALID_CREDENTIALS` shape
  + timing (§9). Throttle does **not** need to hide behind that shape, **provided it cannot
  itself become an existence oracle**: the account counter keys on the **submitted normalized
  email whether or not a `User` exists** and returns identical `429` behavior either way (see
  §8.1), so a nonexistent email and a real one throttle identically. We never emit a distinct
  "this account is locked" message (that *would* leak existence) — only the generic
  `429 + Retry-After`.

### 8.3 Distributed / edge cases
- **Distributed IP attack (botnet):** IP throttle is useless when each attempt comes from a
  fresh IP → the **account-level** counter is the backstop, since it keys on the *target
  identity* not the source. This is precisely why both dimensions exist.
- **Account-level DoS (attacker locks out a victim by failing on purpose):** mitigated by
  choosing **backoff, not lock** (victim can still get in once the short window passes, and
  a correct password is what matters), and by the counter being consecutive-failure based
  (a legit success resets it). We accept mild friction over a permanent-lockout footgun.
- **Trusted proxy / real client IP:** the source IP must be derived from the **trusted
  proxy chain** (`X-Forwarded-For` only honored from known proxies), not a raw client-
  claimed header — otherwise IP throttle is trivially bypassed by spoofing `X-Forwarded-For`.
  devops owns the proxy trust config; flagged as a cross-domain dependency below.
- **Redis unavailable (fail-open, but not blind — M-7):** if the throttle store is down we
  **keep failing open on the distributed throttle** (allow the auth attempt) rather than lock
  everyone out — auth availability > throttle during a Redis outage, and other layers (short
  token TTL, argon2 cost) still bound abuse. But a naked fail-open turns any Redis outage
  (possibly attacker-induced) into a fully unthrottled brute-force window, so we add three
  guards, none needing new infra:
  1. **Degraded fallback: a best-effort in-process IP limiter.** When Redis is unreachable,
     each API instance applies a local (per-process, in-memory) IP cap on `/auth/login` and
     `/auth/signup`. It is coarse and per-instance (not shared across the fleet), so it is a
     dampener, not the real control — but it removes the "single IP hammers unbounded"
     worst case for free.
  2. **Observability: every fail-open decision is logged** (a distinct log signal /
     structured event, e.g. `auth.throttle.fail_open`), and **Redis-down alerting** is wired
     so the outage is noticed, not silently absorbed. Alerting/monitoring config is
     **@devops** (flagged in §12).
  3. **qa** extends the existing fail-open test to assert the log/alert signal fires and the
     in-process limiter engages — not just that auth still succeeds (flagged in §12).

---

## 9. Security considerations

- **Account-enumeration resistance (Gate 1 §4):** identical generic response + timing for
  (a) wrong password, (b) unknown email, (c) throttled — all return the same "invalid
  credentials" shape. Signup with a duplicate email is the one *necessary* leak (the user
  must be told the email is taken) — Gate 1 accepts this ("ไม่รั่ว privacy เกินจำเป็น"); we
  keep the message minimal. **Admin reset & (future) self-serve reset** always respond
  success-shaped whether or not the target exists (Gate 1 §4).
- **Timing attacks:** (a) argon2 verify is constant-time. (b) **On unknown email we still
  perform a dummy argon2 verify** against a fixed dummy hash so the login path takes the
  same time whether or not the account exists (prevents "fast reject ⇒ no such user").
- **`alg` confusion / token forgery:** verifier pins the expected algorithm (HS256) and the
  `typ` claim (§2.2); never accept `alg: none` or a client-chosen `alg`. **Only the access token
  is a JWT** (`JWT_ACCESS_SECRET` signs/verifies it). The refresh token is an **opaque random
  value, not a JWT** (§2.3), so there is **no second JWT signer** — `JWT_REFRESH_SECRET` is
  **not** a JWT-signing key. Instead it is repurposed (L-3) as the **HMAC key for `tokenHash`**:
  `tokenHash = HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue)` (§2.3). Keeping the two env secrets
  in **separate scopes** still holds — the access-JWT signing secret and the refresh-hash HMAC
  key are distinct, so compromising one does not grant the other — but the two are *not* "two JWT
  signers" (that was a stale F-000 assumption; the refresh token was never a JWT once §2.3 made it
  opaque). `JWT_REFRESH_SECRET` already exists in F-000 env, so this repurpose adds no new secret.
- **Refresh-token leakage:** rotation + reuse detection (§3) is the primary containment —
  a stolen refresh token is single-use and its first replay after the victim's next refresh
  burns the family. At-rest, only the **hash** is stored (DB dump ≠ usable tokens, §2.3).
- **Access-token leakage:** bounded to ≤15 min by TTL (§2.1); minimal claims (no PII/role)
  limit what a leaked token discloses.
- **Transport / storage:** tokens only over TLS (devops). **Mobile** stores tokens in secure
  storage (Keychain/Keystore) and wipes on logout (Gate 1 US-4 AC — F-006 implements).
  **Web** keeps the refresh token in an **httpOnly, Secure, SameSite=Strict** cookie
  (`omni_rt`, `Path=/auth`) — out of JS reach → XSS-resistant. This is now **locked in
  api-spec §0**: the client declares `tokenTransport` at login and the plaintext refresh
  token is delivered on **exactly one** channel (cookie **xor** body), so on the web path the
  rotated token is never present in a JS-readable response body (H-1 — an XSS payload can
  trigger `/auth/refresh` but cannot read the rotated token out of the httpOnly cookie).
- **Login-CSRF (L-2):** `/auth/login` has no CSRF token (it can't — the user isn't authenticated
  yet), so a cross-site auto-submitting HTML form could otherwise log a victim into an
  **attacker's** account. Defense: **all `/auth/*` POSTs require strict
  `Content-Type: application/json`** → non-JSON (form-encoded/multipart) is rejected `415`
  *before* credential processing (api-spec §3). An HTML form can't emit that content-type, and a
  cross-origin `fetch` with it triggers a CORS preflight the API won't allow — so no cross-site
  form-POST reaches these endpoints. This complements the `SameSite=Strict` cookie defense on the
  refresh path (§9 transport) and is enforced uniformly across auth POSTs.
- **Password reset does not leak:** admin reset (§5) revokes all the target's families, so a
  reset also serves as "kick all sessions".

---

## 10. Admin reset flow (recovery MVP) — scope

**In MVP (F-001):**
- An **Owner/Admin of an org the target user is a member of** can set/reset that member's
  password (Gate 1 US-5 AC). Flow: privileged endpoint (capability-checked via F-003, e.g.
  `manage_members`) → set a new `passwordHash` (argon2id) for the target `User` → **revoke
  all the target's refresh-token families** (§4, forces re-login everywhere) → emit
  `auth.password.admin_reset` for audit (F-005).
- **Authorization is org-scoped, and both memberships must be `status = active` (H-2).** The
  acting admin must hold the capability via an **`active`** `Membership(callerUserId, orgId)`
  **and** the target must have an **`active`** `Membership(targetUserId, orgId)`. Because
  `User` is system-wide, an admin resets a member **through the shared *active* org
  membership**, never a global "reset any user" power. Pinning to `active` is load-bearing,
  not cosmetic: F-000 keeps membership rows on removal (`MembershipStatus { active invited
  revoked }`, "deactivate ไม่ delete"), so a mere *existence* check would let Org A's admin
  reset the **global** `passwordHash` of a **revoked** ex-member who now works only at Org B —
  handing Org A a credential valid in Org B (cross-tenant account takeover). Same hole for an
  `invited` target who never accepted. Any failure (caller not active / lacks capability, or
  target not active) → the existing **same-shape `404`** (no cross-org/status enumeration).
  The capability check itself is F-003's guard; F-001 defines the reset effect + the
  active-status precondition.
- **Residual trade-off + its structural fix (D-008/D-010):** even with the active-status fix,
  resetting a shared *active* member briefly gives the admin a credential valid in that
  member's other orgs (`passwordHash` is global). The structural fix is now **in scope**:
  the member can immediately call **`POST /auth/change-password`** (US-6, D-008 — Bearer,
  verify current, set new, revoke all *other* families) to rotate the admin-chosen password
  and evict any lingering admin knowledge. The only remaining sliver — a member who *never*
  changes it — is a known, small dogfood trade-off logged as **D-010** (product accepts;
  F-081 self-serve email reset later removes even the admin-chosen-password step).
- **No email infrastructure required** — the new password is delivered out-of-band by the
  admin (Gate 1 explicitly de-scopes SMTP). No token, no email link, no expiry to manage.

**Deferred to F-081 (needs SMTP):** self-serve "forgot password" via emailed one-time reset
link, email verification of the `verified` flag. F-000 already carries `verified=false`;
F-001 sets it, F-081 flips it.

**Anti-lockout guarantee (Gate 1 US-5 AC "ห้ามล็อกตัวเองออกถาวร"):** the Owner role is
system/locked (F-000 `Role.isSystem`), and admin-reset + self-healing throttle (§8.2) mean
there is always a path back in. The one residual risk — *a sole Owner forgets their own
password before F-081 ships* — is a known MVP gap; mitigation options (a break-glass
support-side reset, or making F-081 a fast-follow) are a **product** call, flagged below.

---

## 11. Constraints & assumptions

- **Redis is available** (F-000 boots it; `REDIS_URL` set) — throttle depends on it; Redis-
  down behavior is fail-open with a degraded in-process IP limiter + logged/alerted (§8.3 M-7).
- **Reuse-leeway window (~60s, §3.5, D-011):** a just-rotated immediate predecessor replayed
  within the window is a benign retry (no family revocation); older/deeper replays still burn
  the family. Tunable via one config constant.
- **Single API deployment for MVP** → HS256 shared-secret is fine; multi-verifier future →
  RS256/EdDSA (§2.2). No key-rotation tooling in MVP (single active secret per scope).
- **DB latency budget:** access verification does **zero** DB I/O (§2.2); only refresh/login/
  logout touch Postgres — acceptable since those are infrequent.
- **Token size:** access JWT stays small (minimal claims, §2.2) — well within header limits.
- **Clock skew:** allow a small `exp`/`iat` leeway (~30s) on access verification for mobile
  clock drift.
- **Depends on F-000** (schema + Redis/JWT env) — shipped. **Enables** F-002 (org context
  guard consumes `req.user.userId`), F-003 (capability guard), F-005 (consumes our auth
  security events), F-006 (mobile secure-storage + refresh loop).

---

## 12. Cross-domain flags (route from PM)

- **@devops** — trusted-proxy config so real client IP is derived from `X-Forwarded-For`
  only via known proxies (§8.3); TLS termination for token transport (§9); **Redis-down
  alerting + wiring so the `auth.throttle.fail_open` log signal is monitored** (§8.3 M-7).
  No new infra (Redis/JWT env already in F-000; the degraded IP limiter is in-process).
  **Global `/auth/*` request ceiling — @devops hardening requirement for Build (L-4).** Every
  login attempt costs ~50–100ms of argon2 CPU (the dummy-verify on unknown email is inherent to
  enumeration resistance, §9 — we **keep** it), so a distributed rotating-email/IP attack can
  amplify that into CPU exhaustion. The account/IP throttles (§8) don't bound this because the
  attacker rotates both dimensions; the real mitigation is a **service-level global request
  ceiling on `/auth/*`** (edge/gateway-level cap, e.g. total req/s across the auth surface),
  which is **infra, not a contract change**. Flagged here so it becomes a @devops task in
  tasks.md. Do **not** remove the dummy-verify (that would trade CPU-DoS for an enumeration
  oracle — the worse bug).
- **@frontend / @ux** (contract changes now locked in `api-spec.md`, review relayed):
  (1) web declares `tokenTransport: "cookie"` at login and treats body `refreshToken` as
  `null` — the refresh token is only ever in the httpOnly `omni_rt` cookie (H-1); (2)
  `omni_rt`/`omni_csrf` are `Path=/auth` so logout / sessions carry the cookie (C-1);
  (3) the reuse-leeway window (§3.5, D-011) means a benign predecessor-replay returns a
  generic `401` **without** forcing logout — client should single-flight refreshes and retry
  once with its current token before re-login (defense-in-depth, no longer mandatory to
  avoid self-DoS).
- **@product** — (1) sole-Owner self-lockout residual gap before F-081 (§10): accept as a
  known MVP gap, or pull F-081 forward / add a support-side break-glass reset? (2) residual
  admin-reset cross-org credential trade-off even after the active-status fix (§10) — now
  substantially reduced by the self-serve change-password endpoint (D-008: a member reset by
  an admin can immediately rotate their own password); the remaining sliver (member never
  changes it) is logged as D-010. M-4/M-5/M-6 are **decided** (D-007/D-008/D-009) and folded
  in — see below. Business calls remain (1) + the D-010 acceptance.
- **@qa** — explicit decisions to seed/verify: reuse-detection family revocation **that
  commits** (§3.3/data-model §2.4 H-3) + the leeway-window benign-retry case (§3.5); throttle
  **always-429** + account-counter-keys-regardless-of-user (§8.1/§8.2 M-1); throttle
  fail-open on Redis-down **+ degraded in-process limiter + log/alert signal** (§8.3 M-7);
  admin-reset **revoked-membership 404** (§10 H-2); logout `familyId` ownership → idempotent
  204 (api-spec §2.4 M-3); dummy-verify timing on unknown email (§9); anti-lockout self-heal
  (§8.2). **Low-hardening (this amendment):** `415` on non-JSON `Content-Type` for every
  `/auth/*` POST (L-2, api-spec §3); `/auth/refresh` IP-throttle → `429 + Retry-After` (L-5,
  §8.1); **`tokenHash` is `HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue)` — assert HMAC, not bare
  SHA-256** (L-3, §2.3). Reuse-decision pure fn in `core-domain` is unit-testable in isolation
  (golden rule #4).

### Product scope decisions folded in (M-4 / M-5 / M-6 → D-007 / D-008 / D-009)
Product resolved the three seams; all are now decided and incorporated in these specs:
- **M-4 → D-007 (absolute session cap): ADOPTED.** `RefreshToken.familyExpiresAt` = login +
  90d, inherited unchanged on rotation; rotation refused once passed → force re-login (§2.3,
  §3.1; data-model §2.1/§2.4). Additive NOT-NULL column on the still-empty table (no backfill).
- **M-5 → D-008 (self-serve change-password): IN SCOPE (US-6).** New `POST /auth/change-password`
  (Bearer; verify current pw, enforce signup policy, set new hash, revoke all *other* families
  — caller's current session survives). This is the structural fix for the admin-reset
  residual (§10, D-010). No schema change. See api-spec §1 (endpoint 7) + §2.7.
- **M-6 → D-009 (identifier abstraction): DOC-NOTE ONLY, no schema/contract change.**
  Authentication resolves a **service-layer `identifier { type, value }`** abstraction with
  `email` as the only `type` in MVP; the DB stays `User.email` (no `Identifier` table). This
  keeps the Gate-1 §3 "identifier นามธรรม" scope promise honest without an empty table; a
  future phone/OTP type slots in at the service layer, and only *then* would a schema change
  be considered (out of F-001). See §1.3 below + data-model §1.
