// F-002 · T-002-Q6 — the PUBLIC baseline for the perf smoke's P-03.
//
// P-03 measures "what does the membership lookup cost per request" by comparing
// an org-scoped route against a public one (test-plan §14). That comparison
// needs a public route which does the same amount of everything ELSE: routing,
// the global pipe, serialisation — and no database work at all. The existing
// fixtures cannot serve: `boom/public` throws on purpose (so it would measure
// the exception filter), and `probe/:orgId` is org-scoped, which is the other
// side of the comparison.
//
// Its own controller rather than another route on `ProbeController`, because a
// `@Get("public")` there would sit next to `@Get(":orgId")` and Nest matches in
// declaration order — a path that means "the org called public" one refactor
// later. Two controllers, no overlap possible.
import { Controller, Get } from "@nestjs/common";
import { Public } from "../../src/tenancy";

@Controller("__test__/ping")
export class PingController {
  /**
   * Deliberately does NOTHING. Every millisecond it costs is framework
   * overhead the org-scoped route also pays, so the difference between the two
   * is the tenancy chain and nothing else.
   */
  @Public()
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}
