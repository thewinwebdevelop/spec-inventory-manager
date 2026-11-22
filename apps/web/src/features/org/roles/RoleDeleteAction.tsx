"use client";

/**
 * R5 — ลบบทบาท (ux-wireframe R5 · AC-3.8 / AC-3.9b) · T-003-W09.
 *
 * The "ลบบทบาทนี้" button of R3/R4 ("การจัดการอื่น"), what sits under it, and
 * the dialog it opens. What the button does is decided by
 * {@link deleteAffordance} from the server's verdicts only.
 *
 *  - (ก) `canDelete.allowed` → ConfirmDialog-style alertdialog, destructive,
 *    focus on "ไม่ลบ". One press = one DELETE (in-flight latch; while sending
 *    the dialog cannot be dismissed). Success → R1 + toast.
 *  - (ข) still in use — (1) `canDelete.reason = in_use` already: the button is
 *    disabled and the panel is shown UNDER it from `usage` (no need to press
 *    first); (2) a `409 ROLE_IN_USE` at confirm (someone joined meanwhile):
 *    the dialog turns into (ข) with the numbers from `details`, and the role
 *    is re-read.
 *  - links to R6 only for a viewer who can open it (`can("manage_members")`,
 *    the same UX rule as the members menu — R6 is behind its own guard and
 *    the server decides there); otherwise the "คนที่จัดการสมาชิกได้…" line.
 *  - other refusals per §E (`role-delete-failure.ts`).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveOrg } from "../../../lib/org/org-context";
import { can, CAPABILITY_MANAGE_MEMBERS } from "../../../lib/org/capability";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { DialogShell } from "../../../components/ui/DialogShell";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/providers/ToastProvider";
import { roleRateLimitedMessage } from "../role-copy";
import { roleDeleteTh } from "./i18n";
import { deleteAffordance, inUseCountLine } from "./role-actions-model";
import { classifyRoleDeleteFailure, type RoleUsageCounts } from "./role-delete-failure";
import type { RoleRefetchTarget } from "./role-write-failure";
import type { RoleDetail } from "./api/use-role-details";
import { useDeleteRole } from "./api/use-role-mutations";

const T = roleDeleteTh;

export interface RoleDeleteActionProps {
  role: RoleDetail;
  /** The role's display name (§0.2) — the dialog title and the toast use it. */
  displayName: string;
  /** `myMembership.roleId === role.id` */
  isMine: boolean;
  onRefetch: (targets: readonly RoleRefetchTarget[]) => void;
  onForbidden: () => void;
}

