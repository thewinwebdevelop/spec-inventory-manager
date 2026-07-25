import { describe, it, expect } from "vitest";
import {
  hasCapability,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_FULL_ACCESS,
} from "./capabilities";

describe("capability constants + check (api-spec §2.8)", () => {
  it("manage_members constant is the pinned literal", () => {
    expect(CAPABILITY_MANAGE_MEMBERS).toBe("manage_members");
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
