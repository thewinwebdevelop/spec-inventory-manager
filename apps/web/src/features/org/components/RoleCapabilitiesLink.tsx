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
import { ButtonLink } from "../../../components/ui/ButtonLink";

export function RoleCapabilitiesLink() {
  const { orgId } = useActiveOrg();
  const canManageRoles = useCan(CAPABILITY_MANAGE_ROLES);
  if (!canManageRoles) return null;
  // `ButtonLink tertiary`: reads as the text link ui.md asks for, with the 44px
  // target (D-038 ③ measured the bare <a> at 17px). `self-start` keeps it from
  // stretching across the dialog's flex column.
  return (
    <ButtonLink
      href={`/o/${orgId}/settings/roles`}
      target="_blank"
      rel="noopener noreferrer"
      variant="tertiary"
      className="self-start"
    >
      {roleCapabilitiesLinkLabel} ↗
    </ButtonLink>
  );
}
