---
doc: F-001 data-model — auth deltas (RefreshToken family/hash/expiry; User unchanged)
owner: "@backend-api"
signoff: approved     # pending | approved
---

# F-001 — Data model (Gate 2)

> Builds on the F-000 schema. Authoritative base = [docs/01-data-model.md](../../01-data-model.md)
> §Tenancy & Auth + [F-000/data-model.md](../F-000/data-model.md) §Tenancy & Auth.
> Architecture that drives this = [architecture.md](./architecture.md) §6 (delta list) / §3 (family model).
>
> **Scope:** F-001 adds fields to `RefreshToken` and adds **no new tables**. `User` is
> unchanged. Throttle state is Redis-only (ephemeral, not a Postgres record — arch §7/§8),
> so it is **not** in this schema.

---

## 1. `User` — unchanged (F-000 already sufficient)

F-000 shipped `User { id, email @unique, passwordHash, verified @default(false),
createdAt, updatedAt, memberships[], refreshTokens[] }`. F-001 **adds no columns** — it
only *uses* these:
- `email` — normalized (lowercase + trim, Gate 1 §4) at the **service layer** before it
  reaches the existing `@unique(email)` constraint. Normalization is behavior, not schema —
  no new column, no citext for MVP (we normalize on write and on lookup consistently).
- `passwordHash` — argon2id PHC-encoded string (salt embedded; arch §5.1). Single column,
  no separate salt column.
- `verified` — F-001 sets it (`false` on signup, Gate 1 US-1 AC); F-081 flips it when email
  verification ships.

> No `organizationId` on `User` (F-000 AC6 allowlist, D-004) — auth is org-agnostic
> (arch §1). Do not add one.

> **Identifier abstraction (D-009 — doc-note, no schema change).** Gate-1's "identifier
> นามธรรม (`identifier + type`)" is honored as a **service-layer** abstraction only: the
> login/lookup path treats the credential as `identifier { type, value }` with
> `type = "email"` the sole MVP type. The **DB stays `User.email`** — **no `Identifier`
> table, no new column, no contract change**. A future phone/OTP type plugs in at the service
> layer; only then is a schema change evaluated (out of F-001). Recorded so the scope promise
> is honest without an empty table (arch §1.3).

---

## 2. `RefreshToken` — deltas required by F-001

F-000 shipped the structural stub:
```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  deviceId    String?
  rotatedFrom String?                        // previous token id — rotation chain
  revokedAt   DateTime?                       // reuse-detection revoke
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([rotatedFrom])
}
```

### 2.1 Target schema (F-001)
```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  familyId    String                          // NEW — rotation-chain / session id (arch §3)
  tokenHash   String    @unique               // NEW — HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue) (arch §2.3, L-3)
  deviceId    String?                         // client-supplied session label (arch §4)
  rotatedFrom String?                         // previous RefreshToken.id — chain link
  expiresAt   DateTime                        // NEW — per-token 60-day expiry, SLIDES on rotation (arch §2.3)
  familyExpiresAt DateTime                     // NEW — absolute family-lifetime cap, login+90d, INHERITED unchanged on rotation (D-007, arch §2.3)
  lastUsedAt  DateTime?                        // NEW (optional) — for session-list UX (arch §4)
  revokedAt   DateTime?                        // reuse/logout/admin revoke
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([rotatedFrom])
  @@index([familyId])                          // NEW — family-wide revoke + session list
  @@index([userId, revokedAt])                 // NEW — list live sessions for a user
}
```

