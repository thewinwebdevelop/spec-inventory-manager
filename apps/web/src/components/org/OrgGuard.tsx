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

function OrgShellSkeleton() {
  return (
    <div className="p-6" role="status" aria-label="กำลังโหลด">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
