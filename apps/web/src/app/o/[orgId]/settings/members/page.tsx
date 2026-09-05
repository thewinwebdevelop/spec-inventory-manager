/**
 * S6 — สมาชิก (`/o/{orgId}/settings/members`). Routing only.
 *
 * No `RouteGuard` yet: `manage_members` gating on this route is F-003's
 * `RouteGuard`/`ForbiddenPanel` work (web.md §3.3, debt W-16). Until then the
 * shell hides the nav entry without the capability and the server answers 403
 * to anyone who types the URL — which is the correct order of authority, just
 * without the friendly panel.
 */
import { MembersScreen } from "../../../../../features/org/components/MembersScreen";

export default function MembersPage() {
  return <MembersScreen />;
}
