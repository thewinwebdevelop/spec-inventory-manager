import { describe, it, expect } from "vitest";
import {
  SecurityEventsService,
  SECURITY_EVENT_TYPES,
  F001_SECURITY_EVENT_TYPES,
  F002_SECURITY_EVENT_TYPES,
  SECURITY_EVENT_PAYLOAD_KEYS,
  STRICT_PAYLOAD_EVENT_TYPES,
  collectSecurityEvents,
  type SecurityEventType,
} from "./security-events.service";

// T-002-12 ★ — the security-event union + payload safety rules.
// The union is the audit vocabulary of the whole platform: adding or removing a
// member must be a deliberate act, so this suite pins it against an independent
// transcription of F-002 architecture §9 (drift → red).

/**
 * The 15 F-002 events, transcribed from architecture §9 (table order).
 * Deliberately NOT imported from the code — that is the point: this is the doc
 * side of the contract, so code and doc are compared, not code with itself.
 */
const ARCH_S9_EVENTS = [
  "org.created",
  "org.invitation.created",
  "org.invitation.link_reissued",
  "org.invitation.cancelled",
  "org.invitation.accepted",
  "org.member.reactivated",
  "org.member.role_changed",
  "org.member.revoked",
  "org.member.left",
  "org.tax_profile.set",
  "org.tax_profile.revealed",
  "org.access.denied",
  "org.access.capability_denied",
  "auth.password.admin_reset_blocked_multi_org",
  "auth.password.admin_reset_blocked_owner_target",
];

describe("SecurityEventType union — F-002 architecture §9 / §15 row 4", () => {
  it("contains exactly the 15 F-002 events, by name and in §9 order", () => {
    expect([...F002_SECURITY_EVENT_TYPES]).toEqual(ARCH_S9_EVENTS);
    expect(F002_SECURITY_EVENT_TYPES).toHaveLength(15);
  });

  it("keeps the 4 shipped F-001 events untouched (F-005 greps these strings)", () => {
    expect([...F001_SECURITY_EVENT_TYPES]).toEqual([
      "auth.refresh.reuse_detected",
      "auth.password.admin_reset",
      "auth.password.self_changed",
      "auth.throttle.fail_open",
    ]);
  });

  it("is the union of both sets, 19 values, with no duplicates", () => {
    expect(SECURITY_EVENT_TYPES).toHaveLength(19);
    expect(new Set(SECURITY_EVENT_TYPES).size).toBe(19);
    expect([...SECURITY_EVENT_TYPES]).toEqual([
      ...F001_SECURITY_EVENT_TYPES,
      ...F002_SECURITY_EVENT_TYPES,
    ]);
  });

  it("keeps admin_reset_blocked_owner_target separate from _multi_org (D-030)", () => {
    // One ticket per reason: "someone tried to reset the OWNER's password" is an
    // account-takeover signal; folding it into the multi-org event makes the
    // takeover attempt unrecoverable at investigation time.
    expect(SECURITY_EVENT_TYPES).toContain("auth.password.admin_reset_blocked_multi_org");
    expect(SECURITY_EVENT_TYPES).toContain("auth.password.admin_reset_blocked_owner_target");
  });

  it("distinguishes member.left (D-029) from member.revoked", () => {
    expect(SECURITY_EVENT_TYPES).toContain("org.member.left");
    expect(SECURITY_EVENT_TYPES).toContain("org.member.revoked");
  });

  it("documents payload keys for every member of the union", () => {
    expect(Object.keys(SECURITY_EVENT_PAYLOAD_KEYS).sort()).toEqual(
      [...SECURITY_EVENT_TYPES].sort(),
    );
  });
});

// Compile-time twin of the runtime assertions above: a missing key (event
// removed from the union) or an excess key (event added) fails `typecheck`,
// so the union cannot drift even without running this file.
const _UNION_IS_EXHAUSTIVE: Record<SecurityEventType, true> = {
  "auth.refresh.reuse_detected": true,
  "auth.password.admin_reset": true,
  "auth.password.self_changed": true,
  "auth.throttle.fail_open": true,
  "org.created": true,
  "org.invitation.created": true,
  "org.invitation.link_reissued": true,
  "org.invitation.cancelled": true,
  "org.invitation.accepted": true,
  "org.member.reactivated": true,
  "org.member.role_changed": true,
  "org.member.revoked": true,
  "org.member.left": true,
  "org.tax_profile.set": true,
  "org.tax_profile.revealed": true,
  "org.access.denied": true,
  "org.access.capability_denied": true,
  "auth.password.admin_reset_blocked_multi_org": true,
  "auth.password.admin_reset_blocked_owner_target": true,
};
void _UNION_IS_EXHAUSTIVE;

