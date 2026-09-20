// T-002-W1 ★ — `unknown` is a state, not a spinner.
import { describe, it, expect } from "vitest";
import {
  isSignedIn,
  isSignedOut,
  settledSession,
  SESSION_AUTHED,
  SESSION_NONE,
  SESSION_UNKNOWN,
} from "./session-state";

describe("session state", () => {
  it("★ `unknown` is neither signed in nor signed out", () => {
    // Both predicates false is the whole point. If `isSignedOut(unknown)`
    // were true, every page load would bounce a live session to /login
    // before the bootstrap refresh had a chance to answer; if `isSignedIn`
    // were true, a logged-out deep link would flash the org shell.
    expect(isSignedIn(SESSION_UNKNOWN)).toBe(false);
    expect(isSignedOut(SESSION_UNKNOWN)).toBe(false);
  });

  it("settled states are decisive", () => {
    expect(isSignedIn(SESSION_AUTHED)).toBe(true);
    expect(isSignedOut(SESSION_AUTHED)).toBe(false);
    expect(isSignedIn(SESSION_NONE)).toBe(false);
    expect(isSignedOut(SESSION_NONE)).toBe(true);
  });

  it("a successful bootstrap refresh means authed; a failed one means none", () => {
    expect(settledSession(true)).toEqual(SESSION_AUTHED);
    expect(settledSession(false)).toEqual(SESSION_NONE);
  });

  it("★ the settled state is never `unknown` — a stuck app is worse than a login prompt", () => {
    expect(settledSession(true).status).not.toBe("unknown");
    expect(settledSession(false).status).not.toBe("unknown");
  });
});
