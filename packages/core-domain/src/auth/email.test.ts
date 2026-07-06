import { describe, it, expect } from "vitest";
import { normalizeEmail, isValidEmailShape, emailIdentifier } from "./email";

// Pure — no DB. U1.1 (email normalize) + the shape guard behind EMAIL_INVALID.

describe("normalizeEmail (U1.1)", () => {
  it("trims surrounding whitespace and lowercases the whole address", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it.each([
    ["  user@example.com  ", "user@example.com"], // leading/trailing space
    ["USER@EXAMPLE.COM", "user@example.com"], // all upper
    ["User@Example.Com", "user@example.com"], // mixed case
    ["a.b+tag@Sub.Domain.CO", "a.b+tag@sub.domain.co"], // local-part lowered too (MVP rule)
  ])("normalizes %j → %j", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it("is idempotent (normalizing twice == once)", () => {
    const once = normalizeEmail("  Foo@Bar.COM ");
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe("isValidEmailShape", () => {
  it.each([
    "user@example.com",
    "a.b+tag@sub.domain.co",
    "x@y.io",
  ])("accepts well-formed %j", (e) => {
    expect(isValidEmailShape(e)).toBe(true);
  });

  it.each([
    "", // empty
    "no-at-sign", // no @
    "@example.com", // empty local
    "user@", // empty domain
    "user@nodot", // domain without dot
    "user@@example.com", // double @
    "user name@example.com", // whitespace
    "user@.com", // domain starts with dot
    "user@example.", // domain ends with dot
  ])("rejects malformed %j", (e) => {
    expect(isValidEmailShape(e)).toBe(false);
  });
});

describe("emailIdentifier (D-009 service-layer abstraction)", () => {
  it("builds a normalized email identifier", () => {
    expect(emailIdentifier("  Foo@Bar.COM ")).toEqual({
      type: "email",
      value: "foo@bar.com",
    });
  });
});
