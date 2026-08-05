// F-002 · T-002-20 ★ — what the TWO PUBLICLY REACHABLE routes declare
// (api-spec §3.14/§3.15 · architecture §1.1/§8 · I-3/I-6).
//
// Every other F-002 route is behind `OrgScopeGuard` + `CapabilityGuard` with a
// proven active membership. These two are not: one has no authentication at all
// and the other has no organization. That makes their DECLARATIONS the whole
// perimeter, and a declaration is exactly the kind of thing a refactor drops
// without any test noticing — which is why they are asserted here, in the unit
// lane, with no database and no application.
//
// The live-router version (the tier the middleware actually assumes, the 429,
// the headers on the wire) is `test/invitations-redeem.e2e.int.test.ts`.
import { describe, it, expect } from "vitest";
import { PATH_METADATA } from "@nestjs/common/constants";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import {
  ANY_ACTIVE_MEMBER_KEY,
  CAPABILITY_KEY,
  ROUTE_CAPABILITIES,
  routeKey,
} from "../common/authz";
import { ORG_RATE_LIMIT_KEY } from "../common/org-rate-limit.decorator";
import { ROUTE_SCOPE_KEY } from "../tenancy";
import { InvitationRedemptionController } from "./invitation-redemption.controller";
import { RESPONSE_HEADER_POLICY, responseHeaderPolicyFor } from "./response-headers";

const reflector = new Reflector();

function declarationOf(target: object) {
  return {
    scope: reflector.get<string | undefined>(ROUTE_SCOPE_KEY, target as never),
    capability: reflector.get<string | undefined>(CAPABILITY_KEY, target as never),
    anyActiveMember: reflector.get<boolean | undefined>(ANY_ACTIVE_MEMBER_KEY, target as never),
    rateLimit: reflector.get<string | undefined>(ORG_RATE_LIMIT_KEY, target as never),
    httpCode: Reflect.getMetadata(HTTP_CODE_METADATA, target) as number | undefined,
    path: Reflect.getMetadata(PATH_METADATA, target) as string | undefined,
  };
}

const preview = InvitationRedemptionController.prototype.preview;
const accept = InvitationRedemptionController.prototype.accept;

describe("★ paths match api-spec §2/§3.14/§3.15 exactly", () => {
  it("the controller is mounted at /invitations — NOT under /orgs/{orgId}", () => {
    // The whole point: neither route has an `:orgId` segment, so there is no
    // path value that could aim them at a tenant (I-3).
    expect(Reflect.getMetadata(PATH_METADATA, InvitationRedemptionController)).toBe("invitations");
  });

  it.each([
    ["preview", preview, "preview"],
    ["accept", accept, "accept"],
  ])("%s is mounted at /invitations/%s", (_name, handler, path) => {
    expect(declarationOf(handler).path).toBe(path);
  });

  it("★ neither route appears in ROUTE_CAPABILITIES — there is no org to evaluate one in", () => {
    for (const path of ["/invitations/preview", "/invitations/accept"]) {
      expect(
        ROUTE_CAPABILITIES.some((row) => routeKey(row) === routeKey({ method: "POST", path })),
      ).toBe(false);
    }
  });
});

describe("★ tiers (architecture §1.1, I-3)", () => {
  it("preview is @Public() — the invite page renders before anyone signs in", () => {
    expect(declarationOf(preview).scope).toBe("public");
  });

  it("accept is @UserScoped() — authenticated, but NOT about an org", () => {
    // `@Public()` here would let a stranger write a membership; org-scoped (the
    // default) would demand a context the caller does not have and could only
    // supply from a header — the thing I-3 exists to forbid.
    expect(declarationOf(accept).scope).toBe("user");
  });

  it("★ the tier is on the HANDLER, and NOTHING is declared on the class (High-1)", () => {
    // A class-level tier is inherited by every handler added later, and the
    // inherited one is always the more permissive of the two here: a future
    // handler on this controller would silently become `@Public()`.
    expect(reflector.get(ROUTE_SCOPE_KEY, InvitationRedemptionController)).toBeUndefined();
    expect(reflector.get(CAPABILITY_KEY, InvitationRedemptionController)).toBeUndefined();
    expect(reflector.get(ANY_ACTIVE_MEMBER_KEY, InvitationRedemptionController)).toBeUndefined();
  });

  it("neither declares a capability or @AnyActiveMember — there is nothing to check", () => {
    for (const handler of [preview, accept]) {
      expect(declarationOf(handler).capability).toBeUndefined();
      expect(declarationOf(handler).anyActiveMember).toBeUndefined();
    }
  });
});

describe("★ rate limit (architecture §8 · api-spec §19)", () => {
  it.each([
    ["preview", preview],
    ["accept", accept],
  ])("%s declares @OrgRateLimit('publicInvitationEntry') — 30/hour/IP", (_name, handler) => {
    // On preview it is the ONLY bound on an unauthenticated, enumerable
    // endpoint. On accept it shares the same per-IP bucket, which is what
    // api-spec §19 asks for ("preview+accept 30/ชม./IP"): a machine trying
    // tokens gets no extra budget by switching endpoints.
    expect(declarationOf(handler).rateLimit).toBe("publicInvitationEntry");
  });
});

describe("status codes (api-spec §3.14/§3.15)", () => {
  it.each([
    ["preview", preview],
    ["accept", accept],
  ])("%s answers 200, not Nest's POST default of 201", (_name, handler) => {
    // Both are POSTs because the token must travel in a BODY (I-6), not because
    // they create a resource at a new URL. The contract says 200.
    expect(declarationOf(handler).httpCode).toBe(200);
  });
});

describe("★ response headers (api-spec §1 · I-6 · I-05)", () => {
  it.each([
    ["POST", "/invitations/preview"],
    ["POST", "/invitations/accept"],
  ])("%s %s demands no-store AND no-referrer", (method, path) => {
    const row = responseHeaderPolicyFor(method, path);
    expect(row, `${method} ${path} is missing from RESPONSE_HEADER_POLICY`).toBeDefined();
    expect(row!.headers["Cache-Control"]).toBe("no-store");
    // `no-referrer` is the one that matters here and nowhere else: the page
    // these responses render on has the token in its URL, and without it that
    // URL travels to every cross-origin resource the page loads (I-6).
    expect(row!.headers["Referrer-Policy"]).toBe("no-referrer");
    expect(RESPONSE_HEADER_POLICY.length).toBeGreaterThan(0);
  });
});
