import { describe, it, expect } from "vitest";
import {
  hasCapability,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  CAPABILITY_FULL_ACCESS,
} from "./capabilities";

describe("capability constants + check (api-spec §2.8)", () => {
  it("manage_members constant is the pinned literal", () => {
    expect(CAPABILITY_MANAGE_MEMBERS).toBe("manage_members");
  });

  // T-002-08c — the constant moved from apps/api into core-domain. The move is
  // only safe if the string is byte-identical: it is compared against
  // `Role.capabilities` rows already seeded in the database, so a renamed
  // literal would not fail to compile — it would silently deny every Admin.
  it("manage_org_settings constant is the pinned literal (survived the move from apps/api)", () => {
    expect(CAPABILITY_MANAGE_ORG_SETTINGS).toBe("manage_org_settings");
  });

  it("manage_org_settings is a distinct capability from manage_members", () => {
    expect(hasCapability([CAPABILITY_MANAGE_MEMBERS], CAPABILITY_MANAGE_ORG_SETTINGS)).toBe(false);
    expect(hasCapability([CAPABILITY_MANAGE_ORG_SETTINGS], CAPABILITY_MANAGE_MEMBERS)).toBe(false);
  });

  it("grants when the exact capability is present", () => {
    expect(hasCapability(["manage_products", "manage_members"], CAPABILITY_MANAGE_MEMBERS)).toBe(true);
  });

  it("denies when the capability is absent (Staff role)", () => {
    expect(hasCapability(["manage_products"], CAPABILITY_MANAGE_MEMBERS)).toBe(false);
  });

  it("full_access is a wildcard (system Owner)", () => {
    expect(hasCapability([CAPABILITY_FULL_ACCESS], CAPABILITY_MANAGE_MEMBERS)).toBe(true);
  });

  it("empty capability list denies (no permissive default — api-spec §2.8 forbids it)", () => {
    expect(hasCapability([], CAPABILITY_MANAGE_MEMBERS)).toBe(false);
  });
});
