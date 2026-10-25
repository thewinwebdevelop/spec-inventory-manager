// T-003-W11 · R8 — one verdict per role option, shared by InviteDialog and
// ChangeRoleDialog. `viewerCanAssign` is the authority when present; the
// client never recomputes it.
import { describe, it, expect } from "vitest";
import { roleOptionState } from "./role-picker";

const NONE = new Set<string>();
const OWNER_ROLE = new Set(["rol_owner"]);
const AS_OWNER = new Set(["full_access"]);

describe("roleOptionState", () => {
  it("★ viewerCanAssign=false → closed + copy from assignBlockedReason", () => {
    expect(
      roleOptionState(
        { id: "r", viewerCanAssign: false, assignBlockedReason: "exceeds_your_permissions" },
        NONE,
        NONE,
      ),
    ).toEqual({ closed: true, reason: "บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้" });
    expect(
      roleOptionState(
        { id: "r", viewerCanAssign: false, assignBlockedReason: "owner_only" },
        NONE,
        NONE,
      ).reason,
    ).toBe("เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้");
  });

  it("unknown / missing reason → generic copy, still closed", () => {
    for (const assignBlockedReason of ["from_the_future", null, undefined]) {
      expect(
        roleOptionState({ id: "r", viewerCanAssign: false, assignBlockedReason }, NONE, NONE),
      ).toEqual({ closed: true, reason: "คุณมอบบทบาทนี้ไม่ได้" });
    }
  });

  it("★ viewerCanAssign=true is open even where the F-002 fallback would close it", () => {
    expect(roleOptionState({ id: "rol_owner", viewerCanAssign: true }, NONE, OWNER_ROLE)).toEqual({
      closed: false,
      reason: undefined,
    });
  });

  it("field absent → F-002 rule: ownership role closed for a non-Owner, open for an Owner", () => {
    expect(roleOptionState({ id: "rol_owner" }, NONE, OWNER_ROLE)).toEqual({
      closed: true,
      reason: "เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้",
    });
    expect(roleOptionState({ id: "rol_owner" }, AS_OWNER, OWNER_ROLE).closed).toBe(false);
    expect(roleOptionState({ id: "rol_x" }, NONE, OWNER_ROLE).closed).toBe(false);
  });
});
