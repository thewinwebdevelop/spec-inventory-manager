// F-002 · T-002-15/16 — the public surface of `orgs/` (backend.md §2.2 rule 1:
// another module imports THIS file, never a file inside).
//
// The services are NOT exported. `OrgProvisioningService` and
// `MyOrganizationsService` hold the unfiltered client; a second call site for
// either is a design conversation, not an import.
export { OrgsModule } from "./orgs.module";
// T-002-17 — the header policy + the TIN allowlist the PII assertions import
// (architecture §12.2 items 4 and 7). One definition, imported; never copied
// into a suite.
export {
  ORG_PROFILE_RESPONSE_HEADERS,
  TAX_ID_REVEAL_RESPONSE_HEADERS,
  INVITATION_RESPONSE_HEADERS,
  RESPONSE_HEADER_POLICY,
  responseHeaderPolicyFor,
  TAX_ID_RESPONSE_ALLOWLIST,
  isTaxIdAllowedOnRoute,
  TOKEN_RESPONSE_ALLOWLIST,
  isTokenAllowedOnRoute,
  applyResponseHeaders,
  type ResponseHeaderPolicyRow,
  type ResponseSensitivity,
} from "./response-headers";
export type { CreatedOrganization } from "./system/org-provisioning.service";
// T-002-18 — the wire shapes of api-spec §3.7–§3.9/§3.17. The SERVICE is not
// exported: a second call site for a membership write is a design conversation
// (it would have to re-derive the whole §5 transaction shape), not an import.
export type {
  MemberListPage,
  MemberListStatusFilter,
  RevokeMemberResult,
  LeaveOrgResult,
} from "./members.service";
export type {
  MyOrganizationsPage,
  MyOrganizationsStatusFilter,
} from "./system/my-organizations.service";
