"use client";

import { useId, useState } from "react";
import { authTh } from "../../i18n/auth";
import { cn } from "./utils";

export interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
}

/**
 * `PasswordField` (ui.md §2.1) — input + show/hide toggle + helper/error
 * slot. Reused by signup, login, change-password (ui.md §2.1.1) and the
 * admin-reset dialog spec'd for F-004.
 *
 * Accessibility (ui.md §6): label bound to the input via htmlFor/id (not
 * placeholder-only); toggle button has an aria-label that flips
 * "แสดงรหัสผ่าน"/"ซ่อนรหัสผ่าน"; min 44px tap target
 * (`size.tap-target.min`).
 */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  errorText,
  disabled,
  autoComplete,
  autoFocus,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorText);

  return (
    <div className="mb-form-gap">
      <label
        htmlFor={id}
        className="mb-2 block text-label-sm text-text"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={cn(
            "box-border min-h-[var(--size-tap-target-min)] w-full rounded-button border p-3 text-body-md",
            "pr-[calc(var(--size-tap-target-min)+8px)]", // space.2 (design-system.md §1.3)
            hasError ? "border-danger-border" : "border-border-default",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? authTh.common.passwordHide : authTh.common.passwordShow}
          className={cn(
            "absolute right-0 top-0 h-full w-[var(--size-tap-target-min)] min-w-[var(--size-tap-target-min)] border-none bg-transparent",
            disabled ? "cursor-default" : "cursor-pointer",
          )}
        >
          {visible ? "🙈" : "👁"}
        </button>
      </div>
      {hasError ? (
        <p id={errorId} className="mt-2 text-body-sm text-danger-text">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-2 text-body-sm text-text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
