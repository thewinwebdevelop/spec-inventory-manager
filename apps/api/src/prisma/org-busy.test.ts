// F-002 · T-002-18 ★ — `describeOrgBusy` (architecture §5.2 · §15 row 6b ·
// test-plan I-C-10).
//
// WHY THIS FILE EXISTS
// The adapter shipped with T-002-09 and had no test, because at the time no
// endpoint took the org lock — so nothing could produce the input it was written
// for. T-002-18 produced it, and the answer was `500`: `runInOrgLockTransaction`
// classifies contention itself and rethrows a ready-made `OrgBusyError`, which
// carries no `code`/`meta` and therefore could not be re-classified. Both input
// shapes are now pinned here, in the unit lane, so the DB-backed case is a
// confirmation rather than the only line of defence.
import { describe, it, expect } from "vitest";
import { OrgBusyError } from "@omnistock/db";
import { describeOrgBusy } from "./org-busy";

describe("describeOrgBusy", () => {
  it("★ recognises an ALREADY-CLASSIFIED OrgBusyError (what the org lock throws)", () => {
    const error = new OrgBusyError("lock_timeout", { sqlState: "55P03" }, "revokeMember");
    const described = describeOrgBusy(error);

    expect(described).not.toBeNull();
    expect(described).toMatchObject({
      status: 409,
      code: "CONFLICT",
      details: { reason: "busy" },
      alert: false,
    });
  });

  it("recognises a RAW driver error (nothing has classified it yet)", () => {
    expect(describeOrgBusy({ code: "P2010", meta: { code: "55P03" } })).toMatchObject({
      status: 409,
      code: "CONFLICT",
      details: { reason: "busy" },
    });
    expect(describeOrgBusy({ code: "P2028" })).toMatchObject({ status: 409 });
  });

  it("★ a deadlock/serialization failure asks to be alerted on (§5.1)", () => {
    // The uniform lock order means these cannot happen unless somebody wrote a
    // transaction off-policy — a bug, not load to ride out.
    expect(describeOrgBusy(new OrgBusyError("deadlock", { sqlState: "40P01" }))?.alert).toBe(true);
    expect(
      describeOrgBusy(new OrgBusyError("serialization", { sqlState: "40001" }))?.alert,
    ).toBe(true);
  });

  it("★ the diagnostic is carried separately — never inside `details`", () => {
    // `details` is what the filter puts on the wire. A SQLSTATE there tells an
    // attacker about our schema and the user nothing (U-API-21 ก).
    const described = describeOrgBusy(new OrgBusyError("lock_timeout", { sqlState: "55P03" }))!;
    expect(described.details).toEqual({ reason: "busy" });
    expect(JSON.stringify(described.details)).not.toContain("55P03");
    expect(described.diagnostic).toMatchObject({ sqlState: "55P03" });
  });

  it("★ stays narrow: anything that is NOT contention is left alone", () => {
    // A `409 + try again` shown for a unique-constraint violation or a plain bug
    // would hide every real failure behind "retry", which is worse than the 500
    // this policy replaces (U-API-21 ข).
    for (const notBusy of [
      null,
      undefined,
      new Error("boom"),
      { code: "P2002" }, // unique constraint
      { code: "P2025" }, // record not found
      { name: "OrgBusyError" }, // the NAME alone is not the shape
      "P2028",
    ]) {
      expect(describeOrgBusy(notBusy)).toBeNull();
    }
  });
});
