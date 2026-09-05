// F-002 · T-002-22 ★ — the cross-org leak kit (test-plan Q10 · ★1 tenant
// isolation · golden rule 3).
//
// THE POINT
// "Every domain query filters organizationId" is a claim. This turns it into
// something CHECKABLE: given two organizations, it produces callers whose
// membership situation differs in exactly the ways that matter, then fires the
// same request as each of them and inspects all the answers TOGETHER. The bugs
// it hunts are invisible one response at a time — "the outsider got a 404 while
// the stranger got a 403" is only a leak when you hold both up next to each
// other.
//
// THE FOUR PERSONAS
//   activeInAOnly  active member of A, nothing in B  → the control. Must SUCCEED
//                  on A (otherwise "denied" proves nothing) and be denied on B.
//   activeInBoth   active in A and B                 → the persona that catches
//                  "the query filtered by *a* membership, just not this org's".
//                  A caller with no B membership can be refused by accident; one
//                  who has both can only be refused correctly.
//   revokedInA     row present, status `revoked`     → AC-5.1: the very next
//                  request is 403. The row EXISTING is what makes this different
//                  from `noMembership` — a `findFirst` without a status filter
//                  passes for the outsider and fails here.
//   noMembership   no membership anywhere            → the stranger. Its answer
//                  must be byte-identical to "that org does not exist", or the
//                  endpoint is an org-existence oracle (I-8).
//
// A FIFTH is available on request: `underprivilegedInA` (active member, role
// without the capability). It is what proves `FORBIDDEN` and `ORG_ACCESS_DENIED`
// have not been merged (I-5) — qa's added persona in test-plan Q10 — and is
// opt-in because a route with no capability requirement has no use for it.
//
// WHAT MAKES THE VERDICT NON-VACUOUS
// `auditSweep` fails a sweep that contains no successful outcome at all. An
// endpoint that is broken for everyone would otherwise satisfy every isolation
// rule perfectly.
import type { Server } from "node:http";
import request from "supertest";
import { AccessTokenService } from "../src/auth/access-token.service";
import type { INestApplication } from "@nestjs/common";
import {
  assertNoForeignValues,
  assertNoSecretFields,
  findFieldPaths,
  normalizeErrorBody,
  traceIdOf,
  type HttpResponseLike,
} from "./assertions.kit";
import { isTaxIdAllowedOnRoute, isTokenAllowedOnRoute } from "../src/common/authz";
import { createSeedKit, type SeedKit, type SeedPrismaClient, type SeededOrg } from "./f002-seed.kit";

/** The org an outcome was addressed to. */
export type TargetOrg = "A" | "B" | "nonexistent";

export type LeakPersonaKey =
  | "activeInAOnly"
  | "activeInBoth"
  | "revokedInA"
  | "noMembership"
  | "underprivilegedInA";

export interface LeakPersona {
  readonly key: LeakPersonaKey;
  readonly label: string;
  readonly userId: string;
  readonly email: string;
  readonly accessToken: string;
  /** Active membership in org A? */
  readonly activeInA: boolean;
  /** Active membership in org B? */
  readonly activeInB: boolean;
  /** Capabilities of this persona's role in A (empty when not a member). */
  readonly capabilitiesInA: readonly string[];
}

export interface SweepOutcome {
  readonly persona: LeakPersonaKey;
  readonly target: TargetOrg;
  /** Is this persona an ACTIVE member of the org this request addressed? */
  readonly memberOfTarget: boolean;
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /** The route, for a readable failure message. */
  readonly route: string;
}

export interface LeakFinding {
  readonly kind:
    | "leaked-to-outsider"
    | "tin-on-disallowed-route"
    | "token-on-disallowed-route"
    | "wrong-denial-code"
    | "member-denied"
    | "existence-oracle"
    | "shared-trace-id"
    | "secret-in-body"
    | "foreign-email"
    | "vacuous-sweep";
  readonly message: string;
}

