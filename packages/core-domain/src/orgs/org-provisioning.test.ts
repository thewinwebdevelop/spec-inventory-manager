// F-002 · T-002-15 ★ — the org-creation policy, as a table.
// architecture §6.1–§6.3 · data-model §5.2 · api-spec §3.1.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_WAREHOUSE_NAME,
  ORG_DEFAULT_CURRENCY,
  ORG_DEFAULT_TIMEZONE,
  ORG_NAME_MAX_LENGTH,
  ORG_NAME_REQUIRED_MESSAGE,
  ORG_NAME_TOO_LONG_MESSAGE,
  ORG_TIMEZONE_INVALID_MESSAGE,
  SYSTEM_ROLE_BLUEPRINT,
  isOrgCapReached,
  isSupportedTimezone,
  ownerRoleBlueprint,
  validateNewOrganization,
  validateOrgName,
  type SystemRoleBlueprint,
} from "./org-provisioning";
import { isOwnerRole } from "./member-authz";
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
} from "../auth/capabilities";

describe("SYSTEM_ROLE_BLUEPRINT — data-model §5.2, row for row", () => {
  it("is exactly Owner / Admin / Staff, in that order", () => {
    expect(SYSTEM_ROLE_BLUEPRINT.map((r) => r.name)).toEqual(["Owner", "Admin", "Staff"]);
  });

  it("pins the `key` values — they are part of the API contract (ux Q4)", () => {
    // Changing one of these is a BREAKING change for every client that
    // translates a role name on screen. It must never happen by accident.
    expect(SYSTEM_ROLE_BLUEPRINT.map((r) => r.key)).toEqual(["owner", "admin", "staff"]);
  });

  it("only Owner is `isSystem` (locked against edit/delete in F-003)", () => {
    expect(SYSTEM_ROLE_BLUEPRINT.filter((r) => r.isSystem).map((r) => r.name)).toEqual(["Owner"]);
  });

  it("Owner holds full_access and nothing else", () => {
    expect(SYSTEM_ROLE_BLUEPRINT[0].capabilities).toEqual([CAPABILITY_FULL_ACCESS]);
  });

  it("Admin holds the two capabilities F-002 actually enforces", () => {
    const admin = SYSTEM_ROLE_BLUEPRINT[1];
    expect(admin.capabilities).toContain(CAPABILITY_MANAGE_MEMBERS);
    expect(admin.capabilities).toContain(CAPABILITY_MANAGE_ORG_SETTINGS);
    // …and NOT full_access: an Admin who could promote themselves to Owner is
    // finding C-1 (architecture §3.2).
    expect(admin.capabilities).not.toContain(CAPABILITY_FULL_ACCESS);
  });

  it("Staff holds neither of the two F-002 capabilities", () => {
    const staff = SYSTEM_ROLE_BLUEPRINT[2];
    expect(staff.capabilities).not.toContain(CAPABILITY_MANAGE_MEMBERS);
    expect(staff.capabilities).not.toContain(CAPABILITY_MANAGE_ORG_SETTINGS);
    expect(staff.capabilities).not.toContain(CAPABILITY_FULL_ACCESS);
  });

  it("is frozen — a caller cannot mutate the blueprint every org is built from", () => {
    expect(Object.isFrozen(SYSTEM_ROLE_BLUEPRINT)).toBe(true);
    for (const role of SYSTEM_ROLE_BLUEPRINT) expect(Object.isFrozen(role)).toBe(true);
  });
});

describe("ownerRoleBlueprint — resolved by capability, never by name/key", () => {
  it("returns the row holding full_access", () => {
    expect(ownerRoleBlueprint().name).toBe("Owner");
    expect(isOwnerRole(ownerRoleBlueprint().capabilities)).toBe(true);
  });

  it("★ still finds it when the role is RENAMED (F-003 lets users rename)", () => {
    const renamed: SystemRoleBlueprint[] = [
      { name: "เจ้าของร้าน", key: "owner", isSystem: true, capabilities: [CAPABILITY_FULL_ACCESS] },
      { name: "Owner", key: "admin", isSystem: false, capabilities: [CAPABILITY_MANAGE_MEMBERS] },
    ];
    // A `name === "Owner"` lookup would return the WRONG row here — and the
    // creator's membership would be created against a non-owner role.
    expect(ownerRoleBlueprint(renamed).name).toBe("เจ้าของร้าน");
  });

  it("★ still finds it when the `key` is a lie (I-45)", () => {
    const impostor: SystemRoleBlueprint[] = [
      { name: "Staff", key: "owner", isSystem: false, capabilities: ["manage_products"] },
      { name: "Real", key: "staff", isSystem: true, capabilities: [CAPABILITY_FULL_ACCESS] },
    ];
    expect(ownerRoleBlueprint(impostor).name).toBe("Real");
  });

  it("throws when no row (or more than one) holds full_access", () => {
    expect(() => ownerRoleBlueprint([])).toThrow(/EXACTLY ONE/);
    expect(() =>
      ownerRoleBlueprint([
        { name: "A", key: "a", isSystem: true, capabilities: [CAPABILITY_FULL_ACCESS] },
        { name: "B", key: "b", isSystem: true, capabilities: [CAPABILITY_FULL_ACCESS] },
      ]),
    ).toThrow(/EXACTLY ONE/);
  });
});

