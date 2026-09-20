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
  "inline-flex items-center justify-center gap-2 rounded-button min-h-[var(--size-tap-target-min)] border transition-colors disabled:opacity-60",
  {
    variants: {
      variant: {
        /* §1.1c — the BUTTON tokens, not `color.primary`. In dark those two
           must differ: a link has to be light on charcoal, a button deep and
           solid. `shadow-btn` is `none` in light and the lift in dark. */
        primary:
          "bg-btn-bg text-btn-fg border-btn-bg shadow-btn hover:bg-btn-hover disabled:hover:bg-btn-bg",
        secondary:
          "bg-surface text-text border-border-default hover:bg-surface-muted",
        destructive:
          "bg-btn-danger-bg text-btn-fg border-btn-danger-bg shadow-btn hover:bg-btn-danger-hover",
        /**
         * D-031 / design-system.md §1.1c-3. The quietest action there is
         * ("ไว้ทีหลัง", "ออกจากร้านนี้", "ใช้บัญชีอื่น"): no fill, no border,
         * and the text is `color.primary` ALWAYS — never `text.muted`, which
         * would make a real action look disabled. Hover is a `surface.muted`
         * fill and never an underline.
         */
        tertiary:
          "bg-transparent text-primary border-transparent hover:bg-surface-muted",
      },
      /**
       * "ตัวอักษรเล็กลง ปุ่มไม่เตี้ยลง" — `sm` shrinks the type and the
       * horizontal padding and keeps the 44px tap target, on every platform.
       * The mockup writes the reason down: the web app is used on touch
       * tablets, and Flutter shares this token set.
       */
      size: {
        md: "text-button-md font-[var(--text-button-md--font-weight)] leading-[var(--text-button-md--line-height)] px-4 py-3",
        sm: "text-button-sm font-[var(--text-button-sm--font-weight)] leading-[var(--text-button-sm--line-height)] px-3 py-2",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      // §1.1c-3: tertiary is defined AS the small type, whatever size is asked
      // for — it is the quiet one, and a 16px quiet button is not quiet.
      {
        variant: "tertiary",
        class:
          "text-button-sm font-[var(--text-button-sm--font-weight)] leading-[var(--text-button-sm--line-height)] px-2",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
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
    size = "md",
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
        buttonVariants({ variant, size, fullWidth }),
        disabled || loading ? "cursor-default" : "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {loading ? (loadingLabel ?? "...") : children}
    </button>
  );
});