### 2.2 Field rationale
| Field | Type | Why |
|---|---|---|
| `familyId` | `String` (cuid, **not** `@id`) | Groups every token in one rotation chain = one device session. Family-wide revoke on reuse (arch §3.3) and logout (arch §4) filter on this. Assigned fresh on **login**; **inherited** on rotation. Many rows share one `familyId`. |
| `tokenHash` | `String @unique` | Lookup key. We store **`HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue)`** (a **keyed** hash — L-3, arch §2.3), never plaintext. A plain SHA-256 would suffice against a DB dump *alone* (the token is high-entropy random), but keying it with the F-000 `JWT_REFRESH_SECRET` env secret is free hardening: an attacker with only a DB dump **cannot even verify** a guessed token without also holding the env secret (offline verification requires both). Lookup = compute the HMAC of the presented plaintext, match by `tokenHash`. `@unique` because a token value maps to exactly one row. *(This repurposes the otherwise-idle `JWT_REFRESH_SECRET` — the refresh token is opaque, not a JWT, so the secret is no longer a JWT signer; see arch §9.)* |
| `expiresAt` | `DateTime` | **Per-token** 60-day expiry (arch §2.3), independent of `revokedAt`. **Slides:** each rotation mints a *new* successor row with a fresh `now()+60d`. Bounds how long a single un-rotated token is usable. |
| `familyExpiresAt` | `DateTime` | **NEW (D-007).** **Absolute family-lifetime cap** = the login instant + **90d**. Unlike `expiresAt` it is **inherited unchanged** on every rotation (the successor copies the predecessor's `familyExpiresAt` verbatim — it does **not** slide), so the whole rotation chain dies 90d after the original login no matter how often it refreshes. Rotation is refused once `now() > familyExpiresAt` → forces re-login (arch §3.1). This gives the Gate-1 30–90d band a real ceiling instead of sliding-forever; a stolen-but-unnoticed device session ages out. |
| `lastUsedAt` | `DateTime?` | Nice-to-have for "last active" in the session list UX (arch §4). Not security-critical; nullable, set on each successful rotation. Can drop if it complicates MVP. |

### 2.3 Derived state (NOT columns — arch §3.2)
A token's logical state is **derived**, never stored redundantly (consistent with the
schema-vs-logic rule F-000 follows):
- **current** — newest in family: `revokedAt IS NULL` AND `expiresAt > now()` AND
  `familyExpiresAt > now()` (family cap not reached — D-007) AND no other row has
  `rotatedFrom = this.id`. Only a current token may be exchanged.
- **consumed** — a successor exists (`∃ row WHERE rotatedFrom = this.id`). Presenting a
  consumed token is the **reuse signal** (arch §3.3).
- **revoked** — `revokedAt IS NOT NULL`.

There is **no `status` enum column** — deriving avoids a second source of truth that could
drift from the chain. The reuse-decision pure fn (`core-domain`, arch §3.3) takes the
presented row + its family rows as plain values and returns `{ ALLOW_ROTATE | REVOKE_FAMILY
| REJECT_EXPIRED }`.

