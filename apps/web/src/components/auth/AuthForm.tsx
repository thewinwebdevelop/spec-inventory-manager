"use client";

import type { FormEvent, ReactNode } from "react";
import { PasswordField } from "../ui/PasswordField";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { ErrorBanner } from "../ui/ErrorBanner";
import { ThrottleBanner } from "../ui/ThrottleBanner";

export interface AuthFormProps {
  title: string;
  subtitle?: string;
  email: string;
  onEmailChange: (v: string) => void;
  onEmailBlur?: () => void;
  emailError?: string;
  password: string;
  onPasswordChange: (v: string) => void;
  passwordPlaceholder?: string;
  passwordHelper?: string;
  passwordError?: string;
  submitLabel: string;
  submitLoadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  bannerError?: string;
  onBannerRetry?: () => void;
  throttleRemainingSeconds?: number;
  onSubmit: () => void;
  footer?: ReactNode;
  passwordAutoFocus?: boolean;
}

/**
 * `AuthForm` (ui.md §2.1) — shared email+password form shell for signup and
 * login, covering all 4 states (design-system.md §2): loading (submit button
 * spinner + disabled), error (ErrorBanner / ThrottleBanner + inline field
 * errors), success is the caller's redirect, and the plain/empty form is the
 * default render.
 */
export function AuthForm({
  title,
  subtitle,
  email,
  onEmailChange,
  onEmailBlur,
  emailError,
  password,
  onPasswordChange,
  passwordPlaceholder,
  passwordHelper,
  passwordError,
  submitLabel,
  submitLoadingLabel,
  loading,
  disabled = false,
  bannerError,
  onBannerRetry,
  throttleRemainingSeconds,
  onSubmit,
  footer,
  passwordAutoFocus,
}: AuthFormProps) {
  const throttled = Boolean(throttleRemainingSeconds && throttleRemainingSeconds > 0);
  const formDisabled = disabled || loading || throttled;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formDisabled) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="m-0 text-center text-heading-md">{title}</h1>
      {subtitle && (
        <p className="mt-2 mb-8 text-center text-text-muted">{subtitle}</p>
      )}
      {!subtitle && <div className="mb-8" />}

      {throttled ? (
        <ThrottleBanner remainingSeconds={throttleRemainingSeconds!} />
      ) : (
        bannerError && <ErrorBanner message={bannerError} onRetry={onBannerRetry} />
      )}

      <TextField
        label="อีเมล"
        type="email"
        value={email}
        onChange={onEmailChange}
        onBlur={onEmailBlur}
        errorText={emailError}
        disabled={formDisabled}
        autoComplete="email"
      />
      <PasswordField
        label="รหัสผ่าน"
        value={password}
        onChange={onPasswordChange}
        placeholder={passwordPlaceholder}
        helperText={passwordError ? undefined : passwordHelper}
        errorText={passwordError}
        disabled={formDisabled}
        autoComplete="current-password"
        autoFocus={passwordAutoFocus}
      />

      <Button
        type="submit"
        fullWidth
        loading={loading}
        loadingLabel={submitLoadingLabel}
        disabled={formDisabled}
      >
        {submitLabel}
      </Button>

      {footer && <div className="mt-6 text-center">{footer}</div>}
    </form>
  );
}
