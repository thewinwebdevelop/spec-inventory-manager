// F-002 · T-002-Q3 ★ — the concurrency matrix of test-plan §8, all 13 cases.
//
// WHY A SUITE OF ITS OWN, when four of these races already appear inside the
// feature suites: §8 is not a list of cases, it is a list of cases PLUS three
// rules that only mean something when they are enforced across the whole set —
//
//   1. no `500` anywhere in this file. A 500 produced by a race is a bug, not
//      "one of the acceptable outcomes". Every response goes through `fire()`,
//      which records it; the rule is checked per response AND again in
//      `afterAll` over everything recorded, so a case that forgets to assert
//      still cannot hide one.
//   2. no `40P01` (deadlock) or `40001` (serialization failure) in the
//      process's output. architecture §5.1 claims every path takes the org
//      lock in the same order, so deadlock is impossible — a claim nothing
//      checked until this file. The single exception §8 grants is `55P03`
//      inside I-C-13, which the test itself creates.
//   3. a round that ends with "exactly one winner" emits exactly ONE security
//      event, and a round that ends in `409` emits NONE. A race that doubles
//      the audit trail is invisible to every status-code assertion ever
//      written, and an audit log that reports an action that did not happen is
//      worse than no audit log.
//
// Each case runs `ROUNDS` (20, per §8) times and asserts the INVARIANT against
// Postgres after every round — never just the status codes, which would be
// satisfied by an endpoint that refuses everybody. I-C-13 runs 3 rounds, the
// exception §8 spells out: each round has to hold a real lock for real time.
//
// ⚠️ No `setTimeout` staging anywhere (§8's own rule): a sleep proves the
// sleep. Every race is `Promise.all` over requests already in flight.
//
// ⚠️ No rate-limit Redis is bound (see `app.kit`'s note): the guard fails open
// without one, which is what this suite wants — 20 rounds of paired invitation
// accepts would otherwise spend their time proving the rate limiter works,
// and a 429 here would be noise standing where a 409 should be.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { ORG_TX_TIMEOUTS } from "@omnistock/config";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import {
  collectSecurityEvents,
  type SecurityEventCollector,
  type SecurityEventType,
} from "../src/auth";
import { assertErrorEnvelope } from "./assertions.kit";
import { INT_LANE_ENABLED, applyTestEnv, createTestApp, type TestApp } from "./app.kit";
import { createSeedKit, type SeedKit, type SeededOrg, type SeededUser } from "./f002-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;

/**
 * Derived from the call, not imported: `@types/supertest` publishes a single
 * `export =` and its inner names are not part of the public surface, so naming
 * them here would break on a version bump for no benefit.
 */
type SupertestRequest = ReturnType<ReturnType<typeof request>["get"]>;
type SupertestResponse = Awaited<SupertestRequest>;

if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-002-Q3] SKIPPING the concurrency matrix: TEST_DATABASE_URL / TEST_REDIS_URL are not set. " +
      "None of the 13 races in test-plan §8 is verified in this run — including the two that can " +
      "leave a shop with zero Owners.",
  );
}

/**
 * §8 says 20. Overridable so a developer can bisect a flake at 200 without
 * editing the file — CI never sets it, so CI runs 20.
 */
const ROUNDS = Number(process.env.CONCURRENCY_ROUNDS ?? 20);

/** §8's single documented exception: I-C-13 holds a real lock for real time. */
const LOCK_ROUNDS = 3;

/** SQLSTATEs that must never appear — in output or on the wire (§8 rule 2). */
const FORBIDDEN_SQLSTATES = ["40P01", "40001"] as const;

/**
 * Token-boundary match, exported so the self-check below can exercise both
 * directions rather than trusting the regex by reading it.
 */
export function leaksSqlstate(wire: string, sqlstate: string): boolean {
  return new RegExp(`(^|[^0-9A-Za-z])${sqlstate}([^0-9A-Za-z]|$)`).test(wire);
}

