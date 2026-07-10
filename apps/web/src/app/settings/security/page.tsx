"use client";

import { useRef, useState } from "react";
import { ChangePasswordForm } from "../../../components/auth/ChangePasswordForm";
import { SessionList } from "../../../components/auth/SessionList";
import { Toast, type ToastData } from "../../../components/ui/Toast";
import { authTh } from "../../../i18n/auth";

/**
 * `/settings/security` — ux-wireframe §9.1/§11.5: change-password section on
 * top, session list below, one page (F-001 spec explicitly leaves the exact
 * IA split to frontend — "แล้วแต่ที่ frontend ทำได้ง่ายกว่า").
 *
 * On change-password success: show the toast AND refresh the session list
 * immediately (ux-wireframe §9.4 — "ให้ผู้ใช้เห็นด้วยตาว่าเครื่องอื่นหายไปจริง").
 */
export default function SecuritySettingsPage() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const refreshSessionsRef = useRef<() => void>(() => {});

  function handlePasswordChanged() {
    setToast({ message: authTh.changePassword.successToast, variant: "success" });
    refreshSessionsRef.current();
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <main className="mx-auto max-w-[640px] px-6 py-8">
      <Toast toast={toast} />
      <ChangePasswordForm onSuccess={handlePasswordChanged} />
      <hr className="my-8 border-0 border-t border-border-default" />
      <SessionList onRefreshReady={(refresh) => (refreshSessionsRef.current = refresh)} />
    </main>
  );
}
