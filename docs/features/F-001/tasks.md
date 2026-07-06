# F-001 Task Board — Authentication

> เจ้าของ task update status ของตัวเอง (`todo→in_progress→done`) + ลงชื่อ `updated_by` · PM dispatch task ที่ `deps=done` ครบ
> ref = เอกสาร Gate-2 + target path ([workspace-map.md](../../workspace-map.md)) · ที่มา: Gate-2 docs (sign off + commit 2026-07-04)
> Build order: `backend-api` (apps/api + packages/*) → contract/client พร้อม → `frontend` · `devops` ∥ · `ux` design-sync ก่อน frontend visual · `qa` colocated ตามหลังโค้ด
> **หมายเหตุ:** board นี้ PM ร่างจาก Gate-2 docs ที่ approved — เจ้าของแต่ละทีม refine/claim + อัปเดต status ได้เมื่อหยิบงาน
> **D-014 (บังคับทุก task):** ทุก task ที่ implement ส่ง unit test มาพร้อมโค้ดเสมอ — T-001-18 คือ integration/E2E **gate** ไม่ใช่จุดเดียวที่มี test
> **Amended 2026-07-05:** ตาม fable pre-build review — C-1 (T-001-07), I-1 (T-001-20 ใหม่), I-3 (บรรทัด D-014 บนนี้), D-017 session cap
> **backend-api build 2026-07-06:** T-001-01/02/03/04/05/06/07/08/14 = **done** (tree staged, ไม่ได้ commit — รอ security review บน ★ 01/05/07).
> Tests all green (ดูตัวเลขด้านล่าง). T-001-09 = **in_progress**: OpenAPI 8 endpoints published + redocly gate ผ่าน + TS client
> gen แล้ว; Dart client **code** gen แล้วครบ (`apps/mobile/api_client` — auth_api.dart + models ทุกตัว) แต่ `build_runner`
> (`.g.dart` companions, D-015) **ค้าง** เพราะ Dart SDK บนเครื่อง build = 2.17.1 (pubspec ต้องการ ≥2.18) และ FVM-pinned SDK
> ไม่มีใน worktree นี้ — รันบน CI/dev machine ที่มี FVM SDK (ตาม `scripts/gen-dart-client.sh`). TS client พอสำหรับ web (T-001-15/16).
> **New tooling deps:** apps/api += argon2, @nestjs/jwt, class-validator/-transformer, cookie-parser (runtime) + supertest, unplugin-swc/@swc/core
> (test: vitest ต้องมี decorator-metadata สำหรับ Nest DI). core-domain += `verify:fixture`/`gen:fixture` scripts. lockfile updated.
> **Security-review fixes applied 2026-07-06 (★ review of 01/05/07, still staged — no commit):**
> (1) [Critical] `main.ts` trust-proxy = `Number(env.TRUST_PROXY_HOPS)` (default 0 = spoof-safe) — no more `trust proxy:true` XFF-spoof bypass;
> new `TRUST_PROXY_HOPS` in `packages/config/src/env.ts` (non-neg int, default "0", fail-fast). (2) [Important] `main.ts`
> `app.enableCors({ origin: CORS_ALLOWED_ORIGINS allow-list, credentials:true, allowedHeaders:[Content-Type,Authorization,X-CSRF-Token] })`
> — new `CORS_ALLOWED_ORIGINS` env (comma→string[]); never `*`/`true` w/ credentials. (3) [Minor] admin-reset now
> `throttle.clearAccount(targetEmailNorm)` (anti-lockout escape hatch, I5.4). (4) [Minor] `issueOnLogin` count→evict→mint wrapped in
> one `$transaction` (tightens concurrent-login cap race). (5) [Minor] `resolveFamily(value, liveOnly=true)` for change-password spare
> (spec §2.7 "live family"; revoked/expired → safe-direction revoke-all). Tests added: env.ts (2 vars, 8 cases — **run, pass**),
> spoofed-XFF-no-fresh-bucket + CORS reject/allow + admin-reset-clears-backoff (DB/Redis-backed).
> **Client-security review fix — D-019 split cookie paths (Option A, user-approved) 2026-07-06 (staged, no commit):** C-1 amendment —
> `omni_rt` (httpOnly refresh) คง `Path=/auth`; `omni_csrf` (non-httpOnly double-submit) → **`Path=/`** เพราะ JS ต้องอ่านจาก app page
> (`/login`,`/settings/security`,`/`) นอก `/auth` (single `/auth` path ทำให้ cookie transport ตายในเบราว์เซอร์จริง). auth เสิร์ฟที่
> browser path `/auth/*` (web proxy rewrite `/auth/:path*`). แก้: `auth.constants.ts` (+`CSRF_COOKIE_PATH="/"`), `cookies.ts` (set+clear แยก path).
> docs amended: api-spec §0 (C-1 block + §2.2/§2.4/§5), architecture §12, **DECISIONS.md D-019**. Test เพิ่ม: E2E cookie-login assert
> `omni_rt Path=/auth` + `omni_csrf Path=/` (NOT `/auth`) + SameSite=Strict ทั้งคู่ (DB-backed → รันใน CI). qa: อัปเดต test-plan L155/L411
> (`omni_csrf ... Path=/auth` → `Path=/`) — เจ้าของ test-plan; backend ไม่แก้ไฟล์ qa. ไม่แตะ apps/web / next.config.mjs (frontend/devops owns).
> **⚠️ Re-run limitation:** Docker daemon wedged กลางรอบนี้ (ทุก `docker` cmd แฮงก์ครบ 2-min timeout) → **ไม่สามารถรัน DB-backed integration/E2E suite ซ้ำได้** in-session.
> ที่รันผ่าน (ตัวเลขจริง 2 รอบ security-review นี้): config 18/18, core-domain 91/91, api non-DB 54 passed / 29 skipped (int+e2e skip เพราะไม่มี TEST_DATABASE_URL),
> lint (api/config/core-domain) clean, typecheck all clean, redocly + purity + fixture gates ผ่าน. DB-backed tests เขียนครบ + typecheck ผ่าน
> แต่ **ยังไม่ได้ execute รอบนี้** — CI (T-001-20 Postgres+Redis lane) จะรันจริง; ก่อน Docker พังรอบก่อนหน้ารันผ่านครบ (api 79/79).
> **Devops update 2026-07-06:** T-001-11/T-001-12/T-001-20 done — see `.env.example` (CORS/trusted-proxy env contract),
> `apps/web/next.config.mjs` (dev rewrite → same-origin proxy), `.github/workflows/ci.yml` (`integration-api` +
> `e2e-web` jobs), `infra/gateway/README.md` (trusted-proxy + T-001-13 notes). Both new CI jobs already run a REAL
> booted-process HTTP smoke (`/health` 200, web `GET /` 200 — satisfies the F-000 forward-commitment) **today**, and
> auto-pick-up `apps/api`'s `test:integration` / `apps/web`'s `test:e2e` scripts once T-001-07/T-001-15/T-001-18 land
> (existence-checked, no CI file change needed then — see job comments). T-001-13 stays `todo`: it depends on
> T-001-07 (nothing to put a rate ceiling in front of yet) and Phase 0 has no live deploy target to configure.
> **Frontend build 2026-07-06:** T-001-15/T-001-16 = **done**. Screens: `/signup`, `/login` (email
> prefill from signup redirect + throttle countdown), `/login/help` (static), `/settings/security`
> (change-password section + session list section, ux-wireframe §9.1), all in `apps/web/src/app/**`.
> Components (contribute-back per ui.md §2.1, `apps/web/src/components/**`): `AuthForm`,
> `PasswordField`, `TextField`, `Button`, `ErrorBanner`, `ThrottleBanner`, `ConfirmDialog`, `Toast`,
> `Skeleton`/`SessionListSkeleton`, `SessionListItem`, `SessionList`, `ChangePasswordForm`. All 4
> design-system §2 states (loading/empty/error/success) implemented per screen; Thai copy centralized
> in `apps/web/src/i18n/auth.ts` (`auth.*` keys verbatim from ui.md §3, no hardcoded strings in
> components). Design tokens ported 1:1 from design-system.md §1 into CSS custom properties
> (`apps/web/src/styles/tokens.css`) — plain CSS custom properties + inline styles were used instead of
> Tailwind/shadcn (workspace-map's stated stack) because neither was scaffolded anywhere in the repo yet
> and pulling in Tailwind v4's new CSS-first toolchain wasn't a decision this task should make silently;
> token values/names are unchanged so a later Tailwind/shadcn pass is a mechanical remap, not a rewrite —
> flagging for `ux`/PM to confirm or override. T-001-16 ★: `apps/web/src/lib/token-store.ts` (access
> token in-memory module var only — never localStorage/sessionStorage, asserted by test),
> `apps/web/src/lib/csrf.ts` (reads `omni_csrf` cookie → `X-CSRF-Token` header), `apps/web/src/lib/
> auth-client.ts` (`requestWithRefresh`: silent refresh on 401, retry original call exactly once, then
> `SessionExpiredError` — never loops; CSRF header attached on refresh/logout/change-password; web
> always sends `tokenTransport: "cookie"`; same-origin `/api/*` via the existing T-001-11 proxy, no
> `SameSite=None` introduced). D-014: 14 test files / **99/99 tests passing** — covers token-store
> (in-memory only + no web-storage writes), csrf header attach/absence, refresh-retry-once (5 branch
> cases incl. double-401 and refresh-failure), silentRefresh wire behavior (credentials:include, CSRF
> header, token storage, 401 clears state), throttle countdown formatting + real-time hook ticking (no
> jitter, tabular-nums class asserted), relative-time, client-side validation, error-code→Thai mapping,
> and component states (AuthForm loading/error/throttle/success, PasswordField show/hide + a11y,
> ThrottleBanner copy/role, ConfirmDialog destructive-defaults-to-Cancel-focus, SessionList
> loading/error/success + confirm-before-logout). `pnpm --filter web lint` / `typecheck` / `test` /
> `build` all green (see PM verification). client-security skill checklist walked (in-memory access
> token, httpOnly-only refresh, retry-once, no tokens/PII logged, no `dangerouslySetInnerHTML`) —
> `security-reviewer` pass on this ★ diff is still outstanding before merge (WEB_TEAM §3.6). T-001-18
> (qa Playwright/E2E) and T-001-19 (agentic) can now start against these routes; mobile T-001-17 remains
> parked (Dart SDK blocked, untouched by this task).
> **Client-security review fixes applied 2026-07-06 (T-001-16 ★, staged, no commit) — CONVERGED CONTRACT
> (backend+devops): auth reachable at browser path `/auth/*` (Next proxy rewrite `/auth/:path*` listed
> before `/api/:path*`, see `apps/web/next.config.mjs`); `omni_rt` stays `Path=/auth`, `omni_csrf` moves
> to `Path=/` so `document.cookie` can read it from app pages (D-019, backend-owned cookie change).**
> (1) [Critical] `apps/web/src/lib/api-base.ts` now exports `AUTH_BASE="/auth"` (kept alongside
> `API_BASE="/api"` for future non-auth calls); `auth-client.ts`'s `rawRequest` was hitting
> `/api/auth/refresh` (path-missing `omni_rt`'s `Path=/auth` scope — the browser would never actually
> attach the cookie in prod), now hits `/auth/refresh` etc. via an explicit `AUTH_PATHS` allowlist (all 8
> endpoints) so a future stray call fails loudly instead of silently drifting back to `/api/auth/*`.
> (2) [Important] `silentRefresh` is now single-flight — a module-level `inflightRefresh` promise dedupes
> concurrent 401s so a second/third caller no longer fires its own `/auth/refresh` (which would've hit the
> just-rotated token as a benign-retry 401 and wrongly thrown `SessionExpiredError` for a live session).
> (3) [Important] `SessionList.tsx`'s `confirmLogoutAll` no longer redirects to `/login` on a network/500
> failure — it now shows a danger `ErrorBanner` ("ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ ลองใหม่อีกครั้ง", new key
> `auth.sessions.error.logoutAllFailed` — not in the original ui.md table, flagging for `ux` to
> confirm/adjust copy) and keeps the user on the page; only a genuine 204 or a `SessionExpiredError`
> (access token already dead either way) redirects. (4) [Important] added a shared
> `isSessionExpired(err)` helper (`auth-client.ts`) + `redirectToLoginSessionExpired()`
> (`session-expired-redirect.ts`, redirects to `/login?sessionExpired=1`) — wired into
> `ChangePasswordForm.tsx` and `SessionList.tsx`'s `load()`/`confirmLogoutAll` so a dead session always
> redirects with the standard polite toast (`auth.sessionExpired.toast`, wired via the login page's
> existing query-param-toast pattern) instead of `SessionList` looping a "ลองใหม่" retry forever against
> an already-confirmed-dead session. (5) [Minor] fixed the `auth-client.ts` doc comment (logout-all is
> Bearer-only, never got the CSRF header — code was already correct, only the comment was wrong); dropped
> the previously-unused `hasFreshAccessToken` export from `token-store.ts` rather than wiring a
> pre-emptive-refresh code path that would have changed the already-reviewed retry-once contract in
> `requestWithRefresh`. Tests: 3 new files (`auth-client.paths.test.ts` — all 8 endpoints assert `/auth/*`
> not `/api/*`; `auth-client.helpers.test.ts` — `isSessionExpired`; `ChangePasswordForm.test.tsx` — new,
> covers success/error/throttle/session-expiry-redirect states) + updates to `csrf.test.ts` (added a
> real-`JSDOM`-per-case regression suite modeling actual `Path=` cookie scoping — the previous
> `document.cookie` assertions ran under vitest's shared jsdom document with no explicit `Path=`, which
> silently inherited the current path and would never have caught a `Path=/auth` vs `Path=/` bug),
> `auth-client.silent-refresh.test.ts` (URL assertion corrected to `/auth/refresh`; added single-flight
> dedupe test asserting exactly one fetch across 3 concurrent callers, plus a test proving the in-flight
> promise clears so a later non-concurrent call fires fresh), `auth-client.retry.test.ts` (added a
> concurrent-401-shares-one-refresh test at the `requestWithRefresh` level), `SessionList.test.tsx` (added
> logout-all success/failure/session-expired-redirect cases + a `getSessions` session-expired-redirect
> case, using a `window.location.href` stub to assert redirect vs. no-redirect without real navigation),
> `token-store.test.ts` (dropped the removed export's cases). **Full suite now 17 files / 121 tests
> passing** (`pnpm --filter web lint|typecheck|test` all exit 0; `next build` also still succeeds, 5
> static routes). Did NOT start the Tailwind/shadcn migration (separate follow-up per PM instruction) —
> plain CSS custom properties unchanged. `security-reviewer` re-pass on this diff still outstanding
> before merge.
> **Tailwind v4 + shadcn/ui migration (D-020) applied 2026-07-06 — mechanical restyle, T-001-10/T-001-15
> follow-up:** apps/web moved from plain CSS custom properties + inline `style` to Tailwind v4
> (`@tailwindcss/postcss`, CSS-first `@theme` in `apps/web/src/styles/tokens.css`) + shadcn/ui
> conventions (`cva`, `cn()` at `components/ui/utils.ts`, `components.json`). Same components, same
> props/state machine, same a11y attributes, same Thai i18n keys, same token **values** — see
> design-system.md §1.5 for the full token → Tailwind theme mapping. `ConfirmDialog` intentionally
> NOT swapped to the Radix `<Dialog>` primitive (installed as a dependency for future shadcn
> components, but this restyle keeps the existing hand-rolled focus/Escape/role wiring — already
> meets every a11y + test requirement, and this task is a restyle, not a redesign). `src/lib/**`
> untouched (token-store, auth-client, csrf, validation — byte-identical). Full suite still **17
> test files / 121 tests passing**; `pnpm --filter web lint|typecheck|test` all exit 0; `next build`
> still succeeds (5 static routes, same route list). D-020 flipped to done in DECISIONS.md.

## backend-api

| ID       | งาน                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ref → target                                                               | deps                                   | status | updated_by |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- | ------ | ---------- |
| T-001-01 | core-domain auth pure fns — password policy (8–128 + breached top-10k), email normalize, reuse-decision (+60s leeway D-011), backoff curve · unit test ★ (กฎทอง #4/#6)                                                                                                                                                                                                                                                                                                                                                  | architecture §3.3/§5 · data-model §5 → `packages/core-domain/src/auth`     | G2✓                                    | done   | backend-api |
| T-001-02 | Prisma migration — RefreshToken deltas: `familyId`, `tokenHash @unique` (HMAC), `expiresAt`, `familyExpiresAt` (90d cap, inherited), `lastUsedAt?` + indexes · no backfill                                                                                                                                                                                                                                                                                                                                              | data-model §2/§3 → `packages/db`                                           | G2✓                                    | done   | backend-api |
| T-001-03 | password hashing (argon2id) — OWASP params + verify (constant-time) + rehash-on-login + dummy-verify                                                                                                                                                                                                                                                                                                                                                                                                                    | architecture §5/§9 → `apps/api`                                            | T-001-01                               | done   | backend-api |
| T-001-04 | JWT access token + guard — HS256 15m, claims `sub` only, `typ`/alg pin, `JwtAuthGuard`                                                                                                                                                                                                                                                                                                                                                                                                                                  | architecture §2.2 → `apps/api`                                             | G2✓                                    | done   | backend-api |
| T-001-05 | ★ refresh service — opaque + `tokenHash=HMAC-SHA-256` (L-3); rotation txn row-lock; reuse→committed family revoke (H-3) +60s leeway (D-011); `familyExpiresAt` guard (D-007); **live-family cap 20/user — login เกิน revoke family เก่าสุด (D-017)**                                                                                                                                                                                                                                                                    | architecture §3/§4 · data-model §2.4 → `apps/api` + `packages/core-domain` | T-001-01, T-001-02                     | done   | backend-api |
| T-001-06 | throttle & rate-limit (Redis) — IP+account backoff, always `429+Retry-After` (M-1); fail-open + degraded limiter + log (M-7); `/auth/refresh` IP cap (L-5); change-pw throttle (N-2)                                                                                                                                                                                                                                                                                                                                    | architecture §8 · data-model §4 → `apps/api`                               | T-001-02                               | done   | backend-api |
| T-001-07 | ★ auth endpoints (8) + DTOs — signup, login (transport-decl H-1), refresh (dual + CSRF + 415 L-2), logout (+familyId ownership M-3), logout-all, sessions, change-password (US-6 + N-1/N-2), admin-reset (active-status H-2); cookie `Path=/auth` (C-1) · **admin-reset ต้อง implement capability check เต็ม INLINE ใน F-001: caller มี Membership(orgId).status=active + Role.capabilities ⊇ `manage_members` — ห้ามพึ่ง/ห้าม ship stub (fable C-1; F-003 มาแทนกลไกทีหลัง ไม่ใช่ semantics) — ไม่ต้องรอ tenancy seam** | api-spec ทั้งฉบับ → `apps/api`                                             | T-001-03, T-001-04, T-001-05, T-001-06 | done   | backend-api |
| T-001-08 | security event emission (F-005 seam) — `reuse_detected`, `admin_reset`, `self_changed`, `fail_open` (post-commit)                                                                                                                                                                                                                                                                                                                                                                                                       | architecture §3.3/§10 → `apps/api`                                         | T-001-07                               | done   | backend-api |
| T-001-09 | OpenAPI contract + client codegen — publish 8 endpoints → gen TS (web) + Dart (mobile) client · additive-only + per-op security mapping (endpoints 1–4 `security: []`) ผ่าน redocly gate · Dart output = `apps/mobile/api_client` + build_runner (D-015)                                                                                                                                                                                                                                                                | api-spec → `packages/contracts`                                            | T-001-07                               | in_progress | backend-api |

## ux

| ID       | งาน                                                                                                                                                                                                       | ref → target                                             | deps | status | updated_by |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---- | ------ | ---------- |
| T-001-10 | design-sync — เติมค่า design token จริง + register `AuthForm`/`PasswordField`/`ThrottleBanner`/`ErrorBanner`/`SessionListItem`/`ConfirmDialog` เข้า design-system กลาง (contribute-back) · `/design-sync` | ui.md §4/§7 → [design-system.md](../../design-system.md) | G2✓  | done   | ux         |

## devops

| ID       | งาน                                                                                                                                                                                                                                                   | ref → target                                                | deps     | status | updated_by |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- | ------ | ---------- |
| T-001-11 | dev-CORS + cookie credentials — allowed-origins + `credentials:true` (cookie path); same-origin proxy (Next.js rewrites) เลี่ยง SameSite=None ใน dev; `SameSite=Strict` prod                                                                          | api-spec §0 · architecture §12 → root env/config            | G2✓      | done   | devops     |
| T-001-12 | trusted-proxy real client IP — `X-Forwarded-For` เฉพาะ known proxies (กัน IP-throttle spoof); TLS                                                                                                                                                     | architecture §8.3 → infra/config                            | G2✓      | done   | devops     |
| T-001-13 | global /auth/* request ceiling (L-4) — service-level rate ceiling กัน dummy-verify CPU-DoS                                                                                                                                                            | architecture §12 → infra/gateway                            | T-001-07 | todo   | —          |
| T-001-14 | breached-password fixture pipeline — version-pinned top-10k + `SOURCE.md` (offline, diff-able)                                                                                                                                                        | data-model §5 → `packages/core-domain` fixtures             | G2✓      | done   | backend-api |
| T-001-20 | **CI integration/E2E lane (I-1)** — job ใหม่: Postgres+Redis services + รัน api integration suite (supertest) + Playwright job (web) เป็น required checks · รวม forward-commitment "e2e-in-CI (F-000 AC3/AC15)" — supertest `/health` + web GET / 200 | test-plan §7/§8 · forward-commitments → `.github/workflows` | G2✓      | done   | devops     |

## frontend

| ID       | งาน                                                                                                                                                                   | ref → target                                  | deps               | status | updated_by |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------ | ------ | ---------- |
| T-001-15 | web auth screens + components — signup, login (+throttle countdown), help, sessions, change-password; states + i18n `auth.*`; consume generated client (ห้าม reshape) | ux-wireframe · ui.md → `apps/web`             | T-001-09, T-001-10 | done   | frontend    |
| T-001-16 | ★ web token/cookie refresh flow — httpOnly cookie refresh, access in-memory, silent refresh on 401 + retry-once, `X-CSRF-Token`                                       | api-spec §0 · ux-wireframe §7 → `apps/web`    | T-001-09           | done   | frontend    |
| T-001-17 | ★ mobile auth + secure storage — Flutter screens + refresh ใน Keychain/Keystore, body-transport refresh loop, clear-on-logout (ประสาน F-006)                          | ux-wireframe §8 · api-spec §0 → `apps/mobile` | T-001-09, T-001-10 | todo   | —          |

## qa

| ID       | งาน                                                                                                                                                                                                                                                                                          | ref → target                                                                                                      | deps                             | status | updated_by |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------ | ---------- |
| T-001-18 | Track-1 test suite (hard gate) — unit (core-domain ★) + integration/API + E2E (Playwright/Flutter); seed ≥2 org + isolation; HMAC/415/refresh-cap/leeway/committed-revoke/enumeration · หมายเหตุ D-014: unit test มากับ task ต้นทางอยู่แล้ว — task นี้คือชั้น integration/E2E + gate verdict | test-plan ทั้งฉบับ → `apps/api/**/*.spec.ts`, `packages/core-domain/**/*.test.ts`, `apps/web`, `apps/mobile/test` | T-001-07, T-001-15, **T-001-20** | todo   | —          |
| T-001-19 | Track-2 agentic (scheduled, non-blocking) — Browser Use persona SME ไทย: signup/login/logout + throttle message + session list                                                                                                                                                               | test-plan §7 → scheduled CI                                                                                       | T-001-15                         | todo   | —          |

---

> **★** = money/stock/auth/token ตาม WEB_TEAM §3.4 (dispatch opus + security-reviewer ก่อน merge) — T-001-01 มีแต่แรก; T-001-05/07/16/17 retro-tag 2026-07-04
> **Dispatch แรกที่ปลดล็อกทันที (deps=G2✓):** T-001-01, T-001-02, T-001-04, T-001-10, T-001-11, T-001-12, T-001-14, T-001-20
> **Critical path:** T-001-01/02 → 05 → 07 → 09 → (15/16/17 frontend) → 18 qa
