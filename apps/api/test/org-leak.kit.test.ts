// F-002 · T-002-22 ★ — META-TEST for the cross-org leak audit (deliverable 2).
//
// `auditSweep` is pure over a list of outcomes, which is the whole reason it is
// shaped that way: the leaks it must catch can be WRITTEN DOWN here, exactly as
// a broken endpoint would produce them, without first having to build a broken
// endpoint. Every case is a real regression somebody could ship:
//
//   • a `findMany` that forgot `organizationId`      → outsider gets 200
//   • `revoked` treated as "still a member"          → revoked persona gets 200
//   • 404 for a stranger, 403 for a member           → org-existence oracle
//   • `FORBIDDEN` merged into `ORG_ACCESS_DENIED`    → client sends the user to
//                                                       the wrong screen (I-5)
//   • an endpoint broken for everyone                → vacuous "isolation"
import { describe, it, expect } from "vitest";
import { assertNoCrossOrgLeak, auditSweep, type SweepOutcome } from "./org-leak.kit";

const TRACE_A = "11111111-1111-4111-8111-111111111111";
const TRACE_B = "22222222-2222-4222-8222-222222222222";

function denial(code = "ORG_ACCESS_DENIED", traceId = TRACE_A): unknown {
  return { error: { code, message: "คุณไม่ได้เป็นสมาชิกของร้านนี้", traceId } };
}

function outcome(over: Partial<SweepOutcome> & Pick<SweepOutcome, "persona" | "target">): SweepOutcome {
  const memberOfTarget = over.memberOfTarget ?? false;
  return {
    memberOfTarget,
    status: memberOfTarget ? 200 : 403,
    body: memberOfTarget ? { ok: true } : denial(),
    headers: {},
    route: "GET /orgs/{orgId}",
    ...over,
  };
}

/** What a correctly isolated endpoint produces. */
function cleanSweep(): SweepOutcome[] {
  return [
    outcome({ persona: "activeInAOnly", target: "A", memberOfTarget: true }),
    outcome({ persona: "activeInBoth", target: "A", memberOfTarget: true }),
    outcome({ persona: "revokedInA", target: "A" }),
    outcome({ persona: "noMembership", target: "A" }),
    outcome({ persona: "activeInAOnly", target: "B" }),
    outcome({ persona: "activeInBoth", target: "B", memberOfTarget: true }),
    outcome({ persona: "noMembership", target: "nonexistent", body: denial("ORG_ACCESS_DENIED", TRACE_B) }),
  ];
}

describe("auditSweep — the clean baseline", () => {
  it("a correctly isolated endpoint produces no findings", () => {
    expect(auditSweep(cleanSweep())).toEqual([]);
    expect(() => assertNoCrossOrgLeak(cleanSweep())).not.toThrow();
  });
});

describe("auditSweep — RED cases (each is a shippable regression)", () => {
  it("RED: a query that forgot `organizationId` — the outsider gets 200", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "noMembership" && o.target === "A"
        ? { ...o, status: 200, body: { items: [{ id: "secret-of-org-A" }] } }
        : o,
    );
    const findings = auditSweep(sweep);
    expect(findings.map((f) => f.kind)).toContain("leaked-to-outsider");
    expect(() => assertNoCrossOrgLeak(sweep)).toThrow(/cross-tenant/);
  });

  it("RED (AC-5.1): a REVOKED member is still served", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "revokedInA" ? { ...o, status: 200, body: { ok: true } } : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("leaked-to-outsider");
  });

  it("RED: a member of A calling B is served — the leak a single-org test never sees", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "activeInAOnly" && o.target === "B" ? { ...o, status: 200, body: { ok: true } } : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("leaked-to-outsider");
  });

  it("RED (I-5): a non-member is refused with the WRONG code", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "noMembership" && o.target === "A"
        ? { ...o, status: 404, body: { error: { code: "NOT_FOUND", message: "ไม่พบข้อมูล", traceId: TRACE_A } } }
        : o,
    );
    const findings = auditSweep(sweep);
    expect(findings.map((f) => f.kind)).toContain("wrong-denial-code");
    // …and the same edit also trips the oracle check, because the stranger now
    // learns something the ghost-org caller does not.
    expect(findings.map((f) => f.kind)).toContain("existence-oracle");
  });

  it("RED (I-5, other direction): an ACTIVE member told ORG_ACCESS_DENIED", () => {
    // This is how "FORBIDDEN and ORG_ACCESS_DENIED got merged" looks from the
    // wire: the client bounces a legitimate member back to the org picker.
    const sweep = cleanSweep().map((o) =>
      o.persona === "activeInAOnly" && o.target === "A" ? { ...o, status: 403, body: denial() } : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("member-denied");
  });

  it("RED (I-8): the real-org denial differs from the no-such-org denial", () => {
    const sweep = cleanSweep().map((o) =>
      o.target === "nonexistent"
        ? { ...o, body: { error: { code: "ORG_ACCESS_DENIED", message: "ไม่พบร้านนี้", traceId: TRACE_B } } }
        : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("existence-oracle");
  });

  it("RED (NEW-7): two responses sharing a traceId", () => {
    const sweep = cleanSweep().map((o) =>
      o.target === "nonexistent" ? { ...o, body: denial("ORG_ACCESS_DENIED", TRACE_A) } : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("shared-trace-id");
  });

  it("RED: a secret in a body nobody looked at", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "activeInAOnly" && o.target === "A"
        ? { ...o, body: { user: { id: "u", passwordHash: "$argon2id$x" } } }
        : o,
    );
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("secret-in-body");
  });

  it("RED: another persona's email in the body", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "activeInAOnly" && o.target === "A" ? { ...o, body: { owner: "bob@other.co" } } : o,
    );
    const findings = auditSweep(sweep, { foreignValues: ["bob@other.co"] });
    expect(findings.map((f) => f.kind)).toContain("foreign-email");
    // …and without declaring it foreign, the same body is (correctly) fine.
    expect(auditSweep(sweep).map((f) => f.kind)).not.toContain("foreign-email");
  });

  it("RED (the important one): an empty sweep is NOT green", () => {
    expect(auditSweep([]).map((f) => f.kind)).toEqual(["vacuous-sweep"]);
  });

  it("RED (the other important one): an endpoint denied to EVERYONE is not 'isolated'", () => {
    // 403 for all four personas satisfies every isolation rule. Without this
    // check, deleting the endpoint would be the easiest way to go green.
    const sweep = cleanSweep().map((o) => ({ ...o, status: 403, body: denial(), memberOfTarget: false }));
    expect(auditSweep(sweep).map((f) => f.kind)).toContain("vacuous-sweep");
  });
});

describe("assertNoCrossOrgLeak", () => {
  it("names every finding in one error, so one run reports the whole picture", () => {
    const sweep = cleanSweep().map((o) =>
      o.persona === "noMembership" && o.target === "A" ? { ...o, status: 200, body: { passwordHash: "x" } } : o,
    );
    let message = "";
    try {
      assertNoCrossOrgLeak(sweep);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/found \d+ problem\(s\)/);
    expect(message).toContain("leaked-to-outsider");
    expect(message).toContain("secret-in-body");
  });
});
