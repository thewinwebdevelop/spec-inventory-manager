"use client";

import { Icon } from "./Icon";
import { cn } from "./utils";

export type ToastVariant = "success" | "danger";

export interface ToastData {
  message: string;
  variant: ToastVariant;
}

/**
 * Minimal toast — top-right on web (ui.md §5). `aria-live="polite"` so it's
 * announced without stealing focus.
 */
export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  const isSuccess = toast.variant === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-6 right-6 z-[100] max-w-[360px] rounded-card border p-4 shadow-toast",
        isSuccess
          ? "border-success-text bg-success-bg text-success-text"
          : "border-danger-border bg-danger-bg text-danger-text",
      )}
    >
      {/* `icon.check-circle` / `icon.warn` (§1.6.2) — these were the glyphs
          "✓ " and "⚠ " concatenated onto the message, so they rendered in
          whatever font the reader has and could not be sized or aligned. */}
      <span className="flex items-start gap-2">
        <Icon role={isSuccess ? "check-circle" : "warn"} size="md" className="mt-0.5" />
        <span className="min-w-0 flex-1">{toast.message}</span>
      </span>
    </div>
  );
}
