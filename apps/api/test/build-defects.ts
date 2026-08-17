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
  // ── open, and owned by somebody else ──────────────────────────────────────
  {
    finding: "B-7",
    title: "the members list is 30s stale after somebody accepts an invitation",
    tier: "none",
    foundBy: "E-04, then S9, then E-07 — three files before it was believed",
    owner: "ux + frontend",
    noTest:
      "OPEN by decision, not by omission. `staleTime: 30_000` is a deliberate default and the " +
      "window heals itself; whether the members screen — the one screen whose data is MEANT to " +
      "change from outside this browser — should override it is ux/frontend's call. Pinning " +
      "either behaviour now would freeze that decision. The three E2E files reload and say why.",
  },
  {
    finding: "B-8",
    title: "the wrong-account refusal drops `details.emailMasked`, so it names no account to switch to",
    tier: "none",
    foundBy: "E-06, browser lane",
    owner: "ux (copy) + frontend (plumbing)",
    noTest:
      "OPEN. The server sends `emailMasked` for this code precisely so the UI can say which " +
      "account to use; web's `toApiFailure` drops `details` for `forbidden` and §11.4's sentence " +
      "says 'that account' without naming it. Deliberately NOT asserted either way in e06, so " +
      "that fixing it does not turn a case red.",
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
    title: "neither `dev` nor `start` can run the API (config ships TS source; tsx emits no decorator metadata)",
    tier: "none",
    foundBy: "booting the stack for the browser lane",
    owner: "devops + backend-api",
    noTest:
      "OPEN. `node dist/main.js` dies on @omnistock/config's TypeScript source; `tsx src/main.ts` " +
      "boots and then every injected constructor parameter is undefined, because esbuild emits no " +
      "`design:paramtypes`. CI works around it with `tsx dist/main.js` and the workflow says so at " +
      "length. A packaging decision, not a test.",
  },
]);
