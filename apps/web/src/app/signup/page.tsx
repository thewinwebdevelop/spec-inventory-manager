"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "../../components/ui/AuthCard";
import { AuthForm } from "../../components/auth/AuthForm";
import { authTh } from "../../i18n/auth";
import { ApiError, signup } from "../../lib/auth-client";
import { signupErrorMessage } from "../../lib/error-messages";
import { isValidEmailShape } from "../../lib/validation";

/**
 * `/signup` (ux-wireframe §2, ui.md #1). Auto-login on signup: NO (locked in
 * api-spec.md §4 open item #1 / ux-wireframe §0) — 201 redirects to
 * `/login?email=...` with the email prefilled + a success toast, matching
 * ux-wireframe §2's "สำเร็จ" row.
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [throttleSeconds, setThrottleSeconds] = useState<number | undefined>();

  const emailInvalid = emailTouched && email.length > 0 && !isValidEmailShape(email);

  async function handleSubmit() {
    setBannerError(undefined);
    setEmailError(undefined);
    setPasswordError(undefined);
    setThrottleSeconds(undefined);

    if (!isValidEmailShape(email)) {
      setEmailError(authTh.signup.error.emailInvalid);
      return;
    }

    setLoading(true);
    try {
      await signup({ email, password });
      router.push(`/login?email=${encodeURIComponent(email)}&signupSuccess=1`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setThrottleSeconds(err.retryAfterSeconds ?? 60);
        } else if (err.code === "EMAIL_TAKEN") {
          setEmailError(signupErrorMessage(err.code));
        } else if (err.code === "PASSWORD_TOO_SHORT" || err.code === "PASSWORD_BREACHED") {
          setPasswordError(signupErrorMessage(err.code));
        } else if (err.code === "EMAIL_INVALID") {
          setEmailError(signupErrorMessage(err.code));
        } else {
          setBannerError(signupErrorMessage(err.code));
        }
      } else {
        setBannerError(authTh.signup.error.generic);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <AuthForm
        title={authTh.signup.title}
        subtitle={authTh.signup.subtitle}
        email={email}
        onEmailChange={(v) => {
          setEmail(v);
          setEmailError(undefined);
        }}
        onEmailBlur={() => setEmailTouched(true)}
        emailError={emailError ?? (emailInvalid ? authTh.signup.error.emailInvalid : undefined)}
        password={password}
        onPasswordChange={(v) => {
          setPassword(v);
          setPasswordError(undefined);
        }}
        passwordPlaceholder={authTh.signup.password.placeholder}
        passwordHelper={authTh.signup.password.helper}
        passwordError={passwordError}
        submitLabel={authTh.signup.submit}
        submitLoadingLabel={authTh.signup.submitLoading}
        loading={loading}
        bannerError={bannerError}
        onBannerRetry={bannerError ? handleSubmit : undefined}
        throttleRemainingSeconds={throttleSeconds}
        onSubmit={handleSubmit}
        footer={
          <Link href="/login">{authTh.signup.linkToLogin}</Link>
        }
      />
    </AuthCard>
  );
}
