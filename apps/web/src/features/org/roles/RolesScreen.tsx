"use client";

/**
 * R1 — รายการบทบาท (`/o/{orgId}/settings/roles`, ux-wireframe R1).
 *
 * ⛔ Every write affordance below is drawn from the server's verdict and
 * nothing else (repo lesson "client-invented server facts"):
 *  - "สร้างบทบาท" ← `viewer.canCreate` (+ `viewer.limit`);
 *  - the "ดูได้อย่างเดียว" / "ล็อก" badge ← each role's `viewer.canEdit` /
 *    `isSystem`;
 *  - the writes-off banner ← `reason === "writes_disabled"` on the create
 *    verdict (the server reports it on EVERY write verdict while off).
 * This screen never reads `myMembership.capabilities` to decide any of that;
 * the only capability question it asks is "ไปหน้าสมาชิก" (a link to another
 * screen), through `useCan`.
 *
 * Four states (apps/web/CLAUDE.md rule 5): skeleton / error / data, and
 * `items = []` is treated as the error state — a shop always has its Owner
 * role, so an empty list means the answer is wrong, not that there is nothing.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { orgKey } from "../../../lib/org/org-keys";
import { toApiFailure } from "../../../lib/api/error";
import { CAPABILITY_MANAGE_MEMBERS } from "../../../lib/org/capability";
import { Badge } from "../../../components/ui/Badge";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ForbiddenPanel } from "../../../components/ui/ForbiddenPanel";
import { Icon } from "../../../components/ui/Icon";
import { ListRow } from "../../../components/ui/ListRow";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SkeletonRow } from "../../../components/ui/Skeleton";
import {
  bannerReasonCopy,
  createOrCloneBlockedReasonCopy,
  displayRoleName,
  lastEditedLine,
  type LastEdited,
  roleBadgeLabel,
  ROLE_FORBIDDEN_PANEL_COPY,
  usageLine,
} from "../role-copy";
import { rolesTh } from "./i18n";
import { TemplateDialog } from "./TemplateDialog";
import { useCapabilityCatalog, useRoleDetails, type RoleDetail } from "./api/use-role-details";

/**
 * The wire's `RoleLastEdited` is `{ at, by: { kind, roleName?, roleKey?, … } }`;
 * `lastEditedLine` (W03) takes `{ kind, at, by?: { roleName } }`. The editor's
 * role name goes through the same §0.2 display rule as every other role name.
 */
export function toLastEdited(le: RoleDetail["lastEdited"]): LastEdited | null {
  if (le === null) return null;
  const { kind, roleName, roleKey, roleNameCustomized } = le.by;
  return {
    kind,
    at: le.at,
    by: {
      roleName: roleName
        ? displayRoleName({ name: roleName, roleKey, nameCustomized: roleNameCustomized })
        : null,
    },
  };
}

function RoleRowLink({
  role,
  orgId,
  myRoleId,
}: {
  role: RoleDetail;
  orgId: string;
  myRoleId: string;
}) {
  const badge = roleBadgeLabel({
    isSystem: role.isSystem,
    canEditAllowed: role.viewer.canEdit.allowed,
    canEditReason: role.viewer.canEdit.reason,
  });
  const meta = [
    usageLine({
      activeMembers: role.usage.activeMembers,
      pendingInvitations: role.usage.pendingInvitations,
      isViewerRole: role.id === myRoleId,
    }),
    lastEditedLine(toLastEdited(role.lastEdited)),
  ].join(" · ");
  return (
    // The whole row is the target (ux R1: "แตะทั้งแถว → R3 หรือ R4"). Which of
    // the two it is, is R3/R4's decision from the same verdict.
    <Link
      href={`/o/${orgId}/settings/roles/${encodeURIComponent(role.id)}`}
      className="block text-inherit no-underline"
    >
      <ListRow
        main={
          <>
            <span>
              {displayRoleName({
                name: role.name,
                roleKey: role.key,
                nameCustomized: role.nameCustomized,
              })}
            </span>
            {badge && <Badge>{badge}</Badge>}
          </>
        }
        sub={meta}
        right={<Icon role="chevron-right" className="text-text-muted" />}
      />
    </Link>
  );
}

