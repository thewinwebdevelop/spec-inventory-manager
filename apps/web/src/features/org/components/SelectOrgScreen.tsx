"use client";

/**
 * S1 — เลือกร้าน (ux-wireframe §2).
 *
 * Also the landing place for a removed member (§12.1): when `?removed=` is
 * present the yellow notice sits above the list. Yellow, not red — the user
 * did nothing wrong and can keep working.
 *
 * All four states are here (design-system §2): skeleton rows shaped like the
 * real rows, an empty state with a CTA, an error with a retry, and data.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMyOrganizations, activeOrganizations } from "../api/use-my-organizations";
import { orgTh, roleLabel } from "../i18n";
import { errorsTh } from "../../../i18n/errors";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { SkeletonRow } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";

export const CREATE_ORG_PATH = "/orgs/new";

export function SelectOrgScreen() {
  const removed = useSearchParams().get("removed");
  const query = useMyOrganizations();
  const items = activeOrganizations(query.data);

  return (
    <main className="mx-auto w-full max-w-[480px] p-6">
      {removed && <RemovedNotice />}

      <h1 className="text-heading-md">{orgTh.selectOrg.title}</h1>

      {query.isPending && <SelectOrgSkeleton />}

      {query.isError && (
        <ErrorBanner
          message={orgTh.selectOrg.error}
          onRetry={() => void query.refetch()}
          retryLabel={errorsTh.retry}
        />
      )}

      {!query.isPending && !query.isError && items.length === 0 && <EmptyState />}

      {items.length > 0 && (
        <>
          <p className="mb-4 text-body-sm">{orgTh.selectOrg.subtitle(items.length)}</p>
          <ul className="mb-6 list-none p-0">
            {items.map((item) => (
              <li key={item.organization.id}>
                <Link
                  href={`/o/${item.organization.id}`}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-card border border-border p-4 no-underline"
                >
                  <span>{item.organization.name}</span>
                  <span className="text-body-sm">
                    {roleLabel(item.membership.roleKey, item.membership.roleName)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {query.data?.nextCursor && (
            // The cap is 50 shops per user, so this is reachable but rare.
            // Paging itself lands with the list screens that need it (F-010's
            // DataTable); until then the button is honest about there being
            // more rather than silently truncating.
            <p className="text-body-sm">{orgTh.selectOrg.loadMore}</p>
          )}
          <Link href={CREATE_ORG_PATH}>{orgTh.selectOrg.createShop}</Link>
        </>
      )}
    </main>
  );
}

/**
 * §12.1 — warning, not danger. The shop NAME is not shown: by the time we get
 * here the profile call has already been refused, so we never learned it, and
 * inventing one from a stale cache would be worse than the nameless wording
 * `ux` supplied for exactly this case.
 */
function RemovedNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-card border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text"
    >
      {errorsTh.orgAccessDenied.withoutName}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-6">
      <h2 className="text-heading-sm">{orgTh.selectOrg.empty.title}</h2>
      <p className="mb-4 text-body-sm">{orgTh.selectOrg.empty.body}</p>
      <Link href={CREATE_ORG_PATH}>
        <Button>{orgTh.selectOrg.empty.cta}</Button>
      </Link>
    </div>
  );
}

function SelectOrgSkeleton() {
  return (
    <div role="status" aria-label="กำลังโหลด">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
