import { describe, expect, it } from "vitest";
import { isPasswordLongEnough, isValidEmailShape, PASSWORD_MIN_LENGTH } from "./validation";

describe("validation (client-side mirror of server rules — ux-wireframe §2)", () => {
  describe("isValidEmailShape", () => {
    it("accepts a well-formed email", () => {
      expect(isValidEmailShape("somchai@shop.com")).toBe(true);
    });

    it("rejects a string with no @", () => {
      expect(isValidEmailShape("somchai-shop.com")).toBe(false);
    });

    it("rejects a string with no domain", () => {
      expect(isValidEmailShape("somchai@")).toBe(false);
    });

    it("rejects a string with no TLD", () => {
      expect(isValidEmailShape("somchai@shop")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidEmailShape("")).toBe(false);
    });

    it("trims surrounding whitespace before checking", () => {
      expect(isValidEmailShape("  somchai@shop.com  ")).toBe(true);
    });

    it("rejects a string containing spaces in the middle", () => {
      expect(isValidEmailShape("som chai@shop.com")).toBe(false);
    });
  });

  describe("isPasswordLongEnough", () => {
    it("matches the server PASSWORD_MIN_LENGTH constant (8)", () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });

    it("rejects a 7-char password", () => {
      expect(isPasswordLongEnough("1234567")).toBe(false);
    });

    it("accepts an 8-char password (boundary)", () => {
      expect(isPasswordLongEnough("12345678")).toBe(true);
    });

    it("accepts a long passphrase", () => {
      expect(isPasswordLongEnough("this is a long thai-friendly passphrase")).toBe(true);
    });

    it("counts unicode code points, not UTF-16 units (matches core-domain policy)", () => {
      // 8 emoji code points should count as length 8, not fail as "too short"
      const eightEmoji = "😀".repeat(8);
      expect(isPasswordLongEnough(eightEmoji)).toBe(true);
    });
  });
});
