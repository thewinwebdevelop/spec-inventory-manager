import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRedisConnection } from "../health/redis.provider";
import {
  SecurityEventsService,
  SECURITY_EVENT_TYPES,
  F001_SECURITY_EVENT_TYPES,
  F002_SECURITY_EVENT_TYPES,
  F003_SECURITY_EVENT_TYPES,
  SECURITY_EVENT_PAYLOAD_KEYS,
  STRICT_PAYLOAD_EVENT_TYPES,
  collectSecurityEvents,
  ESCALATION_CHECKED_OPERATIONS,
  ESCALATION_DENIED_REASONS,
  ESCALATION_DEDUPE_WINDOW_SECONDS,
  ESCALATION_DEDUPE_TIMEOUT_MS,
  type EscalationDedupeStore,
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

/** A well-formed `org.role.escalation_denied` payload (arch §7). */
const ESCALATION_PAYLOAD = {
  actorUserId: "actor-1",
  organizationId: "org-1",
  roleId: "role-1",
  targetUserId: null,
  operation: "update_role",
  reason: "exceeds_actor",
  excessCapabilities: ["manage_roles"],
} as const;

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

  // R3-01 (F-003 AC-9.4) — was 19 (F-001 4 + F-002 15). Raised to 25 ON
  // PURPOSE in the same change that adds the 6 F-003 events; the F-002 list
  // above is untouched and still pinned at 15.
  it("is the union of all three sets, 25 values (4 + 15 + 6), with no duplicates", () => {
    expect(SECURITY_EVENT_TYPES).toHaveLength(25);
    expect(new Set(SECURITY_EVENT_TYPES).size).toBe(25);
    expect([...SECURITY_EVENT_TYPES]).toEqual([
      ...F001_SECURITY_EVENT_TYPES,
      ...F002_SECURITY_EVENT_TYPES,
      ...F003_SECURITY_EVENT_TYPES,
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
  // F-003 (arch §7 / §13.4)
  "org.role.created": true,
  "org.role.updated": true,
  "org.role.deleted": true,
  "org.role.escalation_denied": true,
  "auth.password.admin_reset_blocked_privilege": true,
  "org.invitation.accept_blocked_inviter": true,
};
void _UNION_IS_EXHAUSTIVE;

describe("SecurityEventsService transport (unchanged — qa test sink)", () => {
  it("delivers every event type to the '*' subscriber", async () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    for (const type of SECURITY_EVENT_TYPES) {
      // `escalation_denied` only leaves through its deduped door (arch §7
      // SR-12) — `emit()` does not accept it at the type level.
      if (type === "org.role.escalation_denied") {
        await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
      } else {
        svc.emit(type, {});
      }
    }
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
      expect(Object.keys(event.payload).sort()).toEqual(["actorUserId", "orgId", "targetUserId"]);
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
    // Uses `org.member.role_changed`, which is deliberately NOT strict: this
    // case is about substring matching, and it needs an event where an extra
    // key survives. It used to use `org.invitation.accepted`, which ★ A-10
    // moved onto the strict list — so the extra key is now dropped there, by
    // design, and the test would have been asserting the opposite of the rule.
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.member.role_changed", {
      actorUserId: "u1",
      organizationId: "o1",
      targetUserId: "u2",
      fromRoleId: "r1",
      toRoleId: "r2",
      correlationId: "c1", // undocumented but harmless → kept (non-strict event)
    });
    const [event] = sink.ofType("org.member.role_changed");
    expect(event.payload.correlationId).toBe("c1");
    sink.stop();
  });

  it("★ A-10 · a strict invitation event keeps its documented keys and drops the rest", () => {
    // The other half of A-10: being on the strict list must not cost a
    // documented field. `userCreatedAfterTokenIssued` contains "Token" — key
    // matching is by exact name, never substring, or I-7's forensic field
    // would vanish the moment this event became strict.
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
      emailMasked: "s***@shop.com", // a full address hidden here is the risk
      correlationId: "c1",
    });
    const [event] = sink.ofType("org.invitation.accepted");
    expect(event.payload.userCreatedAfterTokenIssued).toBe(true);
    // Undocumented keys are gone — the point of the strict list.
    expect(event.payload.correlationId).toBeUndefined();
    // …and so is `emailMasked`, because `org.invitation.accepted` does not
    // declare it (only `org.invitation.created` does). A call site that put a
    // real address here would now lose it rather than log it.
    expect(event.payload.emailMasked).toBeUndefined();
    sink.stop();
  });

  it("★ A-10 · every event family that handles an address is on the strict list", () => {
    // Security review A-10. The invitation family relies on (a) each call site
    // remembering to call `maskEmail`, and (b) `REDACTED_PAYLOAD_KEYS`
    // stripping a key literally named `email`. It does NOT strip `emailMasked`
    // — correctly, that is the key we mean to send — so a call site that put a
    // FULL address under `emailMasked` would sail straight through.
    //
    // `org.tax_profile.*` is on the strict list for exactly this reason. The
    // invitation family has the same shape of risk and was not.
    for (const type of [
      "org.invitation.created",
      "org.invitation.accepted",
      "org.invitation.link_reissued",
      "org.invitation.cancelled",
      "org.member.reactivated",
    ] as const) {
      expect(STRICT_PAYLOAD_EVENT_TYPES, type).toContain(type);
    }
  });

  it("STRICT_PAYLOAD_EVENT_TYPES covers exactly the families that handle a secret or an address", () => {
    // An exact list, not a `toContain`: adding a family here changes what is
    // dropped from real audit payloads, so it must be a deliberate edit rather
    // than something that drifts in.
    expect([...STRICT_PAYLOAD_EVENT_TYPES].sort()).toEqual(
      [
        "auth.password.admin_reset_blocked_multi_org",
        "auth.password.admin_reset_blocked_owner_target",
        "org.invitation.accepted",
        "org.invitation.cancelled",
        "org.invitation.created",
        "org.invitation.link_reissued",
        "org.member.reactivated",
        "org.tax_profile.revealed",
        "org.tax_profile.set",
        // F-003 (T-003-B16) — all 6 role/permission events, deliberately.
        "org.role.created",
        "org.role.updated",
        "org.role.deleted",
        "org.role.escalation_denied",
        "auth.password.admin_reset_blocked_privilege",
        "org.invitation.accept_blocked_inviter",
      ].sort(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F-003 · T-003-B16 ★ — the 6 role/permission events (arch §7 · §13.4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The 6 F-003 events, transcribed from F-003 architecture §7 (table order).
 * Not imported from the code, for the same reason as ARCH_S9_EVENTS.
 */
const F003_ARCH_S7_EVENTS = [
  "org.role.created",
  "org.role.updated",
  "org.role.deleted",
  "org.role.escalation_denied",
  "auth.password.admin_reset_blocked_privilege",
  "org.invitation.accept_blocked_inviter",
];

/** arch §7 payload column, transcribed. `before`/`after` are nested objects. */
const F003_ARCH_S7_PAYLOAD_KEYS: Record<string, string[]> = {
  "org.role.created": ["actorUserId", "organizationId", "roleId", "name", "capabilities"],
  "org.role.updated": [
    "actorUserId",
    "organizationId",
    "roleId",
    "before",
    "after",
    "affectedActiveMembers",
    "invitationsShortened",
  ],
  "org.role.deleted": ["actorUserId", "organizationId", "roleId", "name", "capabilities"],
  "org.role.escalation_denied": [
    "actorUserId",
    "organizationId",
    "roleId",
    "targetUserId",
    "operation",
    "reason",
    "excessCapabilities",
    "suppressedCount",
  ],
  "auth.password.admin_reset_blocked_privilege": ["actorUserId", "orgId", "targetUserId"],
  "org.invitation.accept_blocked_inviter": [
    "actorUserId",
    "organizationId",
    "invitationId",
    "issuerUserId",
    "reason",
    "excessCapabilities",
  ],
};

/** Keys that would identify a PERSON rather than an id (AC-9.5). `name` is
 *  allowed only as the ROLE's name, on the role CRUD events. */
const PERSON_KEYS = ["email", "emailmasked", "displayname", "fullname", "username", "phone"];

describe("U-API3-10 ★ · F-003 events — pin, strict payload, no email (AC-9.1/9.4/9.5)", () => {
  it("F003_SECURITY_EVENT_TYPES equals the 6 arch §7 events, in order", () => {
    expect([...F003_SECURITY_EVENT_TYPES]).toEqual(F003_ARCH_S7_EVENTS);
    expect(F003_SECURITY_EVENT_TYPES).toHaveLength(6);
  });

  it("does not touch the F-002 list (15) and shares no name with F-001/F-002", () => {
    expect(F002_SECURITY_EVENT_TYPES).toHaveLength(15);
    const earlier = new Set<string>([...F001_SECURITY_EVENT_TYPES, ...F002_SECURITY_EVENT_TYPES]);
    for (const type of F003_SECURITY_EVENT_TYPES) expect(earlier.has(type), type).toBe(false);
  });

  it("documents exactly the arch §7 payload keys for each of the 6", () => {
    for (const type of F003_SECURITY_EVENT_TYPES) {
      expect([...SECURITY_EVENT_PAYLOAD_KEYS[type]].sort(), type).toEqual(
        [...F003_ARCH_S7_PAYLOAD_KEYS[type]].sort(),
      );
    }
  });

  it("all 6 are on the strict list (undocumented keys are dropped)", () => {
    for (const type of F003_SECURITY_EVENT_TYPES) {
      expect(STRICT_PAYLOAD_EVENT_TYPES, type).toContain(type);
    }
  });

  it("no documented F-003 key names a person (AC-9.5) — `name` only on role CRUD", () => {
    let checked = 0;
    for (const type of F003_SECURITY_EVENT_TYPES) {
      for (const key of SECURITY_EVENT_PAYLOAD_KEYS[type]) {
        checked++;
        expect(PERSON_KEYS, `${type}.${key}`).not.toContain(key.toLowerCase());
        if (key === "name") {
          expect(["org.role.created", "org.role.deleted"], type).toContain(type);
        }
      }
    }
    expect(checked).toBeGreaterThan(0); // non-vacuity
  });

  const EMAIL = "victim@example.com";

  for (const type of [
    "org.role.created",
    "org.role.deleted",
    "auth.password.admin_reset_blocked_privilege",
    "org.invitation.accept_blocked_inviter",
  ] as const) {
    it(`${type} drops an email smuggled under any undocumented key (key + value)`, () => {
      const svc = new SecurityEventsService();
      const sink = collectSecurityEvents(svc);
      const documented = Object.fromEntries(
        SECURITY_EVENT_PAYLOAD_KEYS[type].map((k) => [k, `v-${k}`]),
      );
      svc.emit(type, {
        ...documented,
        email: EMAIL,
        emailMasked: "v***@example.com",
        actorEmail: EMAIL,
        displayName: "Somchai",
      });
      const [event] = sink.ofType(type);
      expect(Object.keys(event.payload).sort()).toEqual(
        [...SECURITY_EVENT_PAYLOAD_KEYS[type]].sort(),
      );
      const serialized = JSON.stringify(event.payload);
      expect(serialized).not.toContain("@");
      expect(serialized).not.toContain("Somchai");
      sink.stop();
    });
  }

  it("org.role.updated: before/after keep ONLY {name, capabilities} (nested strict)", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.role.updated", {
      actorUserId: "a",
      organizationId: "o1",
      roleId: "r1",
      before: { name: "Staff", capabilities: ["view_stock"], editedByEmail: EMAIL },
      after: { name: "Staff+", capabilities: ["view_stock", "edit_stock"], lastEditedBy: EMAIL },
      affectedActiveMembers: 3,
      invitationsShortened: 1,
      actorEmail: EMAIL,
    });
    const [event] = sink.ofType("org.role.updated");
    expect(event.payload).toEqual({
      actorUserId: "a",
      organizationId: "o1",
      roleId: "r1",
      before: { name: "Staff", capabilities: ["view_stock"] },
      after: { name: "Staff+", capabilities: ["view_stock", "edit_stock"] },
      affectedActiveMembers: 3,
      invitationsShortened: 1,
    });
    expect(JSON.stringify(event.payload)).not.toContain("@");
    sink.stop();
  });

  it("org.role.updated: a non-object before/after (e.g. an address string) is dropped", () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    svc.emit("org.role.updated", {
      actorUserId: "a",
      organizationId: "o1",
      roleId: "r1",
      before: EMAIL,
      after: ["x", EMAIL],
    });
    const [event] = sink.ofType("org.role.updated");
    expect(event.payload).not.toHaveProperty("before");
    expect(event.payload).not.toHaveProperty("after");
    expect(event.payload.roleId).toBe("r1"); // control: the rest survived
    sink.stop();
  });

  it("escalation_denied drops undocumented keys too (strict through the deduped door)", async () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    await svc.emitEscalationDenied({
      ...ESCALATION_PAYLOAD,
      // A careless call site spreading a wider object — compiles, so the
      // runtime must hold the line.
      ...({ actorEmail: EMAIL } as object),
    });
    const [event] = sink.ofType("org.role.escalation_denied");
    expect(Object.keys(event.payload).sort()).toEqual(
      [...F003_ARCH_S7_PAYLOAD_KEYS["org.role.escalation_denied"]].sort(),
    );
    expect(event.payload.suppressedCount).toBe(0);
    expect(JSON.stringify(event.payload)).not.toContain("@");
    sink.stop();
  });

  it("post-commit: an F-003 event after a rolled-back tx leaves no trace", async () => {
    const svc = new SecurityEventsService();
    const sink = collectSecurityEvents(svc);
    const commitThenEmit = async (tx: () => Promise<void>): Promise<void> => {
      await tx();
      svc.emit("org.role.deleted", {
        actorUserId: "a",
        organizationId: "o1",
        roleId: "r1",
        name: "Staff",
        capabilities: ["view_stock"],
      });
    };
    await expect(
      commitThenEmit(async () => {
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(sink.events).toHaveLength(0);
    await commitThenEmit(async () => {});
    expect(sink.types()).toEqual(["org.role.deleted"]); // control: the path CAN emit
    sink.stop();
  });

  it("emit() refuses escalation_denied at the type level (only the deduped door)", () => {
    const svc = new SecurityEventsService();
    // Never invoked — this case exists for `typecheck`: if `emit()` ever
    // accepts the type again, the directive below becomes unused and fails.
    // @ts-expect-error — `org.role.escalation_denied` is not an `emit()` type.
    const call = (): void => svc.emit("org.role.escalation_denied", {});
    expect(call).toBeTypeOf("function");
  });

  it("emit() refuses escalation_denied at RUNTIME too — a cast cannot bypass the dedupe", () => {
    const redis = new FakeRedis();
    const svc = new SecurityEventsService(redis);
    const sink = collectSecurityEvents(svc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the point: a cast
    const untyped = svc.emit.bind(svc) as any;
    expect(() => untyped("org.role.escalation_denied", ESCALATION_PAYLOAD)).toThrow(
      /emitEscalationDenied/,
    );
    expect(sink.events).toHaveLength(0); // nothing leaked around the dedupe
    expect(redis.calls).toEqual([]);
    // control: the same service still emits a direct type
    svc.emit("org.role.deleted", { actorUserId: "a", organizationId: "o", roleId: "r", name: "n" });
    expect(sink.types()).toEqual(["org.role.deleted"]);
    sink.stop();
  });
});

// ─── U-API3-11 — dedupe of escalation_denied (arch §7 SR-12) ────────────────

/** Minimal in-memory Redis for the 4 commands the dedupe uses, with a clock. */
class FakeRedis implements EscalationDedupeStore {
  now = 0;
  failing = false;
  calls: string[] = [];
  private readonly data = new Map<string, { value: string; expiresAt: number | null }>();

  private live(key: string): { value: string; expiresAt: number | null } | undefined {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= this.now) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }
  private guard(cmd: string): void {
    this.calls.push(cmd);
    if (this.failing) throw new Error("ECONNREFUSED");
  }
  async set(
    key: string,
    value: string,
    _ex: "EX",
    seconds: number,
    _nx: "NX",
  ): Promise<"OK" | null> {
    this.guard("set");
    if (this.live(key)) return null;
    this.data.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return "OK";
  }
  async incr(key: string): Promise<number> {
    this.guard("incr");
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }
  async expire(key: string, seconds: number): Promise<number> {
    this.guard("expire");
    const entry = this.live(key);
    if (!entry) return 0;
    entry.expiresAt = this.now + seconds * 1000;
    return 1;
  }
  async getdel(key: string): Promise<string | null> {
    this.guard("getdel");
    const entry = this.live(key);
    this.data.delete(key);
    return entry ? entry.value : null;
  }
}

describe("U-API3-11 · escalation_denied dedupe — Redis SET NX EX 300, fail-open", () => {
  let redis: FakeRedis;
  let svc: SecurityEventsService;
  let sink: ReturnType<typeof collectSecurityEvents>;
  const WINDOW_MS = ESCALATION_DEDUPE_WINDOW_SECONDS * 1000;

  beforeEach(() => {
    redis = new FakeRedis();
    svc = new SecurityEventsService(redis);
    sink = collectSecurityEvents(svc);
  });
  afterEach(() => sink.stop());

  it("window is 5 minutes", () => {
    expect(ESCALATION_DEDUPE_WINDOW_SECONDS).toBe(300);
  });

  it("same key 3× inside 5 minutes = 1 event; next after the window carries suppressedCount=2", async () => {
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    redis.now += 60_000;
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    redis.now += 60_000;
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    expect(sink.ofType("org.role.escalation_denied")).toHaveLength(1);
    expect(sink.events[0].payload.suppressedCount).toBe(0);
    expect(svc.suppressedTotal("org.role.escalation_denied")).toBe(2);

    redis.now = WINDOW_MS; // first SET was at t=0 → the window is over exactly now
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    const events = sink.ofType("org.role.escalation_denied");
    expect(events).toHaveLength(2);
    expect(events[1].payload.suppressedCount).toBe(2);

    // …and the counter was consumed: the window after that starts from 0.
    redis.now += WINDOW_MS;
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    expect(sink.ofType("org.role.escalation_denied")[2].payload.suppressedCount).toBe(0);
  });

  it("a different targetUserId is a different key → emitted separately", async () => {
    const onMember = { ...ESCALATION_PAYLOAD, operation: "change_member_role" as const };
    await svc.emitEscalationDenied({ ...onMember, targetUserId: "u-1" });
    await svc.emitEscalationDenied({ ...onMember, targetUserId: "u-2" });
    await svc.emitEscalationDenied({ ...onMember, targetUserId: "u-1" }); // dup of #1
    expect(sink.ofType("org.role.escalation_denied").map((e) => e.payload.targetUserId)).toEqual([
      "u-1",
      "u-2",
    ]);
  });

  it("every key component separates: actor, org, operation, reason, roleId, targetUserId", async () => {
    const variants = [
      { actorUserId: "actor-2" },
      { organizationId: "org-2" },
      { operation: "delete_role" as const },
      { reason: "role_locked" as const },
      { roleId: "role-2" },
      { roleId: null },
      { targetUserId: "u-9" },
    ];
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    for (const v of variants) await svc.emitEscalationDenied({ ...ESCALATION_PAYLOAD, ...v });
    expect(sink.ofType("org.role.escalation_denied")).toHaveLength(1 + variants.length);
  });

  it("excessCapabilities is NOT part of the key (arch §7 key tuple)", async () => {
    await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    await svc.emitEscalationDenied({ ...ESCALATION_PAYLOAD, excessCapabilities: ["other"] });
    expect(sink.ofType("org.role.escalation_denied")).toHaveLength(1);
  });

  it('null and the string "null" are not the same key (no delimiter collision)', async () => {
    await svc.emitEscalationDenied({ ...ESCALATION_PAYLOAD, roleId: null });
    await svc.emitEscalationDenied({ ...ESCALATION_PAYLOAD, roleId: "null" });
    expect(sink.ofType("org.role.escalation_denied")).toHaveLength(2);
  });

  it("Redis throwing = emit EVERY time (fail-open — lose volume, never the signal)", async () => {
    redis.failing = true;
    for (let i = 0; i < 3; i++) await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
    const events = sink.ofType("org.role.escalation_denied");
    expect(events).toHaveLength(3);
    for (const e of events) expect(e.payload.suppressedCount).toBe(0);
    expect(redis.calls.length).toBeGreaterThan(0); // it did try Redis
  });

  it("Redis failing AFTER the NX set (reading the counter) still emits", async () => {
    const store: EscalationDedupeStore = {
      set: async () => "OK",
      incr: async () => 1,
      expire: async () => 1,
      getdel: async () => {
        throw new Error("ECONNRESET");
      },
    };
    const s2 = new SecurityEventsService(store);
    const sink2 = collectSecurityEvents(s2);
    await s2.emitEscalationDenied(ESCALATION_PAYLOAD);
    expect(sink2.ofType("org.role.escalation_denied")).toHaveLength(1);
    expect(sink2.events[0].payload.suppressedCount).toBe(0);
    sink2.stop();
  });

  it("Redis failing on the suppression counter keeps it suppressed (NX already said duplicate)", async () => {
    const store: EscalationDedupeStore = {
      set: async () => null,
      incr: async () => {
        throw new Error("ECONNRESET");
      },
      expire: async () => 1,
      getdel: async () => null,
    };
    const s2 = new SecurityEventsService(store);
    const sink2 = collectSecurityEvents(s2);
    await s2.emitEscalationDenied(ESCALATION_PAYLOAD);
    expect(sink2.events).toHaveLength(0);
    expect(s2.suppressedTotal("org.role.escalation_denied")).toBe(1);
    sink2.stop();
  });

  it("applies to escalation_denied ONLY — other F-003 events are never deduped", () => {
    for (let i = 0; i < 3; i++) {
      svc.emit("org.invitation.accept_blocked_inviter", {
        actorUserId: "u1",
        organizationId: "o1",
        invitationId: "i1",
        issuerUserId: "u0",
        reason: "inviter_not_active",
        excessCapabilities: [],
      });
      svc.emit("auth.password.admin_reset_blocked_privilege", {
        actorUserId: "a",
        orgId: "o1",
        targetUserId: "t",
      });
    }
    expect(sink.events).toHaveLength(6);
    expect(redis.calls).toEqual([]); // emit() never touches Redis
  });

  it("no store wired = every event emitted (fail-open, same as Redis down)", async () => {
    const bare = new SecurityEventsService();
    const sink2 = collectSecurityEvents(bare);
    for (let i = 0; i < 3; i++) await bare.emitEscalationDenied(ESCALATION_PAYLOAD);
    expect(sink2.events).toHaveLength(3);
    sink2.stop();
  });
});

// ─── U-API3-12 — the 8 checked operations + 4 reasons (test-plan §5.3) ─────

describe("U-API3-12 · ESCALATION_CHECKED_OPERATIONS (8) + reasons (4)", () => {
  it("exports exactly the 8 operations of test-plan §5.3, in table order", () => {
    expect([...ESCALATION_CHECKED_OPERATIONS]).toEqual([
      "create_role",
      "update_role",
      "delete_role",
      "change_member_role",
      "remove_member",
      "invite_create",
      "invite_reissue",
      "invite_cancel",
    ]);
    expect(new Set(ESCALATION_CHECKED_OPERATIONS).size).toBe(8);
  });

  it("does not count accept re-check / admin reset (they have their own events)", () => {
    const ops: readonly string[] = ESCALATION_CHECKED_OPERATIONS;
    for (const excluded of ["invite_accept_recheck", "reset_password", "invite_accept"]) {
      expect(ops).not.toContain(excluded);
    }
  });

  it("the possible reasons are exactly the 4 of arch §7", () => {
    expect([...ESCALATION_DENIED_REASONS].sort()).toEqual([
      "exceeds_actor",
      "full_access_reserved",
      "role_locked",
      "target_not_below_actor",
    ]);
  });
});

// ─── SR-12 fail-open must hold against a Redis that HANGS, not only one that
// throws (security review of B16, High). The shared connection is built with
// `maxRetriesPerRequest: null` + offline queue, so a dead Redis makes commands
// wait forever instead of rejecting — the `catch` alone never fires.

/** A store whose chosen commands never settle (a hung / queued connection). */
function hangingStore(
  hang: ReadonlyArray<keyof EscalationDedupeStore>,
  base: Partial<EscalationDedupeStore> = {},
): EscalationDedupeStore & { calls: string[] } {
  const calls: string[] = [];
  const never = <T>(): Promise<T> => new Promise<T>(() => {});
  const cmd =
    <T>(name: keyof EscalationDedupeStore, fallback: () => Promise<T>) =>
    (): Promise<T> => {
      calls.push(name);
      return hang.includes(name) ? never<T>() : fallback();
    };
  return {
    calls,
    set: cmd("set", base.set ? () => base.set!("", "", "EX", 0, "NX") : async () => "OK" as const),
    incr: cmd("incr", async () => 1),
    expire: cmd("expire", async () => 1),
    getdel: cmd("getdel", async () => null),
  } as EscalationDedupeStore & { calls: string[] };
}

describe("U-API3-11b · escalation_denied fail-open on a HANGING Redis (SR-12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Starts the emit and reports whether the returned promise has settled. */
  function start(svc: SecurityEventsService): { settled: () => boolean; done: Promise<void> } {
    let settled = false;
    const done = svc.emitEscalationDenied(ESCALATION_PAYLOAD).then(() => {
      settled = true;
    });
    return { settled: () => settled, done };
  }

  it("the deadline is 200–300 ms (review: bounded, short enough for a 403 path)", () => {
    expect(ESCALATION_DEDUPE_TIMEOUT_MS).toBeGreaterThanOrEqual(200);
    expect(ESCALATION_DEDUPE_TIMEOUT_MS).toBeLessThanOrEqual(300);
  });

  it("SET NX never answers → event emitted AT the deadline, promise settles (every time)", async () => {
    const store = hangingStore(["set", "incr", "expire", "getdel"]);
    const svc = new SecurityEventsService(store);
    const sink = collectSecurityEvents(svc);
    for (let i = 1; i <= 3; i++) {
      const run = start(svc);
      await vi.advanceTimersByTimeAsync(ESCALATION_DEDUPE_TIMEOUT_MS - 1);
      expect(sink.events).toHaveLength(i - 1); // not before the deadline…
      expect(run.settled()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(sink.events).toHaveLength(i); // …but exactly at it
      expect(run.settled()).toBe(true);
      await run.done;
    }
    for (const e of sink.events) expect(e.payload.suppressedCount).toBe(0);
    expect(store.calls.filter((c) => c === "set")).toHaveLength(3); // it did try Redis
    sink.stop();
  });

  it("SET answers OK but GETDEL hangs → still emitted by the next deadline", async () => {
    const svc = new SecurityEventsService(hangingStore(["getdel"]));
    const sink = collectSecurityEvents(svc);
    const run = start(svc);
    await vi.advanceTimersByTimeAsync(ESCALATION_DEDUPE_TIMEOUT_MS);
    expect(sink.ofType("org.role.escalation_denied")).toHaveLength(1);
    expect(sink.events[0].payload.suppressedCount).toBe(0);
    expect(run.settled()).toBe(true);
    await run.done;
    sink.stop();
  });

  it("duplicate (SET → null) but INCR hangs → stays suppressed, promise still settles", async () => {
    const store = hangingStore(["incr", "expire"], { set: async () => null });
    const svc = new SecurityEventsService(store);
    const sink = collectSecurityEvents(svc);
    const run = start(svc);
    await vi.advanceTimersByTimeAsync(ESCALATION_DEDUPE_TIMEOUT_MS);
    expect(run.settled()).toBe(true); // a 403 awaiting this is not held hostage
    expect(sink.events).toHaveLength(0);
    expect(svc.suppressedTotal("org.role.escalation_denied")).toBe(1);
    await run.done;
    sink.stop();
  });
});

describe("U-API3-11c · real ioredis, PRODUCTION connection options, Redis down", () => {
  it("createRedisConnection() → dead port: the event still goes out within the deadline", async () => {
    // Port 1 on loopback: connection refused. With the production options
    // (maxRetriesPerRequest:null + offline queue) the SET is queued forever —
    // the exact failure mode a thrown-error fake cannot reproduce.
    const redis = createRedisConnection({ REDIS_URL: "redis://127.0.0.1:1" });
    redis.on("error", () => {}); // reconnect noise is expected here
    try {
      const svc = new SecurityEventsService(redis);
      const sink = collectSecurityEvents(svc);
      const t0 = Date.now();
      await svc.emitEscalationDenied(ESCALATION_PAYLOAD);
      const elapsed = Date.now() - t0;
      expect(sink.ofType("org.role.escalation_denied")).toHaveLength(1);
      expect(elapsed).toBeGreaterThanOrEqual(ESCALATION_DEDUPE_TIMEOUT_MS - 5);
      expect(elapsed).toBeLessThan(ESCALATION_DEDUPE_TIMEOUT_MS + 1000);
      sink.stop();
    } finally {
      redis.disconnect();
    }
  }, 10_000);
});
