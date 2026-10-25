// T-003-W11 · R9 (D-035) — `409 INVITATION_CANCELLED` on accept.
//
// B19 makes the body byte-identical whether the shop cancelled the invitation
// or the inviter re-check did, so the client has ONE copy and must not guess a
// reason or mention the inviter.
import { describe, it, expect } from "vitest";
import { toInviteError } from "./invite-error";
import { ApiRequestError } from "../../lib/api/error";

const cancelled = () =>
  new ApiRequestError(409, { error: { code: "INVITATION_CANCELLED", message: "x" } });

describe("R9 · INVITATION_CANCELLED", () => {
  it("★ heading stays, body tells the invitee WHAT to ask for", () => {
    const e = toInviteError(cancelled());
    expect(e.title).toBe("คำเชิญนี้ถูกยกเลิกแล้ว");
    expect(e.body).toBe("ถ้าคุณยังต้องการเข้าร่วม ให้ขอลิงก์คำเชิญใหม่จากเจ้าของร้าน");
    expect(e.next).toEqual({ kind: "home" });
  });

  it("⛔ never names the inviter or an internal reason, never 'system error'", () => {
    const e = toInviteError(cancelled());
    const text = `${e.title} ${e.body}`;
    expect(text).not.toMatch(/ผู้เชิญ|ผู้ออกลิงก์|สิทธิ์|ระบบผิดพลาด|ขออภัย|ติดต่อเจ้าของร้าน/);
  });

  it("different message/details in the body still map to the same copy", () => {
    const other = new ApiRequestError(409, {
      error: { code: "INVITATION_CANCELLED", message: "different words", details: { why: "x" } },
    });
    expect(toInviteError(other)).toEqual(toInviteError(cancelled()));
  });
});
