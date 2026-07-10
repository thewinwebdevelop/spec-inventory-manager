"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

/**
 * D-020 (Tailwind v4 + shadcn/ui migration) — same variants/props/behavior
 * as before, now expressed as `cva` classes over the design-token `@theme`
 * (docs/design-system.md §1: `color.primary*`, `radius.button`,
 * `type.button.md`, `size.tap-target.min`) instead of inline `style`.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-button text-button-md font-[var(--text-button-md--font-weight)] leading-[var(--text-button-md--line-height)] min-h-[var(--size-tap-target-min)] px-4 py-3 border transition-colors disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg border-primary hover:bg-primary-hover disabled:hover:bg-primary",
        secondary:
          "bg-surface text-text border-border-default hover:bg-surface-muted",
        destructive: "bg-danger text-danger-fg border-danger",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    loadingLabel,
    fullWidth = false,
    disabled,
    children,
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, fullWidth }),
        disabled || loading ? "cursor-default" : "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {loading ? (loadingLabel ?? "...") : children}
    </button>
  );
});
