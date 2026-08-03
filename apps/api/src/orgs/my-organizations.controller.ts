// F-002 · T-002-16 — `GET /me/organizations` (api-spec §3.2, US-2).
//
// The org switcher's source of truth on web and mobile. `@UserScoped()`: the
// question "which shops am I in?" has no single org to be scoped to, so no org
// context exists here and any `X-Organization-Id` the caller sent is ignored
// (I-3).
//
// AC US-5 / D-027 — the default list is `status=active`, evaluated as a database
// filter on every request (no cache, no TTL). A client that gets
// `403 ORG_ACCESS_DENIED` refetches this endpoint and the shop it was removed
// from is already gone.
import { Controller, Get, Inject, Query, Req } from "@nestjs/common";
import { domainError } from "../common";
import { requireCursor, resolveLimit } from "../common/cursor";
import { UserScoped, type OrgAuthRequest } from "../tenancy";
import {
  MyOrganizationsService,
  type MyOrganizationsPage,
  type MyOrganizationsStatusFilter,
} from "./system/my-organizations.service";

/** `?status=` — anything else is a client bug and is refused, not coerced. */
const STATUS_FILTERS: readonly MyOrganizationsStatusFilter[] = ["active", "all"];
const STATUS_INVALID_MESSAGE = "ตัวกรองสถานะไม่ถูกต้อง";

@Controller("me/organizations")
export class MyOrganizationsController {
  constructor(@Inject(MyOrganizationsService) private readonly orgs: MyOrganizationsService) {}

  /**
   * `{ items, nextCursor }` — the standard list envelope (api-spec §1). Sorted
   * `createdAt desc, id desc`, fixed; the client cannot choose an ordering in
   * F-002, so the cursor's meaning is stable.
   *
   * ⛔ ON THE HANDLER, NOT THE CLASS (High-1): a tier at class level is
   * inherited by every handler added later.
   */
  @UserScoped()
  @Get()
  async list(
    @Req() req: OrgAuthRequest,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<MyOrganizationsPage> {
    const userId = req.orgAuth?.userId;
    // Unreachable behind `OrgScopeGuard` (401 for an invalid token on this
    // tier). A missing id here would mean listing "everyone's" shops, so it is
    // an INTERNAL, never a default.
    if (!userId) throw domainError("INTERNAL");

    const filter = status ?? "active";
    if (!STATUS_FILTERS.includes(filter as MyOrganizationsStatusFilter)) {
      throw domainError("VALIDATION_FAILED", { fieldErrors: { status: STATUS_INVALID_MESSAGE } });
    }

    return this.orgs.list({
      userId,
      status: filter as MyOrganizationsStatusFilter,
      limit: resolveLimit(limit),
      cursor: requireCursor(cursor),
    });
  }
}
