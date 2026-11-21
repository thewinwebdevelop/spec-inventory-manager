// F-002 · T-002-Q4 — the regression pack of test-plan §9, as data.
//
// §9 registers all 41 findings and pins each to the test that stops it coming
// back. §16 calls it the "permanent pack" (deleting a member needs a D-XXX) and
// §17.11(ก) makes it a verdict condition: "ทุกข้อมีเทสต์ หรือ มีเหตุผลเป็น
// ลายลักษณ์ — ช่องว่าง = แดง".
//
// Nothing checked any of that. The table lives in a markdown file; the tests
// live in the tree; nobody compares them. That is the same shape as the finding
// which produced NEW-1 — a rule believed closed because a document said so.
//
// ⚠️ WHAT THE GATE OVER THIS FILE CAN AND CANNOT PROVE.
//   CAN: the pinned test file still exists, and still contains the marker the
//        pack pinned it by. Delete the file, rename it, or strip the case and
//        the pack goes red.
//   CANNOT: that the test still ASSERTS the right thing. A marker is a
//        location, not a proof. Weakening an assertion inside a pinned file is
//        invisible here and is what code review is for.
// Saying so plainly, because a gate that is believed to prove more than it does
// is worse than no gate — that is the lesson this project has already learned
// six times over.

/** Where a finding's coverage lives. Paths are relative to the REPO ROOT. */
export interface Pin {
  readonly file: string;
  /** Strings that must all appear in that file. Usually the finding id. */
  readonly must: readonly string[];
}

export interface RegressionEntry {
  /** The finding id exactly as test-plan §9 writes it. */
  readonly finding: string;
  readonly title: string;
  /** §16's tier. `none` = deliberately not runnable (see [noTest]). */
  readonly tier: "smoke" | "full" | "none";
  readonly pins?: readonly Pin[];
  /**
   * Why this finding has no test — required when [pins] is absent, and the
   * exact thing §17.11(ก) refuses to let anybody leave blank.
   */
  readonly noTest?: string;
  /**
   * Present when the pins cover a COMPENSATING control rather than the finding
   * itself. Recorded so nobody reads the row as "closed".
   */
  readonly partial?: string;
  /**
   * F-003 · T-003-QA09 — tests test-plan §10 names for this row that do NOT
   * exist yet, and the task that brings them. Not a promise in prose: the gate
   * reads `docs/features/F-003/tasks.md` and goes red once `task` is `done`
   * while the row still lists it — the re-pin cannot be forgotten.
   */
  readonly pending?: readonly { readonly tests: readonly string[]; readonly task: string }[];
}

