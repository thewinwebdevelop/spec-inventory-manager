// F-002 · T-002-22 — the DELIBERATE 500 (test-plan §19.1 item 10 ·
// architecture §12.2 item 9).
//
// I-06 requires `traceId` on EVERY error status — and 500 is the one support
// actually needs it for, because a 500 is the only status whose body tells the
// caller nothing at all. To assert it we need a route that throws something that
// is NOT an `ApiFailure`/`DomainException`, i.e. a genuine unexpected error.
//
// WHY IT CANNOT SHIP: this file lives under `apps/api/test/`, and
// `apps/api/tsconfig.json` compiles `include: ["src"]` only. There is no build
// configuration in which this controller reaches `dist/`. That is a stronger
// guarantee than the `NODE_ENV` check in `TestFixturesModule` — the env check is
// the belt, this is the trousers.
//
// THREE ROUTES, THREE DIFFERENT MOMENTS
//   /public → throws with no org context at all (the filter must still work)
//   /user   → throws on a @UserScoped() route (token verified, no org context)
//   /org    → throws AFTER OrgScopeGuard + CapabilityGuard have passed and the
//             ALS context is open — the case that proves the filter renders an
//             envelope from inside an established tenant context rather than
//             leaking the context into the body.
import { Controller, Get, Param } from "@nestjs/common";
import { AnyActiveMember } from "../../src/common/authz";
import { Public, UserScoped } from "../../src/tenancy";

/** Prefix every fixture route shares — the audit kit ignores it by default. */
export const TEST_FIXTURE_PREFIX = "/__test__";

/** The message the fixtures throw. It must NEVER appear in a response body. */
export const BOOM_MESSAGE = "deliberate boom from the F-002 test fixture";

@Controller("__test__/boom")
export class BoomController {
  @Public()
  @Get("public")
  boomPublic(): never {
    throw new Error(`${BOOM_MESSAGE} (public)`);
  }

  @UserScoped()
  @Get("user")
  boomUser(): never {
    throw new Error(`${BOOM_MESSAGE} (user-scoped)`);
  }

  /**
   * Org-scoped (the default tier — no marker) and open to any active member, so
   * the throw happens with a real org context on the stack.
   */
  @AnyActiveMember()
  @Get("org/:orgId")
  boomOrgScoped(@Param("orgId") _orgId: string): never {
    throw new Error(`${BOOM_MESSAGE} (org-scoped)`);
  }
}
