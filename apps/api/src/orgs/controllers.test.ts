// F-002 · T-002-15/16 — what the three controllers DO (their declarations are
// pinned separately, in `routes.test.ts`).
//
// The handlers are called directly with doubles: a controller's job is to turn
// a request into a validated call and a response into headers + body, and none
// of that needs an HTTP server to be proven. The wire behaviour end to end is in
// `orgs.e2e.int.test.ts`.
import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import { DomainException } from "../common/domain-exception";
import { CURSOR_INVALID_MESSAGE, encodeCursor } from "../common/cursor";
import { MyOrganizationsController } from "./my-organizations.controller";
import { OrgProfileController } from "./org-profile.controller";
import { OrganizationsController } from "./organizations.controller";
import { TaxProfileController } from "./tax-profile.controller";
import {
  ORG_PROFILE_RESPONSE_HEADERS,
  TAX_ID_REVEAL_RESPONSE_HEADERS,
} from "./response-headers";
import type { OrgProfileService } from "./org-profile.service";
import type { TaxProfileService } from "./tax-profile.service";
import type { MyOrganizationsService } from "./system/my-organizations.service";
import type { OrgProvisioningService } from "./system/org-provisioning.service";

/**
 * A `@Res({ passthrough: true })` stand-in. These handlers only ever call
 * `setHeader` on it (★ B-3 put `applyResponseHeaders` on both), so a stub with
 * that one method is the whole contract — a real Response here would be
 * testing express, not the controller.
 */
function res() {
  return { setHeader: vi.fn() } as unknown as import("express").Response;
}

const USER_ID = "usr_me";
const authed = { orgAuth: { userId: USER_ID, tokenValid: true } } as never;

function fakeResponse(): { res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => (headers[name] = value),
  } as unknown as Response;
  return { res, headers };
}

// ── POST /organizations ────────────────────────────────────────────────────

