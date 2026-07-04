# F-001 Task Board — Authentication

> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ `updated_by`
> PM dispatch task ที่ `deps=done` ครบ · ref = เอกสาร Gate-2 + target path ([workspace-map.md](../../workspace-map.md))
> ที่มา: architecture.md · data-model.md · api-spec.md · ux-wireframe.md · ui.md · test-plan.md (sign off ครบ + Gate 2 commit 2026-07-04)
> Build order (workspace-map §4): `backend-api` (apps/api + packages/*) → contract/client พร้อม → `frontend` (web+mobile) · `devops` ∥ · `ux` design-sync ก่อน frontend visual · `qa` colocated ตามหลังโค้ด
> **หมายเหตุ:** board นี้ PM ร่างจาก Gate-2 docs ที่ approved — เจ้าของแต่ละทีม refine/claim + อัปเดต status ได้เมื่อหยิบงาน

---

## T-001-01 · backend-api · core-domain auth pure functions
- desc: pure fns (กฎทอง #6) — password policy (length 8–128, breached top-10k fixture), email normalize (lowercase/trim), reuse-decision (`ALLOW_ROTATE|REVOKE_FAMILY|REJECT_EXPIRED` + 60s leeway D-011), backoff curve; unit test ไปพร้อมโค้ด (กฎทอง #4, ★ merge blocker)
- ref: architecture.md §3.3/§5 · data-model.md §5 · test-plan.md U1.*/U2.3/U3.* · → `packages/core-domain/src/auth`
- deps: G2✓   · status: todo   · updated_by: —

## T-001-02 · backend-api · Prisma migration (RefreshToken deltas)
- desc: additive migration — `familyId`, `tokenHash @unique` (HMAC), `expiresAt`, `familyExpiresAt` (90d cap, inherited), `lastUsedAt?` + `@@index([familyId])`, `@@index([userId, revokedAt])`; no backfill (empty table)
- ref: data-model.md §2/§3 · → `packages/db`
- deps: G2✓   · status: todo   · updated_by: —

## T-001-03 · backend-api · password hashing service (argon2id)
- desc: argon2id (OWASP params, config constant) + verify (constant-time) + rehash-on-login + dummy-verify (unknown email timing)
- ref: architecture.md §5/§9 · → `apps/api` (auth module)
- deps: T-001-01   · status: todo   · updated_by: —

## T-001-04 · backend-api · JWT access token + guard
- desc: HS256 sign/verify (15m, claims `sub` only, `typ` pin, alg pin), `JwtAuthGuard` populate `req.user`
- ref: architecture.md §2.2 · → `apps/api`
- deps: G2✓   · status: todo   · updated_by: —

## T-001-05 · backend-api · refresh-token service (rotation/reuse/cap)
- desc: opaque gen + `tokenHash = HMAC-SHA-256(JWT_REFRESH_SECRET, value)` (L-3); rotation txn (row-lock, deterministic); reuse detection → **committed** family revoke (H-3) + 60s leeway (D-011); `familyExpiresAt` 90d guard (D-007) → generic 401; per-device + logout-all revoke
- ref: architecture.md §3/§4 · data-model.md §2.4 · test-plan.md U3.*/I3.* · → `apps/api` + `packages/core-domain` (decision fn)
- deps: T-001-01, T-001-02   · status: todo   · updated_by: —

## T-001-06 · backend-api · throttle & rate-limit (Redis)
- desc: IP + account sliding window, exponential backoff (self-heal, always `429+Retry-After` M-1), counter keys on submitted email; fail-open + in-process degraded limiter + `auth.throttle.fail_open` log (M-7); `/auth/refresh` IP cap (L-5); change-password `throttle:acct:{userId}` (N-2)
- ref: architecture.md §8 · data-model.md §4 · test-plan.md I2.4-2.9/I3.10/I6.7 · → `apps/api`
- deps: T-001-02   · status: todo   · updated_by: —

## T-001-07 · backend-api · auth endpoints + DTOs (8 endpoints)
- desc: signup, login (transport declaration H-1), refresh (dual-transport + CSRF + 415 L-2), logout (+`familyId` ownership M-3), logout-all, sessions, change-password (US-6/D-008 + N-1 current-family + N-2 throttle), admin-reset (active-status guard H-2, F-003 capability seam); cookie `Path=/auth` (C-1); enumeration-safe errors
- ref: api-spec.md ทั้งฉบับ · → `apps/api`
- deps: T-001-03, T-001-04, T-001-05, T-001-06   · status: todo   · updated_by: —

## T-001-08 · backend-api · security event emission (F-005 seam)
- desc: emit `auth.refresh.reuse_detected`, `auth.password.admin_reset`, `auth.password.self_changed`, `auth.throttle.fail_open` (post-commit) — F-005 consumes ภายหลัง
- ref: architecture.md §3.3/§10 · → `apps/api`
- deps: T-001-07   · status: todo   · updated_by: —

## T-001-09 · backend-api · OpenAPI contract + client codegen
- desc: publish OpenAPI ของ 8 endpoints ลง `packages/contracts` (seam) → generate TS client (web) + Dart client (mobile)
- ref: api-spec.md · → `packages/contracts`
- deps: T-001-07   · status: todo   · updated_by: —

---

## T-001-10 · ux · design-sync (tokens + auth components)
- desc: เติมค่าจริง design token (color/typography/spacing) + register `AuthForm`/`PasswordField`/`ThrottleBanner`/`ErrorBanner`/`SessionListItem`/`ConfirmDialog` เข้า design-system กลาง (contribute-back); `/design-sync`
- ref: ui.md §4/§7 · → [design-system.md](../../design-system.md)
- deps: G2✓   · status: todo   · updated_by: —

---

## T-001-11 · devops · dev-CORS + cookie credentials
- desc: allowed-origins (web dev) + `credentials: true` สำหรับ cookie path; same-origin proxy (Next.js rewrites) เพื่อเลี่ยง SameSite=None ใน dev; `SameSite=Strict` prod
- ref: api-spec.md §0 · architecture.md §12 · → root env/config
- deps: G2✓   · status: todo   · updated_by: —

## T-001-12 · devops · trusted-proxy real client IP
- desc: derive client IP จาก `X-Forwarded-For` เฉพาะ known proxies (กัน IP-throttle spoof); TLS termination
- ref: architecture.md §8.3 · → infra/config
- deps: G2✓   · status: todo   · updated_by: —

## T-001-13 · devops · global /auth/* request ceiling (L-4 hardening)
- desc: service-level global rate ceiling บน `/auth/*` (กัน dummy-verify CPU-DoS amplification) — infra layer
- ref: architecture.md §12 · → infra/gateway
- deps: T-001-07   · status: todo   · updated_by: —

## T-001-14 · devops · breached-password fixture pipeline
- desc: version-pinned top-10k list ที่ `packages/core-domain/src/auth/fixtures/common-passwords-top10k.txt` + `SOURCE.md` (offline, diff-able)
- ref: data-model.md §5 · → `packages/core-domain` fixtures
- deps: G2✓   · status: todo   · updated_by: —

---

## T-001-15 · frontend · web auth screens + components
- desc: Next.js/Tailwind/shadcn — signup, login (+throttle countdown), help, sessions (`/settings/security`), change-password; states empty/loading/error/kicked-out; i18n `auth.*` (ไทย default); consume generated client (ห้าม reshape)
- ref: ux-wireframe.md · ui.md · → `apps/web`
- deps: T-001-09, T-001-10   · status: todo   · updated_by: —

## T-001-16 · frontend · web token/cookie refresh flow
- desc: httpOnly cookie refresh (web), access token in-memory, silent refresh on 401 + retry-once, `X-CSRF-Token` header บน cookie path
- ref: api-spec.md §0 · ux-wireframe.md §7 · → `apps/web`
- deps: T-001-09   · status: todo   · updated_by: —

## T-001-17 · frontend · mobile auth + secure storage (coordinate F-006)
- desc: Flutter — auth screens + refresh token ใน Keychain/Keystore, body-transport refresh loop, clear-on-logout; ประสาน shell ของ F-006
- ref: ux-wireframe.md §8 · api-spec.md §0 · → `apps/mobile`
- deps: T-001-09, T-001-10   · status: todo   · updated_by: —

---

## T-001-18 · qa · Track-1 test suite (hard gate)
- desc: implement test ตาม test-plan — unit (core-domain ★) + integration/API (supertest, Postgres+Redis) + E2E (Playwright web + Flutter); seed ≥2 org + isolation; HMAC/415/refresh-cap/leeway/committed-revoke/enumeration; เขียวก่อน merge (money-stock N/A — auth = identity)
- ref: test-plan.md ทั้งฉบับ · → `apps/api/**/*.spec.ts`, `packages/core-domain/**/*.test.ts`, `apps/web` Playwright, `apps/mobile/test`
- deps: T-001-07, T-001-15   · status: todo   · updated_by: —

## T-001-19 · qa · Track-2 agentic (scheduled, non-blocking)
- desc: Browser Use, persona SME ไทยไม่สาย tech — signup/login/logout happy path + throttle message + session list; report ไม่บล็อก merge
- ref: test-plan.md §7 Track 2 · → scheduled CI
- deps: T-001-15   · status: todo   · updated_by: —

---

> **Dispatch แรกที่ปลดล็อกทันที (deps=G2✓):** T-001-01, T-001-02, T-001-04, T-001-10, T-001-11, T-001-12, T-001-14
> **Critical path:** T-001-01/02 → 05 → 07 → 09 → (15/16/17 frontend) → 18 qa
