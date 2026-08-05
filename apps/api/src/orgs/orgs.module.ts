// F-002 · T-002-15/16 — the `orgs/` feature module (backend.md §2.2).
//
// LAYOUT THIS ESTABLISHES (every later F-002 endpoint follows it):
//
//   orgs/
//     *.controller.ts        HTTP shape + tier/authorization declaration only
//     *.service.ts           org-scoped orchestration — injects ORG_PRISMA
//     system/                the SYSTEM_PRISMA jail (architecture §2.4)
//     dto.ts                 request bodies (structure only; rules are pure fns)
//     response-headers.ts    the header policy tests import
//
// WHY `system/` IS A SEPARATE FOLDER AND NOT A FLAG
// `SYSTEM_PRISMA` is the client with NO tenant filter. Exactly three F-002
// operations need it (§2.4) and every one of them is a place where forgetting a
// `userId`/`organizationId` in a `where` is a cross-tenant leak that no test
// would notice. Keeping them in one directory makes "is this file allowed to
// hold the unfiltered client?" a question a reviewer answers from the path, and
// `system/system-prisma-allowlist.test.ts` turns that answer into a red test.
//
// `AuthModule` is imported for ONE provider — `SecurityEventsService`, the
// single audit emitter (`org.created` must reach the same emitter
// `collectSecurityEvents()` subscribes to). It is imported through `../auth`,
// the module's barrel, never by deep-importing the file (backend.md §2.2 rule 1).
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { orgConfigProviders } from "./org-config";
import { MyOrganizationsController } from "./my-organizations.controller";
import { OrgProfileController } from "./org-profile.controller";
import { OrgProfileService } from "./org-profile.service";
import { OrganizationsController } from "./organizations.controller";
import { MembersController } from "./members.controller";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";
import { MembershipController } from "./membership.controller";
import { MembersService } from "./members.service";
import { TaxProfileController } from "./tax-profile.controller";
import { TaxProfileService } from "./tax-profile.service";
import { MyOrganizationsService } from "./system/my-organizations.service";
import { OrgProvisioningService } from "./system/org-provisioning.service";
import { PlanProvisioningService } from "./system/plan-provisioning.service";

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationsController,
    MyOrganizationsController,
    OrgProfileController,
    // T-002-17 — mounted at `orgs/:orgId/tax-profile`, a SEPARATE controller
    // rather than two more handlers on `OrgProfileController`: the reveal route
    // is the only one in F-002 that returns a full TIN, and keeping it in its
    // own file is what makes "which code can emit that number" a question a
    // reviewer answers by opening one file.
    TaxProfileController,
    // T-002-18 — TWO controllers for the membership surface, on purpose.
    // `MembersController` acts on OTHER people (`:userId` in the path,
    // `manage_members` on every verb); `MembershipController` acts only on the
    // caller (no `:userId` at all, `@AnyActiveMember()`). Keeping them apart is
    // what makes "this route can never target somebody else" a property of the
    // file rather than of an `if` (api-spec §3.17 / D-029).
    MembersController,
    InvitationsController,
    MembershipController,
  ],
  providers: [
    // env → DI, once at boot (never `loadEnv()` on a request path).
    ...orgConfigProviders,
    OrgProfileService,
    // Injects `OrgProfileService` (to answer §3.5 with the §3.3 body) and
    // `SecurityEventsService` (from the imported `AuthModule`).
    TaxProfileService,
    // T-002-18 — serves both membership controllers: one service, one
    // transaction shape, one place the Owner ≥ 1 invariant is evaluated.
    MembersService,
    InvitationsService,
    // `system/` providers are registered here, not exported: nothing outside
    // this module may reach an unfiltered read.
    OrgProvisioningService,
    MyOrganizationsService,
    PlanProvisioningService,
  ],
  // Deliberately exports NOTHING yet. `ORG_PRISMA`/`SYSTEM_PRISMA` come from the
  // global `TenancyModule`, and no other feature needs an orgs provider today.
})
export class OrgsModule {}
