"use client";

/**
 * R2 — เลือกบทบาทต้นแบบ (ux-wireframe R2). A dialog over R1; it has no loading
 * state of its own because R1 only enables "สร้างบทบาท" once both reads are in.
 *
 * "ถัดไป" navigates to R3's create mode (`?from=<roleId>`, none for blank). The
 * selection is only a starting point for a form — nothing is written here, and
 * nothing here decides whether the clone is allowed: disabled options come from
 * the server's `canClone` verdict (see template-options.ts).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveOrg } from "../../../lib/org/org-context";
import { Button } from "../../../components/ui/Button";
import { DialogShell } from "../../../components/ui/DialogShell";
import { RadioCardGroup } from "../../../components/ui/RadioCardGroup";
import { rolesTh } from "./i18n";
import { buildTemplateOptions, createHref, defaultTemplate } from "./template-options";
import type { CapabilityCatalog, RoleDetail } from "./api/use-role-details";

export function TemplateDialog({
  roles,
  catalog,
  onClose,
}: {
  roles: readonly RoleDetail[];
  catalog: CapabilityCatalog;
  onClose: () => void;
}) {
  const { orgId } = useActiveOrg();
  const router = useRouter();
  const options = useMemo(() => buildTemplateOptions(roles, catalog), [roles, catalog]);
  const [selected, setSelected] = useState(() => defaultTemplate(roles));

  return (
    <DialogShell label={rolesTh.template.title} onClose={onClose}>
      <h2 className="m-0 text-heading-sm">{rolesTh.template.title}</h2>
      <p className="m-0 text-body-sm text-text-muted">{rolesTh.template.lead}</p>
      <RadioCardGroup
        name="role-template"
        legend={rolesTh.template.legend}
        value={selected}
        options={options}
        onChange={setSelected}
      />
      <p className="m-0 text-body-sm text-text-muted">{rolesTh.template.ownerNote}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {rolesTh.template.cancel}
        </Button>
        <Button onClick={() => router.push(createHref(orgId, selected))}>
          {rolesTh.template.next}
        </Button>
      </div>
    </DialogShell>
  );
}
