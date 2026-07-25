"use client";

import { useState } from "react";
import { PasswordField } from "../ui/PasswordField";
import { Button } from "../ui/Button";
import { ErrorBanner } from "../ui/ErrorBanner";
import { ThrottleBanner } from "../ui/ThrottleBanner";
import { authTh } from "../../i18n/auth";
import { ApiError, changePassword, isSessionExpired } from "../../lib/auth-client";
import { changePasswordErrorMessage } from "../../lib/error-messages";
import { useThrottleCountdown } from "../../hooks/use-throttle-countdown";
import { redirectToLoginSessionExpired } from "../../lib/session-expired-redirect";

/**
 * Change-password section (ux-wireframe §9, ui.md §2.1.1) — reuse-only, no
 * new component: PasswordField x2 + ErrorBanner + ThrottleBanner (shared
 * `auth.throttle.*` copy, same backoff machinery as login per api-spec §2.7
 * N-2). On success: clear both fields + green toast + call `onSuccess` so
 * the parent page can refresh the session list (ux-wireframe §9.4).
 */
export function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | undefined>();
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [newError, setNewError] = useState<string | undefined>();
  const throttle = useThrottleCountdown();

  const throttled = throttle.remainingSeconds > 0;
  const formDisabled = loading || throttled;

  async function handleSubmit() {
    setBannerError(undefined);
    setCurrentError(undefined);
    setNewError(undefined);
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      onSuccess();
    } catch (err) {
      // client-security review Important #4: check session-expiry FIRST,
      // before any ApiError-shape handling — a dead session must redirect
      // immediately with the standard polite toast, per ux-wireframe §7
      // ("ใช้ข้อความเดียวกันทุกสาเหตุ"), not render an inline form error that
      // invites the user to just retry against an already-dead session.
      if (isSessionExpired(err)) {
        redirectToLoginSessionExpired();
        return;
      }
      if (err instanceof ApiError) {
        if (err.status === 429) {
          throttle.start(err.retryAfterSeconds ?? 60);
        } else if (err.code === "INVALID_CREDENTIALS") {
          setCurrentError(changePasswordErrorMessage(err.code));
        } else if (err.code === "PASSWORD_TOO_SHORT" || err.code === "PASSWORD_BREACHED") {
          setNewError(changePasswordErrorMessage(err.code));
        } else {
          setBannerError(changePasswordErrorMessage(err.code));
        }
      } else {
        setBannerError(authTh.changePassword.error.generic);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!formDisabled) void handleSubmit();
      }}
      noValidate
    >
      <h2 className="m-0 mb-4 text-heading-sm">{authTh.changePassword.sectionTitle}</h2>

      {throttled ? (
        <ThrottleBanner remainingSeconds={throttle.remainingSeconds} />
      ) : (
        bannerError && <ErrorBanner message={bannerError} onRetry={handleSubmit} />
      )}

      <PasswordField
        label={authTh.changePassword.current.label}
        value={currentPassword}
        onChange={(v) => {
          setCurrentPassword(v);
          setCurrentError(undefined);
        }}
        errorText={currentError}
        disabled={formDisabled}
        autoComplete="current-password"
      />
      <PasswordField
        label={authTh.changePassword.new.label}
        value={newPassword}
        onChange={(v) => {
          setNewPassword(v);
          setNewError(undefined);
        }}
        placeholder={authTh.changePassword.new.placeholder}
        helperText={newError ? undefined : authTh.changePassword.new.helper}
        errorText={newError}
        disabled={formDisabled}
        autoComplete="new-password"
      />

      <Button
        type="submit"
        loading={loading}
        loadingLabel={authTh.changePassword.submitLoading}
        disabled={formDisabled}
      >
        {authTh.changePassword.submit}
      </Button>
    </form>
  );
}
