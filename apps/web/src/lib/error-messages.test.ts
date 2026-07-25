import { describe, expect, it } from "vitest";
import {
  changePasswordErrorMessage,
  loginErrorMessage,
  signupErrorMessage,
} from "./error-messages";
import { authTh } from "../i18n/auth";

describe("error-messages", () => {
  describe("signupErrorMessage", () => {
    it("maps EMAIL_TAKEN", () => {
      expect(signupErrorMessage("EMAIL_TAKEN")).toBe(authTh.signup.error.emailTaken);
    });
    it("maps PASSWORD_TOO_SHORT", () => {
      expect(signupErrorMessage("PASSWORD_TOO_SHORT")).toBe(authTh.signup.error.passwordTooShort);
    });
    it("maps PASSWORD_BREACHED", () => {
      expect(signupErrorMessage("PASSWORD_BREACHED")).toBe(authTh.signup.error.passwordBreached);
    });
    it("maps EMAIL_INVALID", () => {
      expect(signupErrorMessage("EMAIL_INVALID")).toBe(authTh.signup.error.emailInvalid);
    });
    it("falls back to generic for an unknown code (never renders the raw code)", () => {
      expect(signupErrorMessage("SOMETHING_NEW_FROM_BACKEND")).toBe(authTh.signup.error.generic);
    });
    it("falls back to generic for undefined", () => {
      expect(signupErrorMessage(undefined)).toBe(authTh.signup.error.generic);
    });
  });

  describe("loginErrorMessage (enumeration-safe)", () => {
    it("returns the SAME generic message regardless of the underlying code", () => {
      const codes = ["INVALID_CREDENTIALS", "SOME_OTHER_CODE", undefined];
      const messages = codes.map((c) => loginErrorMessage(c));
      expect(new Set(messages).size).toBe(1);
      expect(messages[0]).toBe(authTh.login.error.invalidCredentials);
    });
  });

  describe("changePasswordErrorMessage", () => {
    it("maps INVALID_CREDENTIALS to the current-password-wrong copy", () => {
      expect(changePasswordErrorMessage("INVALID_CREDENTIALS")).toBe(
        authTh.changePassword.error.invalidCurrent,
      );
    });
    it("maps PASSWORD_BREACHED", () => {
      expect(changePasswordErrorMessage("PASSWORD_BREACHED")).toBe(
        authTh.changePassword.error.passwordBreached,
      );
    });
    it("falls back to generic for unknown codes", () => {
      expect(changePasswordErrorMessage("WEIRD_CODE")).toBe(authTh.changePassword.error.generic);
    });
  });
});