export const REGRESSION_PACK: readonly RegressionEntry[] = Object.freeze([
  // ── §9.0 — the original 29 ────────────────────────────────────────────────
  {
    finding: "C-1",
    title: "an Admin promoting themselves to Owner",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/orgs/member-authz.test.ts", must: ["C-1"] },
      { file: "apps/api/test/invitations.e2e.int.test.ts", must: ["C-1"] },
    ],
  },
  {
    finding: "C-2",
    title: "admin-reset reaching across orgs",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/orgs/admin-reset-authz.test.ts", must: ["C-2"] },
      { file: "apps/api/src/auth/auth.e2e.int.test.ts", must: ["C-2"] },
    ],
  },
  {
    finding: "C-3",
    title: "a query starting from an org-agnostic model",
    tier: "smoke",
    pins: [
      { file: "packages/db/src/org-models.test.ts", must: ["C-3"] },
      { file: "packages/db/src/tenancy.test.ts", must: ["C-3"] },
    ],
  },
  {
    finding: "C-4",
    title: "passwordHash reaching the wire",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/orgs/system/my-organizations.service.test.ts", must: ["C-4"] },
      { file: "packages/db/src/user-select.test.ts", must: ["USER_SELECT"] },
    ],
  },
  {
    finding: "I-1",
    title: "accepting an invitation issued before the revocation",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/orgs/invitation-policy.test.ts", must: ["I-1"] },
      { file: "apps/api/src/orgs/members.service.test.ts", must: ["I-1"] },
      { file: "apps/api/test/concurrency-matrix.int.test.ts", must: ["I-C-04"] },
    ],
  },
  {
    finding: "I-2",
    title: "a forgotten @RequireCapability leaking a route",
    tier: "smoke",
    pins: [{ file: "apps/api/src/common/authz/capability.guard.test.ts", must: ["I-2"] }],
  },
  {
    finding: "I-3",
    title: "org context built from a header on a user-scoped route",
    tier: "smoke",
    pins: [{ file: "apps/api/src/tenancy/org-scope.guard.test.ts", must: ["I-3"] }],
  },
  {
    finding: "I-4",
    title: "a guard trusting req.user",
    tier: "smoke",
    pins: [{ file: "apps/api/src/tenancy/org-scope.guard.test.ts", must: ["I-4"] }],
  },
  {
    finding: "I-5",
    title: "ORG_ACCESS_DENIED collapsed into FORBIDDEN",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/tenancy/org-scope.guard.test.ts", must: ["I-5"] },
      { file: "apps/mobile/test/core/error/org_failures_test.dart", must: ["ORG_ACCESS_DENIED"] },
    ],
  },
  {
    finding: "I-6",
    title: "an invitation token in a query string",
    tier: "full",
    pins: [
      { file: "apps/api/src/orgs/invitation-redemption.routes.test.ts", must: ["I-6"] },
      { file: "apps/api/src/common/log-hygiene.test.ts", must: ["I-6"] },
      { file: "apps/web/src/features/invite/invite-token.test.ts", must: ["token"] },
    ],
  },
  {
    finding: "I-7",
    title: "email binding has no basis in Phase 0",
    tier: "full",
    partial:
      "NOT closed and not claimed closed (§9.0). There is no SMTP in F-002, so the binding " +
      "itself cannot be tested; the pins below cover the four compensating controls. The real " +
      "control is email verification in F-081.",
    pins: [
      { file: "packages/core-domain/src/orgs/invitation-policy.test.ts", must: ["U-CD-03"] },
      { file: "apps/api/test/invitations.e2e.int.test.ts", must: ["I-7"] },
    ],
  },
  {
    finding: "I-8",
    title: "the tax id readable by every member",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/orgs/members.service.test.ts", must: ["I-8"] },
      { file: "apps/api/src/orgs/tax-profile.service.test.ts", must: ["TaxProfileService.reveal"] },
    ],
  },
  {
    finding: "I-9",
    title: "accept rewriting the role of an active membership",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/orgs/invitation-redemption.service.test.ts", must: ["I-9"] },
      { file: "apps/api/test/concurrency-matrix.int.test.ts", must: ["I-C-02"] },
    ],
  },
  {
    finding: "I-10",
    title: "the per-user org cap failing open",
    tier: "full",
    pins: [
      { file: "apps/api/src/orgs/system/org-provisioning.service.test.ts", must: ["I-10"] },
      { file: "apps/api/test/concurrency-matrix.int.test.ts", must: ["I-C-09"] },
    ],
  },
  {
    finding: "M-1",
    title: "tenancy/ on the SYSTEM_PRISMA allowlist, and its bounds",
    tier: "full",
    pins: [{ file: "apps/api/src/orgs/system/system-prisma-allowlist.test.ts", must: ["M-1"] }],
  },
  {
    finding: "M-2",
    title: "the owner count read outside the transaction",
    tier: "full",
    pins: [{ file: "apps/api/src/orgs/members.service.test.ts", must: ["M-2"] }],
  },
  {
    finding: "M-3",
    title: "the invitation cap counting expired rows",
    tier: "full",
    // ⚠️ §9.0 pins this to "I-27". There was no I-27 — the rule was implemented
    // and tested by nothing, which this gate found on its first run. The pair
    // of cases now in the invitations suite is what the pin points at.
    pins: [{ file: "apps/api/test/invitations.e2e.int.test.ts", must: ["M-3"] }],
  },
  {
    finding: "M-4",
    title: "logo accepted as a free-form string",
    tier: "full",
    pins: [{ file: "packages/core-domain/src/orgs/org-profile.test.ts", must: ["M-4"] }],
  },
  {
    finding: "M-5",
    title: "a new env var skipping the zod schema",
    tier: "full",
    pins: [{ file: "packages/config/src/env.test.ts", must: ["MAX_ORGS_PER_USER"] }],
  },
  {
    finding: "M-6",
    title: "a role deleted while an invitation is pending",
    tier: "full",
    pins: [{ file: "packages/core-domain/src/orgs/invitation-policy.test.ts", must: ["M-6"] }],
  },
  {
    finding: "M-7",
    title: "security events missing or ambiguous",
    tier: "full",
    pins: [{ file: "apps/api/src/auth/security-events.service.test.ts", must: ["M-7"] }],
  },
  {
    finding: "M-8",
    title: "the leak kit's persona set",
    tier: "smoke",
    pins: [{ file: "apps/api/test/org-leak.kit.int.test.ts", must: ["persona"] }],
  },
  {
    finding: "M-9",
    title: "upsert / extendedWhereUnique escaping the tenant filter",
    tier: "smoke",
    pins: [
      { file: "packages/db/src/tenancy.test.ts", must: ["M-9"] },
      { file: "packages/db/src/tenancy.db.test.ts", must: ["M-9"] },
    ],
  },
  {
    finding: "M-10",
    title: "status=all returning the short row shape",
    tier: "full",
    pins: [
      { file: "apps/api/src/orgs/system/my-organizations.service.test.ts", must: ["M-10"] },
      { file: "apps/mobile/test/features/org/data/org_repository_impl_test.dart", must: ["M-10"] },
    ],
  },
  {
    finding: "M-11",
    title: "cache headers and invitation-email retention",
    tier: "full",
    partial:
      "The headers are pinned; RETENTION is deliberately untested (§9.0) — F-002 ships no " +
      "deletion job, and a test for a job that does not exist would pass forever. Carried as a " +
      "PDPA forward-commitment.",
    pins: [{ file: "apps/api/test/response-header-policy.int.test.ts", must: ["no-store"] }],
  },
  {
    finding: "N-1",
    title: "ORG_MISMATCH classified as 422",
    tier: "full",
    pins: [{ file: "apps/api/src/tenancy/org-scope.guard.test.ts", must: ["N-1"] }],
  },
  {
    finding: "N-2",
    title: "the lock reading its org from an argument instead of the context",
    tier: "full",
    pins: [{ file: "packages/db/src/org-lock.test.ts", must: ["N-2"] }],
  },
  {
    finding: "N-3",
    title: "IPv6 addresses bucketed per address instead of per /64",
    tier: "full",
    pins: [{ file: "apps/api/src/common/client-ip.test.ts", must: ["N-3"] }],
  },
  {
    finding: "N-4",
    title: "who may read the member list",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/common/authz/route-capabilities.test.ts", must: ["N-4"] },
      { file: "apps/api/test/members.e2e.int.test.ts", must: ["N-4"] },
    ],
  },

  // ── §9.1 — the 12 from the delta review (NEW-5 has two halves) ────────────
  {
    finding: "NEW-1",
    title: "admin-reset taking over an Owner account in the same org",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/orgs/admin-reset-authz.test.ts", must: ["NEW-1"] },
      { file: "apps/api/src/auth/auth.service.test.ts", must: ["NEW-1"] },
      { file: "apps/api/src/auth/auth.e2e.int.test.ts", must: ["NEW-1"] },
    ],
  },
  {
    finding: "NEW-2",
    title: "reissuing a link without re-checking canAssignRole",
    tier: "smoke",
    pins: [{ file: "apps/api/test/invitations.e2e.int.test.ts", must: ["NEW-2"] }],
  },
  {
    finding: "NEW-3",
    title: "fail-closed not covering reads",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/common/authz/capability.guard.test.ts", must: ["NEW-3"] },
      { file: "apps/api/src/orgs/members.routes.test.ts", must: ["NEW-3"] },
      { file: "apps/api/test/members.e2e.int.test.ts", must: ["NEW-3"] },
    ],
  },
  {
    finding: "NEW-4",
    title: "no transaction / lock timeout policy",
    tier: "smoke",
    pins: [
      { file: "apps/api/src/prisma/org-busy.test.ts", must: ["U-API-21"] },
      { file: "packages/config/src/env.test.ts", must: ["NEW-4"] },
      { file: "apps/api/test/concurrency-matrix.int.test.ts", must: ["I-C-13"] },
    ],
  },
  {
    finding: "NEW-5(ก)",
    title: "TOCTOU — reads taken outside the transaction",
    tier: "smoke",
    pins: [{ file: "apps/api/src/auth/auth.service.test.ts", must: ["NEW-5"] }],
  },
  {
    finding: "NEW-5(ข)",
    title: "no forced password change after an admin reset",
    tier: "none",
    noTest:
      "The hole is OPEN, by qa's own verdict (§9.1): an Admin who resets a member's password " +
      "still knows it if that member later joins another org. There is no correct behaviour to " +
      "assert, so there is no test to write — asserting today's behaviour would pin the bug. " +
      "Carried as an openly accepted risk (§19.3 item 4) and bound to F-081, which owes the test " +
      "'a reset forces a change' at that time.",
  },
  {
    finding: "NEW-6",
    title: "data-model §3.3 contradicting api-spec on the tax id",
    tier: "smoke",
    partial:
      "Doc drift: there is no test that reads a document. What is pinned instead are the tests " +
      "that make an implementation FOLLOWING the wrong document fail immediately.",
    pins: [
      { file: "apps/api/src/orgs/tax-profile.service.test.ts", must: ["taxId"] },
      { file: "apps/api/src/orgs/org-profile.service.test.ts", must: ["taxId"] },
    ],
  },
  {
    finding: "NEW-7",
    title: "traceId format not pinned",
    tier: "smoke",
    pins: [{ file: "apps/api/src/common/domain-exception.filter.test.ts", must: ["NEW-7"] }],
  },
  {
    finding: "NEW-8",
    title: "C-3 not covering a nested read that climbs back down",
    tier: "smoke",
    pins: [
      { file: "packages/db/src/user-select.test.ts", must: ["NEW-8"] },
      { file: "packages/db/src/tenancy.db.test.ts", must: ["NEW-8"] },
    ],
  },
  {
    finding: "NEW-9",
    title: "rotating a link clearing the forensic flag",
    tier: "full",
    pins: [
      { file: "packages/core-domain/src/orgs/invitation-view.test.ts", must: ["NEW-9"] },
      { file: "apps/api/test/invitations-redeem.e2e.int.test.ts", must: ["NEW-9"] },
    ],
  },
  {
    finding: "NEW-10",
    title: "canAssignRole does not stop a privilege superset",
    // F-003 · T-003-B23/QA09 (R3-02 · G3-12): the G-15 tripwire is retired. The
    // rule exists now (⊆ on every grant — `decideMemberAuthority`/`decideRoleWrite`)
    // and so does the surface it guards (POST /roles), so the pins are the real
    // tests: U-RB-10/12, I3-20 (invite ⊄), G3-01..03 (the three layers that
    // replace G-15), I3-04/I3-17 (role create on the real DB).
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/rbac/member-authority.test.ts", must: ["U-RB-10"] },
      { file: "packages/core-domain/src/rbac/role-write.test.ts", must: ["U-RB-12"] },
      { file: "apps/api/test/invitations.f003.e2e.int.test.ts", must: ["I3-20"] },
      { file: "apps/api/src/common/authz/role-write.test.ts", must: ["G3-01"] },
      { file: "apps/api/test/f003-role-create.e2e.int.test.ts", must: ["G3-01", "I3-04", "I3-17"] },
      { file: "apps/api/test/static-gates/g3-02-validated-capabilities.test.ts", must: ["G3-02"] },
      {
        file: "apps/api/test/static-gates/g3-03-role-write-surface.test.ts",
        must: ["G3-03", "NEW-10"],
      },
    ],
    pending: [{ tests: ["I3-31"], task: "T-003-B26a" }],
  },
  {
    finding: "NEW-11",
    title: "reveal reaching Admin — confirmed deliberate (D-030(2))",
    tier: "smoke",
    pins: [{ file: "apps/api/src/orgs/tax-profile.service.test.ts", must: ["D-030"] }],
  },
  {
    finding: "NEW-12",
    title: "a dangling §20 reference inside the test plan",
    tier: "none",
    noTest:
      "A documentation nit, already fixed. The layer that would catch it is a link/anchor check " +
      "in a docs lane, which this project does not have — registered as a small request to " +
      "@devops (§19.1 item 12), not a condition of F-002's verdict.",
  },

  // ── F-003 · T-003-QA09 (G3-12 · test-plan §8/§10) — SR-F003-01..19 + the
  // three named regressions of route behaviour that already ships. Pins are the
  // tests that EXIST today; `pending` names the rest and the task that brings
  // them (the gate turns red when that task is `done` and the row was not
  // re-pinned). Markers are the test ids in the test names (test-plan §1).
  {
    finding: "SR-F003-01",
    title: "an Admin downgrading an equal Admin, resetting them, then upgrading (SR-01)",
    tier: "smoke",
    pins: [
      {
        file: "packages/core-domain/src/rbac/member-authority.test.ts",
        must: ["U-RB-10", "U-RB-21"],
      },
      {
        file: "apps/api/test/members.f003.e2e.int.test.ts",
        must: ["I3-25", "I3-26", "I3-27", "I3-28"],
      },
    ],
    pending: [{ tests: ["I3-31", "I3-32"], task: "T-003-B26a" }],
  },
  {
    finding: "SR-F003-02",
    title: "an invitation outliving its issuer's authority (D-035)",
    tier: "smoke",
    pins: [
      { file: "apps/api/test/invitations-redeem.e2e.int.test.ts", must: ["I3-38"] },
      { file: "apps/api/test/invitations.f003.e2e.int.test.ts", must: ["I3-39"] },
      { file: "apps/api/src/orgs/invitations.service.test.ts", must: ["U-API3-08", "U-API3-09"] },
    ],
    pending: [{ tests: ["IC3-06"], task: "T-003-B26b" }],
  },
  {
    finding: "SR-F003-03",
    title: "custom roles reaching F-002 instances during the rollout (ROLE_WRITES_ENABLED)",
    tier: "smoke",
    pins: [
      { file: "packages/config/src/env.test.ts", must: ["U-CFG3-01"] },
      { file: "apps/api/test/f003-role-create.e2e.int.test.ts", must: ["I3-44", "I3-45"] },
      { file: "apps/api/src/orgs/org-config.boot-env.test.ts", must: ["DV01"] },
    ],
    partial:
      "M3-07 (migration) and MAN3-05 (manual rollout check) are not code in this repo yet; the " +
      "flag's server half is pinned. The rollout evidence itself is devops' (architecture §12).",
  },
  {
    finding: "SR-F003-04",
    title: "a role name made of invisible / control characters (Cc/Cf)",
    tier: "full",
    pins: [
      { file: "packages/core-domain/src/rbac/role-validation.test.ts", must: ["U-RB-07"] },
      { file: "apps/api/test/f003-role-create.e2e.int.test.ts", must: ["I3-02"] },
      { file: "apps/api/test/role-name-charset-parity.test.ts", must: ["G3-07"] },
    ],
    partial: "M3-02 (DB CHECK under migration) is not in the repo yet — G3-07 pins the parity.",
  },
  {
    finding: "SR-F003-05",
    title: "admin-reset deciding on a roleId a concurrent PATCH is changing",
    tier: "full",
    pins: [{ file: "apps/api/test/admin-reset.f003.e2e.int.test.ts", must: ["IC3-02"] }],
  },
  {
    finding: "SR-F003-06",
    title: "delete-role ‖ invite-with-role write skew",
    tier: "full",
    pins: [{ file: "apps/api/test/role-db-guards.int.test.ts", must: ["IC3-07"] }],
  },
  {
    finding: "SR-F003-07",
    title: "promoting a custom role to isSystem / full_access in the database",
    tier: "full",
    pins: [{ file: "apps/api/test/role-db-guards.int.test.ts", must: ["I3-16"] }],
  },
  {
    finding: "SR-F003-08",
    title: "a role write authorised by the stale ALS snapshot instead of the tx",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/rbac/role-write.test.ts", must: ["U-RB-12"] },
      { file: "apps/api/src/orgs/roles.service.create.test.ts", must: ["U-API3-02"] },
    ],
    pending: [{ tests: ["IC3-03"], task: "T-003-B26b" }],
  },
  {
    finding: "SR-F003-09",
    title: "lastEdited.by leaking another shop's role",
    tier: "full",
    pins: [{ file: "apps/api/test/f003-role-reads.e2e.int.test.ts", must: ["I3-53"] }],
  },
  {
    finding: "SR-F003-10",
    title: "the admin bridge trigger outliving its removeBy date (G-12 on migrations)",
    tier: "smoke",
    pins: [{ file: "apps/api/test/static-gates/role-key-authority.gate.test.ts", must: ["G-12"] }],
    partial: "M3-05 (migration harness for the bridge) is not in the repo yet.",
  },
  {
    finding: "SR-F003-11",
    title: "an unknown / removed capability key widening instead of narrowing",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/rbac/registry.test.ts", must: ["U-RB-02"] },
      { file: "packages/core-domain/src/rbac/expand.test.ts", must: ["U-RB-03"] },
      { file: "packages/core-domain/src/rbac/member-authority.test.ts", must: ["U-RB-10"] },
    ],
  },
  {
    finding: "SR-F003-12",
    title: "unbounded role churn / event floods (caps, rate limits, dedupe)",
    tier: "full",
    pins: [
      { file: "apps/api/src/auth/security-events.service.test.ts", must: ["I3-11", "U-API3-11"] },
      { file: "apps/api/test/members.f003.e2e.int.test.ts", must: ["I3-47"] },
      { file: "packages/config/src/env.test.ts", must: ["U-CFG3-02", "U-CFG3-03"] },
      { file: "apps/api/test/f003-role-create.e2e.int.test.ts", must: ["I3-05"] },
    ],
    pending: [{ tests: ["I3-46"], task: "T-003-B25" }],
  },
  {
    finding: "SR-F003-13",
    title: "ROLE_LOCKED by a non-Owner not leaving an escalation trace",
    tier: "full",
    pins: [
      { file: "apps/api/test/f003-role-reads.e2e.int.test.ts", must: ["I3-49"] },
      // T-003-B24 — PATCH of the Owner role: ROLE_LOCKED for everyone, event only for a non-Owner.
      { file: "apps/api/test/f003-role-update.e2e.int.test.ts", must: ["I3-14"] },
      { file: "apps/api/src/orgs/roles.service.update.test.ts", must: ["SR-13"] },
    ],
  },
  {
    finding: "SR-F003-14",
    title: "a client auto-resubmitting on 409 ROLE_CHANGED (last-write-wins)",
    tier: "none",
    noTest:
      "No surface yet: 409 ROLE_CHANGED is answered by PATCH /roles/{id} (T-003-B24) and consumed " +
      "by the role form (W06/M06). CW3-05 · CM3-05 · EW3-08 · EM3-06 land there — see `pending`.",
    pending: [
      { tests: ["CW3-05", "EW3-08"], task: "T-003-W06" },
      { tests: ["CM3-05", "EM3-06"], task: "T-003-M06" },
    ],
  },
  {
    finding: "SR-F003-15",
    title: "upcoming capabilities going live silently (manage_billing)",
    tier: "none",
    noTest:
      "Handed to product (architecture §7 last bullet): the surface is the Gate 2 of the feature " +
      "that flips a capability upcoming → live. F-003 has nothing to fire a test at.",
  },
  {
    finding: "SR-F003-16",
    title: "multi-actor escalation through a sequence of individually-allowed ops",
    tier: "smoke",
    pins: [
      {
        file: "packages/core-domain/src/rbac/authority-lemma.test.ts",
        must: ["U-RB-18", "U-RB-19", "U-RB-20"],
      },
    ],
  },
  {
    finding: "SR-F003-17",
    title: "manage_roles + manage_members insiders colluding through a held role (Addendum 2)",
    tier: "smoke",
    pins: [
      { file: "packages/core-domain/src/rbac/role-write.test.ts", must: ["U-RB-12", "R13"] },
      { file: "packages/core-domain/src/rbac/authority-lemma.test.ts", must: ["U-RB-19", "c3"] },
    ],
    pending: [
      { tests: ["I3-31", "I3-33"], task: "T-003-B26a" },
      { tests: ["IC3-04"], task: "T-003-B26b" },
    ],
  },
  {
    finding: "SR-F003-18",
    title: "rename-only / no-op edits short-circuiting the held-role rule",
    tier: "full",
    pins: [{ file: "packages/core-domain/src/rbac/role-write.test.ts", must: ["R04", "R14"] }],
    pending: [{ tests: ["I3-31"], task: "T-003-B26a" }],
  },
  {
    finding: "SR-F003-19",
    title: "a no-op PATCH member leaving no trace either way",
    tier: "smoke",
    pins: [{ file: "apps/api/test/members.f003.e2e.int.test.ts", must: ["I3-30"] }],
  },
  {
    finding: "AC-5.4b",
    title: "demote → reset → promote fails at the FIRST step (named regression)",
    tier: "smoke",
    pins: [
      { file: "apps/api/test/members.f003.e2e.int.test.ts", must: ["I3-25", "I3-26", "I3-27"] },
    ],
    pending: [{ tests: ["I3-32"], task: "T-003-B26a" }],
  },
  {
    finding: "AC-5.5b",
    title: "admin-reset refusal byte-identical to 'not a member' (named regression)",
    tier: "smoke",
    pins: [{ file: "apps/api/test/admin-reset.f003.e2e.int.test.ts", must: ["I3-35", "I3-36"] }],
  },
  {
    finding: "D-035",
    title: "accept re-checks the last issuer's authority (named regression)",
    tier: "smoke",
    pins: [{ file: "apps/api/test/invitations-redeem.e2e.int.test.ts", must: ["I3-38"] }],
  },
]);
