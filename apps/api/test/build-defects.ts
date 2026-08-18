// F-002 — the defects found while BUILDING, as data.
//
// `regression-pack.ts` mirrors test-plan §9: the 41 findings from the spec
// reviews, and its gate is sized to that number. These are different animals
// and get their own file so neither list dilutes the other: nothing here was
// predicted by a review. Every one was found by running the thing — a browser
// against a real API, an emulator against a real API — and every one had a
// green unit suite sitting on top of it at the time.
//
// That is the argument the list exists to make. Two of them were total: an
// Owner could not see their own members menu, and the only screen that shows a
// full tax id answered 415 to everybody. Neither is a corner case, and neither
// was findable by any lane that mocks the other side.
//
// Same rule as the §9 pack (§17.11(ก)): a row either pins a test or writes
// down why it has none. An OPEN row names its owner — it is not this file's
// job to decide somebody else's fix, only to stop the finding evaporating.
import type { RegressionEntry } from "./regression-pack";

export interface BuildDefect extends RegressionEntry {
  /** How it was found — the instrument, not the story. */
  readonly foundBy: string;
  /** Open rows name the team that decides. */
  readonly owner?: string;
}

export const BUILD_DEFECTS: readonly BuildDefect[] = Object.freeze([
  {
    finding: "B-1",
    title: "clients ignored `full_access` as a wildcard — six sites, one of them unreachable code",
    tier: "smoke",
    foundBy: "E-08b, browser lane (the Owner's own sidebar had no members entry)",
    pins: [
      // The tripwire is the durable half: it fails on the NEXT `.has(CAPABILITY_X)`
      // anybody writes, in either tree.
      { file: "apps/web/src/lib/org/capability-lint.test.ts", must: ["full_access", "capability"] },
      { file: "apps/web/src/features/org/components/AppShell.test.tsx", must: ["full_access"] },
      { file: "apps/web/src/features/org/tax-card.test.ts", must: ["the Owner who actually exists"] },
      {
        file: "apps/mobile/test/core/session/active_org_capabilities_test.dart",
        must: ["full_access", "wildcard"],
      },
    ],
  },
  {
    finding: "B-2",
    title: "`POST …/tax-profile/reveal` answered 415 for everybody (bodyless POST behind JsonOnlyGuard)",
    tier: "smoke",
    foundBy: "E-14, browser lane; named exactly by the API log CI dumps on failure",
    pins: [
      { file: "apps/web/src/features/org/api/use-reveal-tax-id.test.tsx", must: ["415"] },
      { file: "apps/web/e2e/e09-tax-profile.spec.ts", must: ["E-14"] },
    ],
  },
  {
    finding: "B-3",
    title: "W-17 — S9/S10 rendered their actions as `<span>`, so two mutation hooks had no caller",
    tier: "full",
    foundBy: "reading §7 against the screen while writing E-07",
    pins: [
      {
        file: "apps/web/src/features/org/components/MembersScreen.actions.test.tsx",
        must: ["W-17", "real button"],
      },
      { file: "apps/web/e2e/e07-removed-mid-session.spec.ts", must: ["S9", "ถอดออกจากร้าน"] },
    ],
  },
  {
    finding: "B-4",
    title: "F-002's mobile providers were never wired into the app — the feature could not run outside a test",
    tier: "smoke",
    foundBy: "E-10, while building the emulator lane",
    pins: [
      { file: "apps/mobile/test/app/bootstrap_test.dart", must: ["UnimplementedError"] },
      { file: "apps/mobile/integration_test/org_flow_test.dart", must: ["buildAppOverrides"] },
    ],
  },
  {
    finding: "B-5",
    title: "`type: boolean` + `enum:` in the contract generates a STRING enum for Dart — mobile signup always failed",
    tier: "smoke",
    foundBy: "E-10 on a real emulator: three cases, all dying at signup with ApiError(201)",
    pins: [
      // The scan is the durable half — it bans the shape rather than the instance.
      {
        file: "packages/contracts/src/generator-hostile-shapes.test.ts",
        must: ["no boolean carries an `enum`"],
      },
      {
        file: "apps/mobile/test/features/auth/data/auth_repository_impl_test.dart",
        must: ["'verified': false"],
      },
    ],
  },
  {
    finding: "B-6",
    title: "post-login redirect still pointed at F-000's placeholder, and the session provider could not learn about a login",
    tier: "full",
    foundBy: "E-01, the browser lane's first case",
    pins: [
      { file: "apps/web/src/lib/session/session-context.test.tsx", must: ["beginSession"] },
      { file: "apps/web/e2e/e01-signup-create-shop.spec.ts", must: ["select-org"] },
    ],
  },
  {
    finding: "B-11",
    title: "the backup-owner nudge overflowed its row on a phone-width screen",
    tier: "full",
    foundBy: "E-10 on a real emulator — Flutter reported the overflow as an error",
    pins: [
      {
        file: "apps/mobile/test/features/org/presentation/members_screen_test.dart",
        must: ["fits a phone", "physicalSize"],
      },
    ],
  },
  // ── open, and owned by somebody else ──────────────────────────────────────
  {
    finding: "B-7",
    title: "the members list was 30s stale after somebody accepted an invitation",
    tier: "smoke",
    foundBy: "E-04, then S9, then E-07 — three files before it was believed",
    owner: "ux + frontend",
    partial:
      "CLOSED as a caching policy on TWO queries, not app-wide. `useMembers` and `useInvitations` " +
      "set `staleTime: 0` because they exist to report what somebody ELSE did, on another " +
      "machine; the 30s default stays everywhere else, including the org PROFILE query that " +
      "`OrgGuard` reads — a removed member is still evicted on their next real request (AC-5.1), " +
      "which is what that AC asks for. The three E2E files had a `reload()` workaround; removing " +
      "it is how the fix is proven, so a regression reddens them instead of passing quietly.",
    pins: [
      {
        file: "apps/web/src/features/org/api/use-members.staleness.test.tsx",
        must: ["staleTime", "B-7"],
      },
      { file: "apps/web/e2e/e04-accept-and-permissions.spec.ts", must: ["NO RELOAD"] },
    ],
  },
  {
    finding: "B-8",
    title: "the wrong-account refusal dropped `details.emailMasked`, so it named no account",
    tier: "smoke",
    foundBy: "E-06, browser lane",
    owner: "ux + frontend",
    partial:
      "CLOSED with NO new copy. `toApiFailure` now carries `details` on the `forbidden` kind — " +
      "the same reason `conflict` already carried it — and the mismatch body composes two " +
      "sentences ux had already approved: §11.1's `issuedTo` naming line and §11.4's existing " +
      "instruction. Scoped to that one code on purpose; a generic 'append details to the copy' " +
      "would put server internals in front of users. Falls back to the bare §11.4 sentence when " +
      "the server sends no masked address.",
    pins: [
      {
        file: "apps/web/src/features/invite/invite-token.test.ts",
        must: ["B-8", "emailMasked"],
      },
      { file: "apps/web/e2e/e06-wrong-account.spec.ts", must: ["B-8"] },
    ],
  },
  {
    finding: "B-9",
    title: "no client can identify the Owner role unless the viewer is one (§3.6 publishes no capabilities)",
    tier: "none",
    foundBy: "writing S9's role picker against §10.1",
    owner: "backend-api",
    noTest:
      "OPEN, and structurally unfixable on the client: ownership is a capability and roles are " +
      "an open set (F-003), so `ownerRoleIds` can only ever hold a role the viewer holds. §10.1 " +
      "wants the Owner option shown-but-disabled for an Admin, and S7's invite filter has the " +
      "same hole. Proposed: a `grantsOwnership` flag on the roles list. The safety property does " +
      "not depend on it — the server refuses and both dialogs carry the 403 copy. The current " +
      "behaviour is pinned in MembersScreen.actions.test.tsx so the day the flag lands, it fails " +
      "and says what to change.",
  },
  {
    finding: "B-10",
    title: "neither `dev` nor `start` could run the API (config ships TS source; tsx emits no decorator metadata)",
    tier: "full",
    foundBy: "booting the stack for the browser lane",
    owner: "devops + backend-api",
    partial:
      "HALF closed, and the halves are different jobs. The TRAP is gone — `start` and every " +
      "`dev*` script now boot the compiled entry through tsx, the combination CI runs green, and " +
      "the test below fails if either broken form comes back. The CAUSE is untouched: three of " +
      "the four workspace packages the API depends on ship TypeScript source, and until they " +
      "emit `dist/` like core-domain and connectors already do, plain `node dist/main.js` cannot " +
      "work and tsx stays a runtime dependency. That is a packaging decision for its owners.",
    pins: [
      {
        file: "apps/api/test/run-scripts.test.ts",
        must: ["design:paramtypes", "ships TypeScript source"],
      },
    ],
  },
]);
