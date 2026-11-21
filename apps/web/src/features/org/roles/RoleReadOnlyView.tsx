"use client";

/**
 * R4 — ดูบทบาทแบบอ่านอย่างเดียว, INTERIM (T-003-W06).
 *
 * W06 needs `/settings/roles/{id}` to tell the truth for a role the viewer may
 * not edit (`viewer.canEdit.allowed = false`) — rendering the edit form there
 * would invite a save the server refuses. This is the minimum honest view:
 * heading + meta, the ONE reason banner (ux §0.3 (ก) — server order, no
 * re-sorting), the clone button inside the banner when `canClone.allowed`,
 * and a plain list ("ให้" / "ไม่ได้ให้" as TEXT — not disabled checkboxes, ux §A).
 *
 * T-003-W08 owns R4 proper (`CapabilityReadList`, `RoleReasonBanner`, Badge
 * "ล็อก", the delete reason line) and replaces this file.
 */
import { Badge } from "../../../components/ui/Badge";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { Banner } from "../../../components/ui/Banner";
import { Icon } from "../../../components/ui/Icon";
import { useActiveOrg } from "../../../lib/org/org-context";
import { CAPABILITY_FULL_ACCESS } from "../../../lib/org/capability";
import {
  bannerReasonCopy,
  displayRoleName,
  lastEditedLine,
  toLastEdited,
  usageLine,
} from "../role-copy";
import { roleFormTh } from "./i18n";
import { buildChecklist, initialSelection } from "./role-form-model";
import { createHref } from "./template-options";
import type { CapabilityCatalog, RoleDetail } from "./api/use-role-details";

export function RoleReadOnlyView({
  role,
  catalog,
  isMine,
}: {
  role: RoleDetail;
  catalog: CapabilityCatalog | undefined;
  isMine: boolean;
}) {
  const { orgId } = useActiveOrg();
  const reason = role.viewer.canEdit.reason;
  const writesOff = reason === "writes_disabled";
  const copy = bannerReasonCopy(reason);
  const name = displayRoleName({
    name: role.name,
    roleKey: role.key,
    nameCustomized: role.nameCustomized,
  });
  // `writes_disabled`: the top banner already explains; clone/delete are disabled by it (ux R4 table).
  const showClone = role.viewer.canClone.allowed && !writesOff;

  // The Owner card: from the server's `grantsOwnership` (derived from
  // `full_access`, never from `key`), labelled by the catalog entry.
  const fullAccess = role.grantsOwnership
    ? catalog?.items.find((i) => i.key === CAPABILITY_FULL_ACCESS)
    : undefined;
  const { selection, passthrough } = catalog
    ? initialSelection(role.capabilities, catalog)
    : { selection: new Set<string>(), passthrough: [] };
  const view = catalog ? buildChecklist(catalog, selection, () => true) : null;

  const reasonBanner = (
    <Banner
      tone="info"
      icon={<Icon role={writesOff ? "info" : "lock"} />}
      role="status"
      actions={
        showClone ? (
          <ButtonLink href={createHref(orgId, role.id)} variant="secondary" size="sm">
            {roleFormTh.clone}
          </ButtonLink>
        ) : undefined
      }
    >
      <strong className="block">{copy.title}</strong>
      {copy.body}
    </Banner>
  );

  return (
    <>
      {/* writes_disabled is THE top banner of the screen (ux §0.3 (ก)); a lock reason sits under the heading. */}
      {writesOff && reasonBanner}
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-heading-md">{name}</h1>
        <p className="m-0 text-body-sm text-text-muted">
          {usageLine({
            activeMembers: role.usage.activeMembers,
            pendingInvitations: role.usage.pendingInvitations,
            isViewerRole: isMine,
          })}
        </p>
        <p className="m-0 text-body-sm text-text-muted">
          {lastEditedLine(toLastEdited(role.lastEdited))}
        </p>
      </div>

      {!writesOff && reasonBanner}

      <section aria-labelledby="role-read-title" className="flex flex-col">
        <h2 id="role-read-title" className="m-0 text-heading-sm">
          {roleFormTh.checklist.title}
        </h2>
        {fullAccess ? (
          <div className="mt-4 flex items-start gap-3 rounded-card bg-surface-muted p-4">
            <Icon role="check" className="mt-0.5 flex-none" />
            <div>
              <p className="m-0 text-body-md">{fullAccess.labelTh}</p>
              <p className="m-0 text-body-sm text-text-muted">{fullAccess.descriptionTh}</p>
            </div>
          </div>
        ) : (
          view?.groups.map((group) => (
            <div key={group.key} className="mt-6">
              <h3 className="m-0 mb-2 border-b border-border-default pb-2 text-label-sm text-text-muted">
                {group.label}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {group.rows.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-3 text-body-md">
                    <span
                      className={
                        row.checked
                          ? "flex items-start gap-2"
                          : "flex items-start gap-2 text-text-muted"
                      }
                    >
                      {row.checked ? (
                        <Icon role="check" className="mt-0.5 flex-none" aria-hidden="true" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="w-[var(--size-icon-md)] flex-none text-center"
                        >
                          –
                        </span>
                      )}
                      <span>
                        {row.label}
                        {row.upcoming && (
                          <Badge tone="neutral" className="ml-2">
                            {roleFormTh.checklist.upcomingBadge}
                          </Badge>
                        )}
                        {row.locked && (
                          <span className="block text-body-sm text-text-muted">
                            {roleFormTh.checklist.impliedReason}
                          </span>
                        )}
                      </span>
                    </span>
                    {/* ✓ alone = granted; "–" + "ไม่ได้ให้" as text (colour is not the only signal — ux R4). */}
                    {row.checked ? (
                      <span className="sr-only">{roleFormTh.readOnly.granted}</span>
                    ) : (
                      <span className="flex-none text-body-sm text-text-muted">
                        {roleFormTh.readOnly.notGranted}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {passthrough.length > 0 && (
          <p className="m-0 mt-4 text-body-sm text-text-muted">
            {roleFormTh.checklist.unknownExtra(passthrough.length)}
          </p>
        )}
      </section>
    </>
  );
}
