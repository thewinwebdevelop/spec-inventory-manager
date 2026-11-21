"use client";

/**
 * Sign out of THIS device — shared by the shell's sidebar row (B-16) and S1's
 * header bar (D-038 ③ D1), so the two cannot drift.
 *
 * `logoutDevice()` with no `familyId` ends this session only. ⛔ On failure it
 * STAYS and says so rather than routing to `/login` optimistically: the token
 * is cleared only after the server's `204`, so a failed call leaves the
 * session alive and a login page would show a sign-out that did not happen.
 *
 * B-19: `endSession()` is what drops a held invitation token, so the next
 * person to sign in at this tab is not routed to somebody else's invite.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutDevice } from "../../lib/auth-client";
import { useSession } from "../../lib/session/session-context";
import { useToast } from "../../components/providers/ToastProvider";
import { orgTh } from "./i18n";

export function useSignOut() {
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await logoutDevice();
      session.endSession();
      router.replace("/login");
    } catch {
      toast.error(orgTh.shell.nav.logoutFailed);
    } finally {
      setSigningOut(false);
    }
  }

  return { signOut, signingOut };
}
