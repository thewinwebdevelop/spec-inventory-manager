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
import { useQueryClient } from "@tanstack/react-query";
import { displayRoleName, memberActionErrorMessage, memberRateLimitedMessage } from "../role-copy";
import { orgKey } from "../../../lib/org/org-keys";
import { useRoles } from "../api/use-members";
import { useActiveOrg } from "../../../lib/org/org-context";
import { roleOptionState } from "../role-picker";
import { toApiFailure } from "../../../lib/api/error";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { DialogShell } from "../../../components/ui/DialogShell";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { RoleCapabilitiesLink } from "./RoleCapabilitiesLink";
import { RadioCardGroup } from "../../../components/ui/RadioCardGroup";

/**
 * ux-wireframe §10.1, moved through F-003 §0.1: `ux` owns every string here,
 * and F-002's "สิทธิ์" (ROLE) is renamed to "บทบาท" throughout — the word
 * "สิทธิ์" now belongs to F-003's capability checklist and the two meanings
 * cannot share a screen (see ux-wireframe F-003 §0.1 migration table).
 */
export const CHANGE_ROLE_COPY = {
  title: (email: string) => `เปลี่ยนบทบาทของ ${email}`,
  currentTag: "(บทบาทปัจจุบัน)",
  lastOwnerWarning: "ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ",
  submit: "บันทึกบทบาท",
  submitLoading: "กำลังบันทึก...",
  cancel: "ยกเลิก",
  successToast: (email: string, role: string) => `เปลี่ยนบทบาทของ ${email} เป็น ${role} แล้ว`,
  error: {
    lastOwner:
      "ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คน — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วค่อยเปลี่ยนบทบาทนี้",
    forbidden:
      "คุณไม่มีสิทธิ์เปลี่ยนบทบาทนี้ — เฉพาะเจ้าของร้านเท่านั้นที่ตั้งหรือเปลี่ยนบทบาทของเจ้าของร้าน",
    roleInvalid: "บทบาทที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง",
    gone: "คนนี้ไม่ได้เป็นสมาชิกของร้านนี้แล้ว",
    generic: "เปลี่ยนบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
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
  const queryClient = useQueryClient();
  const roles = useRoles();
  const change = useChangeMemberRole();
  const [roleId, setRoleId] = useState(member.roleId);
  const [banner, setBanner] = useState<string | null>(null);

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
              selected
                ? displayRoleName({
                    name: selected.name,
                    roleKey: selected.key,
                    nameCustomized: selected.nameCustomized,
                  })
                : "",
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
          // T-003-W10 · §E — the F-002 fallback offered this, the server said the
          // target is not below you. Say so (not the Owner sentence), and refetch so
          // the row picks up the server's verdict instead of offering it again.
          if (failure.kind === "forbidden" && failure.code === "TARGET_NOT_BELOW_ACTOR") {
            setBanner(memberActionErrorMessage(failure.code, "changeRole"));
            void queryClient.invalidateQueries({ queryKey: orgKey(org.orgId, "members") });
            return;
          }
          if (failure.kind === "throttled") {
            setBanner(memberRateLimitedMessage(failure.retryAfterSeconds ?? 60));
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
    <DialogShell label={CHANGE_ROLE_COPY.title(member.email)} onClose={onClose}>
      <h3 className="text-heading-sm">{CHANGE_ROLE_COPY.title(member.email)}</h3>
      {banner && <ErrorBanner message={banner} />}

      <RadioCardGroup
        name="changeRoleId"
        legend={CHANGE_ROLE_COPY.title(member.email)}
        value={roleId}
        onChange={setRoleId}
        options={offered.map((role) => {
          // R8: the server's verdict decides. The member's CURRENT role may be
          // closed to the viewer yet stays checked - it is the default value, and
          // save is disabled because nothing changes.
          const state = roleOptionState(role, org.capabilities, ownerRoleIds);
          return {
            value: role.id,
            label: displayRoleName({
              name: role.name,
              roleKey: role.key,
              nameCustomized: role.nameCustomized,
            }),
            description: role.id === member.roleId ? CHANGE_ROLE_COPY.currentTag : undefined,
            disabled: change.isPending || state.closed,
            disabledReason: state.reason,
          };
        })}
      />

      <RoleCapabilitiesLink />

      {/* Before the press, never as an error afterwards (§10.1). */}
      {demotingAnOwner && <p className="text-body-sm">{CHANGE_ROLE_COPY.lastOwnerWarning}</p>}

      {/* `.dialog .acts` — one right-aligned row, `space.3` between. */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
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
    </DialogShell>
  );
}
