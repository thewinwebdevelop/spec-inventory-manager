/**
 * T-003-W05 — R2 "เลือกบทบาทต้นแบบ": which templates to offer, how each is
 * worded, and which is pre-selected (ux-wireframe R2).
 *
 * ⛔ Nothing here decides a permission. Whether a role can be cloned is
 * `viewer.canClone` from the server — this module never compares capability
 * sets (⊆/⊊) and never looks at a role key. `capabilities.length` is used for
 * exactly one thing the ux spec asks for: the safest DEFAULT (fewest
 * permissions) among roles the server already said are cloneable.
 */
import type { RadioCardOption } from "../../../components/ui/RadioCardGroup";
import { displayRoleName } from "../role-copy";
import { rolesTh } from "./i18n";
import type { CapabilityCatalog, RoleDetail } from "./api/use-role-details";

/** The "start from empty" choice. Not a role id by construction (ids never contain `__`). */
export const BLANK_TEMPLATE = "__blank__";

const LABELS_SHOWN = 3;

/** `canClone.reason = owner_role` ⇒ not offered at all (AC-3.2). */
function offered(role: RoleDetail): boolean {
  return role.viewer.canClone.reason !== "owner_role";
}

function describe(role: RoleDetail, catalog: CapabilityCatalog): string {
  const held = new Set(role.capabilities);
  // Catalog order, selectable entries only (`full_access` is never a checklist
  // item). A key the catalog does not know is counted in `n` but has no label —
  // we do not print a raw key.
  const labels = catalog.items
    .filter((entry) => entry.selectable && held.has(entry.key))
    .map((entry) => entry.labelTh);
  return rolesTh.template.description(
    role.capabilities.length,
    labels.slice(0, LABELS_SHOWN),
    role.capabilities.length > LABELS_SHOWN,
  );
}

function disabledReason(role: RoleDetail): string {
  switch (role.viewer.canClone.reason) {
    case "exceeds_your_permissions":
      return rolesTh.template.cloneExceeds;
    default:
      return rolesTh.template.cloneUnknown;
  }
}

export function buildTemplateOptions(
  roles: readonly RoleDetail[],
  catalog: CapabilityCatalog,
): RadioCardOption<string>[] {
  const options: RadioCardOption<string>[] = roles.filter(offered).map((role) => {
    const allowed = role.viewer.canClone.allowed;
    return {
      value: role.id,
      label: displayRoleName({
        name: role.name,
        roleKey: role.key,
        nameCustomized: role.nameCustomized,
      }),
      description: describe(role, catalog),
      ...(allowed ? {} : { disabled: true, disabledReason: disabledReason(role) }),
    };
  });
  options.push({
    value: BLANK_TEMPLATE,
    label: rolesTh.template.blankLabel,
    description: rolesTh.template.blankDescription,
  });
  return options;
}

/** Cloneable role with the fewest capabilities (ties: first in server order); none ⇒ blank. */
export function defaultTemplate(roles: readonly RoleDetail[]): string {
  let best: RoleDetail | null = null;
  for (const role of roles) {
    if (!offered(role) || !role.viewer.canClone.allowed) continue;
    if (best === null || role.capabilities.length < best.capabilities.length) best = role;
  }
  return best === null ? BLANK_TEMPLATE : best.id;
}

/** R3's create mode (`?from=<roleId>` or none for blank). */
export function createHref(orgId: string, template: string): string {
  const base = `/o/${orgId}/settings/roles/new`;
  return template === BLANK_TEMPLATE ? base : `${base}?from=${encodeURIComponent(template)}`;
}
