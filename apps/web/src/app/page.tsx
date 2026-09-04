"use client";

/**
 * `/` — the domain root.
 *
 * ★ B-14. This was T-000-09's placeholder shell ("apps/web placeholder shell"),
 * still rendering a sample `HealthResponse` months after the app had real
 * screens: opening the bare domain showed scaffolding whether or not anybody
 * was signed in. Exactly B-6's shape — the post-login redirect also pointed at
 * an F-000 placeholder — and B-6 was only caught because E-01 walks
 * login→shop as one journey. Nothing walked `/`.
 *
 * It stayed filed rather than fixed because `web.md` sent an authenticated
 * visitor to `/o/[defaultOrg]` and `defaultOrg` was in no model, no contract
 * and no other line of the repo. The user decided on 2026-09-01: mirror login
 * and go to `/select-org`, which needs no new field and lets the picker — the
 * screen that knows whether you are in zero, one or many shops — decide.
 *
 * The branch lives in `decideRoot`, tested without a router.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/session/session-context";
import { decideRoot } from "../lib/session/root-redirect";
import { LOGIN_PATH, SELECT_ORG_PATH } from "../components/org/OrgGuard";
import { SkeletonRow } from "../components/ui/Skeleton";

export default function HomePage() {
  const router = useRouter();
  const { state } = useSession();
  const decision = decideRoot(state);

  useEffect(() => {
    // `replace`, not `push`: `/` is a doorway, and leaving it in history means
    // Back from the picker lands here and bounces forward again.
    if (decision.kind === "sign-in") router.replace(LOGIN_PATH);
    if (decision.kind === "pick-shop") router.replace(SELECT_ORG_PATH);
  }, [decision.kind, router]);

  // Every branch renders this: while `unknown` it is the truthful answer, and
  // during the two redirects it is the frame before the navigation commits.
  return (
    <main className="mx-auto w-full max-w-[var(--size-dialog-max-w)] p-card-padding">
      <div role="status" aria-label="กำลังโหลด">
        <SkeletonRow />
      </div>
    </main>
  );
}
