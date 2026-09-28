/**
 * S6 — สมาชิก (`/o/{orgId}/settings/members`). Routing only.
 *
 * Behind `RouteGuard(manage_members)` (T-003-W01, closes debt W-16): someone
 * who types the URL without the capability gets the S12ข `ForbiddenPanel`
 * instead of a screen that fires requests only to be refused. The guard is UX
 * — the server still answers 403 to every members call regardless.
 */
import { MembersScreen } from "../../../../../features/org/components/MembersScreen";
import { RouteGuard } from "../../../../../components/org/RouteGuard";
import { CAPABILITY_MANAGE_MEMBERS } from "../../../../../lib/org/capability";

export default function MembersPage() {
  return (
    <RouteGuard requiredCapability={CAPABILITY_MANAGE_MEMBERS}>
      <MembersScreen />
    </RouteGuard>
  );
}
