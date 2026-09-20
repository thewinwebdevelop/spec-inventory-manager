/**
 * S4 — ข้อมูลร้าน (`/o/{orgId}/settings/org`). Routing only.
 *
 * Renders inside `OrgGuard` + `AppShell` (the org layout), so the profile it
 * reads from `useActiveOrg()` is already loaded and already known to belong
 * to a shop this caller is a member of.
 */
import { OrgProfileScreen } from "../../../../../features/org/components/OrgProfileScreen";

export default function OrgSettingsPage() {
  return <OrgProfileScreen />;
}
