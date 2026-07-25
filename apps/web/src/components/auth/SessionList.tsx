"use client";

import { useCallback, useEffect, useState } from "react";
import type { components } from "@omnistock/contracts";
import { SessionListItem } from "./SessionListItem";
import { SessionListSkeleton } from "../ui/Skeleton";
import { ErrorBanner } from "../ui/ErrorBanner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { Toast, type ToastData } from "../ui/Toast";
import { authTh } from "../../i18n/auth";
import { getSessions, isSessionExpired, logoutAll, logoutDevice } from "../../lib/auth-client";
import { redirectToLoginSessionExpired } from "../../lib/session-expired-redirect";

type Session = components["schemas"]["Session"];

export interface SessionListHandle {
  refresh: () => void;
}

/**
 * Session list (ux-wireframe §4, ui.md #4) — all 4 states:
 *  - loading: SessionListSkeleton (shimmer, NOT a spinner — design-system §2)
 *  - error: message + "ลองใหม่" retry button
 *  - empty: not designed per spec (should never happen — at least the
 *    current device is always present); we render nothing special, matching
 *    ux-wireframe §4's explicit "ไม่ต้องออกแบบ empty state พิเศษ"
 *  - success/data: the row list + "ออกจากระบบทุกอุปกรณ์"
 *
 * Exposes `onRefreshReady` so a sibling (ChangePasswordForm success) can
 * trigger a re-fetch per ux-wireframe §9.4 ("refresh รายการ session ทันที
 * หลัง toast").
 */
export function SessionList({ onRefreshReady }: { onRefreshReady?: (refresh: () => void) => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pendingLogoutFamilyId, setPendingLogoutFamilyId] = useState<string | null>(null);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState<string | undefined>();
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await getSessions();
      setSessions(res.sessions);
    } catch (err) {
      // client-security review Important #4: a dead session must redirect
      // immediately, not render a "ลองใหม่" retry button — retrying against
      // an already-confirmed-dead session would just loop forever (every
      // retry re-hits the same 401 -> refresh-fails -> SessionExpiredError
      // path) instead of ever getting the user back to a working state.
      if (isSessionExpired(err)) {
        redirectToLoginSessionExpired();
        return;
      }
      setError(authTh.sessions.error.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onRefreshReady?.(load);
  }, [load, onRefreshReady]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  async function confirmLogoutDevice() {
    if (!pendingLogoutFamilyId) return;
    const familyId = pendingLogoutFamilyId;
    setPendingLogoutFamilyId(null);
    const previous = sessions;
    // optimistic removal (ux-wireframe §4 interaction step 2)
    setSessions((prev) => prev?.filter((s) => s.familyId !== familyId) ?? prev);
    try {
      await logoutDevice(familyId);
      setToast({ message: authTh.sessions.toast.deviceLoggedOut, variant: "success" });
    } catch {
      setSessions(previous ?? null);
      setToast({ message: authTh.sessions.toast.deviceLogoutFailed, variant: "danger" });
    }
  }

  async function confirmLogoutAll() {
    setConfirmLogoutAllOpen(false);
    setLogoutAllError(undefined);
    setLogoutAllLoading(true);
    try {
      await logoutAll();
      // Only redirect on a CONFIRMED success — families are actually revoked
      // server-side (204), so sending the user to /login now correctly
      // reflects reality.
      window.location.href = "/login";
    } catch (err) {
      // client-security review Important #3: a network/500 failure here
      // used to still navigate to /login as if logout-all worked, while the
      // user's other families stayed live server-side — a false sense of
      // security ("I logged out everywhere" when they didn't).
      //
      // SessionExpiredError (refresh/retry-once both failed) is the one
      // exception that's still safe to treat as "might as well be logged
      // out" — the access token this action needed is already dead, so the
      // user is about to be forced to /login regardless of whether the
      // server-side revoke happened.
      if (isSessionExpired(err)) {
        redirectToLoginSessionExpired();
        return;
      }
      setLogoutAllLoading(false);
      setLogoutAllError(authTh.sessions.error.logoutAllFailed);
    }
  }

  return (
    <section>
      <h2 className="m-0 text-heading-sm">{authTh.sessions.title}</h2>
      <p className="mt-2 mb-4 text-body-sm text-text-muted">{authTh.sessions.subtitle}</p>

      <Toast toast={toast} />

      {loading && <SessionListSkeleton />}

      {!loading && error && (
        <ErrorBanner message={error} onRetry={load} retryLabel={authTh.sessions.action.retry} />
      )}

      {!loading && !error && sessions && (
        <>
          <div className="rounded-card border border-border-default">
            {sessions.map((s) => (
              <SessionListItem
                key={s.familyId}
                session={s}
                onLogoutDevice={(familyId) => setPendingLogoutFamilyId(familyId)}
              />
            ))}
          </div>

          {logoutAllError && (
            <div className="mt-4">
              <ErrorBanner message={logoutAllError} onRetry={confirmLogoutAll} />
            </div>
          )}

          <div className="mt-6">
            <Button
              variant="destructive"
              fullWidth
              loading={logoutAllLoading}
              loadingLabel={authTh.sessions.action.logoutAll}
              onClick={() => setConfirmLogoutAllOpen(true)}
            >
              {authTh.sessions.action.logoutAll}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingLogoutFamilyId !== null}
        title={authTh.confirm.logoutDevice.title}
        body={authTh.confirm.logoutDevice.body}
        cancelLabel={authTh.confirm.logoutDevice.cancel}
        confirmLabel={authTh.confirm.logoutDevice.confirm}
        variant="destructive"
        onCancel={() => setPendingLogoutFamilyId(null)}
        onConfirm={confirmLogoutDevice}
      />

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        title={authTh.confirm.logoutAll.title}
        body={authTh.confirm.logoutAll.body}
        cancelLabel={authTh.confirm.logoutAll.cancel}
        confirmLabel={authTh.confirm.logoutAll.confirm}
        variant="destructive"
        onCancel={() => setConfirmLogoutAllOpen(false)}
        onConfirm={confirmLogoutAll}
      />
    </section>
  );
}