describe("OrganizationsController.create", () => {
  function subject() {
    const create = vi.fn(async (_args: unknown) => ({ organization: { id: "org_new" } }));
    const controller = new OrganizationsController({ create } as unknown as OrgProvisioningService);
    return { controller, create };
  }

  it("passes the VALIDATED, normalized body to the service", async () => {
    const { controller, create } = subject();
    await controller.create({ name: "  ร้าน ก  " }, authed, res());
    expect(create).toHaveBeenCalledWith({
      userId: USER_ID,
      organization: { name: "ร้าน ก", timezone: "Asia/Bangkok" },
    });
  });

  it("★ 422 VALIDATION_FAILED with fieldErrors — not the ValidationPipe's shape", async () => {
    // api-spec §3.1 asks for `fieldErrors` per field. The global pipe would put
    // a constraint MESSAGE in `error.code`, which the client switches on.
    const { controller, create } = subject();
    const error = (await controller.create({ name: "", timezone: "Mars/Olympus" }, authed, res())
      .catch((e: unknown) => e)) as DomainException;
    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(422);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual(["name", "timezone"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("★ the caller identity comes from req.orgAuth (the verified token), not req.user", async () => {
    // I-4: `req.user` is set by the controller-level `JwtAuthGuard`, which does
    // not run on this route. Trusting it would mean "no user" on every request.
    const { controller, create } = subject();
    await controller.create({ name: "ร้าน" }, {
      user: { userId: "usr_someone_else" },
      orgAuth: { userId: USER_ID, tokenValid: true },
    } as never, res());
    expect(create.mock.calls[0][0]).toMatchObject({ userId: USER_ID });
  });

  it("★ 500 rather than creating an owner-less shop when the chain is mis-wired", async () => {
    const { controller, create } = subject();
    const error = (await controller
      .create({ name: "ร้าน" }, { orgAuth: { tokenValid: true } } as never, res())
      .catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(500);
    expect(create).not.toHaveBeenCalled();
  });

  it("★ ignores a client-supplied plan/currency (no self-granted tier)", async () => {
    const { controller, create } = subject();
    await controller.create(
      { name: "ร้าน", planKey: "comp_full", currency: "USD" } as never,
      authed,
      res(),
    );
    expect(create.mock.calls[0][0]).toEqual({
      userId: USER_ID,
      organization: { name: "ร้าน", timezone: "Asia/Bangkok" },
    });
  });
});

// ── GET /me/organizations ──────────────────────────────────────────────────

describe("MyOrganizationsController.list", () => {
  function subject() {
    const list = vi.fn(async (_args: unknown) => ({ items: [], nextCursor: null }));
    const controller = new MyOrganizationsController({ list } as unknown as MyOrganizationsService);
    return { controller, list };
  }

  it("defaults to `status=active`, limit 25, no cursor", async () => {
    const { controller, list } = subject();
    await controller.list(authed, res());
    expect(list).toHaveBeenCalledWith({
      userId: USER_ID,
      status: "active",
      limit: 25,
      cursor: undefined,
    });
  });

  it("accepts `status=all`", async () => {
    const { controller, list } = subject();
    await controller.list(authed, res(), "all");
    expect(list.mock.calls[0][0]).toMatchObject({ status: "all" });
  });

  it("★ refuses an unknown status instead of silently defaulting", async () => {
    // Coercing `?status=revoked` to `active` would answer a different question
    // than the one asked, and look like a server bug to the client.
    const { controller, list } = subject();
    const error = (await controller.list(authed, res(), "revoked").catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(422);
    expect(error.fieldErrors).toHaveProperty("status");
    expect(list).not.toHaveBeenCalled();
  });

  it("decodes a cursor it issued", async () => {
    const { controller, list } = subject();
    const cursor = encodeCursor({ createdAt: "2026-07-28T09:00:00.000Z", id: "mem_1" });
    await controller.list(authed, res(), undefined, cursor);
    expect(list.mock.calls[0][0]).toMatchObject({
      cursor: { createdAt: "2026-07-28T09:00:00.000Z", id: "mem_1" },
    });
  });

  it("★ 422 for a garbage cursor — never a silent restart at page 1", async () => {
    const { controller } = subject();
    const error = (await controller.list(authed, res(), undefined, "!!!").catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(422);
    expect(error.fieldErrors).toEqual({ cursor: CURSOR_INVALID_MESSAGE });
  });

  it("clamps an absurd limit", async () => {
    const { controller, list } = subject();
    await controller.list(authed, res(), undefined, undefined, "100000");
    expect(list.mock.calls[0][0]).toMatchObject({ limit: 100 });
  });

  it("★ 500 rather than listing everyone's shops when the identity is missing", async () => {
    const { controller, list } = subject();
    const error = (await controller
      .list({ orgAuth: { tokenValid: true } } as never, res())
      .catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(500);
    expect(list).not.toHaveBeenCalled();
  });
});

// ── GET / PATCH /orgs/{orgId} ──────────────────────────────────────────────

describe("OrgProfileController", () => {
  function subject() {
    const get = vi.fn(async () => ({ id: "org_1" }));
    const update = vi.fn(async (_patch?: unknown) => ({ id: "org_1" }));
    const controller = new OrgProfileController({ get, update } as unknown as OrgProfileService);
    return { controller, get, update };
  }

  it("★ GET sets `Cache-Control: no-store` (+ Pragma) — the body is PII", async () => {
    const { controller } = subject();
    const { res, headers } = fakeResponse();
    await controller.get(res);
    expect(headers).toEqual({ ...ORG_PROFILE_RESPONSE_HEADERS });
  });

  it("★ PATCH sets the same headers (the response shape is identical)", async () => {
    const { controller } = subject();
    const { res, headers } = fakeResponse();
    await controller.update({ name: "ร้านใหม่" }, res);
    expect(headers).toEqual({ ...ORG_PROFILE_RESPONSE_HEADERS });
  });

  it("PATCH forwards the validated patch", async () => {
    const { controller, update } = subject();
    const { res } = fakeResponse();
    await controller.update({ name: "  ร้านใหม่  ", logo: null }, res);
    expect(update).toHaveBeenCalledWith({ name: "ร้านใหม่", logo: null });
  });

  it("★ M-4: a non-null logo is 422 and NOTHING is written", async () => {
    const { controller, update } = subject();
    const { res, headers } = fakeResponse();
    const error = (await controller
      .update({ logo: "https://evil.example/pixel.gif" }, res)
      .catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(422);
    expect(error.fieldErrors).toHaveProperty("logo");
    expect(update).not.toHaveBeenCalled();
    // The refusal happens before any header work, so a rejected write cannot be
    // mistaken for a served response.
    expect(headers).toEqual({});
  });

  it("an empty patch is accepted and simply returns the profile", async () => {
    const { controller, update } = subject();
    const { res } = fakeResponse();
    await controller.update({}, res);
    expect(update).toHaveBeenCalledWith({});
  });
});

// ── PUT/POST /orgs/{orgId}/tax-profile(/reveal) — T-002-17 ─────────────────

describe("TaxProfileController", () => {
  const TIN = "1101700207366";

  function subject() {
    const set = vi.fn(async (_write?: unknown) => ({ id: "org_1", taxProfile: { taxIdMasked: "•••••••••7366" } }));
    const reveal = vi.fn(async (_now?: Date) => ({
      taxId: TIN,
      entityType: "company",
      revealedAt: "2026-07-28T09:00:00.000Z",
    }));
    const controller = new TaxProfileController({ set, reveal } as unknown as TaxProfileService);
    return { controller, set, reveal };
  }

  const COMPLETE = { entityType: "company", taxId: TIN, vatRegistered: true, branchCode: "00000" };

  describe("PUT — api-spec §3.5", () => {
    it("forwards the four VALIDATED columns (wire names → column names)", async () => {
      const { controller, set } = subject();
      const { res } = fakeResponse();
      await controller.put(COMPLETE, res);
      expect(set).toHaveBeenCalledWith({
        taxEntityType: "company",
        taxId: TIN,
        vatRegistered: true,
        taxBranchCode: "00000",
      });
    });

    it("★ sets `Cache-Control: no-store` (+ Pragma) — the body carries `taxIdMasked`", async () => {
      const { controller } = subject();
      const { res, headers } = fakeResponse();
      await controller.put(COMPLETE, res);
      expect(headers).toEqual({ ...ORG_PROFILE_RESPONSE_HEADERS });
    });

    it("★ a bad TIN is 422 TAX_ID_INVALID (not VALIDATION_FAILED) and writes nothing", async () => {
      const { controller, set } = subject();
      const { res, headers } = fakeResponse();
      const error = (await controller
        .put({ ...COMPLETE, taxId: "1101700207367" }, res)
        .catch((e: unknown) => e)) as DomainException;
      expect(error.getStatus()).toBe(422);
      expect(error.code).toBe("TAX_ID_INVALID");
      expect(error.fieldErrors).toHaveProperty("taxId");
      expect(set).not.toHaveBeenCalled();
      // The refusal happens before any header work, so a rejected write cannot
      // be mistaken for a served response.
      expect(headers).toEqual({});
    });

    it("★ the 422 body never contains the rejected number", async () => {
      const { controller } = subject();
      const { res } = fakeResponse();
      const bad = "1101700207367";
      const error = (await controller.put({ ...COMPLETE, taxId: bad }, res).catch((e: unknown) => e)) as DomainException;
      expect(JSON.stringify(error.getResponse())).not.toContain(bad);
      expect(JSON.stringify(error.fieldErrors)).not.toContain(bad);
    });

    it("★ a HALF-declared profile is 422 VALIDATION_FAILED and writes nothing", async () => {
      const { controller, set } = subject();
      const { res } = fakeResponse();
      const error = (await controller
        .put({ entityType: "company", taxId: TIN }, res)
        .catch((e: unknown) => e)) as DomainException;
      expect(error.getStatus()).toBe(422);
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.fieldErrors).toHaveProperty("vatRegistered");
      expect(set).not.toHaveBeenCalled();
    });

    it("an EMPTY body clears the profile (all-or-nothing, the `nothing` half)", async () => {
      const { controller, set } = subject();
      const { res } = fakeResponse();
      await controller.put({}, res);
      expect(set).toHaveBeenCalledWith({
        taxEntityType: null,
        taxId: null,
        vatRegistered: null,
        taxBranchCode: null,
      });
    });
  });

  describe("POST reveal — api-spec §3.16", () => {
    it("★ sets no-store + no-referrer BEFORE the value is fetched", async () => {
      const { controller, reveal } = subject();
      const { res, headers } = fakeResponse();
      // Headers must already be on the response by the time the service is
      // asked for the number — a path added later that returns early must not
      // be able to emit a TIN without them.
      reveal.mockImplementationOnce(async () => {
        expect(headers).toEqual({ ...TAX_ID_REVEAL_RESPONSE_HEADERS });
        return { taxId: TIN, entityType: "company", revealedAt: "2026-07-28T09:00:00.000Z" };
      });
      await controller.reveal(res);
      expect(headers).toEqual({ ...TAX_ID_REVEAL_RESPONSE_HEADERS });
      expect(headers["Referrer-Policy"]).toBe("no-referrer");
    });

    it("returns the §3.16 body — the one response in the system with a full TIN", async () => {
      const { controller } = subject();
      const { res } = fakeResponse();
      await expect(controller.reveal(res)).resolves.toEqual({
        taxId: TIN,
        entityType: "company",
        revealedAt: "2026-07-28T09:00:00.000Z",
      });
    });

    it("★ the edge owns the clock — `now` is passed down, never read below", async () => {
      const { controller, reveal } = subject();
      const { res } = fakeResponse();
      const before = Date.now();
      await controller.reveal(res);
      const now = reveal.mock.calls[0][0] as Date;
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
