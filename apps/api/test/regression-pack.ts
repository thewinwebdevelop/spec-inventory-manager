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
    tier: "full",
    partial:
      "Untestable in F-002 and correctly so (§9.1): the three system roles are fixed and there " +
      "is no role CRUD, so there is no surface to fire at. The pin is the TRIPWIRE (G-15), which " +
      "fails the moment a write path to Role.capabilities appears — turning 'F-003 should handle " +
      "this' into 'F-003 cannot merge without handling it'.",
    pins: [
      { file: "apps/api/src/orgs/role-capability-write-tripwire.test.ts", must: ["G-15", "NEW-10"] },
    ],
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
]);
