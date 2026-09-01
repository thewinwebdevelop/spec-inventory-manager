"use client";

/**
 * S9 — เปลี่ยนสิทธิ์ (ux-wireframe §10.1). Closes half of W-17: the mutation
 * hook has existed since W5 and nothing could reach it.
 *
 * Three rules from §10.1, and each exists because of a specific way this
 * screen goes wrong:
 *
 *  - the Owner option is SHOWN and disabled for a non-Owner, not filtered out
 *    (§8's rule, D-028/C-1). Hiding it leaves an Admin wondering whether the
 *    shop even has such a role; showing it greyed with the reason answers the
 *    question they would otherwise ask the owner over chat.
 *  - the "a shop always needs an Owner" warning appears BEFORE the press, when
 *    the change would demote an Owner. `409 LAST_OWNER` after the fact is a
 *    worse version of the same sentence.
 *  - save is disabled while the selection equals the current role, so the
 *    dialog cannot produce a write that changes nothing — every such write is
 *    an audit row saying somebody did something they did not do.
 */
import { useState } from "react";
import { useChangeMemberRole } from "../api/use-member-mutations";
import { useRoles } from "../api/use-members";
import { useActiveOrg } from "../../../lib/org/org-context";
import { isOwner } from "../member-actions";
import { toApiFailure } from "../../../lib/api/error";
import { roleLabel } from "../i18n";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

/** Verbatim from ux-wireframe §10.1 — `ux` owns every string here. */
export const CHANGE_ROLE_COPY = {
  title: (email: string) => `เปลี่ยนสิทธิ์ของ ${email}`,
  currentTag: "(สิทธิ์ปัจจุบัน)",
  ownerOnlyHelper: "เฉพาะเจ้าของร้านเท่านั้นที่ตั้งหรือแก้สิทธิ์ของเจ้าของร้าน",
  lastOwnerWarning: "ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ",
  submit: "บันทึกสิทธิ์",
  submitLoading: "กำลังบันทึก...",
  cancel: "ยกเลิก",
  successToast: (email: string, role: string) => `เปลี่ยนสิทธิ์ของ ${email} เป็น ${role} แล้ว`,
  error: {
    lastOwner:
      "ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คน — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วค่อยเปลี่ยนสิทธิ์นี้",
    forbidden:
      "คุณไม่มีสิทธิ์เปลี่ยนสิทธิ์นี้ — เฉพาะเจ้าของร้านเท่านั้นที่ตั้งหรือแก้สิทธิ์ของเจ้าของร้าน",
    roleInvalid: "สิทธิ์ที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง",
    gone: "คนนี้ไม่ได้เป็นสมาชิกของร้านนี้แล้ว",
    generic: "เปลี่ยนสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

export function ChangeRoleDialog({
  member,
  ownerRoleIds,
  onClose,
}: {
  member: { userId: string; email: string; roleId: string; isOwner: boolean };
  /** Role ids known to carry `full_access` (§3.6 does not publish capabilities). */
  ownerRoleIds: ReadonlySet<string>;
  onClose: () => void;
}) {
  const org = useActiveOrg();
  const toast = useToast();
  const roles = useRoles();
  const change = useChangeMemberRole();
  const [roleId, setRoleId] = useState(member.roleId);
  const [banner, setBanner] = useState<string | null>(null);

  const iAmOwner = isOwner(org.capabilities);
  const offered = roles.data?.items ?? [];
  const selected = offered.find((role) => role.id === roleId);

  /**
   * Demoting somebody who holds ownership — including yourself, which is the
   * case people forget. `ownerRoleIds` only ever contains roles we could
   * classify (our own), so this leans on the server's `isOwner` flag for the
   * row, which is decided from capabilities (§3.7).
   */
  const demotingAnOwner = member.isOwner && !ownerRoleIds.has(roleId);
  const unchanged = roleId === member.roleId;

  const submit = () => {
    setBanner(null);
    change.mutate(
      { userId: member.userId, roleId },
      {
        onSuccess: () => {
          toast.success(
            CHANGE_ROLE_COPY.successToast(
              member.email,
              roleLabel(selected?.key ?? null, selected?.name ?? ""),
            ),
          );
          onClose();
        },
        onError: (err) => {
          const failure = toApiFailure(err);
          if (failure.kind === "not-found") {
            // Not something to fix in this box: the row is gone. Reported as
            // the neutral variant rather than danger — somebody else removing
            // this member while the dialog was open is a race, not a mistake
            // the reader made and can correct.
            toast.success(CHANGE_ROLE_COPY.error.gone);
            onClose();
            return;
          }
          if (failure.kind === "conflict" && failure.code === "LAST_OWNER") {
            setBanner(CHANGE_ROLE_COPY.error.lastOwner);
            return;
          }
          if (failure.kind === "forbidden" || failure.kind === "org-access-denied") {
            setBanner(CHANGE_ROLE_COPY.error.forbidden);
            return;
          }
          if (failure.kind === "validation") {
            setBanner(CHANGE_ROLE_COPY.error.roleInvalid);
            void roles.refetch();
            return;
          }
          setBanner(CHANGE_ROLE_COPY.error.generic);
        },
      },
    );
  };

  return (
    <div
      role="dialog"
      aria-label={CHANGE_ROLE_COPY.title(member.email)}
      className="space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card"
    >
      <h3 className="text-heading-sm">{CHANGE_ROLE_COPY.title(member.email)}</h3>
      {banner && <ErrorBanner message={banner} />}

      <fieldset>
        {offered.map((role) => {
          const isOwnerOption = ownerRoleIds.has(role.id);
          const disabled = change.isPending || (isOwnerOption && !iAmOwner);
          return (
            <label key={role.id} className="block">
              <input
                type="radio"
                name="changeRoleId"
                checked={roleId === role.id}
                onChange={() => setRoleId(role.id)}
                disabled={disabled}
              />
              {roleLabel(role.key, role.name)}
              {role.id === member.roleId && (
                <span className="text-body-sm"> {CHANGE_ROLE_COPY.currentTag}</span>
              )}
              {isOwnerOption && !iAmOwner && (
                <span className="text-body-sm"> {CHANGE_ROLE_COPY.ownerOnlyHelper}</span>
              )}
            </label>
          );
        })}
      </fieldset>

      {/* Before the press, never as an error afterwards (§10.1). */}
      {demotingAnOwner && <p className="text-body-sm">{CHANGE_ROLE_COPY.lastOwnerWarning}</p>}

      <Button
        onClick={submit}
        disabled={change.isPending || unchanged}
        loading={change.isPending}
        loadingLabel={CHANGE_ROLE_COPY.submitLoading}
      >
        {CHANGE_ROLE_COPY.submit}
      </Button>
      <Button variant="secondary" onClick={onClose} disabled={change.isPending}>
        {CHANGE_ROLE_COPY.cancel}
      </Button>
    </div>
  );
}