export function RolesScreen() {
  const { orgId, profile } = useActiveOrg();
  const queryClient = useQueryClient();
  const canSeeMembers = useCan(CAPABILITY_MANAGE_MEMBERS);
  const details = useRoleDetails();
  const catalog = useCapabilityCatalog();
  const [choosing, setChoosing] = useState(false);

  const failure = details.isError
    ? toApiFailure(details.error)
    : catalog.isError
      ? toApiFailure(catalog.error)
      : null;
  const forbidden = failure?.kind === "forbidden";

  // A 403 mid-session means our copy of the caller's capabilities is stale —
  // ask the server again (the menu entry then disappears on its own).
  useEffect(() => {
    if (!forbidden) return;
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
  }, [forbidden, orgId, queryClient]);

  if (forbidden) {
    return <ForbiddenPanel orgId={orgId} copy={ROLE_FORBIDDEN_PANEL_COPY} />;
  }

  const page = details.data;
  const catalogData = catalog.data;
  const broken = failure !== null || (page !== undefined && page.items.length === 0);
  const loading = !broken && (page === undefined || catalogData === undefined);

  const retry = () => {
    void details.refetch();
    void catalog.refetch();
  };

  const canCreate = page?.viewer.canCreate;
  const writesOff = canCreate?.reason === "writes_disabled";
  const blockedCopy =
    canCreate && !canCreate.allowed && !writesOff
      ? createOrCloneBlockedReasonCopy(canCreate.reason, page?.viewer.limit)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-[var(--size-content-narrow-max-w)] flex-col gap-4 p-card-padding">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="m-0 text-heading-md">{rolesTh.title}</h1>
        {/* Disabled until BOTH reads are in (ux R2: "ถ้า R1 ยังไม่มีข้อมูล → ปุ่มสร้างยัง disabled"). */}
        <div className="flex flex-col items-end gap-1">
          <Button
            disabled={!page || !catalogData || canCreate?.allowed !== true}
            onClick={() => setChoosing(true)}
          >
            <Icon role="plus" />
            {rolesTh.create}
          </Button>
          {blockedCopy && (
            <p className="m-0 max-w-xs text-right text-body-sm text-text-muted">
              {blockedCopy.title ? `${blockedCopy.title} — ` : ""}
              {blockedCopy.body}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-body-sm text-text-muted">
        <p className="m-0">{rolesTh.intro}</p>
        <p className="m-0 flex flex-wrap items-center gap-2">
          {rolesTh.introMembers}
          {canSeeMembers && (
            <Link href={`/o/${orgId}/settings/members`} className="no-underline">
              <Button variant="tertiary">{rolesTh.goMembers}</Button>
            </Link>
          )}
        </p>
      </div>

      {writesOff && (
        <Banner tone="info" icon={<Icon role="info" />} role="status">
          <strong className="block">{bannerReasonCopy("writes_disabled").title}</strong>
          {bannerReasonCopy("writes_disabled").body}
        </Banner>
      )}

      {page && !broken && (
        <p className="m-0 text-body-sm text-text-muted">
          {rolesTh.counter(page.items.length, page.viewer.limit)}
        </p>
      )}

      {loading && (
        <div role="status" aria-label={rolesTh.loadingLabel}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {broken && (
        <SectionCard>
          <div role="alert" className="flex flex-col items-center gap-2 p-6 text-center">
            <h2 className="m-0 text-heading-sm">{rolesTh.error.title}</h2>
            <p className="m-0 text-body-sm text-text-muted">{rolesTh.error.body}</p>
            <Button variant="secondary" onClick={retry}>
              {rolesTh.error.retry}
            </Button>
          </div>
        </SectionCard>
      )}

      {page && catalogData && !broken && (
        <SectionCard className="p-0">
          {page.items.map((role) => (
            <RoleRowLink
              key={role.id}
              role={role}
              orgId={orgId}
              myRoleId={profile.myMembership.roleId}
            />
          ))}
        </SectionCard>
      )}

      {choosing && page && catalogData && (
        <TemplateDialog
          roles={page.items}
          catalog={catalogData}
          onClose={() => setChoosing(false)}
        />
      )}
    </main>
  );
}
