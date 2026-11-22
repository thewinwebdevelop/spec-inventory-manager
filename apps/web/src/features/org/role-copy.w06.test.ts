/**
 * T-003-W06 — what W06 adds to the shared role copy:
 *  - `toLastEdited` moves here from RolesScreen.tsx (R1 and R3 both render the
 *    "แก้ไขล่าสุด…" line; one adapter, one G-12 pin);
 *  - (UX01) `429 RATE_LIMITED` on the role routes — "แก้บทบาทถี่เกินไป กรุณารอ {mm:ss} แล้วลองใหม่";
 *  - (UX01) "ไม่พบบทบาทนี้" is a title + a body, never one string glued with " · ".
 */
import { describe, it, expect } from "vitest";
import {
  lastEditedLine,
  ROLE_NOT_FOUND_COPY,
  roleFormErrorMessage,
  roleRateLimitedMessage,
  toLastEdited,
} from "./role-copy";

describe("toLastEdited — wire RoleLastEdited → lastEditedLine input", () => {
  const AT = "2026-06-23T07:30:00.000Z";

  it("null stays null (→ ค่าเริ่มต้นของระบบ)", () => {
    expect(toLastEdited(null)).toBeNull();
    expect(lastEditedLine(toLastEdited(null))).toBe("ค่าเริ่มต้นของระบบ");
  });

  it("the editor's role name goes through the §0.2 display rule (un-renamed admin → ผู้ดูแล)", () => {
    const le = toLastEdited({
      at: AT,
      by: { kind: "member", roleName: "Admin", roleKey: "admin", roleNameCustomized: false },
    });
    expect(lastEditedLine(le)).toContain('แก้ไขล่าสุดโดยคนในบทบาท "ผู้ดูแล"');
  });

  it("a renamed system role shows its stored name, not the translation", () => {
    const le = toLastEdited({
      at: AT,
      by: { kind: "member", roleName: "แพ็คของ", roleKey: "staff", roleNameCustomized: true },
    });
    expect(lastEditedLine(le)).toContain('"แพ็คของ"');
  });

  it("member without roleName → the 'แก้ไขล่าสุด · …' fallback, never 'คนในบทบาท \"\"'", () => {
    const le = toLastEdited({ at: AT, by: { kind: "member" } });
    expect(lastEditedLine(le)).toMatch(/^แก้ไขล่าสุด · /);
  });

  it("an unknown kind passes through untouched (open set)", () => {
    expect(toLastEdited({ at: AT, by: { kind: "robot" } })?.kind).toBe("robot");
  });
});

describe("§E · 429 RATE_LIMITED (roleWrite) · UX01", () => {
  it("formats Retry-After as mm:ss", () => {
    expect(roleRateLimitedMessage(75)).toBe("แก้บทบาทถี่เกินไป กรุณารอ 01:15 แล้วลองใหม่");
  });

  it("rounds up and never goes negative", () => {
    expect(roleRateLimitedMessage(0.2)).toBe("แก้บทบาทถี่เกินไป กรุณารอ 00:01 แล้วลองใหม่");
    expect(roleRateLimitedMessage(-5)).toBe("แก้บทบาทถี่เกินไป กรุณารอ 00:00 แล้วลองใหม่");
  });
});

describe("§E · 404 NOT_FOUND — title and body are separate (UX01)", () => {
  it("has a title and a body", () => {
    expect(ROLE_NOT_FOUND_COPY.title).toBe("ไม่พบบทบาทนี้");
    expect(ROLE_NOT_FOUND_COPY.body).toBe("บทบาทนี้อาจถูกลบไปแล้ว");
  });

  it("the flat message no longer glues them with ' · '", () => {
    const msg = roleFormErrorMessage("NOT_FOUND");
    expect(msg).not.toContain(" · ");
    expect(msg).toContain(ROLE_NOT_FOUND_COPY.title);
    expect(msg).toContain(ROLE_NOT_FOUND_COPY.body);
  });
});
