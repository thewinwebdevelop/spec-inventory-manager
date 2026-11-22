/**
 * R3 create / clone — `/o/{orgId}/settings/roles/new[?from={roleId}]` (T-003-W06).
 * Routing only: reads `?from=` and hands it to the screen.
 *
 * Behind `RouteGuard(manage_roles)` like R1 — UX, the server still refuses.
 */
import { RoleFormScreen } from "../../../../../../features/org/roles/RoleFormScreen";
import { RouteGuard } from "../../../../../../components/org/RouteGuard";
import { CAPABILITY_MANAGE_ROLES } from "../../../../../../lib/org/capability";
import { ROLE_FORBIDDEN_PANEL_COPY } from "../../../../../../features/org/role-copy";

export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const fromRoleId = typeof from === "string" && from.length > 0 ? from : undefined;
  return (
    <RouteGuard
      requiredCapability={CAPABILITY_MANAGE_ROLES}
      forbiddenCopy={ROLE_FORBIDDEN_PANEL_COPY}
    >
      <RoleFormScreen key={fromRoleId ?? ""} mode="create" fromRoleId={fromRoleId} />
    </RouteGuard>
  );
}
