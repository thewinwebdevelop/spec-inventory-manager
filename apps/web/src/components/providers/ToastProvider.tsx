"use client";

/**
 * App-level host for `Toast` (debt W-13, opened in T-002-W3).
 *
 * F-001 built the component but every screen owned its own `useState`, so a
 * dialog that closed on success took its own confirmation with it — S2's
 * "สร้างร้าน … เรียบร้อย", S4's "บันทึกชื่อร้านแล้ว" and S5's
 * "บันทึกข้อมูลผู้เสียภาษีแล้ว" all closed silently. A toast has to outlive the
 * thing that raised it, which means it cannot live inside it.
 *
 * ⛔ Never put a token, an email address or a tax id in a toast. It is rendered
 * outside the screen that owns the data, it lingers after navigation, and
 * `aria-live` reads it aloud.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Toast, type ToastData } from "../ui/Toast";

interface ToastApi {
  readonly show: (toast: ToastData) => void;
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Long enough to read a Thai sentence, short enough not to sit over content. */
export const TOAST_DURATION_MS = 4_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const show = useCallback((next: ToastData) => setToast(next), []);
  const success = useCallback((message: string) => setToast({ message, variant: "success" }), []);
  const error = useCallback((message: string) => setToast({ message, variant: "danger" }), []);

  return (
    <ToastContext.Provider value={{ show, success, error }}>
      {children}
      <Toast toast={toast} />
    </ToastContext.Provider>
  );
}

/**
 * Returns a no-op API outside a provider rather than throwing.
 *
 * The opposite of `useActiveOrg`, and deliberately: a missing org is a routing
 * bug that must fail loudly, whereas a missing toast host must never be the
 * reason a save is lost. Failing to CONFIRM an action is not worth failing the
 * action over.
 */
const NOOP: ToastApi = {
  show: () => undefined,
  success: () => undefined,
  error: () => undefined,
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}
