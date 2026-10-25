"use client";

/**
 * R8 - tertiary link under the role picker: "ดูว่าแต่ละบทบาททำอะไรได้บ้าง".
 * Opens the roles list (R1) in a new tab so the half-filled dialog survives.
 * Shown ONLY to a `manage_roles` holder (AC-6.4: nobody else can read what a
 * role allows, so there is nothing to link to) - gated the same way the
 * sidebar entry is.
 */
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { CAPABILITY_MANAGE_ROLES } from "../../../lib/org/capability";
import { roleCapabilitiesLinkLabel } from "../role-copy";

export function RoleCapabilitiesLink() {
  const { orgId } = useActiveOrg();
  const canManageRoles = useCan(CAPABILITY_MANAGE_ROLES);
  if (!canManageRoles) return null;
  return (
    <a
      href={`/o/${orgId}/settings/roles`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-body-sm text-primary underline"
    >
      {roleCapabilitiesLinkLabel} ↗
    </a>
  );
}
