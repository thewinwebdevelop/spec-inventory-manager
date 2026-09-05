// F-002 · T-002-09 ★ — decision layer of U-API-07 (test-plan §5, 8 cases).
// The transaction/ordering half of U-API-07 lives in
// apps/api/src/auth/auth.service.test.ts; this file pins the RULE.
import { describe, it, expect } from "vitest";
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
} from "../auth/capabilities";
import { decideAdminReset, type AdminResetInput } from "./admin-reset-authz";

const OWNER = [CAPABILITY_FULL_ACCESS];
const ADMIN = [CAPABILITY_MANAGE_MEMBERS];
const STAFF = ["manage_products"];

function input(over: Partial<AdminResetInput> = {}): AdminResetInput {
  return {
    caller: { status: "active", capabilities: ADMIN },
    target: { status: "active", capabilities: STAFF },
    targetActiveMembershipsInOtherOrgs: 0,
    targetUserExists: true,
    callerIsTarget: false,
    ...over,
  };
}

describe("U-API-07 · decideAdminReset — the 2 fail-closed conditions (C-2 + NEW-1)", () => {
  it("(ก) target active in THIS org only and not an Owner → allowed (F-001 behaviour survives)", () => {
    expect(decideAdminReset(input())).toEqual({ allowed: true, refusals: [] });
  });

  it("(ข) C-2 · target is active in another org too → refused", () => {
    const d = decideAdminReset(input({ targetActiveMembershipsInOtherOrgs: 1 }));
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_active_in_other_org"]);
  });

  it("(ค) target's membership elsewhere is NOT active (invited/revoked) → allowed", () => {
    // The count only ever carries `active` rows; 0 means "nothing to cross".
    expect(decideAdminReset(input({ targetActiveMembershipsInOtherOrgs: 0 })).allowed).toBe(true);
  });

  it("(ง) caller lacks manage_members → refused, and ONLY for that reason", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: STAFF },
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 3,
      }),
    );
    expect(d.allowed).toBe(false);
    // No owner-target / multi-org refusal ⇒ no audit event: a stranger with a
    // token cannot make the audit log say someone attacked the Owner.
    expect(d.refusals).toEqual(["caller_not_authorized"]);
  });

  it("(ง²) caller's membership is revoked / missing → refused", () => {
    expect(decideAdminReset(input({ caller: { status: "revoked", capabilities: ADMIN } })).refusals).toEqual([
      "caller_not_authorized",
    ]);
    expect(decideAdminReset(input({ caller: { status: null, capabilities: [] } })).refusals).toEqual([
      "caller_not_authorized",
    ]);
    expect(decideAdminReset(input({ caller: { status: "invited", capabilities: ADMIN } })).refusals).toEqual([
      "caller_not_authorized",
    ]);
  });

  it("target is not an active member here → refused before any other check", () => {
    for (const status of ["invited", "revoked", null] as const) {
      const d = decideAdminReset(
        input({
          target: { status, capabilities: OWNER },
          targetActiveMembershipsInOtherOrgs: 2,
        }),
      );
      expect(d.refusals).toEqual(["target_not_active_member"]);
    }
  });

  it("target User row was not locked (does not exist) → refused", () => {
    expect(decideAdminReset(input({ targetUserExists: false })).refusals).toEqual([
      "target_not_active_member",
    ]);
  });

  it("(ฉ) NEW-1 · target is an Owner and caller only has manage_members → refused", () => {
    const d = decideAdminReset(input({ target: { status: "active", capabilities: OWNER } }));
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_is_owner"]);
  });

  it("(ฉ²) NEW-1 · Owner-ness is read from CAPABILITIES, never a role name", () => {
    // A custom role that happens to hold full_access is an Owner (F-003 lets
    // roles be renamed; a name comparison would silently stop protecting it).
    const d = decideAdminReset(
      input({ target: { status: "active", capabilities: ["manage_products", CAPABILITY_FULL_ACCESS] } }),
    );
    expect(d.refusals).toEqual(["target_is_owner"]);
  });

  it("(ช) control · target is an Owner and caller HAS full_access → allowed", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: OWNER },
        target: { status: "active", capabilities: OWNER },
      }),
    );
    expect(d).toEqual({ allowed: true, refusals: [] });
  });

  it("both conditions at once → BOTH refusals reported (the Owner signal is not swallowed)", () => {
    const d = decideAdminReset(
      input({
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 1,
      }),
    );
    expect(d.allowed).toBe(false);
    expect(d.refusals).toEqual(["target_active_in_other_org", "target_is_owner"]);
  });

  it("an Owner caller is still blocked by C-2 (the two rules are independent)", () => {
    const d = decideAdminReset(
      input({
        caller: { status: "active", capabilities: OWNER },
        target: { status: "active", capabilities: OWNER },
        targetActiveMembershipsInOtherOrgs: 1,
      }),
    );
    expect(d.refusals).toEqual(["target_active_in_other_org"]);
  });

  it("is a pure decision: same input, same answer, no mutation of the input", () => {
    const i = input({ target: { status: "active", capabilities: OWNER } });
    const snapshot = JSON.parse(JSON.stringify(i));
    expect(decideAdminReset(i)).toEqual(decideAdminReset(i));
    expect(i).toEqual(snapshot);
  });

  // ── High-2 · self-reset (security review of f66451f, user decision) ───────

  it("caller resetting their OWN password → refused, however senior they are", () => {
    // The whole point: this is the case where the caller passes every other
    // check. An Owner with full_access trips nothing else at all.
    expect(decideAdminReset(input({ callerIsTarget: true }))).toEqual({
      allowed: false,
      refusals: ["caller_is_target"],
    });
    expect(
      decideAdminReset(
        input({
          caller: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
          target: { status: "active", capabilities: [CAPABILITY_FULL_ACCESS] },
          callerIsTarget: true,
        }),
      ),
    ).toEqual({ allowed: false, refusals: ["caller_is_target"] });
  });

  it("self-reset is reported ALONGSIDE the other refusals, not instead of them", () => {
    // Both must appear: an investigator reading "caller_is_target" alone would
    // conclude someone fat-fingered their own account, and miss that the same
    // request was also an attempt on a multi-org credential.
    const decision = decideAdminReset(
      input({ callerIsTarget: true, targetActiveMembershipsInOtherOrgs: 1 }),
    );
    expect(decision.allowed).toBe(false);
    expect([...decision.refusals].sort()).toEqual(
      ["caller_is_target", "target_active_in_other_org"].sort(),
    );
  });

  it("resetting SOMEBODY ELSE is untouched — the rule is about the caller, not the endpoint", () => {
    expect(decideAdminReset(input({ callerIsTarget: false }))).toEqual({
      allowed: true,
      refusals: [],
    });
  });
});