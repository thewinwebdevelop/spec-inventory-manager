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
  {
    finding: "B-14",
    title:
      "`/` was still F-000's placeholder — the domain root showed a shell whether or not anybody was signed in",
    tier: "smoke",
    foundBy:
      "the user, opening the running app while already signed in and asking whether the auth guard was simply unbuilt",
    // Was open on `product`, and product answered (user, 2026-09-04): `/`
    // mirrors login — signed out → `/login`, signed in → `/select-org`. The
    // other branch (a real default shop) would have meant a new field, a new
    // contract surface and a rule for what happens when it is revoked;
    // `defaultOrg`, which `docs/architecture/web.md:86` had routed on, existed
    // nowhere else in the repo. web.md line 86 now says what the code does.
    //
    // The shape worth remembering is not the placeholder, it is WHY it lived
    // that long: nothing ever opened `/`. B-6 was the same defect one route
    // over and died the day E-01 walked login→shop as one journey. E-15/E-15b
    // are that journey for the root, which is why the pin is the browser lane
    // and not only the pure decision function.
    pins: [
      {
        file: "apps/web/src/lib/session/root-redirect.test.ts",
        must: ["NOT YET KNOWN \u2192 wait", "pick-shop"],
      },
      { file: "apps/web/e2e/e10-root-route.spec.ts", must: ["E-15", "apps/web placeholder shell"] },
    ],
  },
  // ── the §12.2 manual pass, 2026-09-04 ────────────────────────────────────
  // Four findings from ONE person walking the runbook by hand on a real stack.
  // Every one of them had the full suite — 363 web, 684 api, 440 mobile, a
  // browser lane and an emulator lane — sitting green on top of it, which is
  // the same sentence this file has had to write about every row it holds.
  {
    finding: "B-15",
    title:
      "a CANCELLED invitation still advertised its link as live for another seven days",
    tier: "smoke",
    foundBy:
      "the §12.2 manual pass: cancelling an invitation in a browser, one second after the confirm dialog promised \"ลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้ทันที\"",
    // `expiry.ts` warns about this in its own doc comment — "telling somebody
    // a dead link is live" — and `MembersScreen` called `formatExpiry` on
    // every row without reading `status`. `expiresAt` is NON-NULL on every row
    // by contract (ux Q14), so it always read and was always wrong. The module
    // knowing the rule was never the same as the screen obeying it.
    //
    // The fix is ux-wireframe §7's own line 549, which had never been built:
    // `รอตอบรับ · หมดอายุแล้ว · ยกเลิกแล้ว · รับแล้วเมื่อ {วันเวลา}` — and it
    // closes M-04's missing half too, because `acceptedAt` had been on the
    // wire since the contract locked with no production line of web code
    // reading it.
    pins: [
      {
        file: "apps/web/src/features/org/expiry.test.ts",
        must: ["cancelled is dead even though", "รับแล้วเมื่อ"],
      },
      {
        file: "apps/web/src/features/org/components/MembersScreen.invitation-status.test.tsx",
        must: ["ยกเลิกแล้ว", "the fix must not blank every row"],
      },
    ],
  },
  {
    finding: "B-16",
    title:
      "the web app had NO sign-out — the only way out ended every session on every device the person owned",
    tier: "smoke",
    foundBy:
      "the §12.2 manual pass: trying to switch accounts for M-04 and finding nothing to click",
    // ux-wireframe §S2 draws "ออกจากระบบ" as the last row of the sidebar, and
    // `orgTh.shell.nav.logout` sat in the dictionary with NO consumer anywhere
    // in the tree. A missing control renders nothing and asserts nothing:
    // there is no failing render, no console error, no type error — which is
    // why every lane stayed green over a gap a person hits in ten seconds.
    pins: [
      {
        file: "apps/web/src/features/org/components/AppShell.logout.test.tsx",
        must: ["not every session on every device", "does not fake success"],
      },
      { file: "apps/web/e2e/e11-sign-out.spec.ts", must: ["E-16", "does not walk back in"] },
    ],
  },
  {
    finding: "B-17",
    title:
      "the mobile app could not be pointed at any API — `main.dart` hardcoded `localhost`, which on a device is the DEVICE",
    tier: "smoke",
    foundBy:
      "the §12.2 manual pass: login failed on a real Android 13 emulator with the generic \"เกิดข้อผิดพลาด\", because `login_controller`'s `catch (_)` swallows the transport error",
    // `--dart-define=API_BASE_URL=…` — passed by CI's emulator lane AND by the
    // runbook a human follows — was read by `integration_test/org_flow_test.
    // dart` and by nothing else. E-10 builds the provider graph itself from
    // the define and never comes through `main.dart`, so the harness and the
    // app were each internally consistent and disagreed with each other.
    //
    // No behaviour test can catch it: `String.fromEnvironment` is resolved at
    // COMPILE time, so a running test sees its own build's value and can say
    // nothing about what the entrypoint asks for. The pin reads source, and
    // the rule it enforces is that the three places naming this key agree.
    pins: [
      {
        file: "apps/mobile/test/app/base_url_define_test.dart",
        must: ["the app and its integration test read the SAME key", "10.0.2.2"],
      },
    ],
  },
  {
    finding: "B-18",
    title:
      "every F-002 screen on mobile was orphaned — the app could not reach a shop, the members list or the tax card",
    tier: "smoke",
    foundBy:
      "the §12.2 manual pass, immediately after B-17 was fixed: login succeeded on a real emulator and landed on F-001's SecurityScreen with nowhere to go",
    // Product chose to unblock M-07 now rather than wait for F-006 (user,
    // 2026-09-05), so `app/shop_shell.dart` is a deliberately minimal shell
    // that F-006 deletes rather than extends.
    //
    // The finding had two halves and the second was the dangerous one.
    // `CreateOrgScreen`, `MembersScreen`, `OrgPickerScreen` and
    // `OrgProfileScreen` had ZERO references in `lib/` outside their own
    // files — but ALSO `signedIn()` had no caller anywhere, so the session
    // controller sat on `SessionUnknown` for the life of the process. Since
    // `switchOrg` returns early unless the state is already `SessionAuthed`,
    // tapping a shop would have written nothing and looked like a dead row,
    // and `learnCapabilities` swallows its errors by design. Wiring the
    // screens without wiring the session would have shipped that.
    //
    // This is B-4 one layer up (that one was the PROVIDERS being unwired) and
    // B-14's shape on the other platform (`/` was a placeholder because no
    // test opened it). E-10 builds `MembersScreen` inside its own
    // `MaterialApp`, which proves the screen works WHEN SOMEBODY SHOWS IT and
    // can never prove anyone can get there.
    pins: [
      {
        file: "apps/mobile/test/app/app_destination_test.dart",
        must: ["`signedIn()` had no caller at all", "switchOrg` was a no-op before"],
      },
      {
        file: "apps/mobile/test/app/shop_shell_test.dart",
        must: ["the revealed tax id cannot outlive it", "not every device the person owns"],
      },
    ],
  },
]);
