"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AuthCard } from "../../components/ui/AuthCard";
import { AuthForm } from "../../features/auth/components/AuthForm";
import { Toast, type ToastData } from "../../components/ui/Toast";
import { useThrottleCountdown } from "../../hooks/use-throttle-countdown";
import { authTh } from "../../features/auth/i18n";
import { ApiError, login } from "../../lib/auth-client";
import { loginErrorMessage } from "../../lib/error-messages";
import { useSession } from "../../lib/session/session-context";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | undefined>();
  const [passwordAutoFocus, setPasswordAutoFocus] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const throttle = useThrottleCountdown();

  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setEmail(prefill);
    if (searchParams.get("signupSuccess") === "1") {
      setToast({ message: authTh.signup.successToast, variant: "success" });
    }
    // ux-wireframe §7 / client-security review Important #4: identical
    // "session expired" toast regardless of WHY the session died (silent
    // refresh failed, retry-once still 401'd, logout-all failed elsewhere,
    // kicked mid-flight, etc.) — see session-expired-redirect.ts. Spec calls
    // this "toast สุภาพ ไม่กล่าวโทษ" (polite, non-blaming) with no color
    // mandated; `Toast` only has success/danger variants today, so this uses
    // `danger` as the closest fit pending a neutral/info variant from `ux`
    // if the red styling reads as too alarming for a no-fault event.
    if (searchParams.get("sessionExpired") === "1") {
      setToast({ message: authTh.sessionExpired.toast, variant: "danger" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  async function handleSubmit() {
    setBannerError(undefined);
    setLoading(true);
    try {
      await login(email, password);
      // ★ T-002-Q5 — tell the provider, or the app still believes nobody is
      // signed in. It bootstraps once per page load, and that bootstrap ran
      // before this login; `OrgGuard` reads the result, so without this line
      // `/o/{orgId}` sends the person who just signed in back to `/login`.
      session.beginSession();
      // ★ T-002-Q5 — F-002 owns this destination, and never claimed it.
      //
      // The line here read `router.push("/")` with a comment saying F-002
      // would take it over. F-002 shipped its screens and left the redirect
      // pointing at the F-000 placeholder shell, so a successful login landed
      // on "apps/web placeholder shell (T-000-09)" and the org flow was
      // reachable only by typing the URL. Found by writing E-01, which is the
      // first thing that ever walked login → shop as one journey.
      //
      // `/select-org` is what ux-wireframe §1.1's flow map has always said:
      // login สำเร็จ → S1. The picker itself decides where to go from there —
      // it is the screen that knows whether the person has no shops, one, or
      // several.
      router.push("/select-org");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          throttle.start(err.retryAfterSeconds ?? 60);
        } else {
          // Enumeration-safe: same message + both fields flagged, password
          // cleared + refocused (ux-wireframe §3.1).
          setBannerError(loginErrorMessage(err.code));
          setPassword("");
          setPasswordAutoFocus(true);
        }
      } else {
        setBannerError(authTh.login.error.generic);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasCredentialError = Boolean(bannerError);

  return (
    <AuthCard>
      <Toast toast={toast} />
      <AuthForm
        title={authTh.login.title}
        email={email}
        onEmailChange={setEmail}
        emailError={hasCredentialError ? " " : undefined}
        password={password}
        onPasswordChange={setPassword}
        passwordError={hasCredentialError ? " " : undefined}
        passwordAutoFocus={passwordAutoFocus}
        submitLabel={authTh.login.submit}
        submitLoadingLabel={authTh.login.submitLoading}
        loading={loading}
        bannerError={bannerError}
        throttleRemainingSeconds={throttle.remainingSeconds}
        onSubmit={handleSubmit}
        footer={
          <div className="flex flex-col gap-3">
            <Link href="/login/help">{authTh.login.forgotPassword}</Link>
            <Link href="/signup">{authTh.login.linkToSignup}</Link>
          </div>
        }
      />
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
