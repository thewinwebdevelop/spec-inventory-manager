import { describe, it, expect, beforeEach } from "vitest";
import {
  HOLD_MS,
  destinationAfterLogin,
  dropPendingInvite,
  hasPendingInvite,
  holdInviteToken,
  isInviteJourneyRoute,
  takeInviteToken,
} from "./pending-invite";

const T0 = 1_750_000_000_000;

beforeEach(() => dropPendingInvite());

describe("★ B-19 — the invitation token held across sign-in", () => {
  it("a held token is taken exactly once", () => {
    holdInviteToken("tok", T0);
    expect(takeInviteToken(T0 + 1)).toBe("tok");
    // Taking clears it: a second `/invite` mount must not find it again.
    expect(takeInviteToken(T0 + 2)).toBeNull();
    expect(hasPendingInvite(T0 + 2)).toBe(false);
  });

  it("★ is forgotten after the hold window, even if nobody took it", () => {
    holdInviteToken("tok", T0);
    expect(hasPendingInvite(T0 + HOLD_MS - 1)).toBe(true);
    expect(hasPendingInvite(T0 + HOLD_MS)).toBe(false);
    expect(takeInviteToken(T0 + HOLD_MS)).toBeNull();
  });

  it("an expired hold is also CLEARED by the take, not merely hidden", () => {
    holdInviteToken("tok", T0);
    takeInviteToken(T0 + HOLD_MS);
    // Travelling back in time proves the value itself is gone.
    expect(takeInviteToken(T0)).toBeNull();
  });

  it("an empty token is not held", () => {
    holdInviteToken("", T0);
    expect(hasPendingInvite(T0)).toBe(false);
  });

  it("dropping empties it", () => {
    holdInviteToken("tok", T0);
    dropPendingInvite();
    expect(takeInviteToken(T0)).toBeNull();
  });

  it("★ login returns to the invitation only while one is held", () => {
    expect(destinationAfterLogin(T0)).toBe("/select-org");
    holdInviteToken("tok", T0);
    expect(destinationAfterLogin(T0 + 1)).toBe("/invite");
    expect(destinationAfterLogin(T0 + HOLD_MS)).toBe("/select-org");
  });

  it("★ N-1: an abandoned hold does not route the NEXT person at a shared browser to it", () => {
    // The scenario `pending-invite.ts` accepts in a comment ("they should not
    // be shown it") but that nothing was named after — qa, 2026-09-20.
    //
    // A opens an invitation on the shop's counter machine, taps
    // "เข้าสู่ระบบเพื่อรับคำเชิญ", and walks off without signing in. The hold
    // survives: `/login` is ON the journey, so the route guard leaves it, and
    // no session ever ends, so `endSession` never fires. B sits down and signs
    // in with their OWN account. The only thing standing between B and A's
    // invitation — shop name and masked address — is this clock.
    holdInviteToken("a-tok", T0);
    expect(destinationAfterLogin(T0 + HOLD_MS - 1)).toBe("/invite");
    expect(destinationAfterLogin(T0 + HOLD_MS)).toBe("/select-org");
  });

  it("★ N-1: the window itself is the control — widening it must be a deliberate act", () => {
    // Without this, `HOLD_MS` can be raised to a day for convenience and every
    // test above still passes, because they all measure against the constant
    // rather than against a bound. The number is a security parameter: it is
    // the entire mitigation for the case above, on a machine OmniStock's own
    // persona work says is shared (security-review-build-B.md).
    expect(HOLD_MS).toBeLessThanOrEqual(30 * 60_000);
  });

  it("asking where to go does not consume the token — `/invite` still needs it", () => {
    holdInviteToken("tok", T0);
    destinationAfterLogin(T0 + 1);
    expect(takeInviteToken(T0 + 2)).toBe("tok");
  });
});

describe("isInviteJourneyRoute — where the hold is allowed to survive", () => {
  it("the invitation screen and both auth doors are on the journey", () => {
    expect(isInviteJourneyRoute("/invite")).toBe(true);
    expect(isInviteJourneyRoute("/login")).toBe(true);
    expect(isInviteJourneyRoute("/signup")).toBe(true);
  });

  it("★ a sub-route is NOT the same route — the reported gap, verbatim", () => {
    // `/login/help` is the reported example of "wandering off": it starts
    // with `/login` but is a different screen, so an exact match (not a
    // prefix) must say no.
    expect(isInviteJourneyRoute("/login/help")).toBe(false);
    expect(isInviteJourneyRoute("/signup/terms")).toBe(false);
  });

  it("anywhere else in the app is not the journey", () => {
    expect(isInviteJourneyRoute("/select-org")).toBe(false);
    expect(isInviteJourneyRoute("/o/org_1")).toBe(false);
    expect(isInviteJourneyRoute("/")).toBe(false);
  });
});
