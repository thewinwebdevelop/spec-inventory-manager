// devops — security review of B-19 (F-002 tasks.md "ที่ยังเหลือ" row, predates
// B-19). api-spec.md §3.14/I-6: the invitation token in `/invite?token=…` is
// "the one secret that keeps a stranger out of an organisation" — the API
// side already refuses it in a query string and sets
// `Referrer-Policy: no-referrer` on every invitation response
// (`apps/api/src/orgs/response-headers.ts`). This pins the matching header on
// the web route that carries the token on its FIRST document load, before
// `InviteScreen`'s layout effect strips it from the URL (E-12).
//
// D-014: this asserts against `next.config.mjs` itself (not a re-declared
// copy) — a copy would keep passing on the day the header stops being served.
// The real-server proof (`curl -sI` against a rebuilt `next start`) lives in
// the devops report for this change, not in this suite: vitest never boots a
// Next.js server, so it cannot see whether Next actually serves whatever
// `headers()` returns.
import { describe, it, expect } from "vitest";
import nextConfig from "../../../next.config.mjs";

describe("next.config headers() — /invite Referrer-Policy", () => {
  it("★ sets Referrer-Policy: no-referrer on the /invite route", async () => {
    const rules = await nextConfig.headers!();
    const inviteRule = rules.find((rule) => rule.source === "/invite");

    expect(inviteRule).toBeDefined();
    expect(inviteRule!.headers).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    });
  });

  it("does not widen the header to every route — scope stays /invite only", async () => {
    // Non-vacuity for the scoping decision (next.config.mjs comment): this
    // fails the moment `source` becomes a wildcard like "/:path*", forcing
    // whoever does that to make the trade-off explicit rather than get it
    // for free by editing one string.
    const rules = await nextConfig.headers!();
    const sources = rules.map((rule) => rule.source);

    expect(sources).toEqual(["/invite"]);
  });
});