describe("SecurityEventsService transport (unchanged — qa test sink)", () => {
  it("delivers every event type to the '*' subscriber", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    for (const type of SECURITY_EVENT_TYPES) svc.emit(type, {});
    expect(sink.types()).toEqual([...SECURITY_EVENT_TYPES]);
    sink.stop();
  });

  it("also delivers on the per-type channel, with payload and timestamp", () => {
    const svc = new SecurityEventsService();
    const seen: unknown[] = [];
    svc.emitter.on("org.created", (e) => seen.push(e));
    svc.emit("org.created", { actorUserId: "u1", organizationId: "o1", planKey: "full" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      type: "org.created",
      payload: { actorUserId: "u1", organizationId: "o1", planKey: "full" },
    });
    expect((seen[0] as { at: number }).at).toBeTypeOf("number");
  });

  it("collectSecurityEvents supports ofType/clear/stop", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.member.left", { userId: "u1", organizationId: "o1" });
    svc.emit("org.member.revoked", { actorUserId: "a", organizationId: "o1", targetUserId: "u2" });
    expect(sink.ofType("org.member.left")).toHaveLength(1);
    expect(sink.ofType("org.member.revoked")).toHaveLength(1);
    sink.clear();
    expect(sink.events).toHaveLength(0);
    sink.stop();
    svc.emit("org.created", {});
    expect(sink.events).toHaveLength(0); // unsubscribed
  });
});

describe("post-commit only (H-3) — a rolled-back tx leaves no trace", () => {
  /** Mirrors the production call-site shape: `await tx(...)` FIRST, emit after
   *  it resolves. If the transaction throws, control never reaches the emit. */
  async function commitThenEmit(
    svc: SecurityEventsService,
    tx: () => Promise<void>,
  ): Promise<void> {
    await tx();
    svc.emit("org.member.role_changed", {
      actorUserId: "a",
      organizationId: "o1",
      targetUserId: "u2",
      fromRoleId: "r1",
      toRoleId: "r2",
      grantsFullAccess: true,
    });
  }

  it("emits exactly one event when the transaction commits", async () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    await commitThenEmit(svc, async () => {
      /* committed */
    });
    expect(sink.types()).toEqual(["org.member.role_changed"]);
    sink.stop();
  });

  it("emits NOTHING when the transaction rolls back", async () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    await expect(
      commitThenEmit(svc, async () => {
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(sink.events).toHaveLength(0);
    sink.stop();
  });
});

describe("payload safety — org.tax_profile.* never carries the TIN (M-7ค / D-030)", () => {
  const TIN = "1234567890123";

  it("org.tax_profile.set keeps only the documented keys (taxIdPresent, no value)", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    // A careless call site tries to attach the real thing, masked and whole.
    svc.emit("org.tax_profile.set", {
      actorUserId: "a",
      organizationId: "o1",
      taxEntityType: "juristic",
      vatRegistered: true,
      taxIdPresent: true,
      taxId: TIN,
      taxIdMasked: `*********${TIN.slice(-4)}`,
    });
    const [event] = sink.ofType("org.tax_profile.set");
    // Structural: the key set is exactly what §9 documents — not a string match.
    expect(Object.keys(event.payload).sort()).toEqual(
      [...SECURITY_EVENT_PAYLOAD_KEYS["org.tax_profile.set"]].sort(),
    );
    expect(event.payload.taxIdPresent).toBe(true);
    expect(event.payload).not.toHaveProperty("taxId");
    expect(event.payload).not.toHaveProperty("taxIdMasked");
    sink.stop();
  });

  it("org.tax_profile.revealed carries actor + org only", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.tax_profile.revealed", {
      actorUserId: "a",
      organizationId: "o1",
      taxId: TIN,
      revealedValue: TIN,
    });
    const [event] = sink.ofType("org.tax_profile.revealed");
    expect(Object.keys(event.payload).sort()).toEqual(["actorUserId", "organizationId"]);
    sink.stop();
  });

  it("no substring of the TIN of length >= 4 survives in either tax event", () => {
    // qa U-API-16: serialize the whole payload and hunt for any 4+ char run.
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.tax_profile.set", {
      actorUserId: "a",
      organizationId: "o1",
      taxEntityType: "individual",
      vatRegistered: false,
      taxIdPresent: true,
      taxId: TIN,
      note: `last4=${TIN.slice(-4)}`,
    });
    svc.emit("org.tax_profile.revealed", { actorUserId: "a", organizationId: "o1", taxId: TIN });
    const substrings: string[] = [];
    for (let i = 0; i + 4 <= TIN.length; i++) substrings.push(TIN.slice(i, i + 4));
    for (const event of sink.events) {
      // ⚠️ PAYLOAD only — serializing the whole event includes `at`, an
      // epoch-millis timestamp, and a 4-digit window of a 13-digit TIN collides
      // with a 13-digit clock often enough to fail at random. (It did: `at`
      // 1785890192104 contains "8901".) The claim being made is about what WE
      // put in the payload; the timestamp is ours, carries no TIN, and its
      // digits mean nothing here. Scanning it turned a real guarantee into a
      // coin flip that would have failed in CI on some other day.
      const serialized = JSON.stringify(event.payload);
      for (const fragment of substrings) expect(serialized).not.toContain(fragment);
    }
    sink.stop();
  });
});

