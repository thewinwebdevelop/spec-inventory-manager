/**
 * T-003-W06 · CW3-06 — a refused POST/PATCH role → where it shows and what is
 * re-read (ux-wireframe §E, "Route บทบาท (R3/R4/R5)"). Every new code, plus
 * the unknown-code fallback (non-vacuity).
 */
import { describe, it, expect } from "vitest";
import { ApiRequestError } from "../../../lib/api/error";
import { classifyRoleWriteFailure } from "./role-write-failure";
import { bannerReasonCopy, roleFormErrorMessage } from "../role-copy";

const err = (
  status: number,
  code: string,
  extra: { details?: Record<string, unknown>; fieldErrors?: Record<string, string> } = {},
  retryAfter?: number,
) =>
  new ApiRequestError(status, { error: { code, message: "server words", ...extra } }, retryAfter);

describe("classifyRoleWriteFailure", () => {
  it("409 ROLE_CHANGED → role-changed (re-read the role; never resubmit — SR-14)", () => {
    const f = classifyRoleWriteFailure(
      err(409, "ROLE_CHANGED", { details: { currentVersion: 9 } }),
    );
    expect(f).toEqual({ kind: "role-changed" });
  });

  it("422 VALIDATION_FAILED + fieldErrors.name → under the name field", () => {
    const f = classifyRoleWriteFailure(
      err(422, "VALIDATION_FAILED", { fieldErrors: { name: "x" } }),
    );
    expect(f).toMatchObject({ kind: "field", field: "name" });
    expect(f.kind === "field" && f.message).toContain("อักขระที่ใช้ไม่ได้");
  });

  it("409 ROLE_NAME_TAKEN → under the name field (+ focus it)", () => {
    const f = classifyRoleWriteFailure(err(409, "ROLE_NAME_TAKEN"));
    expect(f).toEqual({
      kind: "field",
      field: "name",
      message: roleFormErrorMessage("ROLE_NAME_TAKEN"),
    });
  });

  it("422 ROLE_EMPTY → under the checklist heading", () => {
    expect(classifyRoleWriteFailure(err(422, "ROLE_EMPTY"))).toEqual({
      kind: "field",
      field: "capabilities",
      message: "เลือกสิทธิ์อย่างน้อย 1 อย่าง",
    });
  });

  it("422 UNKNOWN_CAPABILITY → banner + re-read the catalog + untick the refused keys", () => {
    const f = classifyRoleWriteFailure(
      err(422, "UNKNOWN_CAPABILITY", { details: { capabilities: ["gone_a", "gone_b"] } }),
    );
    expect(f).toEqual({
      kind: "banner",
      message: roleFormErrorMessage("UNKNOWN_CAPABILITY"),
      refetch: ["catalog"],
      untick: ["gone_a", "gone_b"],
    });
  });

  it("409 ROLE_LIMIT_REACHED → banner with details.limit + re-read R1", () => {
    expect(
      classifyRoleWriteFailure(err(409, "ROLE_LIMIT_REACHED", { details: { limit: 30 } })),
    ).toEqual({
      kind: "banner",
      message: roleFormErrorMessage("ROLE_LIMIT_REACHED", { limit: 30 }),
      refetch: ["list"],
    });
  });

  it("403 ROLE_EXCEEDS_ACTOR → banner + re-read my membership and the role", () => {
    expect(classifyRoleWriteFailure(err(403, "ROLE_EXCEEDS_ACTOR"))).toEqual({
      kind: "banner",
      message: roleFormErrorMessage("ROLE_EXCEEDS_ACTOR"),
      refetch: ["profile", "role", "list"],
    });
  });

  it.each(["TARGET_NOT_BELOW_ACTOR", "ROLE_HELD_REQUIRES_MANAGE_MEMBERS", "ROLE_LOCKED"])(
    "%s → STAY on the screen, re-read the role (it becomes read-only) — unlike FORBIDDEN",
    (code) => {
      const status = code === "ROLE_LOCKED" ? 409 : 403;
      expect(classifyRoleWriteFailure(err(status, code))).toEqual({
        kind: "banner",
        message: roleFormErrorMessage(code),
        refetch: ["role", "list"],
      });
    },
  );

  it("503 ROLE_WRITES_DISABLED → re-read (the verdicts now say writes_disabled)", () => {
    expect(classifyRoleWriteFailure(err(503, "ROLE_WRITES_DISABLED"))).toEqual({
      kind: "banner",
      message: bannerReasonCopy("writes_disabled").body,
      refetch: ["role", "list"],
    });
  });

  it("429 → throttled with Retry-After (default 60 when absent)", () => {
    expect(classifyRoleWriteFailure(err(429, "RATE_LIMITED", {}, 75))).toEqual({
      kind: "throttled",
      seconds: 75,
    });
    expect(classifyRoleWriteFailure(err(429, "RATE_LIMITED"))).toEqual({
      kind: "throttled",
      seconds: 60,
    });
  });

  it("403 FORBIDDEN (or a 403 with no code) → forbidden panel", () => {
    expect(classifyRoleWriteFailure(err(403, "FORBIDDEN"))).toEqual({ kind: "forbidden" });
  });

  it("404 → not found", () => {
    expect(classifyRoleWriteFailure(err(404, "NOT_FOUND"))).toEqual({ kind: "not-found" });
  });

  it("409 CONFLICT busy → its own copy", () => {
    expect(classifyRoleWriteFailure(err(409, "CONFLICT", { details: { reason: "busy" } }))).toEqual(
      {
        kind: "banner",
        message: roleFormErrorMessage("CONFLICT"),
        refetch: [],
      },
    );
  });

  it("an unknown code / 5xx / network error → the generic save failure, never the server's raw words", () => {
    for (const e of [
      err(500, "INTERNAL"),
      err(409, "LAST_OWNER"),
      err(418, "TEAPOT"),
      new TypeError("x"),
    ]) {
      expect(classifyRoleWriteFailure(e)).toEqual({
        kind: "banner",
        message: "บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        refetch: [],
      });
    }
  });

  it("422 VALIDATION_FAILED without a name field → generic banner, not a name error", () => {
    expect(
      classifyRoleWriteFailure(err(422, "VALIDATION_FAILED", { fieldErrors: { version: "x" } })),
    ).toMatchObject({
      kind: "banner",
    });
  });
});
