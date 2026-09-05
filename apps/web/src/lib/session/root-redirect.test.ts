import { describe, it, expect } from "vitest";
import { decideRoot } from "./root-redirect";
import { SESSION_AUTHED, SESSION_NONE, SESSION_UNKNOWN } from "./session-state";

describe("★ B-14 — what `/` does", () => {
  it("signed in → the shop picker, mirroring what a successful login does", () => {
    expect(decideRoot(SESSION_AUTHED)).toEqual({ kind: "pick-shop" });
  });

  it("signed out → login", () => {
    expect(decideRoot(SESSION_NONE)).toEqual({ kind: "sign-in" });
  });

  it("★★ NOT YET KNOWN → wait, and this is the case that matters", () => {
    // The refresh cookie is `Path=/auth`, so a cold load cannot know until the
    // bootstrap settles. Reading `unknown` as "signed out" would send every
    // signed-in person to /login on every reload of `/`.
    expect(decideRoot(SESSION_UNKNOWN)).toEqual({ kind: "wait" });
  });
});