describe("payload safety — admin_reset_blocked_* never carries a password or hash", () => {
  for (const type of [
    "auth.password.admin_reset_blocked_multi_org",
    "auth.password.admin_reset_blocked_owner_target",
  ] as const) {
    it(`${type} keeps only { actorUserId, orgId, targetUserId }`, () => {
      const svc = new SecurityEventsService();
      const sink = collectSecurityEvents(svc);
      svc.emit(type, {
        actorUserId: "admin-1",
        orgId: "o1",
        targetUserId: "owner-1",
        password: "hunter2",
        newPassword: "hunter2",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$abc",
        hash: "$argon2id$v=19$m=65536,t=3,p=4$abc",
      });
      const [event] = sink.ofType(type);
      expect(Object.keys(event.payload).sort()).toEqual([
        "actorUserId",
        "orgId",
        "targetUserId",
      ]);
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain("hunter2");
      expect(serialized).not.toContain("argon2id");
      sink.stop();
    });
  }
});

describe("payload safety — invitation events carry emailMasked, never the address", () => {
  it("drops a full `email` key from any event", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.invitation.created", {
      actorUserId: "a",
      organizationId: "o1",
      email: "victim@example.com",
      emailMasked: "v***@example.com",
      roleId: "r1",
      invitationId: "i1",
    });
    const [event] = sink.ofType("org.invitation.created");
    expect(event.payload).not.toHaveProperty("email");
    expect(event.payload.emailMasked).toBe("v***@example.com");
    expect(JSON.stringify(event)).not.toContain("victim@example.com");
    sink.stop();
  });

  it("leaves non-secret keys of non-strict events alone (no over-filtering)", () => {
    // `userCreatedAfterTokenIssued` contains "Token" — key matching must be by
    // exact name, never substring, or I-7's forensic field would vanish.
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.invitation.accepted", {
      userId: "u1",
      organizationId: "o1",
      invitationId: "i1",
      roleId: "r1",
      acceptedByUserId: "u1",
      userCreatedAt: "2026-07-31T00:00:00.000Z",
      userCreatedAfterTokenIssued: true,
      correlationId: "c1", // undocumented but harmless → kept (non-strict event)
    });
    const [event] = sink.ofType("org.invitation.accepted");
    expect(event.payload.userCreatedAfterTokenIssued).toBe(true);
    expect(event.payload.correlationId).toBe("c1");
    sink.stop();
  });

  it("STRICT_PAYLOAD_EVENT_TYPES covers exactly the two sensitive families", () => {
    expect([...STRICT_PAYLOAD_EVENT_TYPES].sort()).toEqual([
      "auth.password.admin_reset_blocked_multi_org",
      "auth.password.admin_reset_blocked_owner_target",
      "org.tax_profile.revealed",
      "org.tax_profile.set",
    ]);
  });
});
