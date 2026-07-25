"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * `ConfirmDialog` (ui.md §2.1, contribute-back component). ux-wireframe §11.7
 * + ui.md §6: default focus MUST be "ยกเลิก" for the `destructive` variant
 * (guards against an accidental Enter destroying data) — implemented via
 * `autoFocus` on the cancel button plus a focus-trap-lite (Escape = cancel).
 *
 * D-020: kept as a hand-rolled overlay (not swapped for the Radix
 * `<Dialog>` primitive) — the existing focus/Escape/role wiring already
 * satisfies every a11y + test requirement, and this migration is a
 * mechanical restyle, not a behavior change.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  variant = "default",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="w-[90%] max-w-[400px] rounded-card bg-surface p-6 shadow-dialog"
      >
        <h2
          id="confirm-dialog-title"
          className="m-0 mb-3 text-heading-sm"
        >
          {title}
        </h2>
        <p id="confirm-dialog-body" className="m-0 mb-6 text-body-md text-text-muted">
          {body}
        </p>
        <div className="flex justify-end gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "destructive" ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
