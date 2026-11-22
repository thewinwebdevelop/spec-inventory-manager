"use client";

/**
 * R3a — ยืนยันก่อนบันทึก (ux-wireframe R3a · AC-3.10 / AC-3.11) · T-003-W07.
 *
 * Opens only in edit mode when the PATCH body carries `capabilities` (a
 * rename alone is sent straight away). Shows the expanded diff, the impact
 * (N from the server's `usage` — never counted here) and, for the viewer's
 * OWN role, what they are about to lose (`lostCapabilities`, core-domain).
 *
 * Nothing is sent until "บันทึก" is pressed; while the request is in flight
 * the dialog cannot be dismissed and the button cannot be pressed again, so
 * one confirmation = one PATCH.
 */
import { useEffect, useRef } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { DialogShell } from "../../../components/ui/DialogShell";
import { Icon } from "../../../components/ui/Icon";
import { roleFormTh } from "./i18n";
import { hasLines, type CapabilityLines, type SaveConfirmation } from "./role-change-summary";

const T = roleFormTh.confirm;

export function CapabilityLineList({ lines }: { lines: CapabilityLines }) {
  return (
    <ul className="m-0 list-disc space-y-1 pl-6">
      {lines.labels.map((l) => (
        <li key={l}>{l}</li>
      ))}
      {lines.otherCount > 0 && <li>{roleFormTh.checklist.unknownExtra(lines.otherCount)}</li>}
    </ul>
  );
}

function Section({ title, lines }: { title: string; lines: CapabilityLines }) {
  if (!hasLines(lines)) return null;
  return (
    <section className="space-y-1 text-body-md">
      <h3 className="m-0 text-label-sm">{title}</h3>
      <CapabilityLineList lines={lines} />
    </section>
  );
}

export function SaveConfirmDialog({
  confirmation,
  submitting,
  onCancel,
  onConfirm,
}: {
  confirmation: SaveConfirmation;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { usage, selfLoss } = confirmation;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const title = T.title(confirmation.roleName);

  // ux R3a: with the self-loss warning the primary turns destructive and focus
  // starts on "แก้ต่อ" (`focusCancel`). Runs after DialogShell's own focus.
  useEffect(() => {
    if (selfLoss) cancelRef.current?.focus();
  }, [selfLoss]);

  const close = () => {
    if (!submitting) onCancel();
  };

  return (
    <DialogShell label={title} onClose={close} role="alertdialog">
      {/* An explicit gap: `m-0` on the heading would cancel DialogShell's space-y. */}
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-heading-sm">{title}</h2>
        <Section title={T.added} lines={confirmation.added} />
        <Section title={T.removed} lines={confirmation.removed} />
        <div className="space-y-1 text-body-sm text-text-muted">
          <p className="m-0">
            {usage.activeMembers > 0 ? T.impactMembers(usage.activeMembers) : T.impactNone}
          </p>
          {usage.pendingInvitations > 0 && (
            <p className="m-0">{T.impactInvitations(usage.pendingInvitations)}</p>
          )}
        </div>
        {selfLoss && (
          <Banner tone="warning" icon={<Icon role="warn" />} role="alert">
            <strong className="block">{T.selfLossTitle}</strong>
            <CapabilityLineList lines={selfLoss.lines} />
            <p className="m-0 mt-2">
              {selfLoss.losesManageRoles ? T.selfLossManageRoles : T.selfLossOther}
            </p>
          </Banner>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={close} disabled={submitting}>
            {T.keepEditing}
          </Button>
          <Button
            variant={selfLoss ? "destructive" : "primary"}
            onClick={() => {
              if (!submitting) onConfirm();
            }}
            loading={submitting}
            loadingLabel={T.saving}
          >
            {selfLoss ? T.saveAndLose : T.save}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
