"use client";

import { useId, type ReactNode, type Ref } from "react";
import { cn } from "./utils";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  errorText?: string;
  disabled?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Muted line under the field (always shown, below any error). */
  helperText?: string;
  /** Right-aligned under the field, e.g. a "{n}/50" counter (live, polite). */
  counter?: ReactNode;
  /** Counter in the danger colour (over the limit). */
  counterInvalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  errorText,
  disabled,
  autoComplete,
  onBlur,
  onFocus,
  helperText,
  counter,
  counterInvalid = false,
  inputRef,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const hasError = Boolean(errorText);
  const describedBy =
    [hasError ? errorId : null, helperText ? helperId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="mb-form-gap">
      <label htmlFor={id} className="mb-2 block text-label-sm text-text">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={cn(
          "box-border min-h-[var(--size-tap-target-min)] w-full rounded-button border p-3 text-body-md",
          hasError ? "border-danger-border" : "border-border-default",
        )}
      />
      {(hasError || helperText || counter !== undefined) && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {hasError && (
              <p id={errorId} className="m-0 text-body-sm text-danger-text">
                {errorText}
              </p>
            )}
            {helperText && (
              <p id={helperId} className="m-0 text-body-sm text-text-muted">
                {helperText}
              </p>
            )}
          </div>
          {counter !== undefined && (
            <span
              aria-live="polite"
              className={cn(
                "flex-none text-body-sm tabular-nums",
                counterInvalid ? "text-danger-text" : "text-text-muted",
              )}
            >
              {counter}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