/** Renders nothing when the affordance is `hidden` — the caller can test `deleteAffordance` first. */
export function RoleDeleteAction({
  role,
  displayName,
  isMine,
  onRefetch,
  onForbidden,
}: RoleDeleteActionProps) {
  const { orgId } = useActiveOrg();
  const router = useRouter();
  const toast = useToast();
  const throttle = useThrottleCountdown();
  const del = useDeleteRole(role.id);
  const affordance = deleteAffordance(role.viewer, role.isSystem);

  const [dialog, setDialog] = useState<
    { mode: "confirm" } | { mode: "in-use"; usage: RoleUsageCounts | null } | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const latch = useRef(false);

  if (affordance.kind === "hidden") return null;

  const listHref = `/o/${orgId}/settings/roles`;

  const open = () => {
    setBanner(null);
    setDialogError(null);
    setDialog({ mode: "confirm" });
  };
  const close = () => {
    if (!submitting) setDialog(null);
  };

  const confirm = async () => {
    if (latch.current || dialogError) return;
    latch.current = true;
    setSubmitting(true);
    try {
      await del.mutateAsync();
      toast.success(T.deletedToast(displayName));
      router.push(listHref);
    } catch (err) {
      const f = classifyRoleDeleteFailure(err);
      switch (f.kind) {
        case "in-use":
          setDialog({ mode: "in-use", usage: f.usage });
          onRefetch(["role", "list"]);
          break;
        case "history-limit":
          // ux §E: shown in R5, the confirm button is closed.
          setDialogError(f.message);
          onRefetch(["role"]);
          break;
        case "gone":
          setDialog(null);
          toast.error(T.goneToast);
          router.push(listHref);
          break;
        case "forbidden":
          setDialog(null);
          onForbidden();
          break;
        case "throttled":
          setDialog(null);
          throttle.start(f.seconds);
          break;
        case "banner":
          setDialog(null);
          setBanner(f.message);
          onRefetch(f.refetch);
          break;
      }
    } finally {
      latch.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="secondary"
        disabled={affordance.kind !== "enabled" || throttle.isActive}
        onClick={open}
      >
        {T.button}
      </Button>

      {affordance.kind === "in-use" && (
        <InUsePanel roleId={role.id} usage={role.usage} isMine={isMine} headingLevel="p" />
      )}
      {affordance.kind === "blocked" && (
        <div className="text-body-sm text-text-muted">
          {affordance.copy.title && (
            <p className="m-0 font-semibold text-text">{affordance.copy.title}</p>
          )}
          <p className="m-0">{affordance.copy.body}</p>
        </div>
      )}
      {throttle.isActive && (
        <Banner tone="warning" icon={<Icon role="clock" />} role="status" className="tabular-nums">
          {roleRateLimitedMessage(throttle.remainingSeconds)}
        </Banner>
      )}
      {banner && <ErrorBanner message={banner} />}

      {dialog?.mode === "confirm" && (
        <ConfirmDeleteDialog
          name={displayName}
          submitting={submitting}
          error={dialogError}
          onCancel={close}
          onConfirm={() => void confirm()}
        />
      )}
      {dialog?.mode === "in-use" && (
        <DialogShell label={T.inUse.title} onClose={() => setDialog(null)} role="alertdialog">
          <div className="flex flex-col gap-4">
            <h2 className="m-0 text-heading-sm">{T.inUse.title}</h2>
            <InUsePanel roleId={role.id} usage={dialog.usage} isMine={isMine} headingLevel={null} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                {T.inUse.close}
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

/** R5 (ก). */
function ConfirmDeleteDialog({
  name,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const title = T.confirm.title(name);
  // `focusCancel` (ui.md §1: R5 = destructive) — after DialogShell's own focus.
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <DialogShell label={title} onClose={onCancel} role="alertdialog">
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-heading-sm">{title}</h2>
        <p className="m-0 text-body-md text-text-muted">{T.confirm.body}</p>
        {error && (
          <div
            role="alert"
            className="rounded-card border border-danger-border bg-danger-bg p-4 text-body-sm text-danger-text"
          >
            {error}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={submitting}>
            {T.confirm.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={error !== null}
            loading={submitting}
            loadingLabel={T.confirm.confirming}
          >
            {T.confirm.confirm}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

/**
 * R5 (ข) — the count line (§0.2, zero parts dropped), what to do, and the way
 * to R6. On the page it carries its own title; in the dialog the dialog's
 * heading is the title (`headingLevel={null}`).
 */
function InUsePanel({
  roleId,
  usage,
  isMine,
  headingLevel,
}: {
  roleId: string;
  usage: RoleUsageCounts | null;
  isMine: boolean;
  headingLevel: "p" | null;
}) {
  const { orgId, capabilities } = useActiveOrg();
  const canOpenMembers = can(capabilities, CAPABILITY_MANAGE_MEMBERS);
  const counts = usage ? inUseCountLine(usage, isMine) : "";
  const onlyMe =
    usage !== null && isMine && usage.activeMembers === 1 && usage.pendingInvitations === 0;
  const r6 = `/o/${orgId}/settings/members?roleId=${encodeURIComponent(roleId)}`;
  const members = usage?.activeMembers ?? 0;
  const invitations = usage?.pendingInvitations ?? 0;

  return (
    <div
      role="group"
      aria-label={T.inUse.title}
      className="flex flex-col items-start gap-2 text-body-sm text-text-muted"
    >
      {headingLevel && <p className="m-0 font-semibold text-text">{T.inUse.title}</p>}
      {counts && <p className="m-0">{counts}</p>}
      <p className="m-0">{onlyMe ? T.inUse.onlyYou : T.inUse.instruction}</p>
      {canOpenMembers ? (
        (members > 0 || invitations > 0) && (
          <div className="flex flex-wrap gap-2">
            {members > 0 && (
              <ButtonLink href={r6} variant="secondary" size="sm">
                {T.inUse.viewMembers(members)}
              </ButtonLink>
            )}
            {invitations > 0 && (
              <ButtonLink href={`${r6}#role-invitations`} variant="secondary" size="sm">
                {T.inUse.viewInvitations(invitations)}
              </ButtonLink>
            )}
          </div>
        )
      ) : (
        <p className="m-0">{T.inUse.noManageMembers}</p>
      )}
    </div>
  );
}