d("F-002 concurrency matrix (test-plan §8)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let kit: SeedKit;
  let events: SecurityEventCollector;

  /**
   * Orgs this suite touched.
   *
   * The kit deletes exactly the rows IT created, and this suite makes rows the
   * kit never sees: an accepted invitation writes a membership through the app,
   * `POST /invitations` writes an invitation. Those rows still point at
   * kit-created roles, so `kit.cleanup()` hit
   * `Membership_organizationId_roleId_fkey` on its first real run. They are
   * swept here, by org id, before the kit runs — never a global TRUNCATE:
   * vitest runs these files in parallel against one Postgres.
   */
  const touchedOrgIds: string[] = [];

  /** Every response this suite produced, for the suite-level rules. */
  const fired: { readonly caseId: string; readonly status: number; readonly body: unknown }[] = [];

  /** Everything the process wrote while the suite ran (rule 2). */
  const output: string[] = [];
  const restore: (() => void)[] = [];

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    applyTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    app = await createTestApp();
    kit = createSeedKit(prisma, { label: "q3" });
    events = collectSecurityEvents(app.events);

    // Tap stdout/stderr rather than replace them: the reporter still prints,
    // and a deadlock logged by Nest or Prisma is captured on the way past.
    // A deadlock that reaches no log at all is still caught, by rule 1 — it
    // cannot become a 200.
    for (const stream of [process.stdout, process.stderr] as const) {
      const original = stream.write.bind(stream);
      stream.write = ((chunk: unknown, ...rest: unknown[]) => {
        if (typeof chunk === "string") output.push(chunk);
        return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
      }) as typeof stream.write;
      restore.push(() => {
        stream.write = original;
      });
    }
  });

  afterAll(async () => {
    for (const undo of restore) undo();
    events?.stop();

    try {
      // ── RULE 1 ────────────────────────────────────────────────────────
      const crashes = fired.filter((f) => f.status >= 500);
      expect(
        crashes,
        `a race produced a 5xx: ${JSON.stringify(crashes.slice(0, 3), null, 2)}`,
      ).toHaveLength(0);

      // ── RULE 2 ────────────────────────────────────────────────────────
      // `55P03` is expected once per I-C-13 round and is not checked here;
      // these two never are, in any case, including that one.
      const combined = output.join("");
      for (const sqlstate of FORBIDDEN_SQLSTATES) {
        const hits = combined.split(sqlstate).length - 1;
        expect(
          hits,
          `${sqlstate} appeared ${hits}× in the suite's output. architecture §5.1 claims every ` +
            `path takes the org lock in the same order, so this cannot happen — the fix belongs ` +
            `to @backend-api, never to a retry in the test.`,
        ).toBe(0);
      }
    } finally {
      if (prisma && touchedOrgIds.length > 0) {
        const where = { organizationId: { in: touchedOrgIds } };
        await prisma.invitation.deleteMany({ where });
        await prisma.membership.deleteMany({ where });
      }
      if (kit) await kit.cleanup();
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    }
  });

  it("SELF-CHECK: a SQLSTATE is caught as a token and ignored inside an id", () => {
    // Both directions, because the first version of this rule failed a run
    // whose bodies were clean: it matched five digits that happened to sit
    // inside a cuid.
    expect(leaksSqlstate('{"error":{"message":"code 40001"}}', "40001")).toBe(true);
    expect(leaksSqlstate('{"code":"40001"}', "40001")).toBe(true);
    expect(leaksSqlstate('{"userId":"cmsz40001dm4s001g"}', "40001")).toBe(false);
    expect(leaksSqlstate('{"userId":"x40P01y"}', "40P01")).toBe(false);
  });

  // ── plumbing ─────────────────────────────────────────────────────────────

  /**
   * Sends a request and records it. Every response in this file goes through
   * here — that is what makes the suite-level rules non-vacuous.
   */
  async function fire(caseId: string, req: SupertestRequest): Promise<SupertestResponse> {
    const res = await req;
    fired.push({ caseId, status: res.status, body: res.body });
    expect(res.status, `${caseId}: ${JSON.stringify(res.body)}`).toBeLessThan(500);
    // The database's vocabulary never reaches a caller, whatever happened.
    //
    // ⚠️ MATCHED ON TOKEN BOUNDARIES, not as a substring. The plain
    // `toContain("40001")` failed a run whose bodies were perfectly clean: the
    // ids in them are cuid2, alphanumeric, and long, so five digits eventually
    // turn up inside one by chance. A guard that reddens a green suite gets
    // deleted by the next person, and this file exists to catch a real leak —
    // a SQLSTATE arrives as its own token ("40001", "code 40001"), never
    // buried inside an identifier.
    const wire = JSON.stringify(res.body ?? {});
    for (const sqlstate of [...FORBIDDEN_SQLSTATES, "55P03", "P2028", "P2010"]) {
      expect(
        leaksSqlstate(wire, sqlstate),
        `${caseId}: SQLSTATE ${sqlstate} leaked to the client — ${wire.slice(0, 300)}`,
      ).toBe(false);
    }
    return res;
  }

  interface Person extends SeededUser {
    readonly accessToken: string;
  }

  async function person(): Promise<Person> {
    const user = await kit.createUser();
    return { ...user, accessToken: token(user.id) };
  }

  async function shop(roles: Readonly<Record<string, string>>): Promise<{
    org: SeededOrg;
    people: Record<string, Person>;
  }> {
    const org = await kit.createOrg();
    touchedOrgIds.push(org.id);
    const people: Record<string, Person> = {};
    for (const [name, roleName] of Object.entries(roles)) {
      const p = await person();
      await kit.addMember({ organizationId: org.id, userId: p.id, roleId: org.roles[roleName].id });
      people[name] = p;
    }
    return { org, people };
  }

  const get = (caseId: string, path: string, accessToken: string) =>
    fire(caseId, request(app.server()).get(path).set("Authorization", `Bearer ${accessToken}`));

  const post = (caseId: string, path: string, accessToken: string | null, body: unknown) => {
    const req = request(app.server()).post(path).set("Content-Type", "application/json");
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`);
    return fire(caseId, req.send(body as object));
  };

  const patch = (caseId: string, path: string, accessToken: string, body: unknown) =>
    fire(
      caseId,
      request(app.server())
        .patch(path)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Content-Type", "application/json")
        .send(body as object),
    );

  const del = (caseId: string, path: string, accessToken: string) =>
    fire(caseId, request(app.server()).delete(path).set("Authorization", `Bearer ${accessToken}`));

  /** The invariant, asked of Postgres — and by CAPABILITY, never by role name. */
  const activeOwnerCount = (organizationId: string): Promise<number> =>
    prisma.membership.count({
      where: {
        organizationId,
        status: "active",
        role: { capabilities: { has: "full_access" } },
      },
    });

  const statusesOf = (...rs: SupertestResponse[]): number[] => rs.map((r) => r.status);
  const codesOf = (...rs: SupertestResponse[]): (string | undefined)[] =>
    rs.map((r) => r.body?.error?.code as string | undefined);

  /** Round scaffolding: clears the event log so each round counts its own. */
  async function round<T>(body: () => Promise<T>): Promise<T> {
    events.clear();
    return body();
  }

  /** §8 rule 3, for a round with a single winner. */
  function expectOneEvent(type: SecurityEventType, where: string): void {
    const emitted = events.ofType(type);
    expect(emitted, `${where}: expected exactly one ${type}, got ${events.types().join(",")}`)
      .toHaveLength(1);
  }

  /** §8 rule 3, for a round that changed nothing. */
  function expectNoEventOfTypes(types: readonly SecurityEventType[], where: string): void {
    const emitted = events.types().filter((t) => types.includes(t));
    expect(emitted, `${where}: an action that did not happen left an audit trail`).toHaveLength(0);
  }

  // ── I-C-01 · demote one Owner ‖ remove the other ─────────────────────────

  it(`I-C-01 · demote Owner A ‖ remove Owner B — COUNT(active owner) is always 1 (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ a: "Owner", b: "Owner" });

        const [demote, remove] = await Promise.all([
          patch("I-C-01", `/orgs/${org.id}/members/${people.a.id}`, people.a.accessToken, {
            roleId: org.roles.Staff.id,
          }),
          del("I-C-01", `/orgs/${org.id}/members/${people.b.id}`, people.a.accessToken),
        ]);

        const where = `round ${r}: statuses ${statusesOf(demote, remove)} codes ${codesOf(demote, remove)}`;

        // THE INVARIANT — after the race, from the database.
        expect(await activeOwnerCount(org.id), where).toBe(1);
        expect(statusesOf(demote, remove).filter((s) => s === 200), where).toHaveLength(1);

        // Both orderings are legitimate and they refuse differently — pinning
        // one would make this a coin flip. What is NOT negotiable is that the
        // loser is a decided refusal.
        const loser = statusesOf(demote, remove).find((s) => s !== 200)!;
        expect([403, 409], where).toContain(loser);
        expect(["LAST_OWNER", "FORBIDDEN", "ORG_ACCESS_DENIED", "CONFLICT"], where).toContain(
          codesOf(demote, remove).find(Boolean),
        );

        // Rule 3: one winner, one event.
        const emitted = events
          .types()
          .filter((t) => t === "org.member.revoked" || t === "org.member.role_changed");
        expect(emitted, where).toHaveLength(1);
      });
    }
  }, 600_000);

  // ── I-C-02 · accept ‖ accept, one token ──────────────────────────────────

  it(`I-C-02 · the same invitation accepted twice at once — one membership row (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        // The Owner is seeded because a shop without one is not a shop the
        // production code would ever see.
        const { org } = await shop({ owner: "Owner" });
        const guest = await person();
        const invitation = await kit.createInvitation({
          organizationId: org.id,
          email: guest.email,
          roleId: org.roles.Staff.id,
        });

        const [a, b] = await Promise.all([
          post("I-C-02", "/invitations/accept", guest.accessToken, { token: invitation.rawToken }),
          post("I-C-02", "/invitations/accept", guest.accessToken, { token: invitation.rawToken }),
        ]);

        const where = `round ${r}: statuses ${statusesOf(a, b)} codes ${codesOf(a, b)}`;

        // The invariant is the ROW COUNT, not the status codes: a second
        // membership for the same person in the same shop is the failure this
        // race exists to find.
        const rows = await prisma.membership.count({
          where: { organizationId: org.id, userId: guest.id },
        });
        expect(rows, where).toBe(1);

        expect(statusesOf(a, b).filter((s) => s === 200), where).toHaveLength(1);
        const loser = codesOf(a, b).find(Boolean);
        // `INVITATION_ALREADY_ACCEPTED` is the SHIPPED code (api-spec §4,
        // `ERROR_CODES`). test-plan §8 writes it as "ALREADY_ACCEPTED", which is
        // shorthand for a code that does not exist — this assertion was red on
        // its first real run for exactly that reason. The contract wins over the
        // plan's abbreviation.
        expect(
          ["INVITATION_ALREADY_ACCEPTED", "ALREADY_MEMBER", "CONFLICT"],
          where,
        ).toContain(loser);

        // And the invitation is not left `pending` — a used token that still
        // reads as usable is a token somebody will try to use.
        const row = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
        expect(row.status, where).not.toBe("pending");

        expectOneEvent("org.invitation.accepted", where);
      });
    }
  }, 600_000);

  // ── I-C-03 · two invitations for one email ───────────────────────────────

  it(`I-C-03 · the same email invited twice at once — 409, never a unique violation (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner" });
        const email = `q3-ic03-${r}-${Date.now()}@shop.test`;

        const body = { email, roleId: org.roles.Staff.id };
        const [a, b] = await Promise.all([
          post("I-C-03", `/orgs/${org.id}/invitations`, people.owner.accessToken, body),
          post("I-C-03", `/orgs/${org.id}/invitations`, people.owner.accessToken, body),
        ]);

        const where = `round ${r}: statuses ${statusesOf(a, b)} codes ${codesOf(a, b)}`;

        expect(statusesOf(a, b).filter((s) => s === 201), where).toHaveLength(1);
        // A raw unique-constraint violation would surface as a 500 — which
        // rule 1 already forbids — so what this pins is that the refusal is
        // the one the client was promised, and can act on.
        const loserCode = codesOf(a, b).find(Boolean);
        expect(["INVITATION_PENDING", "CONFLICT"], where).toContain(loserCode);

        const pending = await prisma.invitation.count({
          where: { organizationId: org.id, email, status: "pending" },
        });
        expect(pending, where).toBe(1);

        expectOneEvent("org.invitation.created", where);
      });
    }
  }, 600_000);

  // ── I-C-04 · revoke ‖ accept ─────────────────────────────────────────────

  it(`I-C-04 · a pending invitation for somebody being revoked — never both (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner", target: "Staff" });
        // The invitation was issued BEFORE the revoke — the I-1 shape.
        const invitation = await kit.createInvitation({
          organizationId: org.id,
          email: people.target.email,
          roleId: org.roles.Admin.id,
          tokenIssuedAt: new Date(Date.now() - 60_000),
        });

        const [revoke, accept] = await Promise.all([
          del("I-C-04", `/orgs/${org.id}/members/${people.target.id}`, people.owner.accessToken),
          post("I-C-04", "/invitations/accept", people.target.accessToken, {
            token: invitation.rawToken,
          }),
        ]);

        const where = `round ${r}: statuses ${statusesOf(revoke, accept)} codes ${codesOf(revoke, accept)}`;

        const membership = await prisma.membership.findFirstOrThrow({
          where: { organizationId: org.id, userId: people.target.id },
        });

        // ⛔ THE OUTCOME THAT MUST NOT EXIST: removed, and back in through the
        // invitation that predates the removal.
        if (revoke.status === 200) {
          expect(membership.status, `${where}: revoked, then let straight back in`).toBe("revoked");
          expect([403, 409], where).toContain(accept.status);
          // Four refusals are all correct here, and WHICH one depends on how far
          // the accept got before the revoke committed:
          //   revoke committed first → the invitation predates the revocation
          //                            → INVITATION_SUPERSEDED (I-1), or
          //                              CANCELLED once the revoke cascaded, or
          //                              ORG_ACCESS_DENIED at the guard;
          //   accept read first      → the person was still an ACTIVE member
          //                            → ALREADY_MEMBER (I-9).
          // The last one is what this assertion missed on its first real run.
          // Note what is NOT on the list: a 200. The invariant above is the
          // point — refused is refused, and the row ends `revoked`.
          expect(
            [
              "INVITATION_SUPERSEDED",
              "INVITATION_CANCELLED",
              "ALREADY_MEMBER",
              "CONFLICT",
              "ORG_ACCESS_DENIED",
            ],
            where,
          ).toContain(codesOf(accept)[0]);
        } else {
          // Accept won the lock; the revoke then applies to the membership it
          // just re-activated, and the row ends `revoked` either way.
          expect(membership.status, where).toBe("revoked");
        }
      });
    }
  }, 600_000);

  // ── I-C-05 · reissue ‖ accept with the pre-rotation token ────────────────

  it(`I-C-05 · a rotated link kills the old token — never two live tokens (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner" });
        const guest = await person();
        const invitation = await kit.createInvitation({
          organizationId: org.id,
          email: guest.email,
          roleId: org.roles.Staff.id,
        });

        const [reissue, accept] = await Promise.all([
          post(
            "I-C-05",
            `/orgs/${org.id}/invitations/${invitation.id}/link`,
            people.owner.accessToken,
            {},
          ),
          post("I-C-05", "/invitations/accept", guest.accessToken, { token: invitation.rawToken }),
        ]);

        const where = `round ${r}: statuses ${statusesOf(reissue, accept)} codes ${codesOf(reissue, accept)}`;

        if (reissue.status === 200 || reissue.status === 201) {
          const newToken = reissue.body?.token as string | undefined;
          expect(newToken, where).toBeTruthy();
          expect(newToken, `${where}: the reissued token is the old one`).not.toBe(
            invitation.rawToken,
          );

          if (accept.status !== 200) {
            // The old token lost the race and is dead. D-027 is the whole
            // point: reissuing INVALIDATES, it does not add a second key.
            expect([404, 409], where).toContain(accept.status);
            const retry = await post("I-C-05", "/invitations/accept", guest.accessToken, {
              token: invitation.rawToken,
            });
            assertErrorEnvelope(retry, { status: 404, code: "INVITATION_INVALID" });
          }
        }

        // Whatever the order, one membership at most.
        const rows = await prisma.membership.count({
          where: { organizationId: org.id, userId: guest.id },
        });
        expect(rows, where).toBeLessThanOrEqual(1);
      });
    }
  }, 600_000);

  // ── I-C-06 · cancel ‖ accept ─────────────────────────────────────────────

  it(`I-C-06 · no membership is created after a cancel commits (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner" });
        const guest = await person();
        const invitation = await kit.createInvitation({
          organizationId: org.id,
          email: guest.email,
          roleId: org.roles.Staff.id,
        });

        const [cancel, accept] = await Promise.all([
          del(
            "I-C-06",
            `/orgs/${org.id}/invitations/${invitation.id}`,
            people.owner.accessToken,
          ),
          post("I-C-06", "/invitations/accept", guest.accessToken, { token: invitation.rawToken }),
        ]);

        const where = `round ${r}: statuses ${statusesOf(cancel, accept)} codes ${codesOf(cancel, accept)}`;
        const row = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
        const memberships = await prisma.membership.count({
          where: { organizationId: org.id, userId: guest.id },
        });

        if (row.status === "cancelled") {
          // Cancel won: nobody joined on a cancelled invitation.
          expect(memberships, `${where}: joined on a cancelled invitation`).toBe(0);
          expect(accept.status, where).not.toBe(200);
        } else {
          expect(row.status, where).toBe("accepted");
          expect(memberships, where).toBe(1);
        }
      });
    }
  }, 600_000);

  // ── I-C-07 · PATCH ‖ DELETE on one target ────────────────────────────────

  it(`I-C-07 · no role change survives a revoke unrecorded (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner", target: "Staff" });

        const [change, remove] = await Promise.all([
          patch("I-C-07", `/orgs/${org.id}/members/${people.target.id}`, people.owner.accessToken, {
            roleId: org.roles.Admin.id,
          }),
          del("I-C-07", `/orgs/${org.id}/members/${people.target.id}`, people.owner.accessToken),
        ]);

        const where = `round ${r}: statuses ${statusesOf(change, remove)} codes ${codesOf(change, remove)}`;
        const row = await prisma.membership.findFirstOrThrow({
          where: { organizationId: org.id, userId: people.target.id },
        });

        for (const res of [change, remove]) expect([200, 404, 409], where).toContain(res.status);

        if (remove.status === 200) {
          expect(row.status, where).toBe("revoked");
          // The state is CONSISTENT: if the role changed too, it changed
          // before the revoke and both are on the row — never a revoked row
          // carrying a role nobody recorded granting.
          if (change.status === 200) {
            expect(row.roleId, where).toBe(org.roles.Admin.id);
            expect(events.types(), where).toContain("org.member.role_changed");
          }
          expect(events.types(), where).toContain("org.member.revoked");
        }
      });
    }
  }, 600_000);

  // ── I-C-08 · two promotions to Owner ─────────────────────────────────────

  it(`I-C-08 · two people promoted to Owner at once — no lost update (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner", x: "Staff", y: "Staff" });

        const [a, b] = await Promise.all([
          patch("I-C-08", `/orgs/${org.id}/members/${people.x.id}`, people.owner.accessToken, {
            roleId: org.roles.Owner.id,
          }),
          patch("I-C-08", `/orgs/${org.id}/members/${people.y.id}`, people.owner.accessToken, {
            roleId: org.roles.Owner.id,
          }),
        ]);

        const where = `round ${r}: statuses ${statusesOf(a, b)} codes ${codesOf(a, b)}`;

        // Nothing here breaks an invariant, so BOTH must succeed. A 409 would
        // mean the lock is refusing work it has no reason to refuse.
        expect(statusesOf(a, b), where).toEqual([200, 200]);
        expect(await activeOwnerCount(org.id), `${where}: a promotion was lost`).toBe(3);
        expect(events.ofType("org.member.role_changed"), where).toHaveLength(2);
      });
    }
  }, 600_000);

  // ── I-C-10 · revoke ‖ revoke ─────────────────────────────────────────────

  it(`I-C-10 · the same member revoked twice at once — 404, never 500 (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner", target: "Staff" });
        const path = `/orgs/${org.id}/members/${people.target.id}`;

        const [a, b] = await Promise.all([
          del("I-C-10", path, people.owner.accessToken),
          del("I-C-10", path, people.owner.accessToken),
        ]);

        const where = `round ${r}: statuses ${statusesOf(a, b)} codes ${codesOf(a, b)}`;

        expect(statusesOf(a, b).filter((s) => s === 200), where).toHaveLength(1);
        const loser = statusesOf(a, b).find((s) => s !== 200)!;
        expect([404, 409], where).toContain(loser);

        const row = await prisma.membership.findFirstOrThrow({
          where: { organizationId: org.id, userId: people.target.id },
        });
        expect(row.status, where).toBe("revoked");
        expect(row.revokedAt, where).not.toBeNull();

        // Rule 3: one removal, one event — not two for one revocation.
        expectOneEvent("org.member.revoked", where);
      });
    }
  }, 600_000);

  // ── I-C-11 · leave ‖ revoke, same person (D-029) ─────────────────────────

  it(`I-C-11 · leaving while being removed — one revocation, ONE event (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ owner: "Owner", target: "Staff" });

        const [leave, remove] = await Promise.all([
          del("I-C-11", `/orgs/${org.id}/membership`, people.target.accessToken),
          del("I-C-11", `/orgs/${org.id}/members/${people.target.id}`, people.owner.accessToken),
        ]);

        const where = `round ${r}: statuses ${statusesOf(leave, remove)} codes ${codesOf(leave, remove)}`;

        expect(statusesOf(leave, remove).filter((s) => s === 200), where).toHaveLength(1);
        const loser = statusesOf(leave, remove).find((s) => s !== 200)!;
        expect([403, 404, 409], where).toContain(loser);

        const row = await prisma.membership.findFirstOrThrow({
          where: { organizationId: org.id, userId: people.target.id },
        });
        expect(row.status, where).toBe("revoked");

        // ⛔ The audit failure this case exists for: ONE person left the shop
        // once. Two events — `member.left` AND `member.revoked` — would be a
        // record of something that did not happen, and no status code can see
        // it.
        const departures = events
          .types()
          .filter((t) => t === "org.member.left" || t === "org.member.revoked");
        expect(departures, `${where}: ${departures.join(",")}`).toHaveLength(1);

        // And the read side agrees, whichever way the race went (api-spec
        // §3.9/§3.17: the shop leaves `/me/organizations` at once). A row that
        // is `revoked` in the table but still listed is the state the mobile
        // picker would happily walk somebody back into.
        const mine = await get("I-C-11", "/me/organizations", people.target.accessToken);
        const listed = (mine.body?.items ?? []) as { organization: { id: string } }[];
        expect(
          listed.map((i) => i.organization.id),
          `${where}: the shop they just left is still in their list`,
        ).not.toContain(org.id);
      });
    }
  }, 600_000);

  // ── I-C-12 · both Owners leave at once (D-029) ───────────────────────────

  it(`I-C-12 · the two Owners leaving together — the shop keeps one (${ROUNDS} rounds)`, async () => {
    for (let r = 0; r < ROUNDS; r++) {
      await round(async () => {
        const { org, people } = await shop({ a: "Owner", b: "Owner" });

        const [x, y] = await Promise.all([
          del("I-C-12", `/orgs/${org.id}/membership`, people.a.accessToken),
          del("I-C-12", `/orgs/${org.id}/membership`, people.b.accessToken),
        ]);

        const where = `round ${r}: statuses ${statusesOf(x, y)} codes ${codesOf(x, y)}`;

        // D-029 opened a NEW way for a shop to lock itself out: two Owners
        // leaving at the same time. `DELETE …/membership` has to take the same
        // anchor as `DELETE …/members/{userId}` or this is how a shop ends up
        // with nobody who can administer it.
        expect(await activeOwnerCount(org.id), `${where}: the shop was left ownerless`).toBe(1);
        expect(statusesOf(x, y).filter((s) => s === 200), where).toHaveLength(1);
        expect(codesOf(x, y).find(Boolean), where).toBe("LAST_OWNER");
        expectOneEvent("org.member.left", where);
      });
    }
  }, 600_000);

  // ── I-C-09 · two shops created at the cap ────────────────────────────────

  describe("I-C-09 · the org cap under a parallel create", () => {
    let capped: TestApp;
    const previousCap = process.env.MAX_ORGS_PER_USER;

    beforeAll(async () => {
      // The cap's NUMBER is not what §8 is about — the overshoot BOUND is
      // (§6.3 accepts at most one). Seeding 49 real shops per round would
      // spend minutes proving arithmetic; the env var the production factory
      // already reads gives the same race at 2, which is the same allowance
      // I-C-13 is given for its timeouts.
      process.env.MAX_ORGS_PER_USER = "2";
      capped = await createTestApp();
    });

    afterAll(async () => {
      if (capped) await capped.close();
      if (previousCap === undefined) delete process.env.MAX_ORGS_PER_USER;
      else process.env.MAX_ORGS_PER_USER = previousCap;
    });

    it(`overshoots by at most one, and never 500s (${ROUNDS} rounds)`, async () => {
      const cap = 2;
      for (let r = 0; r < ROUNDS; r++) {
        const creator = await person();
        const create = (name: string) =>
          fire(
            "I-C-09",
            request(capped.server())
              .post("/organizations")
              .set("Authorization", `Bearer ${creator.accessToken}`)
              .set("Content-Type", "application/json")
              .send({ name }),
          );

        // One below the cap, then two at once.
        const first = await create(`q3-ic09-${r}-a`);
        expect(first.status).toBe(201);
        const [b, c] = await Promise.all([create(`q3-ic09-${r}-b`), create(`q3-ic09-${r}-c`)]);

        const where = `round ${r}: statuses ${statusesOf(first, b, c)} codes ${codesOf(b, c)}`;
        const owned = await prisma.organization.count({ where: { createdByUserId: creator.id } });

        // The documented bound, and the reason it is a bound and not an
        // equality: two requests may both read a count below the cap before
        // either commits, and §6.3 accepts exactly that one-shop overshoot
        // rather than serialising every creation in the system.
        expect(owned, `${where}: created ${owned} shops against a cap of ${cap}`).toBeLessThanOrEqual(
          cap + 1,
        );
        expect(owned, where).toBeGreaterThanOrEqual(cap);

        for (const res of [b, c]) {
          expect([201, 409], where).toContain(res.status);
          if (res.status === 409) expect(codesOf(res)[0], where).toBe("ORG_LIMIT_REACHED");
        }

        // Clean up this round's shops through the same kit bookkeeping the
        // rest of the suite uses, so `cleanup()` still deletes exactly what
        // this file made.
        const ids = await prisma.organization.findMany({
          where: { createdByUserId: creator.id },
          select: { id: true },
        });
        await prisma.warehouse.deleteMany({ where: { organizationId: { in: ids.map((o) => o.id) } } });
        await prisma.orgEntitlement.deleteMany({
          where: { organizationId: { in: ids.map((o) => o.id) } },
        });
        await prisma.membership.deleteMany({ where: { organizationId: { in: ids.map((o) => o.id) } } });
        await prisma.role.deleteMany({ where: { organizationId: { in: ids.map((o) => o.id) } } });
        await prisma.organization.deleteMany({ where: { id: { in: ids.map((o) => o.id) } } });
      }
    }, 600_000);
  });

  // ── I-C-13 · a held lock ‖ an ordinary request (NEW-4) ───────────────────

  describe("I-C-13 · lock contention is a 409, and only for that shop", () => {
    let holder: PrismaClient;

    beforeAll(async () => {
      // Its own pool: the holder must not compete for the app's connections,
      // or "the request waited" would be a statement about the pool.
      holder = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
      await holder.$connect();
    });

    afterAll(async () => {
      if (holder) await holder.$disconnect();
    });

    it(
      `answers busy, leaves the row untouched, emits nothing, and recovers (${LOCK_ROUNDS} rounds)`,
      async () => {
        for (let r = 0; r < LOCK_ROUNDS; r++) {
          await round(async () => {
            const held = await shop({ owner: "Owner", target: "Staff" });
            const control = await shop({ owner: "Owner", target: "Staff" });

            const before = await prisma.membership.findFirstOrThrow({
              where: { organizationId: held.org.id, userId: held.people.target.id },
            });

            let release!: () => void;
            const untilReleased = new Promise<void>((resolve) => (release = resolve));
            let acquired!: () => void;
            const untilAcquired = new Promise<void>((resolve) => (acquired = resolve));

            const holding = holder.$transaction(
              async (tx) => {
                await tx.$queryRawUnsafe(
                  'SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE',
                  held.org.id,
                );
                acquired();
                await untilReleased;
              },
              { timeout: 60_000, maxWait: 5_000 },
            );

            await untilAcquired;
            try {
              const started = Date.now();
              const blocked = await patch(
                "I-C-13",
                `/orgs/${held.org.id}/members/${held.people.target.id}`,
                held.people.owner.accessToken,
                { roleId: held.org.roles.Admin.id },
              );
              const elapsed = Date.now() - started;
              const where = `round ${r}`;

              // (a) the answer, and nothing of the database's vocabulary in it
              // — `fire()` already checked the SQLSTATEs on the wire.
              assertErrorEnvelope(blocked, { status: 409, code: "CONFLICT" });
              expect(blocked.body.error.details, where).toEqual({ reason: "busy" });
              expect(JSON.stringify(blocked.body), where).not.toContain("Organization");

              // (b) it gave up on POLICY, not by hanging.
              expect(elapsed, where).toBeLessThan(ORG_TX_TIMEOUTS.lockTimeoutMs + 2_500);
              // and (b') the envelope is still a normal one (I-06).
              expect(blocked.body.error.traceId, where).toBeTruthy();

              // (c) a transaction that timed out wrote NOTHING — not half a row.
              const after = await prisma.membership.findFirstOrThrow({
                where: { organizationId: held.org.id, userId: held.people.target.id },
              });
              expect(after, where).toEqual(before);

              // (d) and left no audit trail: the action did not happen.
              expectNoEventOfTypes(["org.member.role_changed", "org.member.revoked"], where);

              // (e) THE CONTROL — this is the case's real subject. NEW-4 is a
              // noisy-neighbour risk, not an error-mapping detail: another
              // tenant must be untouched while that row is held.
              const other = await patch(
                "I-C-13",
                `/orgs/${control.org.id}/members/${control.people.target.id}`,
                control.people.owner.accessToken,
                { roleId: control.org.roles.Admin.id },
              );
              expect(other.status, `${where}: another shop was blocked by this shop's lock`).toBe(
                200,
              );
            } finally {
              release();
              await holding;
            }

            // (f) nothing is stuck: the next request on that shop succeeds.
            const recovered = await patch(
              "I-C-13",
              `/orgs/${held.org.id}/members/${held.people.target.id}`,
              held.people.owner.accessToken,
              { roleId: held.org.roles.Admin.id },
            );
            expect(recovered.status, `round ${r}: the shop never recovered`).toBe(200);
          });
        }
      },
      LOCK_ROUNDS * (ORG_TX_TIMEOUTS.lockTimeoutMs + 60_000),
    );
  });

  // ── the suite's own non-vacuity ──────────────────────────────────────────

  it("the suite actually fired the races it claims to have run", async () => {
    // Without this, a file whose cases all silently no-op would satisfy every
    // rule above — the same failure the review found six times over: a gate
    // that cannot go red.
    const byCase = new Map<string, number>();
    for (const f of fired) byCase.set(f.caseId, (byCase.get(f.caseId) ?? 0) + 1);

    for (const caseId of [
      "I-C-01",
      "I-C-02",
      "I-C-03",
      "I-C-04",
      "I-C-05",
      "I-C-06",
      "I-C-07",
      "I-C-08",
      "I-C-09",
      "I-C-10",
      "I-C-11",
      "I-C-12",
      "I-C-13",
    ]) {
      expect(byCase.get(caseId) ?? 0, `${caseId} produced no requests at all`).toBeGreaterThan(0);
    }
  });
});