/** The code every "you are not an active member of this org" answer must use. */
export const ORG_DENIAL_CODE = "ORG_ACCESS_DENIED";
/** The code a member who lacks a capability must get instead (I-5). */
export const CAPABILITY_DENIAL_CODE = "FORBIDDEN";

// ── audit ───────────────────────────────────────────────────────────────────

function codeOf(body: unknown): string | undefined {
  const code = (body as { error?: { code?: unknown } } | null | undefined)?.error?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Turn a set of outcomes into findings. PURE — takes outcomes, not an app — so
 * the meta-test can hand it the exact leak a real endpoint might produce
 * without having to write a leaking endpoint first.
 */
export function auditSweep(
  outcomes: readonly SweepOutcome[],
  options: {
    readonly foreignValues?: readonly string[];
    /**
     * ★ A-5 — the SEEDED tax ids of the orgs under sweep.
     *
     * `TAX_ID_RESPONSE_ALLOWLIST` claims exactly one route may put a full TIN
     * on the wire, and the test named after that claim only ever compared the
     * TABLE with the ROUTER — it never looked at a response body. So a mapper
     * that started emitting `taxId` would have satisfied every gate.
     *
     * Compared against the seeded VALUES rather than a 13-digit regex: a regex
     * matches epoch millis, which is exactly the flakiness this suite already
     * hit once (a `traceId` containing a 4-digit window).
     */
    readonly taxIds?: readonly string[];
  } = {},
): LeakFinding[] {
  const findings: LeakFinding[] = [];
  const push = (kind: LeakFinding["kind"], message: string): void => {
    findings.push({ kind, message });
  };

  if (outcomes.length === 0) {
    push("vacuous-sweep", "the sweep produced no outcomes at all — it proves nothing");
    return findings;
  }

  const succeeded = outcomes.filter((o) => o.status >= 200 && o.status < 300);
  if (succeeded.length === 0) {
    push(
      "vacuous-sweep",
      `no persona succeeded on any target (statuses: ${outcomes.map((o) => `${o.persona}/${o.target}=${o.status}`).join(", ")}). ` +
        `An endpoint that is broken for EVERYONE satisfies every isolation rule; ` +
        `the sweep needs at least one control that works.`,
    );
  }

  for (const o of outcomes) {
    const where = `${o.persona} → ${o.target} (${o.route})`;

    if (!o.memberOfTarget) {
      if (o.status >= 200 && o.status < 300) {
        push(
          "leaked-to-outsider",
          `${where}: answered ${o.status} to a caller with NO active membership in the ` +
            `target org — this is a cross-tenant read/write (golden rule 3).`,
        );
        // ⛔ Do NOT `continue` here. The body of a request that should never have
        // been served is the MOST likely place to find a secret or somebody
        // else's email — skipping the scans below would report the smaller half
        // of the incident and hide the part that says what actually escaped.
      } else {
        const code = codeOf(o.body);
        if (o.status !== 403 || code !== ORG_DENIAL_CODE) {
          push(
            "wrong-denial-code",
            `${where}: expected 403 ${ORG_DENIAL_CODE}, got ${o.status} ${String(code)}. ` +
              `A different status/code for a non-member is an information channel: it tells ` +
              `the caller something about an org they have no relationship with (I-5/I-8).`,
          );
        }
      }
    } else if (codeOf(o.body) === ORG_DENIAL_CODE) {
      push(
        "member-denied",
        `${where}: an ACTIVE member was told ${ORG_DENIAL_CODE}. Either the membership ` +
          `lookup is wrong, or a capability refusal was mislabelled as a tenancy refusal ` +
          `(it must be ${CAPABILITY_DENIAL_CODE} — I-5).`,
      );
    }

    // Nobody, member or not, may receive a secret or somebody else's email.
    try {
      assertNoSecretFields(o.body);
    } catch (err) {
      push("secret-in-body", `${where}: ${(err as Error).message}`);
    }
    if (options.foreignValues && options.foreignValues.length > 0) {
      try {
        assertNoForeignValues(o.body, options.foreignValues);
      } catch (err) {
        push("foreign-email", `${where}: ${(err as Error).message}`);
      }
    }

    // ★ A-5 — a full TIN may appear on exactly one route (§3.16). Everywhere
    // else it is a leak, whoever the caller is: with `entityType: "personal"`
    // those thirteen digits are somebody's national ID.
    // `route` is `"GET /orgs/{orgId}"` — split rather than adding two more
    // fields to every outcome for one check.
    const [routeMethod, ...routeRest] = o.route.split(" ");
    if (
      options.taxIds &&
      options.taxIds.length > 0 &&
      !isTaxIdAllowedOnRoute(routeMethod, routeRest.join(" "))
    ) {
      const serialized = JSON.stringify(o.body ?? null);
      for (const taxId of options.taxIds) {
        if (serialized.includes(taxId)) {
          push(
            "tin-on-disallowed-route",
            `${where}: the body contains a FULL tax id, and this route is not in ` +
              `TAX_ID_RESPONSE_ALLOWLIST. The only route allowed to emit one is ` +
              `POST /orgs/{orgId}/tax-profile/reveal (api-spec §3.16).`,
          );
        }
      }
    }

    // ★ A live invitation token may appear on exactly two routes (§3.11/§3.12,
    // test-plan I-04). Everywhere else it is a leak of a BEARER CREDENTIAL:
    // whoever reads it can join the shop, and only its HMAC is stored (D-018),
    // so there is no revocation short of cancelling the invitation.
    //
    // Keyed on the field NAME, not on a value: unlike a TIN there is no seeded
    // constant to search for, and a token that leaked is by definition one the
    // test never saw. `token` exactly (case-insensitive) — `tokenIssuedAt` and
    // `tokenHash` are different questions (`tokenHash` is already forbidden
    // everywhere by FORBIDDEN_RESPONSE_FIELDS).
    if (!isTokenAllowedOnRoute(routeMethod, routeRest.join(" "))) {
      const hits = findFieldPaths(o.body, "token");
      if (hits.length > 0) {
        push(
          "token-on-disallowed-route",
          `${where}: the body carries \`token\` at ${hits.join(", ")}, and this route is not ` +
            `in TOKEN_RESPONSE_ALLOWLIST. Exactly two routes may mint an invitation link — ` +
            `POST /orgs/{orgId}/invitations and POST /orgs/{orgId}/invitations/{invitationId}/link ` +
            `(api-spec §3.11/§3.12). A token on any other response is a bearer credential ` +
            `handed to whoever asked.`,
        );
      }
    }
  }

  // I-8 — "not your org" and "no such org" must be indistinguishable.
  const stranger = outcomes.find((o) => o.persona === "noMembership" && o.target === "A");
  const ghost = outcomes.find((o) => o.target === "nonexistent");
  if (stranger && ghost) {
    if (stranger.status !== ghost.status) {
      push(
        "existence-oracle",
        `a stranger asking about a REAL org got ${stranger.status} while asking about a ` +
          `NON-EXISTENT one got ${ghost.status} — the difference answers "does this shop exist?".`,
      );
    } else {
      try {
        const a = JSON.stringify(normalizeErrorBody(stranger.body));
        const b = JSON.stringify(normalizeErrorBody(ghost.body));
        if (a !== b) {
          push("existence-oracle", `real-org denial and no-such-org denial differ:\n  ${a}\n  ${b}`);
        }
      } catch (err) {
        push("existence-oracle", `denial bodies could not be compared: ${(err as Error).message}`);
      }
      const ta = traceIdOf(stranger.body);
      const tb = traceIdOf(ghost.body);
      if (ta !== undefined && ta === tb) {
        push(
          "shared-trace-id",
          `two different requests carry the SAME traceId (${ta}) — it is derived from the ` +
            `request instead of being random per response (NEW-7).`,
        );
      }
    }
  }

  return findings;
}

/** Throw one readable error listing every finding, or return silently. */
export function assertNoCrossOrgLeak(
  outcomes: readonly SweepOutcome[],
  options: {
    readonly foreignValues?: readonly string[];
    readonly taxIds?: readonly string[];
  } = {},
): void {
  const findings = auditSweep(outcomes, options);
  if (findings.length === 0) return;
  throw new Error(
    `cross-org sweep found ${findings.length} problem(s):\n` +
      findings.map((f) => `  [${f.kind}] ${f.message}`).join("\n"),
  );
}

// ── the kit ─────────────────────────────────────────────────────────────────

export interface SweepRequest {
  readonly method: "get" | "post" | "patch" | "put" | "delete" | "head";
  /** api-spec dialect: `/orgs/{orgId}/members`. `{orgId}` is substituted. */
  readonly path: string;
  readonly body?: unknown;
  /** Targets to fire at. Default: A, B and a non-existent org. */
  readonly targets?: readonly TargetOrg[];
}

export interface OrgLeakKit {
  readonly orgA: SeededOrg;
  readonly orgB: SeededOrg;
  readonly personas: readonly LeakPersona[];
  persona(key: LeakPersonaKey): LeakPersona;
  /** Every persona's email except `except`'s — the "somebody else's PII" set. */
  foreignEmails(except: LeakPersonaKey): string[];
  /** ★ A-5 — the seeded tax ids, for the TIN rule in `auditSweep`. */
  readonly taxIds: readonly string[];
  sweep(req: SweepRequest): Promise<SweepOutcome[]>;
  cleanup(): Promise<void>;
}

export interface OrgLeakKitOptions {
  /** Give `activeInAOnly`/`activeInBoth` this role in A. Default `Owner`. */
  readonly roleInA?: string;
  /** Also build the `underprivilegedInA` persona (role `Staff`). Default false. */
  readonly withUnderprivileged?: boolean;
  /** Id used for the "no such org" control. Must not exist. */
  readonly nonexistentOrgId?: string;
}

/**
 * Build the two orgs, the personas and their tokens.
 *
 * Tokens are minted with the PRODUCTION `AccessTokenService` rather than by
 * logging in over HTTP: a login is rate-limited per IP, and four personas × N
 * routes would spend the suite's budget on the throttle instead of on tenancy.
 * The token that comes out is the same token `POST /auth/login` returns — same
 * service, same secret, same pinned alg/typ.
 */
export async function createOrgLeakKit(
  app: INestApplication,
  prisma: SeedPrismaClient,
  options: OrgLeakKitOptions = {},
): Promise<OrgLeakKit> {
  const tokens = app.get(AccessTokenService, { strict: false });
  const kit: SeedKit = createSeedKit(prisma, { label: "leak" });
  const roleInA = options.roleInA ?? "Owner";
  const nonexistentOrgId = options.nonexistentOrgId ?? "org-does-not-exist-000000000";

  const orgA = await kit.createOrg({ name: `leak-A-${Date.now().toString(36)}` });
  const orgB = await kit.createOrg({ name: `leak-B-${Date.now().toString(36)}` });

  // ★ A-5 — both orgs DECLARE a tax id, so the sweep has something to look for.
  // Without this the TIN rule below would pass by finding nothing on every
  // route, which is the vacuity this whole kit is built to refuse.
  //
  // Distinct per run and per org: a shared constant would make "org A's TIN
  // appeared in org B's response" indistinguishable from "the value is the
  // same everywhere".
  const stamp = Date.now().toString().slice(-6);
  const taxIds = Object.freeze({
    A: `1${stamp}00001`.padEnd(13, "0").slice(0, 13),
    B: `2${stamp}00002`.padEnd(13, "0").slice(0, 13),
  });
  await prisma.organization.update({
    where: { id: orgA.id },
    data: { taxId: taxIds.A, vatRegistered: true },
  });
  await prisma.organization.update({
    where: { id: orgB.id },
    data: { taxId: taxIds.B, vatRegistered: false },
  });

  const personas: LeakPersona[] = [];

  async function persona(
    key: LeakPersonaKey,
    label: string,
    setup: (userId: string) => Promise<{ activeInA: boolean; activeInB: boolean; caps: readonly string[] }>,
  ): Promise<void> {
    const user = await kit.createUser({ email: `leak-${key}-${Date.now().toString(36)}@seed.test` });
    const state = await setup(user.id);
    personas.push({
      key,
      label,
      userId: user.id,
      email: user.email,
      accessToken: tokens.sign(user.id),
      activeInA: state.activeInA,
      activeInB: state.activeInB,
      capabilitiesInA: state.caps,
    });
  }

  await persona("activeInAOnly", "active member of A only", async (userId) => {
    const role = orgA.roles[roleInA];
    await kit.addMember({ organizationId: orgA.id, userId, roleId: role.id });
    return { activeInA: true, activeInB: false, caps: role.capabilities };
  });

  await persona("activeInBoth", "active member of A and B", async (userId) => {
    const role = orgA.roles[roleInA];
    await kit.addMember({ organizationId: orgA.id, userId, roleId: role.id });
    await kit.addMember({ organizationId: orgB.id, userId, roleId: orgB.roles[roleInA].id });
    return { activeInA: true, activeInB: true, caps: role.capabilities };
  });

  await persona("revokedInA", "revoked member of A", async (userId) => {
    const now = new Date();
    await kit.addMember({
      organizationId: orgA.id,
      userId,
      roleId: orgA.roles[roleInA].id,
      status: "revoked",
      activatedAt: new Date(now.getTime() - 86_400_000),
      revokedAt: now,
    });
    return { activeInA: false, activeInB: false, caps: [] };
  });

  await persona("noMembership", "no membership anywhere", async () => ({
    activeInA: false,
    activeInB: false,
    caps: [],
  }));

  if (options.withUnderprivileged) {
    await persona("underprivilegedInA", "active member of A without the capability", async (userId) => {
      const role = orgA.roles.Staff;
      await kit.addMember({ organizationId: orgA.id, userId, roleId: role.id });
      return { activeInA: true, activeInB: false, caps: role.capabilities };
    });
  }

  function orgIdFor(target: TargetOrg): string {
    if (target === "A") return orgA.id;
    if (target === "B") return orgB.id;
    return nonexistentOrgId;
  }

  function memberOf(p: LeakPersona, target: TargetOrg): boolean {
    if (target === "A") return p.activeInA;
    if (target === "B") return p.activeInB;
    return false;
  }

  async function sweep(req: SweepRequest): Promise<SweepOutcome[]> {
    const targets = req.targets ?? (["A", "B", "nonexistent"] as const);
    const server = app.getHttpServer() as Server;
    const outcomes: SweepOutcome[] = [];

    for (const target of targets) {
      const orgId = orgIdFor(target);
      const path = req.path.replace("{orgId}", encodeURIComponent(orgId));
      for (const p of personas) {
        // `activeInBoth` calling B is a legitimate success, not a sweep subject:
        // the sweep asks "may THIS caller reach THIS org", and it must, so it
        // is included and expected to pass — that is what proves the kit is not
        // simply asserting "everything is denied".
        let call = request(server)[req.method](path).set("Authorization", `Bearer ${p.accessToken}`);
        if (req.body !== undefined) call = call.set("Content-Type", "application/json").send(req.body as object);
        const res = await call;
        outcomes.push({
          persona: p.key,
          target,
          memberOfTarget: memberOf(p, target),
          status: res.status,
          body: res.body,
          headers: res.headers as Record<string, string | string[] | undefined>,
          route: `${req.method.toUpperCase()} ${req.path}`,
        });
      }
    }
    return outcomes;
  }

  return {
    orgA,
    orgB,
    personas,
    persona: (key) => {
      const found = personas.find((p) => p.key === key);
      if (!found) throw new Error(`persona ${key} was not built (see OrgLeakKitOptions)`);
      return found;
    },
    foreignEmails: (except) => personas.filter((p) => p.key !== except).map((p) => p.email),
    taxIds: [taxIds.A, taxIds.B],
    sweep,
    cleanup: () => kit.cleanup(),
  };
}

/** Narrow a supertest response to what the assertions kit reads. */
export function asResponse(outcome: SweepOutcome): HttpResponseLike {
  return { status: outcome.status, body: outcome.body, headers: outcome.headers };
}
