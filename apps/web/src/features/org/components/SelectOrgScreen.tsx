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
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { SectionCard } from "../../../components/ui/SectionCard";
import { ListRow, Avatar } from "../../../components/ui/ListRow";
import { EmptyState as EmptyStatePanel } from "../../../components/ui/EmptyState";
import { Icon } from "../../../components/ui/Icon";
import { Button } from "../../../components/ui/Button";
import { useSignOut } from "../use-sign-out";

export const CREATE_ORG_PATH = "/orgs/new";

export function SelectOrgScreen() {
  const removed = useSearchParams().get("removed");
  const query = useMyOrganizations();
  const items = activeOrganizations(query.data);

  return (
    <div className="min-h-screen bg-bg">
      <SelectOrgHeader />
      {/* D2 — §2 platform note: "การ์ดกึ่งกลาง กว้างสุด 480px" on web, full
          screen with no card on a phone. The card is the WHOLE screen's
          content, heading included, as the wireframe draws it. */}
      <main
        data-testid="select-org-card"
        className="mx-auto w-full max-w-[var(--size-dialog-max-w)] p-4 md:my-8 md:rounded-card md:border md:border-border-default md:bg-surface md:p-card-padding md:shadow-card"
      >
        {removed && <RemovedNotice />}

        <h1 className="m-0 mb-1 text-heading-md">{orgTh.selectOrg.title}</h1>

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
            <p className="m-0 mb-3 text-body-sm text-text-muted">
              {orgTh.selectOrg.subtitle(items.length)}
            </p>
            {/* One card holding `ListRow`s — each shop had been its own bordered
              box with `border-border`, a class that does not exist (the token
              is `border-border-default`), so the "border" was Tailwind's
              default grey. */}
            <SectionCard className="mb-3 p-0">
              <ul className="m-0 list-none p-0">
                {items.map((item) => (
                  <li key={item.organization.id}>
                    <Link href={`/o/${item.organization.id}`} className="block no-underline">
                      <ListRow
                        avatar={<Avatar>{item.organization.name.trim().charAt(0)}</Avatar>}
                        main={<span className="text-text">{item.organization.name}</span>}
                        right={
                          <span className="text-body-sm text-text-muted">
                            {roleLabel(item.membership.roleKey, item.membership.roleName)}
                          </span>
                        }
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
            {query.data?.nextCursor && (
              // The cap is 50 shops per user, so this is reachable but rare.
              // Paging itself lands with the list screens that need it (F-010's
              // DataTable); until then the button is honest about there being
              // more rather than silently truncating.
              <p className="m-0 mb-3 text-body-sm text-text-muted">{orgTh.selectOrg.loadMore}</p>
            )}
            <ButtonLink href={CREATE_ORG_PATH} variant="secondary" fullWidth>
              <Icon role="plus" />
              {orgTh.selectOrg.createShop}
            </ButtonLink>
          </>
        )}
      </main>
    </div>
  );
}

/**
 * D1 — §2's top bar. ⚠️ The wireframe also puts the signed-in EMAIL on the
 * right; no endpoint returns it (`/me/organizations` carries no user, and the
 * access token is opaque to this app by design), so that slot holds the
 * sign-out instead until a contract gives us the address. ★ S1 is where a
 * person with NO shop lives, and without this button they had no way out:
 * the sidebar's sign-out is inside a shop.
 */
function SelectOrgHeader() {
  const { signOut, signingOut } = useSignOut();
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border-default bg-surface px-4">
      <span className="text-heading-sm">OmniStock</span>
      <Button variant="tertiary" size="sm" disabled={signingOut} onClick={() => void signOut()}>
        <Icon role="sign-out" />
        {orgTh.shell.nav.logout}
      </Button>
    </header>
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

/** D3 — §2's empty state is an `EmptyState` (design-system §9.1), icon included. */
function EmptyState() {
  return (
    <EmptyStatePanel
      icon="store"
      title={orgTh.selectOrg.empty.title}
      body={orgTh.selectOrg.empty.body}
      actions={<ButtonLink href={CREATE_ORG_PATH}>{orgTh.selectOrg.empty.cta}</ButtonLink>}
    />
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