### 2.4 Concurrency — how the rotate txn stays deterministic (answers QA Q1)
The rotate step (arch §3.1) runs in a Prisma `$transaction`. To make concurrent refreshes of
the **same** token deterministic (not serializable-retry-dependent), the txn takes a
**row lock on the presented `RefreshToken` row** (`SELECT ... FOR UPDATE`, via a raw locked
read or Prisma's interactive txn) before checking/consuming it:
1. `SELECT ... FOR UPDATE WHERE tokenHash = :h` (where `:h = HMAC-SHA-256(JWT_REFRESH_SECRET, presentedTokenValue)`, L-3) → locks the row.
2. Re-check state under the lock (current? not revoked? not expired? **family cap not
   reached — `familyExpiresAt > now()`, D-007**? no successor yet?). If `familyExpiresAt`
   has passed → refuse rotation, return generic `401 INVALID_REFRESH` (normal session
   expiry, no family revocation, no audit event — the family simply aged out).
3. If already consumed/revoked → **reuse path** (see the commit rule below).
4. Else insert successor (`familyId` inherited, **`familyExpiresAt` inherited unchanged**,
   `rotatedFrom = presented.id`, `expiresAt = now()+60d`), set `lastUsedAt`, commit.

**Reuse path — the family revocation MUST commit (H-3).** A naïve implementation that wraps
steps 1–4 in one `$transaction` and *throws* to signal reuse (the natural NestJS
`throw UnauthorizedException` → 401 pattern) would **roll back the family-wide `revokedAt`
update** — leaving the family's current token (which the attacker may hold) alive: detection
without response, silently failing US-3. So the reuse branch is structured to guarantee the
revoke survives:
- **Distinguish leeway from reuse first.** If the presented token is the **immediate
  predecessor** of the current token (`∃ current row WHERE rotatedFrom = presented.id`) **and**
  that successor was minted within the **reuse-leeway window** (`now() − successor.createdAt
  ≤ 60s`, arch §3.5), this is a benign retry (lost response / multi-tab): **do NOT revoke the
  family** — release the lock and return `401 INVALID_REFRESH`. No audit event.
- **Otherwise it is reuse** (an older predecessor, any deeper ancestor, or an already-revoked
  token): the family revoke runs in a transaction that **commits** — either (a) commit the
  rotation txn that also sets `revokedAt = now()` on **all** `WHERE familyId = F` rows, *then*
  return the 401; or (b) release the rotation lock and run the family revoke in its **own
  committed** `$transaction`, then return the 401. **Do not signal reuse by throwing inside
  the txn that carries the revoke.** The `auth.refresh.reuse_detected` audit event is emitted
  **post-commit** (so it is never lost with a rollback).

Two concurrent refreshes of the same token therefore **serialize on the row lock**: the
first wins and creates the successor; the second, on acquiring the lock, sees a fresh
successor (< leeway) → benign `401 INVALID_REFRESH`, family stays alive (the winner's session
survives — this is the M-2 fix for web multi-tab / mobile lost-response). A **stale**
predecessor or deeper ancestor replayed later still trips the committed family revoke. **No
serializable-retry loop needed.** *(QA: (a) two parallel `/auth/refresh` with the same token
→ 1×200 + 1×401 `INVALID_REFRESH`, family **NOT** revoked, winner's successor still valid;
(b) replay a consumed token **after** the leeway window → 1×401 + family `revokedAt`
committed on all rows + audit event emitted.)*

---

## 3. Migration

- **One additive migration** on top of F-000's `RefreshToken`:
  - add `familyId String NOT NULL`, `tokenHash String NOT NULL UNIQUE`, `expiresAt DateTime
    NOT NULL`, `familyExpiresAt DateTime NOT NULL` (D-007), `lastUsedAt DateTime NULL`;
  - add indexes `@@index([familyId])`, `@@index([userId, revokedAt])`.
- **No data backfill needed** — F-000 ships an empty `RefreshToken` table (no rows in any
  environment yet; auth issues the first tokens in F-001). So the new `NOT NULL` columns are
  safe without a default/backfill step. If any env somehow has rows, they are pre-auth test
  rows and can be truncated (there are no live sessions before F-001 ships).
- Authored via `prisma migrate dev`, applied via `prisma migrate deploy` (F-000 migration
  strategy). No raw SQL / triggers needed for auth.

---

## 4. Redis keys (ephemeral — documented here, not Prisma)

> Not a Postgres schema, but listed so `data-model` is the one place all F-001 persistent
> state is described. TTL'd, non-authoritative (arch §7/§8).

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `throttle:ip:{ip}` | counter | sliding ~5 min | IP-level attempt cap on `/auth/login`, `/auth/signup` **and `/auth/refresh`** (arch §8.1). Refresh is included as plain IP-level hygiene (L-5) — a coarse cap so the endpoint can't be run as a free DB-lookup treadmill; refresh needs **no** account dimension (256-bit token brute-force is infeasible), so it reuses the existing IP sliding-window key only. Trip → `429 + Retry-After`. |
| `throttle:acct:{emailNorm}` | counter | window / backoff ceiling (~15 min) | account-level consecutive-failure backoff on **login** (arch §8.2); keyed on the **submitted** normalized email **whether or not a `User` exists** (M-1 — no 429-differential enumeration oracle); cleared on successful login / admin reset |
| `throttle:acct:{userId}` | counter | window / backoff ceiling (~15 min) | account-level backoff on **`POST /auth/change-password`** `currentPassword` checks (N-2, arch §8.1); keyed on the **authenticated** `userId` (identity already proven by Bearer, no enumeration concern); incremented on wrong `currentPassword`, cleared on success |

Redis-down ⇒ throttle **fails open** (arch §8.3) with a best-effort **in-process** IP limiter
as degraded fallback, and every fail-open decision is **logged** (Redis-down alerting is
@devops) — auth availability > throttle, but not blind (M-7).

---

## 5. Fixtures / seed notes (answers QA Q2)

- **Breached-password list (MVP):** version-pinned fixture bundled in-repo (offline, no
  external call — arch §5.2). Proposal: a **top-10k common-password list**, checked in at a
  stable path (e.g. `packages/core-domain/src/auth/fixtures/common-passwords-top10k.txt`) with
  a `SOURCE.md` recording origin + version/date so the seed is deterministic and diff-able.
  Exact file/count is a small backend call I'll finalize with the api-spec; flagged so QA can
  pin the fixture version in the test plan. (HaveIBeenPwned k-anonymity check = F-081+
  fast-follow, not MVP.)
- **argon2 params fixture:** single config constant (arch §5.1) so tests can assert
  rehash-on-login by seeding a low-param hash and checking it upgrades.

---

## 6. Impact / hand-off
- **Enables** `api-spec.md` (next) — endpoints operate on this schema.
- **F-002/F-003** read `Membership`/`Role` (F-000) — unaffected by these deltas.
- **F-005 audit-log** consumes auth events (not stored in these tables) — no schema coupling.
- **No change** to any domain (org-scoped) table — auth tables are org-agnostic by design.
