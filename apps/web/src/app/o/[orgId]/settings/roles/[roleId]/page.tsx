/**
 * R3 edit / R4 read-only — `/o/{orgId}/settings/roles/{roleId}` (T-003-W06).
 * Routing only. Which of the two renders is the server's `viewer.canEdit`
 * verdict, decided inside the screen.
 */
import { RoleFormScreen } from "../../../../../../features/org/roles/RoleFormScreen";
import { RouteGuard } from "../../../../../../components/org/RouteGuard";
import { CAPABILITY_MANAGE_ROLES } from "../../../../../../lib/org/capability";
import { ROLE_FORBIDDEN_PANEL_COPY } from "../../../../../../features/org/role-copy";

export default async function RoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  return (
    <RouteGuard
      requiredCapability={CAPABILITY_MANAGE_ROLES}
      forbiddenCopy={ROLE_FORBIDDEN_PANEL_COPY}
    >
      <RoleFormScreen key={roleId} mode="edit" roleId={decodeURIComponent(roleId)} />
    </RouteGuard>
  );
}
