"use client";

/**
 * S10 — ถอดออกจากร้าน (ux-wireframe §10.2). The other half of W-17.
 *
 * ⚠️ NOT `ConfirmDialog`, and the reason is the copy. ux review item 8 threw
 * out "แน่ใจหรือไม่" and replaced it with four statements of what actually
 * happens — access ends now, their history stays, a pending invitation to the
 * same address is cancelled with them, and coming back needs a new invitation.
 * A shared confirm takes one body string; these are four separate facts and a
 * reader skims them as a list. Somebody who has read them can decide; somebody
 * asked "are you sure" can only guess.
 *
 * `alertdialog` with focus on ยกเลิก, because the confirming button ends
 * somebody's access to a shop and Enter is one keystroke away.
 */
import { useEffect, useRef, useState } from "react";
import { useRemoveMember } from "../api/use-member-mutations";
import { toApiFailure } from "../../../lib/api/error";
import { useToast } from "../../../components/providers/ToastProvider";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

/** Verbatim from ux-wireframe §10.2. */
export const REMOVE_MEMBER_COPY = {
  title: (email: string) => `ถอด ${email} ออกจากร้าน?`,
  consequences: [
    "เขาจะเข้าถึงข้อมูลของร้านนี้ไม่ได้ทันที",
    "ประวัติการทำรายการที่เขาเคยทำไว้ยังอยู่ครบ",
    "ถ้ามีคำเชิญของอีเมลนี้ค้างอยู่ ระบบจะยกเลิกให้ด้วย",
    "ให้กลับเข้ามาใหม่ได้ด้วยการเชิญใหม่เท่านั้น",
  ],
  confirm: "ถอดออกจากร้าน",
  cancel: "ยกเลิก",
  successToast: (email: string) => `ถอด ${email} ออกจากร้านแล้ว`,
  /** §10.2 — appended only when the server actually cancelled some. */
  alsoCancelled: (n: number) => ` · ยกเลิกคำเชิญที่ค้างอยู่ ${n} ใบด้วย`,
  error: {
    lastOwner: "ร้านนี้ต้องมีเจ้าของอย่างน้อย 1 คน — ตั้งคนอื่นเป็นเจ้าของร้านก่อน",
    forbidden: "เฉพาะเจ้าของร้านเท่านั้นที่ถอดเจ้าของร้านคนอื่นได้",
    gone: "คนนี้ไม่ได้เป็นสมาชิกของร้านนี้แล้ว",
    generic: "ถอดสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

/** The §3.9 body, as much of it as this dialog needs. */
function cancelledCount(result: unknown): number {
  const n = (result as { cancelledInvitations?: unknown } | null)?.cancelledInvitations;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: { userId: string; email: string };
  onClose: () => void;
}) {
  const toast = useToast();
  const remove = useRemoveMember();
  const [banner, setBanner] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const submit = () => {
    setBanner(null);
    remove.mutate(member.userId, {
      onSuccess: (result) => {
        const cancelled = cancelledCount(result);
        // I-1 made this visible on purpose: removing somebody also kills the
        // invitation they were sent, and an owner who is not told will send
        // the same dead link again.
        toast.success(
          REMOVE_MEMBER_COPY.successToast(member.email) +
            (cancelled > 0 ? REMOVE_MEMBER_COPY.alsoCancelled(cancelled) : ""),
        );
        onClose();
      },
      onError: (err) => {
        const failure = toApiFailure(err);
        if (failure.kind === "not-found") {
          toast.success(REMOVE_MEMBER_COPY.error.gone);
          onClose();
          return;
        }
        if (failure.kind === "conflict" && failure.code === "LAST_OWNER") {
          setBanner(REMOVE_MEMBER_COPY.error.lastOwner);
          return;
        }
        if (failure.kind === "forbidden" || failure.kind === "org-access-denied") {
          setBanner(REMOVE_MEMBER_COPY.error.forbidden);
          return;
        }
        setBanner(REMOVE_MEMBER_COPY.error.generic);
      },
    });
  };

  return (
    <div
      role="alertdialog"
      aria-label={REMOVE_MEMBER_COPY.title(member.email)}
      className="space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card"
    >
      <h3 className="text-heading-sm">{REMOVE_MEMBER_COPY.title(member.email)}</h3>
      {banner && <ErrorBanner message={banner} />}

      <ul>
        {REMOVE_MEMBER_COPY.consequences.map((line) => (
          <li key={line} className="text-body-sm">
            {line}
          </li>
        ))}
      </ul>

      {/* `.dialog .acts` — one right-aligned row, `space.3` between. */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={remove.isPending}>
          {REMOVE_MEMBER_COPY.cancel}
        </Button>
        <Button
          variant="destructive"
          onClick={submit}
          disabled={remove.isPending}
          loading={remove.isPending}
        >
          {REMOVE_MEMBER_COPY.confirm}
        </Button>
      </div>
    </div>
  );
}
