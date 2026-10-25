/**
 * R1 — บทบาทและสิทธิ์ (`/o/{orgId}/settings/roles`). Routing only.
 *
 * Behind `RouteGuard(manage_roles)`: someone who types the URL without the
 * capability gets the roles ForbiddenPanel (ux F-003 §0) instead of a screen
 * that fires requests only to be refused. The guard is UX — the server still
 * answers 403 to every roles call regardless.
 */
import { RolesScreen } from "../../../../../features/org/roles/RolesScreen";
import { RouteGuard } from "../../../../../components/org/RouteGuard";
import { CAPABILITY_MANAGE_ROLES } from "../../../../../lib/org/capability";
import { ROLE_FORBIDDEN_PANEL_COPY } from "../../../../../features/org/role-copy";

export default function RolesPage() {
  return (
    <RouteGuard
      requiredCapability={CAPABILITY_MANAGE_ROLES}
      forbiddenCopy={ROLE_FORBIDDEN_PANEL_COPY}
    >
      <RolesScreen />
    </RouteGuard>
  );
}
