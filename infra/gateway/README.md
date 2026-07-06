# infra/gateway — edge/proxy trust + rate-ceiling notes

Owner: `devops`. This directory holds infra-level (not application-code)
config/notes for the reverse-proxy / edge layer that sits in front of
`apps/api` in any real deployment. Phase 0 has no live deployment yet (see
root `CLAUDE.md` — "Phase 0 — Foundation/Spec"), so there is no concrete
Terraform/nginx/Caddy config to commit yet; this README is the seam so the
assumptions are written down once and the real config lands here without a
docs hunt when a deploy target is chosen.

## T-001-12 — trusted-proxy real client IP

Spec: [docs/features/F-001/architecture.md §8.3](../../docs/features/F-001/architecture.md).

**Assumption the API must satisfy (backend-api, T-001-06/T-001-07):**
`X-Forwarded-For` is only ever honored for the number of hops actually
present between the API process and the public internet, and that hop count
is a known constant for the deployment topology — never inferred from the
header itself (an attacker can prepend arbitrary values to `X-Forwarded-For`;
only the hop(s) added by proxies *we* operate are trustworthy).

- **Env contract** (`.env.example`, root): `TRUST_PROXY_HOPS` (integer count
  of trusted hops, Express/NestJS `app.set('trust proxy', N)` semantics) +
  optional `TRUSTED_PROXY_IPS` (allow-list, defense-in-depth where the
  runtime can pin the proxy's own egress IPs/CIDR).
- **Local dev / this repo's CI:** no proxy in front of the API (GitHub
  Actions service container is reached directly) → `TRUST_PROXY_HOPS=0`. The
  `T-001-20` CI lane sets no proxy-related env override, so the
  integration suite's IP-throttle tests exercise the direct
  socket-remote-address path, not a forwarded one.
- **Single-region prod (whenever F-001 ships to a real environment):**
  exactly one reverse proxy/load balancer in front of the API →
  `TRUST_PROXY_HOPS=1`. If a CDN/edge is later added in front of that LB,
  this becomes `2` — the value must track the *actual* topology, never be
  raised speculatively (raising it beyond the real hop count re-opens the
  spoofing hole it exists to close).
- **TLS assumption:** TLS terminates AT the trusted proxy/load balancer, not
  directly at the API instance from the public internet (architecture.md §9
  "Transport" — "tokens only over TLS"). The API trusting a forwarded
  client-IP/proto header is only safe because the hop immediately in front
  of it is infrastructure we operate and control, not an arbitrary
  intermediary — this must hold for `TRUST_PROXY_HOPS` to mean anything.

**Division of labor:** devops owns the env contract + this documented
assumption; `apps/api`'s `main.ts`/throttle middleware (backend-api,
T-001-06/T-001-07) is responsible for actually calling
`app.set('trust proxy', ...)` (or the NestJS-Express equivalent) using
`TRUST_PROXY_HOPS` before the IP-throttle derives the client IP — that call
site is inside `apps/api` source and out of devops's path per the current
task split.

## Critical cookie-path fix — prod topology must expose `/auth/*` same-origin too

Spec: `docs/features/F-001/api-spec.md §0/§2.2` (cookie scope, C-1); client-security
review 2026-07-06, Option A (user-approved), converged contract with backend + frontend.

**The fix is not just a dev-proxy concern.** `omni_rt` is scoped `Path=/auth` (and
`omni_csrf` is now `Path=/`, widened from `/auth` — see below) so that the browser
attaches it to `/auth/*` calls. For that cookie scope to mean anything, the
**browser-visible path** the client calls must itself be `/auth/*`, in every
environment — not only in local dev via the Next.js rewrite
(`apps/web/next.config.mjs`, T-001-11).

- **In prod, the same constraint applies at the edge/gateway, not Next.js.**
  Whatever sits in front of `apps/web` + `apps/api` in a real deployment (a
  single reverse proxy, a PaaS routing layer, a CDN with path rules — topology
  TBD, Phase 0 has none yet) **must route `/auth/*` on the public/browser
  origin straight through to the API's `/auth/*`** (no path rewriting that
  would turn it into e.g. `/api/auth/*` at the API, and no prefix-stripping
  that would change what the browser itself sees as the request path — the
  cookie's `Path` match is evaluated against the browser's URL, so what
  matters is the origin+path the browser sends the request to, which must
  literally be `/auth/*`). This mirrors exactly what the dev rewrite does
  (`source: '/auth/:path*'` ordered before the general `/api/:path*` rule) —
  whoever configures the prod gateway must reproduce the same routing
  decision, not just "same-site" (same-site alone is necessary but not
  sufficient; the *path* must also match `/auth`).
- **`omni_csrf` is now `Path=/`** (widened from `/auth` per the same
  client-security fix) — this cookie has no path-matching constraint left to
  satisfy at the gateway (it's sent on every same-site request regardless of
  path), so it does not add a routing requirement here; noted for
  completeness since it's part of the same converged contract.
- **Division of labor:** devops (this file + the dev rewrite) documents and
  implements the *dev* instance of this constraint; whoever stands up the
  real prod gateway (a future devops/infra task, once a deploy target is
  chosen — Phase 0 has none) must apply the identical `/auth/*` same-origin
  routing rule there. This is flagged here so it is not lost between now and
  that point — same class of seam as T-001-13 below.

## T-001-13 — global `/auth/*` request ceiling (L-4)

Spec: [docs/features/F-001/architecture.md §12](../../docs/features/F-001/architecture.md)
(deps: `T-001-07`, not yet dispatch-ready — endpoints must exist first).

Every login attempt costs ~50–100ms of argon2 CPU (the dummy-verify on
unknown email is inherent to enumeration resistance and must not be
removed — arch §9). A distributed rotating-email/IP attacker can still
amplify that into CPU exhaustion even with the per-account/per-IP throttles
in place (§8), because those throttles don't bound *aggregate* request
volume across many distinct keys. The mitigation is a **service-level global
rate ceiling on the `/auth/*` surface** (e.g. total req/s across all auth
endpoints, edge/gateway-level — nginx `limit_req`, a PaaS-level rate rule, or
equivalent), independent of the per-account/per-IP Redis throttles
`apps/api` already implements.

This is infra, not a contract change — no endpoint behavior changes, only an
additional ceiling in front of the whole `/auth/*` path. **Not yet actioned**
in this pass: `T-001-13` depends on `T-001-07` (the actual endpoints), which
is still `todo` on the backend-api board as of this writing — there is
nothing to put a ceiling in front of yet, and no concrete deploy target
(Phase 0) to configure a real edge rule against. Tracked here so the task
isn't lost; revisit once `T-001-07` lands and a deploy target exists.
