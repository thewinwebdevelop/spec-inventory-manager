"use client";

/**
 * T-002-W1 ★ — the gate every `/o/[orgId]` page renders behind.
 *
 * All it does is execute `decideOrgShell`'s verdict (org-access.ts, where the
 * decision is tested without a DOM). Keeping the branch logic out of here is
 * deliberate: the two 403s do opposite things, and that pairing deserves a
 * test that does not need a router to run.
 */
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ActiveOrgProvider, toActiveOrg } from "../../lib/org/org-context";
import { useOrgProfile } from "../../lib/org/use-org-profile";
import { MY_ORGANIZATIONS_KEY } from "../../lib/org/org-keys";
import { decideOrgShell } from "../../lib/org/org-access";
import { useSession } from "../../lib/session/session-context";
import { failureMessage } from "../../lib/api/error";
import { errorsTh } from "../../i18n/errors";
import { SkeletonRow } from "../ui/Skeleton";
import { ErrorBanner } from "../ui/ErrorBanner";

/** Where a removed member lands (ux-wireframe §12.1 → S1). */
export const SELECT_ORG_PATH = "/select-org";
export const LOGIN_PATH = "/login";

export function OrgGuard({ orgId, children }: { orgId: string; children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state } = useSession();
  const profile = useOrgProfile(orgId);
  const decision = decideOrgShell(state, profile);

  useEffect(() => {
    if (decision.kind === "sign-in") {
      router.replace(LOGIN_PATH);
      return;
    }
    if (decision.kind === "leave-org") {
      // ux-wireframe §12.1: the shop list must be re-fetched, not reused —
      // the shop the user just lost has to disappear from the switcher. The
      // invalidation happens BEFORE the navigation so S1 renders fresh data
      // rather than briefly showing the shop it is apologising about.
      void queryClient.invalidateQueries({ queryKey: MY_ORGANIZATIONS_KEY });
      router.replace(`${SELECT_ORG_PATH}?removed=${encodeURIComponent(orgId)}`);
    }
  }, [decision.kind, orgId, queryClient, router]);

  if (decision.kind === "ready" && profile.data) {
    return (
      <ActiveOrgProvider value={toActiveOrg(orgId, profile.data)}>{children}</ActiveOrgProvider>
    );
  }

  if (decision.kind === "error") {
    return (
      <div className="p-6">
        <ErrorBanner
          message={failureMessage(decision.failure)}
          onRetry={() => void profile.refetch()}
          retryLabel={errorsTh.retry}
        />
      </div>
    );
  }

  // loading, and also the moment between deciding to navigate and the
  // navigation actually happening — never a flash of the shell.
  return <OrgShellSkeleton />;
}

/**
 * D9 (D-038 ③) — the SHAPE of `AppShell` with none of its content: the 56px top
 * bar below lg, the 240px sidebar at ≥lg, and skeleton rows where the page
 * goes. It was three bars in a `p-6` box, so on resolve the chrome appeared
 * from nowhere and the page jumped down (tablet) or right (desktop).
 *
 * ★ Shape only. No shop name, no nav, no links: those are built from a profile
 * nobody has verified yet — which is why the real shell is inside this guard.
 */
function OrgShellSkeleton() {
  return (
    <div
      className="flex min-h-screen flex-col bg-bg lg:flex-row"
      role="status"
      aria-label="กำลังโหลด"
    >
      <div
        data-skeleton="top-bar"
        className="flex h-14 items-center gap-2 border-b border-border-default bg-surface px-4 lg:hidden"
      >
        <div className="h-5 w-40 animate-shimmer rounded-button bg-surface-muted" />
      </div>
      <div
        data-skeleton="sidebar"
        className="hidden flex-col gap-3 border-border-default bg-surface p-card-padding lg:flex lg:w-[var(--size-sidebar-w)] lg:border-r"
      >
        <p className="m-0 mb-2 text-heading-sm">OmniStock</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-shimmer rounded-button bg-surface-muted" />
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4 lg:p-card-padding">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