describe("isOrgCapReached — architecture §6.3 / I-10", () => {
  it.each([
    [0, 50, false],
    [49, 50, false],
    [50, 50, true], // the 51st shop is the one that is refused
    [51, 50, true],
    [0, 0, true], // a limit of zero means "no shops at all"
  ])("count=%i limit=%i → reached=%s", (count, limit, expected) => {
    expect(isOrgCapReached(count, limit)).toBe(expected);
  });

  it("★ fails CLOSED on a count that could not be produced", () => {
    // The whole reason the cap moved off the rate limiter (I-10): the limiter
    // fails OPEN. This one must not — "we could not count" is not "there is room".
    expect(isOrgCapReached(Number.NaN, 50)).toBe(true);
    expect(isOrgCapReached(-1, 50)).toBe(true);
    expect(isOrgCapReached(Number.POSITIVE_INFINITY, 50)).toBe(true);
  });

  it("★ fails CLOSED on a nonsense limit (a bad env value cannot lift the cap)", () => {
    expect(isOrgCapReached(0, Number.NaN)).toBe(true);
    expect(isOrgCapReached(0, -1)).toBe(true);
    expect(isOrgCapReached(0, 1.5)).toBe(true);
  });
});

describe("validateOrgName — api-spec §3.1", () => {
  it("trims and accepts a normal name", () => {
    expect(validateOrgName("  ร้านตัวอย่าง  ")).toEqual({ ok: true, value: "ร้านตัวอย่าง" });
  });

  it.each([undefined, null, 42, {}, [], ""])("rejects %s", (input) => {
    const result = validateOrgName(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toEqual({ name: ORG_NAME_REQUIRED_MESSAGE });
  });

  it("rejects whitespace-only (a name of spaces is not a name)", () => {
    expect(validateOrgName("   \t\n ").ok).toBe(false);
  });

  it("accepts exactly 120 characters and rejects 121", () => {
    expect(validateOrgName("ก".repeat(ORG_NAME_MAX_LENGTH)).ok).toBe(true);
    const tooLong = validateOrgName("ก".repeat(ORG_NAME_MAX_LENGTH + 1));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.fieldErrors).toEqual({ name: ORG_NAME_TOO_LONG_MESSAGE });
  });

  it("★ counts CODE POINTS, not UTF-16 units", () => {
    // 120 emoji = 240 `String.length` units. Counting units would reject a name
    // a human counts as exactly at the limit.
    expect(validateOrgName("🌶".repeat(ORG_NAME_MAX_LENGTH)).ok).toBe(true);
    expect(validateOrgName("🌶".repeat(ORG_NAME_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

describe("isSupportedTimezone", () => {
  it("accepts the default zone", () => {
    expect(isSupportedTimezone(ORG_DEFAULT_TIMEZONE)).toBe(true);
  });

  it.each(["Asia/Tokyo", "Europe/London"])("accepts %s", (zone) => {
    expect(isSupportedTimezone(zone)).toBe(true);
  });

  it.each(["Mars/Olympus", "asia/bangkok", "", " Asia/Bangkok", "+07:00", 7, null, undefined])(
    "rejects %s",
    (zone) => {
      expect(isSupportedTimezone(zone)).toBe(false);
    },
  );

  it("★ the whitelist is the runtime's CANONICAL list — aliases are not in it", () => {
    // Documented, not incidental: `Intl.supportedValuesOf('timeZone')` returns
    // canonical IANA names only, so `"UTC"` and other link names are refused.
    // api-spec §3.4 names that list as the whitelist, and Phase 0 is
    // Thailand-only (D-013), so this is the intended, spec-faithful behaviour —
    // if a client ever needs `"UTC"` the CONTRACT changes, not this predicate.
    expect(Intl.supportedValuesOf("timeZone")).not.toContain("UTC");
    expect(isSupportedTimezone("UTC")).toBe(false);
  });
});

describe("validateNewOrganization — the whole POST /organizations body", () => {
  it("defaults the timezone to Asia/Bangkok when absent", () => {
    expect(validateNewOrganization({ name: "ร้าน ก" })).toEqual({
      ok: true,
      value: { name: "ร้าน ก", timezone: ORG_DEFAULT_TIMEZONE },
    });
  });

  it("accepts an explicit known timezone", () => {
    const result = validateNewOrganization({ name: "ร้าน ก", timezone: "Asia/Tokyo" });
    expect(result).toEqual({ ok: true, value: { name: "ร้าน ก", timezone: "Asia/Tokyo" } });
  });

  it("treats an explicit null timezone as 'not sent'", () => {
    const result = validateNewOrganization({ name: "ร้าน ก", timezone: null });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.timezone).toBe(ORG_DEFAULT_TIMEZONE);
  });

  it("reports EVERY bad field at once, not just the first", () => {
    const result = validateNewOrganization({ name: "", timezone: "Mars/Olympus" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toEqual({
        name: ORG_NAME_REQUIRED_MESSAGE,
        timezone: ORG_TIMEZONE_INVALID_MESSAGE,
      });
    }
  });

  it("★ ignores anything else the caller sent — no plan, no currency, no id", () => {
    const result = validateNewOrganization({
      name: "ร้าน ก",
      // A client trying to grant itself the Full tier, or to pick its own id.
      planKey: "comp_full",
      currency: "USD",
      id: "org_attacker",
    } as { name: string });
    expect(result).toEqual({ ok: true, value: { name: "ร้าน ก", timezone: ORG_DEFAULT_TIMEZONE } });
  });
});

describe("the fixed constants of a new org", () => {
  it("currency is THB and is not an input (D-013)", () => {
    expect(ORG_DEFAULT_CURRENCY).toBe("THB");
  });

  it("the default warehouse has the name architecture §6.1 specifies", () => {
    expect(DEFAULT_WAREHOUSE_NAME).toBe("คลังหลัก");
  });
});
