import { describe, it, expect } from "vitest";
import { checkPasswordPolicy, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password-policy";
import { isBreachedPassword, FIXTURE_VERSION, loadCommonPasswords } from "./common-passwords";

// Pure — no DB. U1.2 (length) + U1.3 (breached, pinned fixture).

const neverBreached = () => false;

describe("checkPasswordPolicy — length (U1.2)", () => {
  it.each([
    [7, "PASSWORD_TOO_SHORT"],
    [8, null],
    [128, null],
    [129, "PASSWORD_TOO_LONG"],
  ])("length %i → %s", (len, expectedError) => {
    // Use a non-breached filler char so only length is exercised.
    const pw = "Zx9!".repeat(40).slice(0, len);
    expect([...pw].length).toBe(len);
    const res = checkPasswordPolicy(pw, { isBreached: neverBreached });
    if (expectedError === null) {
      expect(res).toEqual({ ok: true });
    } else {
      expect(res).toEqual({ ok: false, error: expectedError });
    }
  });

  it("exposes the documented boundaries", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it("counts Unicode code points, not UTF-16 units (emoji passphrase not falsely short)", () => {
    // 8 emoji = 8 code points but 16 UTF-16 units — must NOT be TOO_SHORT.
    const pw = "😀😁😂🤣😃😄😅😆";
    expect([...pw].length).toBe(8);
    expect(checkPasswordPolicy(pw, { isBreached: neverBreached })).toEqual({ ok: true });
  });
});

describe("checkPasswordPolicy — breached (U1.3, pinned top-10k fixture)", () => {
  it("pins the fixture version (a silent swap fails this test)", () => {
    expect(FIXTURE_VERSION).toBe("v1");
  });

  it("loads exactly 10,000 unique entries", () => {
    expect(loadCommonPasswords().size).toBe(10000);
  });

  it.each(["password", "123456", "qwerty", "letmein", "admin"])(
    "rejects known-listed %j → PASSWORD_BREACHED",
    (pw) => {
      // length-safe (all >= 8 except 123456/qwerty/admin/letmein → pad? no —
      // these are checked via real policy: short ones fail length first, so
      // assert breached directly on the loader, and policy on the >=8 ones).
      expect(isBreachedPassword(pw)).toBe(true);
    },
  );

  it("policy returns PASSWORD_BREACHED for a listed >=8 password", () => {
    expect(checkPasswordPolicy("password")).toEqual({ ok: false, error: "PASSWORD_BREACHED" });
    expect(checkPasswordPolicy("12345678")).toEqual({ ok: false, error: "PASSWORD_BREACHED" });
  });

  it("breached check is case-insensitive (trivial variant still rejected)", () => {
    expect(isBreachedPassword("PASSWORD")).toBe(true);
    expect(isBreachedPassword("PassWord")).toBe(true);
  });

  it("accepts a strong random passphrase (not in the list)", () => {
    const strong = "correct-horse-battery-staple-9f3aK!";
    expect(isBreachedPassword(strong)).toBe(false);
    expect(checkPasswordPolicy(strong)).toEqual({ ok: true });
  });

  it("length takes precedence over breached (most actionable single reason)", () => {
    // "123456" is breached AND too short → TOO_SHORT wins.
    expect(checkPasswordPolicy("123456")).toEqual({ ok: false, error: "PASSWORD_TOO_SHORT" });
  });
});
