// F-002 · T-002-15/16 — the public surface of `orgs/` (backend.md §2.2 rule 1:
// another module imports THIS file, never a file inside).
//
// The services are NOT exported. `OrgProvisioningService` and
// `MyOrganizationsService` hold the unfiltered client; a second call site for
// either is a design conversation, not an import.
export { OrgsModule } from "./orgs.module";
export {
  ORG_PROFILE_RESPONSE_HEADERS,
  applyResponseHeaders,
} from "./response-headers";
export type { CreatedOrganization } from "./system/org-provisioning.service";
export type {
  MyOrganizationsPage,
  MyOrganizationsStatusFilter,
} from "./system/my-organizations.service";
