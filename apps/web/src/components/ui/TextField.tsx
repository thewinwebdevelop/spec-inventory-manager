"use client";

import { useId } from "react";
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
}: TextFieldProps) {
  const id = useId();
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
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "box-border min-h-[var(--size-tap-target-min)] w-full rounded-button border p-3 text-body-md",
          hasError ? "border-danger-border" : "border-border-default",
        )}
      />
      {hasError && (
        <p id={errorId} className="mt-2 text-body-sm text-danger-text">
          {errorText}
        </p>
      )}
    </div>
  );
}
