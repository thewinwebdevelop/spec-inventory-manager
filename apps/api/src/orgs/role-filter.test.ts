// F-003 · T-003-B22 — `?roleId=` validation (api-spec §4.2b, maxLength 64).
import { describe, it, expect } from "vitest";
import { DomainException } from "../common/domain-exception";
import {
  ROLE_ID_FILTER_INVALID_MESSAGE,
  ROLE_ID_FILTER_MAX_LENGTH,
  resolveRoleIdFilter,
} from "./role-filter";

function refusal(raw: unknown): DomainException {
  try {
    resolveRoleIdFilter(raw);
  } catch (error) {
    if (error instanceof DomainException) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("resolveRoleIdFilter", () => {
  it("absent or empty → no filter", () => {
    expect(resolveRoleIdFilter(undefined)).toBeUndefined();
    expect(resolveRoleIdFilter("")).toBeUndefined();
  });

  it("a role id passes through untouched, up to 64 characters", () => {
    expect(resolveRoleIdFilter("rol_abc")).toBe("rol_abc");
    const max = "r".repeat(ROLE_ID_FILTER_MAX_LENGTH);
    expect(resolveRoleIdFilter(max)).toBe(max);
  });

  it("65 characters or a repeated param → 422 VALIDATION_FAILED on `roleId`", () => {
    for (const raw of ["r".repeat(ROLE_ID_FILTER_MAX_LENGTH + 1), ["a", "b"]]) {
      const error = refusal(raw);
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.fieldErrors).toEqual({ roleId: ROLE_ID_FILTER_INVALID_MESSAGE });
    }
  });
});
