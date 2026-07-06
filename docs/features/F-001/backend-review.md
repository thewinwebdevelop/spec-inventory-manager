---
doc: F-001 backend review — Gate-2 spec review (architecture, data-model, api-spec)
owner: "@backend-reviewer"
type: advisory        # findings + recommendations; backend-api/user decides adoption
reviewed:
  - architecture.md
  - data-model.md
  - api-spec.md
grounded-in:
  - F-001-authentication.md (Gate-1 AC US-1..US-5)
  - docs/01-data-model.md §Tenancy & Auth
  - docs/features/F-000/data-model.md (base User/RefreshToken/Membership)
  - docs/DECISIONS.md D-005, D-006
date: 2026-07-03
reverified: 2026-07-03   # amended specs re-checked — see "Re-verification" section
---

# Backend review — F-001 Authentication (spec)

**Verdict: has-blocking-concerns** *(advisory — backend-api/user decides adoption)*
> **Superseded by the Re-verification (2026-07-03) section below — new verdict:
> ready-with-recommendations.** Original findings kept verbatim for the record.

The core design is sound and unusually well-reasoned — the auth≠membership seam, the
token-family rotation model, opaque refresh tokens, and the deterministic row-lock
concurrency answer are all correct and should be preserved. The blocking concerns are
**contract-level defects and spec-wording traps**, not architectural flaws: the worst one
(C-1) is a one-line fix. Counts: **1 Critical · 3 High · 7 Medium · 5 Low**.

---

## Findings (severity-ranked)

