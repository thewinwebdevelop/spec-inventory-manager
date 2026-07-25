"use client";

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
      {(isSuccess ? "✓ " : "⚠ ") + toast.message}
    </div>
  );
}
