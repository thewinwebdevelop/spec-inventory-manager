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
      // The M-07 round trip, after the review pointed out it revealed nothing.
      { file: "apps/mobile/integration_test/org_flow_test.dart", must: ["validTaxId"] },
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
      "which is what that AC asks for. " +
      "SCOPE, stated plainly: this makes the lists fresh whenever the screen is MOUNTED — coming " +
      "back to it, or returning to the tab (`refetchOnWindowFocus`, which the 30s window used to " +
      "swallow, and which is the LINE round trip). It does NOT update a screen somebody is " +
      "sitting on without touching anything; that needs polling, which is a product decision " +
      "about requests and battery that nobody has taken. The E2E proof is a navigation round " +
      "trip rather than a `reload()`, because a reload would pass even if the fix were reverted.",
    pins: [
      {
        file: "apps/web/src/features/org/api/use-members.staleness.test.tsx",
        must: ["staleTime", "B-7"],
      },
      // Pinned on the MECHANISM, not on a sentence: the first version of this
      // pin quoted a comment ("NO RELOAD") that I then rewrote, and the gate
      // caught it — which is the gate working, and a lesson about what a pin
      // should name. `reopenMembers` is the thing that would have to disappear
      // for the coverage to disappear.
      { file: "apps/web/e2e/e04-accept-and-permissions.spec.ts", must: ["reopenMembers"] },
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
    title: "no client could identify the Owner role unless the viewer was one (§3.6 published no capabilities)",
    tier: "smoke",
    foundBy: "writing S9's role picker against §10.1",
    owner: "backend-api",
    partial:
      "CLOSED by publishing ONE derived bit, `grantsOwnership`, not the capability list — §3.6's " +
      "refusal to publish `capabilities` stands, and the reason it gives (a client would compute " +
      "permissions from it) still holds. The bit is derived server-side with core-domain's " +
      "`isOwnerRole`, the same function `toMemberRow` uses, so the system has one answer to \"is " +
      "this ownership\". OPTIONAL in the contract per contract-evolution: a client newer than its " +
      "server must still parse the list, and absent means \"not said\" rather than \"no\". " +
      "It also closed a divergence it had been hiding: web's S7 FILTERED the Owner option while " +
      "mobile showed it disabled per §8 — with an empty owner set the filter removed nothing, so " +
      "nobody could see the difference. Both now show and disable, with mobile's approved helper " +
      "sentence reused verbatim on web.",
    pins: [
      { file: "apps/api/src/orgs/roles.service.test.ts", must: ["I-45", "grantsOwnership"] },
      {
        file: "apps/web/src/features/org/components/MembersScreen.actions.test.tsx",
        must: ["grantsOwnership", "DISABLED"],
      },
      {
        file: "apps/mobile/test/features/org/presentation/invite_member_screen_test.dart",
        must: ["grantsOwnership", "B-9"],
      },
    ],
  },
  {
    finding: "B-10",
    title: "neither `dev` nor `start` could run the API (config shipped TS source; tsx emits no decorator metadata)",
    tier: "smoke",
    foundBy: "booting the stack for the browser lane",
    owner: "devops + backend-api",
    partial:
      "CLOSED, both halves. The trap: `start`/`dev` now boot the compiled entry with plain " +
      "`node`, and the guard bans a TypeScript loader in the boot path entirely. The cause: " +
      "`@omnistock/config` and `@omnistock/db` emit `dist/` like `core-domain` and `connectors` " +
      "always did, so `node dist/main.js` loads the application and stops at " +
      "\"DATABASE_URL is required\" — a configuration failure, not a loader failure. " +
      "`@omnistock/contracts` still ships source ON PURPOSE: the API imports it with " +
      "`import type` only, so it never reaches the runtime. " +
      "The Prisma client moved from `src/generated/` to `generated/` at the package root, which " +
      "is what lets one directory serve both `src/` and `dist/` — the alternative was copying it " +
      "into `dist/` at build time, i.e. two clients with one of them free to go stale against " +
      "the schema. CI now runs the repo's own `start` script rather than a command that existed " +
      "only in the workflow.",
    pins: [
      // Mechanisms, not sentences — the lesson from B-7's stale pin.
      { file: "apps/api/test/run-scripts.test.ts", must: ["design:paramtypes", "RUNTIME_PACKAGES"] },
    ],
  },
  // ── found by the M-07 security review, which ran probes rather than reading ──
  //
  // These belong in THIS list rather than the §9 review pack, and the
  // distinction is the whole point of the file: the §9 findings were predicted
  // from documents before anything existed. These two were found by driving
  // the built screen — the reviewer wrote seven throwaway probes to refute the
  // six claims I had made about it, and two of them held. Same signature as
  // every other row here: a green suite was sitting on top at the time.
  {
    finding: "B-12",
    title:
      "a revealed tax id outlived the screen, the shop and the session — so §3.16's \"every reveal is logged\" was false on mobile",
    tier: "smoke",
    foundBy:
      "security-review probes against the real screen: re-entry repainted the number with revealCalls=1 (no request ⇒ no audit event), switchOrg carried it onto another shop's card, and sign-out → a different user showed the previous person's national ID on the first frame",
    pins: [
      // The fix was structural — the secret now lives in the screen's own
      // `State`, so "leaving forgets it" is a fact about storage rather than a
      // rule somebody has to remember. These name the behaviours that would
      // have to be deleted for that to come undone.
      {
        file: "apps/mobile/test/features/org/presentation/org_profile_screen_test.dart",
        must: ["never inherits the number"],
      },
      {
        file: "apps/mobile/test/features/org/application/tax_reveal_session_test.dart",
        must: ["backgrounding drops the number", "after dispose"],
      },
    ],
  },
  {
    finding: "B-13",
    title:
      "every entry point but create-shop entered a shop with an EMPTY capability set — a real Owner was offered nothing",
    tier: "smoke",
    foundBy:
      "the same review, reading the call sites: `/me/organizations` publishes no capabilities by design (§3.5), so the picker and the switcher had nothing to pass",
    pins: [
      {
        file: "apps/mobile/test/features/org/application/enter_organization_test.dart",
        must: ["learns what this member may do", "has LEFT"],
      },
    ],
  },
]);
