import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// F-001 T-001-11 — dev-CORS + cookie credentials.
// Spec: docs/features/F-001/architecture.md §12, api-spec.md §0 ("Dev-CORS").
//
// Why a rewrite instead of relying on API CORS: the web client sends
// `tokenTransport: "cookie"` and expects the refresh token in an `httpOnly;
// Secure; SameSite=Strict` cookie (`omni_rt`, api-spec §0/§2.2). A
// cross-origin browser call to a `SameSite=Strict` cookie's origin would
// simply not send/receive that cookie on subsequent navigations/requests in
// several real browser flows, and forces the API into a permissive
// `credentials:true` + explicit-origin CORS posture just for local dev. A
// same-origin dev proxy sidesteps both problems: the browser only ever talks
// to its own origin (`localhost:3001`), Next.js forwards these paths
// server-side to the real API origin, and `SameSite=Strict` behaves exactly
// as it will in prod (where web + api are same-site behind one edge).
// `CORS_ALLOWED_ORIGINS` (.env.example) remains a fallback for direct
// cross-origin dev setups that skip this proxy — not the primary dev path.
//
// Critical cookie-path fix (client-security review, Option A — 2026-07-06):
// `omni_rt` is scoped `Path=/auth` (api-spec §0/§2.2, C-1). For the browser
// to ever attach that cookie, auth calls must be REACHABLE AT THE BROWSER'S
// OWN PATH `/auth/*` (not proxied under `/api/auth/*`, which would path-miss
// the cookie's scope) — the API itself serves auth at `/auth/*` with no
// `/api` prefix. The `/auth/:path*` rewrite below is therefore listed BEFORE
// the general `/api/:path*` one so it is matched first (Next.js rewrites are
// tried in array order); non-auth API calls keep going through `/api/*`.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // T-000-09 placeholder shell — no custom config beyond defaults.
  // Real settings (env, images, headers, etc.) land with the features that
  // need them.
  reactStrictMode: true,
  // Pin the monorepo root explicitly — this machine has an unrelated
  // lockfile in the user's home directory that Next.js's root inference
  // otherwise picks up, producing a spurious "multiple lockfiles" warning.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    // Dev-only same-origin proxy: the browser calls these paths on the web
    // origin; Next.js forwards them server-side to the real API origin. This
    // never runs in a static/prod export (rewrites are a dev/Node-runtime
    // Next.js feature) — prod same-site topology is an infra/gateway
    // concern, not this file (see infra/gateway/README.md), and must
    // likewise expose auth at same-origin `/auth/*` there.
    return [
      // Auth MUST path-match the browser's own `/auth/*` (not `/api/auth/*`)
      // so `omni_rt`'s `Path=/auth` scope actually covers these requests —
      // listed first so it wins over the general `/api/*` rule below.
      {
        source: "/auth/:path*",
        destination: `${apiOrigin}/auth/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
