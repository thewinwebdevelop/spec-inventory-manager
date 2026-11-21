"use client";

/**
 * R4 — ดูบทบาทแบบอ่านอย่างเดียว (ux-wireframe R4 · ui.md §3) · T-003-W08.
 *
 * Shown on `/settings/roles/{id}` whenever the server says
 * `viewer.canEdit.allowed = false` (every reason) — the caller decides that;
 * nothing here re-derives it from local capabilities.
 *
 * Layout (ux §0.3 (ก) "ลำดับบนจอ R4"):
 *  - `writes_disabled` → ONE banner at the very top of the screen (`icon.info`),
 *    no repeat under the heading; clone/delete DISABLED in "การจัดการอื่น".
 *  - every other reason → ONE `RoleReasonBanner` under the heading (`icon.lock`,
 *    the server's first reason — the client never re-sorts), with the clone
 *    button INSIDE it when `canClone` allows (or disabled + reason for
 *    `role_limit_reached`).
 *  - the Owner (`isSystem`): Badge "ล็อก", the single `full_access` card, no
 *    name row, no "การจัดการอื่น" (AC-3.2 — never a clone button).
 *  - name is TEXT (no field) · capabilities via `CapabilityReadList` (a list,
 *    not disabled checkboxes — ux §A) · no StickyActionBar.
 *  - delete: `RoleDeleteAction` (R5) shows only when its reason differs from
 *    the main one, or when `canDelete` allows (an edit-only reason).
 */
import { Badge } from "../../../components/ui/Badge";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { Icon } from "../../../components/ui/Icon";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useActiveOrg } from "../../../lib/org/org-context";
import {
  displayRoleName,
  lastEditedLine,
  roleBadgeLabel,
  toLastEdited,
  usageLine,
} from "../role-copy";
import { roleFormTh, roleReadOnlyTh } from "./i18n";
import { CapabilityReadList } from "./CapabilityReadList";
import { RoleDeleteAction } from "./RoleDeleteAction";
import { RoleReasonBanner } from "./RoleReasonBanner";
import { cloneAffordance, deleteAffordance } from "./role-actions-model";
import { createHref } from "./template-options";
import type { RoleRefetchTarget } from "./role-write-failure";
import type { CapabilityCatalog, RoleDetail } from "./api/use-role-details";

export function RoleReadOnlyView({
  role,
  catalog,
  isMine,
  onRetryCatalog,
  onRefetch,
  onForbidden,
}: {
  role: RoleDetail;
  /** `undefined` = the catalog failed to load. */
  catalog: CapabilityCatalog | undefined;
  isMine: boolean;
  onRetryCatalog: () => void;
  onRefetch: (targets: readonly RoleRefetchTarget[]) => void;
  onForbidden: () => void;
}) {
  const { orgId } = useActiveOrg();
  const reason = role.viewer.canEdit.reason;
  const writesOff = reason === "writes_disabled";
  const name = displayRoleName({
    name: role.name,
    roleKey: role.key,
    nameCustomized: role.nameCustomized,
  });
  const badge = role.isSystem
    ? roleBadgeLabel({ isSystem: true, canEditAllowed: false, canEditReason: reason })
    : null;
  const clone = cloneAffordance(role.viewer, role.isSystem);
  const showDelete = deleteAffordance(role.viewer, role.isSystem).kind !== "hidden";

  const cloneInBanner =
    clone.kind === "link" ? (
      <ButtonLink href={createHref(orgId, role.id)} variant="secondary" size="sm">
        {roleFormTh.clone}
      </ButtonLink>
    ) : clone.kind === "disabled" && clone.place === "banner" ? (
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" size="sm" disabled>
          {roleFormTh.clone}
        </Button>
        {clone.note && <span>{clone.note}</span>}
      </div>
    ) : undefined;
  const cloneInSection = clone.kind === "disabled" && clone.place === "section";

  return (
    <>
      {writesOff && <RoleReasonBanner reason={reason} />}
      <div className="flex flex-col gap-1">
        <h1 className="m-0 flex flex-wrap items-center gap-2 text-heading-md">
          <span className="min-w-0">{name}</span>
          {badge && <Badge tone="neutral">{badge}</Badge>}
        </h1>
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

      {!writesOff && <RoleReasonBanner reason={reason} action={cloneInBanner} />}

      {!role.grantsOwnership && (
        <dl className="m-0 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <dt className="text-label-sm text-text-muted">{roleReadOnlyTh.nameLabel}</dt>
          <dd className="m-0 min-w-0 text-body-md">{name}</dd>
        </dl>
      )}

      <section aria-labelledby="role-read-title" className="flex flex-col gap-4">
        <h2 id="role-read-title" className="m-0 text-heading-sm">
          {roleFormTh.checklist.title}
        </h2>
        {catalog ? (
          <CapabilityReadList
            capabilities={role.capabilities}
            grantsOwnership={role.grantsOwnership}
            catalog={catalog}
          />
        ) : (
          <Banner
            tone="danger"
            icon={<Icon role="error" />}
            role="alert"
            actions={
              <Button variant="secondary" size="sm" onClick={onRetryCatalog}>
                {roleFormTh.loadError.retry}
              </Button>
            }
          >
            {roleFormTh.checklist.loadError}
          </Banner>
        )}
      </section>

      {(cloneInSection || showDelete) && (
        <SectionCard title={roleFormTh.otherActions}>
          <div className="flex flex-col items-start gap-3">
            {cloneInSection && (
              <Button variant="secondary" disabled>
                {roleFormTh.clone}
              </Button>
            )}
            {showDelete && (
              <RoleDeleteAction
                role={role}
                displayName={name}
                isMine={isMine}
                onRefetch={onRefetch}
                onForbidden={onForbidden}
              />
            )}
          </div>
        </SectionCard>
      )}
    </>
  );
}
