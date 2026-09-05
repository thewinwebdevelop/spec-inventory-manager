// T-002-W4 ★ — the reveal state machine. With `entityType: "personal"` the
// value under test is somebody's national ID, so these assert on what the
// state CANNOT hold, not only on what it renders.
import { describe, it, expect } from "vitest";
import {
  pressRequestsReveal,
  revealShown,
  toggleReveal,
  visibleTaxId,
  REVEAL_ERROR,
  REVEAL_HIDDEN,
  REVEAL_LOADING,
  type RevealState,
} from "./tax-reveal";

const TIN = "0105551234567";

describe("toggleReveal", () => {
  it("★ hiding DISCARDS the number — the hidden state has nowhere to keep it", () => {
    // ux-wireframe §5: "กดซ้ำ = ซ่อนเลข → ทิ้งค่าทิ้งจริง". A
    // `{visible:false, taxId:"…"}` shape would satisfy a render-level test
    // while keeping the TIN alive in memory and in React DevTools for the
    // life of the screen. This asserts the value is unreachable, not unshown.
    const shown = revealShown(TIN, "2026-08-06T10:00:00Z");
    const hidden = toggleReveal(shown);

    expect(hidden).toEqual({ status: "hidden" });
    expect(JSON.stringify(hidden)).not.toContain(TIN);
    expect(Object.values(hidden)).not.toContain(TIN);
    expect(visibleTaxId(hidden)).toBeNull();
  });

  it("pressing from hidden starts a request, never renders a stale value", () => {
    expect(toggleReveal(REVEAL_HIDDEN)).toEqual({ status: "loading" });
    expect(visibleTaxId(REVEAL_LOADING)).toBeNull();
  });

  it("pressing after an error retries", () => {
    expect(toggleReveal(REVEAL_ERROR)).toEqual({ status: "loading" });
  });
});

describe("pressRequestsReveal", () => {
  it("★ seeing it again always costs a fresh request", () => {
    // The full TIN never rides along on `GET /orgs/{orgId}`, so there is no
    // local copy to reuse — and re-asking is what makes the audit event and
    // the 20/hour budget mean anything.
    expect(pressRequestsReveal(REVEAL_HIDDEN)).toBe(true);
    expect(pressRequestsReveal(REVEAL_ERROR)).toBe(true);
  });

  it("does not re-request while already showing or already asking", () => {
    // Hiding must not burn a second call, and a double click must not burn
    // two — each costs a slot out of 20/hour and emits an audit event.
    expect(pressRequestsReveal(revealShown(TIN, "2026-08-06T10:00:00Z"))).toBe(false);
    expect(pressRequestsReveal(REVEAL_LOADING)).toBe(false);
  });
});

describe("visibleTaxId", () => {
  it("only `shown` yields the number", () => {
    const states: RevealState[] = [REVEAL_HIDDEN, REVEAL_LOADING, REVEAL_ERROR];
    for (const s of states) expect(visibleTaxId(s), s.status).toBeNull();
    expect(visibleTaxId(revealShown(TIN, "x"))).toBe(TIN);
  });

  it("★ an error drops whatever was on screen", () => {
    // §5's network/5xx row keeps the existing number visible, but that is the
    // COMPONENT choosing not to transition. Once the state does become
    // `error`, nothing is retained — a failed re-reveal must not leave a
    // number the user believes is current.
    expect(visibleTaxId(REVEAL_ERROR)).toBeNull();
    expect(JSON.stringify(REVEAL_ERROR)).not.toContain(TIN);
  });
});
