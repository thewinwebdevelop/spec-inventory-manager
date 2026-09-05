"use client";

/**
 * ★ The overlay every "dialog" in F-002 was missing.
 *
 * ui.md §1 lists S5 (tax profile), S7 (invite), S8 (invite link), S9 (change
 * role) and the rename as `dialog` on web. Seven of the eight components that
 * implement them had no overlay at all: they returned a plain card into normal
 * document flow, so opening one appended a form to the BOTTOM of the page,
 * below the content it was supposed to sit over. The user found it by looking
 * at a whole screen; I had been measuring individual elements and reading
 * cropped screenshots, which is exactly the blind spot that lets something
 * this obvious survive.
 *
 * `ConfirmDialog` is the one that was right, and its behaviour is the
 * behaviour here: centred over a `color.overlay` scrim, Escape closes, focus
 * moves into the panel on open and returns to whatever opened it on close.
 * Kept hand-rolled for the same reason D-020 gave — the wiring already
 * satisfies the a11y requirements and swapping in a primitive would be a
 * behaviour change nobody asked for.
 *
 * The panel is `size.dialog.max-w` (480px), which is the token six screens had
 * been typing out by hand.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./utils";

export function DialogShell({
  label,
  onClose,
  children,
  className,
  role = "dialog",
}: {
  /** Accessible name — every dialog must have one. */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    // Focus the panel itself rather than its first control: on a form dialog
    // that would put the cursor in a field before the person has read the
    // heading.
    panelRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 sm:items-center"
      onMouseDown={(e) => {
        // Click the scrim to dismiss; a mousedown that STARTED inside the panel
        // and ended outside (a drag while selecting text) must not close it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "my-auto w-full max-w-[var(--size-dialog-max-w)] space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-dialog outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