### C-1 [Critical] Cookie `Path=/auth/refresh` means the browser never sends `omni_rt` to `/auth/logout` — web logout silently revokes nothing
- **Where:** `api-spec.md` §0.1 (line 23: `Path=/auth/refresh`) vs §2.4 (logout authenticates
  "from the presented refresh token; cookie or body") and §2.6 (`current` "matched via the
  refresh cookie if present").
- **Scenario:** browsers match cookie paths by prefix; `Path=/auth/refresh` matches only
  `/auth/refresh[/*]`. A web user clicks logout → `POST /auth/logout` arrives with **no
  cookie** → no family identified → nothing revoked → the endpoint still returns **204
  always** (§2.4 idempotency), so the failure is invisible to client, UX, and any e2e test
  that only asserts the status code. The refresh token stays valid server-side for up to
  60 days. This directly breaks Gate-1 US-4 AC (“logout → refresh token ปัจจุบันใช้ไม่ได้อีก”)
  and defeats the stolen-cookie remedy. Collateral: per-device logout from web (D-006 item 3
  sends `{familyId}` but the *authenticating* cookie still isn't sent) and the `current`
  marker on `GET /auth/sessions` (always null on web) break the same way.
- **Recommendation:** set `Path=/auth` on `omni_rt` (covers `/auth/refresh`, `/auth/logout`,
  `/auth/sessions`; still keeps the cookie off all domain routes). qa: add a test asserting
  the `RefreshToken` row is actually revoked after a cookie-path logout — not just the 204.
  *(Owner: @backend-api; test @qa)*

### H-1 [High] Refresh token plaintext is always in the JSON body — even on the cookie path — which defeats the httpOnly XSS-resistance the design claims
- **Where:** `api-spec.md` §0.4 ("Login/refresh responses **always include the refresh token
  in the JSON body** … Web ignores the body field") vs §0.1 / `architecture.md` §9 ("out of
  JS reach → XSS-resistant").
- **Scenario:** an XSS payload on the web origin runs
  `fetch('/auth/refresh', {credentials:'include', headers:{'X-CSRF-Token': <read omni_csrf — it is deliberately non-httpOnly>}})`
  → 200 → reads the **new plaintext refresh token from the response body** and exfiltrates
  it. The attacker now holds the family's current token *outside* the browser and can keep
  rotating it while the victim is idle — exactly the persistence-beyond-XSS that httpOnly
  exists to prevent. (Reuse detection eventually burns the family when the victim next
  refreshes, but until then the attacker owns the session.) The "one response shape"
  convenience makes the httpOnly design decorative.
- **Recommendation:** omit `refreshToken` from the body on the cookie transport. Smallest
  contract change: client declares transport at login (e.g. body `{ tokenTransport:
  "cookie" | "body" }`, default `body` for mobile compatibility); `cookie` → set cookies,
  body has `refreshToken: null`; `body` → no cookies, token in body. Keeps a single schema
  (nullable field), removes the leak. *(Owner: @backend-api; ux/frontend informed)*

### H-2 [High] Admin-reset does not require `status=active` membership — a **revoked ex-member** can still have their global password reset by the old org's admin (cross-tenant account takeover)
- **Where:** `api-spec.md` §2.7 ("must share `Membership(userId, orgId)` with the target"),
  `architecture.md` §10 ("within an org where a `Membership(targetUserId, thatOrg)`
  **exists**"). Neither constrains `status`. F-000 keeps membership rows on removal
  (`MembershipStatus { active invited revoked }`, "deactivate ไม่ delete" —
  F-000/data-model.md).
- **Scenario:** user U works at Org A, leaves (membership → `revoked`), now works only at
  Org B. Org A's admin calls `POST /orgs/A/members/U/reset-password` — the `Membership(U, A)`
  row *exists*, so the guard as spec'd passes → Org A's admin now knows U's **global**
  password (`User.passwordHash` is system-wide), logs in as U, sends `X-Org-Id: B` → full
  access to Org B's data as U. The arch's own isolation claim ("an admin of Org A cannot
  reset a user who only belongs to Org B") is violated by its own letter, because "belongs"
  was never pinned to `active`. Same hole for `invited` (target never even accepted).
- **Recommendation:** spec explicitly: **both** the acting admin's membership+capability and
  the target's membership must be `status = active` in `orgId`; anything else → the existing
  same-shape `404`. One sentence in §2.7 + §10; qa adds a revoked-membership negative test.
  *(Owner: @backend-api; test @qa)*

### H-3 [High] Reuse path says "revoke whole family, **abort** with reuse error" inside the rotation transaction — a literal implementation **rolls back the revocation**, neutering reuse detection
- **Where:** `data-model.md` §2.4 step 3; `architecture.md` §3.1(b)-(d) frames the whole
  rotate flow as "one DB transaction".
- **Scenario:** implementer wraps §2.4 in `prisma.$transaction` and throws on step 3 (the
  natural NestJS pattern: throw `UnauthorizedException` → interceptor maps to 401). The
  throw **rolls back** the family-wide `revokedAt` update. Result: attacker replaying a
  consumed token gets the intended 401, but the family's *current* token — the one the
  attacker may actually hold (we can't tell attacker from victim, which is the entire
  premise of §3.3) — **stays alive**. Reuse detection becomes detection-without-response;
  Gate-1 US-3 AC "ตรวจพบ reuse → เพิกถอนทั้งสาย" is silently unmet, and the qa test spelled
  out in §2.4 ("family `revokedAt` set on all rows") will catch it only if it is actually
  run against this exact path.
- **Recommendation:** amend §2.4 step 3 to state the revocation **must commit**: either
  (a) commit the transaction containing the family revoke, *then* return the 401; or
  (b) run the revoke in its own committed transaction after releasing the lock. Also note
  the audit event `auth.refresh.reuse_detected` must be emitted post-commit (not lost with
  a rollback). *(Owner: @backend-api; @qa keep the §2.4 concurrency test mandatory)*

### M-1 [Medium] Throttle response is self-contradictory (401 vs 429), and the account counter is unspecified for **nonexistent** emails — a 429-differential enumeration oracle
- **Where:** `architecture.md` §8.2 ("Both IP and account throttle return the **same generic
  response as a wrong password** … we do not reveal 'this account is locked'") vs
  `api-spec.md` §2.2 which lists "currently throttled" under `401 INVALID_CREDENTIALS`
  **and** defines `429 RATE_LIMITED` for "IP or account backoff tripped". Both can't hold.
- **Scenario:** UX needs the 429 + `Retry-After` countdown (D-005), so 429 will exist. If
  the account counter (`throttle:acct:{emailNorm}`, data-model §4) increments only when the
  email resolves to a real `User`, an attacker submits 6 wrong passwords per candidate
  email: real account → 429 on the 6th; nonexistent → still 401. Clean existence oracle
  that bypasses the dummy-verify timing defense. (Signup's accepted `409 EMAIL_TAKEN` leak
  is IP-throttled; this would be a second, cheaper oracle.)
- **Recommendation:** resolve to: throttle always = `429 + Retry-After` (drop "currently
  throttled" from the 401 list in §2.2 and soften §8.2's "same response" to "same
  *credential* failures are indistinguishable"); and spec that the account counter keys on
  the **submitted** normalized email whether or not a user exists, with identical 429
  behavior. *(Owner: @backend-api)*

### M-2 [Medium] Strict rotation with zero reuse-grace turns legitimate retries into family revocation (forced logout)
- **Where:** `architecture.md` §3.1 ("the loser … treated as reuse"), §3.3;
  `data-model.md` §2.4.
- **Scenario:** (a) mobile on a flaky network: client POSTs `/auth/refresh`, server commits
  the rotation, the **response is lost in transit**; client retries with the only token it
  has — now consumed → family revoked → user dumped to login. Directly antagonizes US-3
  ("คงสถานะล็อกอินไว้นานๆ"). (b) web multi-tab: two tabs share one `omni_rt` cookie; both
  refresh at access-expiry → loser burns the family for both. Cross-tab single-flight is
  possible but the contract shouldn't require flawless client coordination to avoid
  self-DoS. Failure direction is safe (logout, not breach), hence Medium not High.
- **Recommendation:** add a bounded reuse-leeway (industry pattern, e.g. Auth0): presenting
  the **immediate predecessor** within N seconds (~60s) of its rotation is *not* treated as
  reuse — respond 401 `INVALID_REFRESH` **without** family revocation (client re-refreshes
  with its cookie or re-logins), or mint a parallel successor. Anything older, or any
  deeper ancestor, still trips full family revocation. If backend-api prefers strict
  rotation as-is, record it as a deliberate UX trade-off and require frontend single-flight
  + mobile retry-then-relogin handling. *(Owner: @backend-api decides; @frontend informed)*

### M-3 [Medium] `/auth/logout { familyId }` (D-006 per-device logout) never states the ownership check
- **Where:** `api-spec.md` §2.6 contract note + §2.4; D-006 item 3.
- **Scenario:** caller authenticates with *their* refresh token but passes an arbitrary
  `familyId`. If the revoke runs `WHERE familyId = :input` without `AND userId =
  :callerUserId`, any authenticated user can revoke another user's session (cuids are
  identifiers, not secrets — they appear in logs/URLs). Cross-user logout = harassment/DoS,
  and on a shared-family guess it's cross-*tenant* by nature since auth tables are
  org-agnostic.
- **Recommendation:** one sentence in §2.4: `familyId` must belong to the authenticated
  user; foreign/unknown `familyId` → the same idempotent `204` (no enumeration). qa negative
  test. *(Owner: @backend-api; test @qa)*

### M-4 [Medium] Rotation grants a fresh 60-day `expiresAt` every refresh — sessions never expire (sliding-forever), which strains the Gate-1 30–90d band
- **Where:** `architecture.md` §2.3 (TTL 60d), §3.1 (successor is a new row →
  new `expiresAt`); `data-model.md` §2.2.
- **Scenario:** a device refreshing at least once per 60 days stays logged in indefinitely —
  a stolen-but-unnoticed device session literally never ages out. Gate-1 US-3 says refresh
  ~30–90 วัน; a plain reading is bounded session lifetime, but the spec delivers unbounded.
  Maybe intended (mobile "stay logged in") — but it's a policy, and it's currently implicit.
- **Recommendation:** either add an absolute family lifetime cap (e.g. `familyExpiresAt` =
  login + 90d; refuse rotation past it → re-login) or record "sliding, unbounded" as an
  explicit decision. → route to @product (session-lifetime policy is a product call).

### M-5 [Medium] No self-serve change-password endpoint — combined with admin-*chosen* passwords (§2.7 `{ newPassword }`) the admin retains indefinite knowledge of a member's **global** credential
- **Where:** `api-spec.md` §1 (7 endpoints — none is change-own-password), §2.7.
- **Scenario:** admin resets member M's password to a value the admin knows; M has **no
  endpoint** to rotate it. That credential opens M's account across *every* org M belongs
  to (H-2's blast-radius logic, but with an active membership — no bug needed). Until F-081
  ships, the sharing is permanent. Gate-1 never listed change-own-password, so this is a
  scope gap, not a spec defect — hence Medium and routed.
- **Recommendation:** add `POST /auth/change-password { currentPassword, newPassword }`
  (auth: Bearer; verify current; revoke all other families) — small, org-agnostic, fits
  F-001 cleanly; or at minimum a `mustChangePassword` nudge after admin reset. → route
  scope to @product.

### M-6 [Medium] Gate-1 in-scope item "identifier นามธรรม (`identifier + type`)" is absent from all three docs
- **Where:** F-001-authentication.md §3 In-scope row 6; `data-model.md` §1 ("User —
  unchanged", email used directly); no mention in architecture or api-spec.
- **Scenario:** the scope table promises an abstract-identifier seam (future phone+OTP);
  the design hard-wires `User.email` everywhere (schema, throttle keys, normalization,
  contract). Retrofitting an `Identifier` table after real users exist is a data migration;
  deciding *now* that email-as-column is fine for MVP is also legitimate — but nobody
  decided.
- **Recommendation:** either add the minimal seam note (service-layer `identifier{type,value}`
  abstraction with email the only type; schema unchanged) or move the row to
  out-of-scope via a DECISIONS entry. → route to @product (scope reconciliation).

### M-7 [Medium] Fail-open on Redis-down has no degraded fallback or mandated observability — an outage is a fully unthrottled brute-force window
- **Where:** `architecture.md` §8.3; `data-model.md` §4.
- **Scenario:** during a Redis outage (or an attacker-induced one), *both* throttle
  dimensions vanish and all counters are lost afterwards. Argon2 cost bounds per-request
  throughput but not a distributed run. The fail-open *choice* is defensible
  (availability > throttle, per D-005's anti-lockout spirit) — the gap is shipping it
  blind.
- **Recommendation:** keep fail-open, add: (a) a best-effort **in-process** IP limiter as
  degraded fallback (a few lines, no infra), (b) every fail-open decision logged +
  Redis-down alerting (@devops), (c) qa's existing fail-open test extended to assert the
  log/alert signal. *(Owner: @backend-api + @devops)*

### L-1 [Low] `omni_csrf` cookie attributes unspecified; double-submit is spoofable by a cookie-planting attacker
- **Where:** `api-spec.md` §0 CSRF block.
- Classic double-submit weakness: anyone who can set cookies for the site (subdomain
  takeover) plants a matching pair. `__Host-` prefix would fix it but requires `Path=/`
  (conflicts with the scoped path). Given `SameSite=Strict` is the primary defense, accept —
  but at least spec `omni_csrf` as `Secure; SameSite=Strict; Path=/auth` and note the
  trade-off. *(Owner: @backend-api)*
  > **SUPERSEDED by D-019 (2026-07-06):** `omni_csrf` is now shipped at `Path=/` (widened so
  > `document.cookie` is readable from app pages). That makes the `__Host-omni_csrf` prefix — which
  > requires `Path=/` + `Secure` + no `Domain` — now **viable**, closing the subdomain-takeover
  > double-submit weakness above. **Minor hardening follow-up (@backend-api):** rename the CSRF
  > cookie to `__Host-omni_csrf`. Not an F-001 blocker (`SameSite=Strict` still primary); logged so
  > the opportunity D-019 opened isn't lost.

### L-2 [Low] No explicit `Content-Type: application/json` / Origin enforcement on auth POSTs — leaves login-CSRF residue
- `/auth/login` has (and can have) no CSRF token; a cross-site form-POST could log the
  victim into an attacker's account (login CSRF). Requiring strict `application/json`
  (forms can't send it; fetch-with-JSON triggers a CORS preflight the API won't allow)
  closes it for free. One contract sentence. *(Owner: @backend-api)*

### L-3 [Low] `JWT_REFRESH_SECRET` is now purposeless — arch §9 still implies two JWT signers, but §2.3 made the refresh token opaque
- Doc inconsistency (stale F-000 assumption). Either delete the claim, or repurpose the
  secret as an **HMAC key for `tokenHash`** (HMAC-SHA-256 instead of bare SHA-256) — free
  hardening: a DB dump alone can't even *verify* token guesses without the env secret.
  *(Owner: @backend-api)*

### L-4 [Low] Dummy-verify makes every login attempt cost ~50–100 ms of argon2 CPU — a distributed rotating-email/IP attack is a CPU-DoS amplifier
- Inherent cost of enumeration resistance (§9) — keep the dummy verify. Note a global/
  service-level request ceiling on `/auth/*` as a hardening flag for @devops; not MVP-
  blocking. *(Owner: @devops, flag only)*

### L-5 [Low] `/auth/refresh` has no rate limit at all
- §3 applies throttle "pre-auth on signup/login" only. Token brute-force is infeasible
  (256-bit), so this is hygiene: a plain IP-level cap keeps the endpoint from being a free
  DB-lookup treadmill. *(Owner: @backend-api)*

---

## Accepted-risk confirmations (documented in the specs; no action needed, listed so sign-off is informed)
- **≤15-min access-token liveness after logout/logout-all/admin-reset** (arch §2.1/§4) —
  deliberate no-blacklist trade-off, correctly bounded and stated.
- **Signup `409 EMAIL_TAKEN` enumeration leak** — accepted by Gate-1 §4, IP-throttled.
- **Solo-owner ~15-min backoff wait** — decided in D-005; arch §8.2/§10 comply.
- **HS256 single-verifier** — sound for single-service MVP; migration path noted (§2.2).

## Strengths (keep these)
- **The auth≠membership seam (arch §1)** is the best part of the design: tokens carry
  `userId` only, org context resolved fresh per request — the removed-from-all-orgs edge
  falls out for free, and golden-rule #3 has one clean boundary instead of leaks everywhere.
- **Opaque (non-JWT) refresh token + hash-only storage** with the *correct* justification
  for SHA-256 over a slow hash (high-entropy input) — a mistake-in-waiting avoided twice.
- **Family/chain reuse-detection with the decision as a `core-domain` pure function**
  (`ALLOW_ROTATE | REVOKE_FAMILY | REJECT_EXPIRED`) — golden rules #4/#6 honored by design,
  and the derived-state/no-status-column choice (data-model §2.3) removes a drift bug class.
- **Deterministic row-lock rotation (data-model §2.4)** — answers the concurrency question
  with a testable, no-retry design (modulo H-3's commit fix).
- **Dummy argon2 verify on unknown email**, backoff-not-lock with self-heal (D-005-
  compliant), thread-sleep explicitly rejected as a DoS vector, trusted-proxy IP flagged to
  devops — the threat model was clearly done, not pasted.
- **Postgres-vs-Redis storage split rationale** (§7) and the additive-migration/no-backfill
  reasoning (data-model §3) are exactly right.

## Questions to route (not guessed)
- **@product** — (1) M-4: absolute session-lifetime cap vs sliding-forever? (2) M-5: is
  `change-password` in F-001 scope (recommended) or deferred with `mustChangePassword`?
  (3) M-6: identifier-abstraction — design the seam or formally de-scope? (4) Residual of
  H-2 even *after* the active-status fix: an org admin resetting a shared **active** member
  still gains a credential valid in the member's *other* orgs — acceptable for dogfood, but
  it deserves a DECISIONS line as a known multi-tenant trade-off (F-081 self-serve reset is
  the structural fix).
- **@backend-api** — M-2: strict rotation vs reuse-leeway window — owner's call; both are
  defensible, pick one explicitly.
- **@devops** — confirm the already-flagged trusted-proxy + dev-CORS items, plus M-7
  alerting and L-4 global ceiling.

---
---

# Re-verification (2026-07-03) — amended specs vs C/H/M findings

**New verdict: ready-with-recommendations** *(advisory — backend-api/user decides adoption)*

All 11 Critical/High/Medium findings are **CLOSED** in the amended specs — each was
verified against the actual doc text, not the change claims. The decision trail
(D-007..D-011) is faithfully incorporated, and the fixes are internally consistent
(D-007 cap × D-011 leeway boundary checked; endpoint renumbering 7/8 consistent across
api-spec §1/§2.7/§2.8/§5 and architecture §10/§12). **Two NEW Medium findings** were
introduced by the new `POST /auth/change-password` surface (D-008) — both are
one-paragraph contract amendments, not design flaws — plus one Low wording nit. Nothing
blocking; no golden-rule violation.

## Per-finding status

### C-1 — CLOSED
`omni_rt` is `Path=/auth` everywhere, with the C-1 rationale written into the contract:
api-spec.md:27–32 (cookie definition + "required so the browser also sends `omni_rt` to
`/auth/logout` and `/auth/sessions`"), api-spec.md:163–164 (logout clears cookies
`Path=/auth`), api-spec.md:180–183 (sessions `current` marker relies on it),
api-spec.md:57–58 (`omni_csrf` matches the scope), architecture.md:454–455. Grep across
all F-001 specs finds **no** lingering `Path=/auth/refresh` (the only remaining mention is
the explicit negation "(not `/auth/refresh`)" at api-spec.md:28–29).

### H-1 — CLOSED
Transport-declaration model adopted exactly as recommended: api-spec.md:20–24 (login
declares `tokenTransport`, default `body`), api-spec.md:41–47 (single schema, token
populated on **exactly one** channel; cookie transport → body `refreshToken: null`),
api-spec.md:140–144 (refresh follows the **presented** transport). **Bypass check:** the
refresh request (§2.3 req, api-spec.md:137–139) carries **no** transport override an XSS
payload could flip — switching to body transport requires a fresh `/auth/login`, i.e. the
victim's password, which XSS does not have; with the cookie present, cookie always wins
(api-spec.md:37–40) and the response body is `null`. The rotated plaintext is never
JS-readable on the web path. architecture.md:453–459 consistent.

### H-2 — CLOSED
api-spec.md:213–221: **both** the acting admin's and the target's `Membership` must be
`status = active` in `orgId`; `revoked`/`invited` targets explicitly disqualified with the
cross-tenant-takeover rationale spelled out; any failure of either check → **same-shape
404** (api-spec.md:226–228). architecture.md:474–483 mirrors it ("Pinning to `active` is
load-bearing, not cosmetic"). The residual (active shared member) is decided as D-010 and
mitigated by D-008 — correctly recorded, not hidden (api-spec.md:230–237).

### H-3 — CLOSED
The commit rule is now explicit in both docs: architecture.md:178–182 ("The reuse branch
does NOT roll the rotation txn back onto itself"), architecture.md:197–203 ("This revoke
MUST commit … never a throw-to-rollback"), data-model.md:124–141 (the exact two-option
committed structure (a)/(b), "Do not signal reuse by throwing inside the txn that carries
the revoke", audit event `auth.refresh.reuse_detected` emitted **post-commit**).
QA case (b) at data-model.md:149–151 asserts the committed `revokedAt` on all rows.

### M-1 — CLOSED
"Currently throttled" is gone from the 401 list (api-spec.md:126–128 lists only wrong
password / unknown email); throttle is **always `429 + Retry-After`, never folded into the
401** (api-spec.md:129–130, api-spec.md:246–251); architecture.md:388–398 softened
precisely as recommended ("the *credential* failures are indistinguishable") and the
account counter keys on the **submitted normalized email whether or not a `User` exists**
(architecture.md:370–377, api-spec.md:130–133, data-model.md:178) — the 429-differential
oracle is closed on both sides.

### M-2 / D-011 — CLOSED (coherent; no new hole beyond the documented bounded window)
architecture.md §3.5 (224–250) + data-model.md:130–134: leeway applies **only** to the
immediate predecessor (`∃ current row WHERE rotatedFrom = presented.id`) replayed ≤60s
after the successor's creation → benign generic `401`, **no** revocation, no audit event;
anything older or any deeper ancestor still trips the committed family burn. Coherence
checked: (a) already-**revoked** tokens never get leeway (data-model.md:135); (b) if the
successor has itself been rotated, the presented token is no longer immediate-predecessor
→ burn; (c) worst case the attacker-replay detection is *delayed* by ≤60s, never missed —
the victim's own post-window replay is an ancestor and burns the family, which arch §3.5
(240–244) states honestly. The multi-tab/lost-response scenarios resolve correctly
(data-model.md:143–148).

### M-3 — CLOSED
api-spec.md:167–172: `familyId` "**must belong to the authenticated user**"; foreign or
unknown `familyId` → the same idempotent **204**, explicitly "no enumeration, no
cross-user/cross-tenant session kill". §2.6 cross-references the ownership check
(api-spec.md:186–187). QA seeded (architecture.md:554–555).

### M-4 / D-007 — CLOSED
`familyExpiresAt` added as NOT-NULL, **inherited unchanged (does not slide)** —
data-model.md:72, data-model.md:92 (successor "copies the predecessor's `familyExpiresAt`
verbatim"), architecture.md:139–147. The rotation guard checks it **under the row lock**
(data-model.md:116–119) and refuses past-cap as **ordinary expiry**: generic
`401 INVALID_REFRESH`, **no family revocation, no audit event** (data-model.md:118–119,
architecture.md:170–172, api-spec.md:146–149) — not a family-burn, exactly as D-007
specifies. Migration is sound: one additive migration on the empty F-000 table, no
backfill, truncate note for stray pre-auth rows (data-model.md:157–166). **Boundary with
D-011 checked:** a consumed-token benign retry straddling the cap boundary yields a
generic 401 with no revocation on either branch — no contradiction.

### M-5 / D-008 — CLOSED (as a scope gap; two NEW findings filed against the new surface, below)
`POST /auth/change-password` is in the contract as endpoint 7 (api-spec.md:82,
§2.7:190–209): Bearer auth, verify `currentPassword` (argon2), **same policy as signup**
on `newPassword`, set hash, **revoke all OTHER families keeping the caller's current
session**, emit `auth.password.self_changed`, generic 401 on wrong current (no leak).
Effect matches D-008 verbatim and the keep-current rationale is well-argued
(api-spec.md:205–209, architecture.md:273–276). The original gap (admin retains
credential knowledge with no member-side rotation) is structurally closed
(api-spec.md:230–237). **However** the new endpoint introduces N-1 and N-2 (below).

### M-6 / D-009 — CLOSED
Doc-note only, exactly per D-009: architecture.md §1.3 (75–84) + data-model.md:35–41 —
service-layer `identifier { type, value }` with `email` the sole MVP type; **DB stays
`User.email`, no Identifier table, no contract change** (requests still send `email`,
confirmed in §2.1/§2.2 schemas). No schema/contract regression.

### M-7 — CLOSED
architecture.md:412–428: fail-open retained but no longer blind — (1) **degraded
in-process IP limiter** on `/auth/login`+`/auth/signup` when Redis is unreachable,
(2) every fail-open decision logged as a distinct structured event
(`auth.throttle.fail_open`) + **Redis-down alerting** flagged to @devops
(architecture.md:531–534), (3) qa test extended to assert the signal + limiter engage
(architecture.md:427–428, 552–553). data-model.md:180–182 consistent.

## Low findings (deferred hardening backlog — status check only, not re-raised)
- **L-1** — effectively *addressed* by the amendment: `omni_csrf` is now spec'd
  `Secure; SameSite=Strict; Path=/auth` (api-spec.md:57). Not escalated.
- **L-2** — unchanged, still Low. The new `tokenTransport` field doesn't worsen login-CSRF
  (forms can't send JSON).
- **L-3** — **still present**: architecture.md:444–446 still claims separate
  `JWT_ACCESS_SECRET` vs `JWT_REFRESH_SECRET` signer scopes although the refresh token is
  opaque (§2.3). Still a Low doc inconsistency; the HMAC-repurpose suggestion stands.
- **L-4** — unchanged. Note: N-2 below adds a second unthrottled argon2-verify surface of
  the same class.
- **L-5** — unchanged, still Low (leeway path is a cheap lookup + 401; no amplification).

None of the five has escalated in severity due to the changes.

## NEW findings (introduced by the amendments)

### N-1 [Medium] change-password's "keep the caller's current session" has no stated identification mechanism — unimplementable as written on the body transport
- **Where:** api-spec.md:196–199 ("revoke all the caller's OTHER refresh-token families,
  i.e. every family *except* the one the caller is currently on"), architecture.md:273–276.
- **Scenario:** the endpoint authenticates by **Bearer access token only**, and the access
  token deliberately carries no `familyId` (claims = `sub, iat, exp, jti, typ` —
  architecture.md:115–123). On web the `omni_rt` cookie happens to reach the endpoint
  (`Path=/auth` covers `/auth/change-password`) but the spec never says to use it; on
  **mobile (body transport) nothing in the request identifies the current family at all**.
  A literal implementation must either revoke ALL families (silently logging the mobile
  user out of the very device they changed the password on — contradicting the spec'd
  effect and D-008) or invent a client-supplied `familyId` without the §2.4 ownership rule.
- **Recommendation:** one paragraph in §2.7: current family resolved from the `omni_rt`
  cookie (web) **or** an optional body `{ refreshToken }` (mobile — the server matches its
  hash to a family, which is inherently ownership-proving); if neither is present/resolvable,
  fall back to revoking **all** families (safe direction; document that a Bearer-only call
  self-logs-out). If a bare `familyId` is ever accepted instead, it must pass the §2.4
  ownership check. *(Owner: @backend-api; test @qa — mobile change-password keeps-current
  case)*

### N-2 [Medium] change-password's `currentPassword` verification is unthrottled — an online password-guessing oracle that bypasses the login backoff
- **Where:** api-spec.md:202–203 (401 on wrong current; no 429 in the error list);
  throttle scope is "pre-auth on **signup/login**" only (api-spec.md:246–247,
  architecture.md §8.1).
- **Scenario:** an attacker holding a live access token — stolen unlocked device, or XSS
  minting fresh 15-min access tokens indefinitely via the cookie refresh loop — brute-forces
  `currentPassword` at full argon2 speed with **no backoff and no counter**. Success = the
  attacker sets a `newPassword` **they** know (global credential, valid across all the
  victim's orgs) *and* evicts the victim's other sessions — precisely the
  XSS→persistent-credential escalation that the H-1 fix just closed, reopened via guessing
  instead of theft. The login-path account backoff (§8.2) is completely bypassed because
  this verify happens post-auth.
- **Recommendation:** apply the account-level throttle to failed change-password attempts —
  reuse `throttle:acct:{emailNorm}` (or a per-`userId` twin) with the same 5-failure
  exponential backoff and `429 + Retry-After`; success clears it. One sentence in §2.7 +
  arch §8.1. *(Owner: @backend-api; test @qa)*

### N-3 [Low] CSRF-skip predicate is keyed on wording that could be misread as "body field present ⇒ skip"
- **Where:** api-spec.md:58–61 ("Requests carrying the refresh token in the **JSON body**
  (mobile) skip the CSRF check") vs api-spec.md:37–40 ("if both are present, cookie wins").
- A careless implementation could skip CSRF whenever `body.refreshToken` exists even though
  resolution then proceeds via the cookie. `SameSite=Strict` + CORS preflight make this
  non-exploitable today; pin the wording to "the CSRF check applies whenever the token is
  **resolved from the cookie**; it is skipped only when no cookie is present and the token
  came from the body". *(Owner: @backend-api; wording only)*

## Verdict rationale
- All prior C/H/M: **11/11 CLOSED**, verified in the amended text with no
  fixed-on-paper-only cases found.
- New surface (D-008 endpoint) carries two Medium contract gaps (N-1, N-2) — both have
  clear, small fixes and neither is a golden-rule violation or shippable-exploit at the
  spec-approval stage, but both **should be amended before build** so the implementation
  isn't left to guess (N-1) or ship an unthrottled verify (N-2).
- L-1..L-5 backlog: L-1 incidentally resolved; L-3 still present (doc nit); none escalated.

**ready-with-recommendations** — recommend backend-api fold N-1 + N-2 into api-spec §2.7
(+ arch §8.1 for N-2) before Gate-2 sign-off; N-3 is a wording touch-up that can ride along.
