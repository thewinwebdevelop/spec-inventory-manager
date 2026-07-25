import { beforeEach, describe, expect, it } from "vitest";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token-store";

describe("token-store (T-001-16 client-security: in-memory only)", () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it("starts with no access token", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and returns the access token after setAccessToken", () => {
    setAccessToken("abc.def.ghi", 900);
    expect(getAccessToken()).toBe("abc.def.ghi");
  });

  it("clearAccessToken wipes the token (used on logout / session-expired)", () => {
    setAccessToken("token", 900);
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("never exposes a refresh-token field/setter — module surface is access-token only", async () => {
    const mod = await import("./token-store");
    const exportedNames = Object.keys(mod);
    for (const name of exportedNames) {
      expect(name.toLowerCase()).not.toContain("refresh");
    }
  });
});

describe("token-store never touches localStorage/sessionStorage (client-security)", () => {
  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("setAccessToken does not write to localStorage", () => {
    setAccessToken("super-secret-access-token", 900);
    expect(localStorage.length).toBe(0);
  });

  it("setAccessToken does not write to sessionStorage", () => {
    setAccessToken("super-secret-access-token", 900);
    expect(sessionStorage.length).toBe(0);
  });
});
