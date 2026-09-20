// T-002-W3 — S2's error table (ux-wireframe §3), tested as a table.
import { describe, it, expect } from "vitest";
import { toCreateOrgError } from "./create-org-error";
import { ApiRequestError } from "../../lib/api/error";
import { orgTh } from "./i18n";

function err(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new ApiRequestError(status, { error: { code, message: "x", ...extra } });
}

describe("toCreateOrgError", () => {
  it("422 with fieldErrors.name goes inline under the field", () => {
    expect(toCreateOrgError(err(422, "VALIDATION_FAILED", { fieldErrors: { name: "ชื่อยาวเกิน" } }))).toEqual(
      { kind: "field", field: "name", message: "ชื่อยาวเกิน" },
    );
  });

  it("422 with no field message falls back to ux's copy", () => {
    expect(toCreateOrgError(err(422, "VALIDATION_FAILED"))).toEqual({
      kind: "field",
      field: "name",
      message: orgTh.createOrg.error.name,
    });
  });

  it("★ ORG_LIMIT_REACHED uses details.limit — the number is never hard-coded", () => {
    // api-spec §3.1 sends `details.limit` precisely so the UI does not bake
    // "50" into Thai copy that then goes stale when the cap changes.
    const mapped = toCreateOrgError(err(409, "ORG_LIMIT_REACHED", { details: { limit: 50 } }));
    expect(mapped).toEqual({
      kind: "banner",
      message: orgTh.createOrg.error.limitReached(50),
      retry: false,
    });
    expect(mapped.kind === "banner" && mapped.message).toContain("50");
  });

  it("★ a missing details.limit does NOT invent a number", () => {
    const mapped = toCreateOrgError(err(409, "ORG_LIMIT_REACHED"));
    expect(mapped).toEqual({ kind: "banner", message: orgTh.createOrg.error.generic, retry: true });
  });

  it("ORG_LIMIT_REACHED offers no retry — retrying cannot help", () => {
    const mapped = toCreateOrgError(err(409, "ORG_LIMIT_REACHED", { details: { limit: 3 } }));
    expect(mapped.kind === "banner" && mapped.retry).toBe(false);
  });

  it("503 ORG_PROVISIONING_UNAVAILABLE says it is not the user's fault, with a retry", () => {
    const mapped = toCreateOrgError(err(503, "ORG_PROVISIONING_UNAVAILABLE"));
    expect(mapped).toEqual({
      kind: "banner",
      message: orgTh.createOrg.error.provisioning,
      retry: true,
    });
    expect(mapped.kind === "banner" && mapped.message).toContain("ไม่ใช่ความผิดของคุณ");
  });

  it("429 becomes a countdown, and never a zero-length one", () => {
    expect(toCreateOrgError(new ApiRequestError(429, null, 90))).toEqual({
      kind: "throttled",
      retryAfterSeconds: 90,
    });
    // A missing Retry-After must not produce a countdown that ends instantly
    // — that would invite the immediate second create the throttle exists to
    // prevent.
    expect(toCreateOrgError(new ApiRequestError(429, null))).toEqual({
      kind: "throttled",
      retryAfterSeconds: 60,
    });
  });

  it("network and 5xx get the generic banner with a retry", () => {
    expect(toCreateOrgError(new TypeError("Failed to fetch"))).toEqual({
      kind: "banner",
      message: orgTh.createOrg.error.generic,
      retry: true,
    });
    expect(toCreateOrgError(err(500, "INTERNAL")).kind).toBe("banner");
  });

  it("never renders a raw code or a status number to the user", () => {
    const cases = [
      err(422, "VALIDATION_FAILED"),
      err(409, "ORG_LIMIT_REACHED", { details: { limit: 5 } }),
      err(503, "ORG_PROVISIONING_UNAVAILABLE"),
      err(500, "INTERNAL"),
      new TypeError("boom"),
    ];
    for (const c of cases) {
      const mapped = toCreateOrgError(c);
      if (mapped.kind === "throttled") continue;
      const text = mapped.kind === "field" ? mapped.message : mapped.message;
      expect(text).not.toMatch(/[A-Z_]{4,}/);
      expect(text).toMatch(/[ก-๙]/);
    }
  });
});

describe("roleLabel", () => {
  it("translates the three system roles", async () => {
    const { roleLabel } = await import("./i18n");
    expect(roleLabel("owner", "Owner")).toBe("เจ้าของร้าน");
    expect(roleLabel("admin", "Admin")).toBe("ผู้ดูแล");
    expect(roleLabel("staff", "Staff")).toBe("พนักงาน");
  });

  it("★ falls back to the server's roleName for an unknown key", async () => {
    // `roleKey` is an OPEN set (api-spec): F-003 lets people create roles, and
    // those arrive with `null`. Rendering the key, or nothing, would be wrong
    // for every custom role the moment F-003 ships.
    const { roleLabel } = await import("./i18n");
    expect(roleLabel(null, "หัวหน้ากะ")).toBe("หัวหน้ากะ");
    expect(roleLabel("shift_lead", "หัวหน้ากะ")).toBe("หัวหน้ากะ");
  });
});
