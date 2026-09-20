"use client";

/**
 * S11 — `/invite` (ux-wireframe §11).
 *
 * ★ The token arrives in the URL and leaves it before the first paint
 * (`useInviteToken`). After that it exists only in a ref inside this tree: it
 * is never put in a query cache, never written back to the address bar, and
 * never persisted.
 *
 * Two things this screen deliberately does NOT do:
 *
 *  - auto-accept for a reader who is already signed in. §11.1 is explicit that
 *    the person must SEE which shop, and as what, before joining. A link that
 *    adds you to an organisation the moment you open it is a link that can be
 *    sent to somebody who never wanted it.
 *  - guess. Every refusal goes through `toInviteError`, which gives all ten
 *    documented outcomes their own copy and their own way out.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useInviteToken } from "../use-invite-token";
import {
  useAcceptInvitation,
  useInvitationPreview,
  type InvitationPreview,
} from "../api/use-invitation";
import { toInviteError, NO_TOKEN_ERROR, type InviteError } from "../invite-error";
import { inviteScreenTh } from "../i18n";
import { formatExpiry } from "../../org/expiry";
import { roleLabel } from "../../org/i18n";
import { useSession } from "../../../lib/session/session-context";
import { isSignedIn } from "../../../lib/session/session-state";
import { Button } from "../../../components/ui/Button";
import { SkeletonRow } from "../../../components/ui/Skeleton";
import { ThrottleBanner } from "../../../components/ui/ThrottleBanner";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";
import { holdInviteToken } from "../../../lib/session/pending-invite";

export function InviteScreen() {
  const { token, ready } = useInviteToken();
  // ★ B-19 — every door from here to an auth screen takes the token along
  // (§11.1), in memory, so the person lands back on this invitation.
  const holdForReturn = () => {
    if (token) holdInviteToken(token);
  };
  const { state } = useSession();
  const preview = useInvitationPreview();
  const accept = useAcceptInvitation();
  const throttle = useThrottleCountdown();

  const [previewed, setPreviewed] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<InviteError | null>(null);
  const [joined, setJoined] = useState<{
    orgId: string;
    orgName: string;
    roleName: string;
  } | null>(null);

  const fail = (err: unknown) => {
    const mapped = toInviteError(err);
    if (mapped.retryAfterSeconds) throttle.start(mapped.retryAfterSeconds);
    setError(mapped);
  };

  const load = (value: string) =>
    preview.mutate(value, { onSuccess: setPreviewed, onError: fail });

  useEffect(() => {
    if (!ready) return;
    if (token === null) {
      // ★ §11.5 — no token in the link AT ALL is a LOCAL screen state
      // (`NO_TOKEN`), not a server refusal: nothing was asked of the API, so
      // nothing here should claim the API said no. Reload, a new tab, or the
      // device dropping this screen's memory mid signup/login all land here
      // — the same case the B-19 hold (`pending-invite.ts`) does NOT cover,
      // because by definition the reader did not come back through it.
      setError(NO_TOKEN_ERROR);
      return;
    }
    load(token);
    // Once per token. `preview` is a new object on every render, so including
    // it would spend the preview rate limit on re-renders.
    // eslint-disable-next-line
  }, [ready, token]);

  if (joined) {
    return (
      <main className="mx-auto my-8 flex w-full max-w-[var(--size-dialog-max-w)] flex-col gap-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card">
        <h1 className="m-0 text-heading-md">{inviteScreenTh.joinedTitle(joined.orgName)}</h1>
        <p className="m-0 text-body-sm text-text-muted">{inviteScreenTh.joinedRole(joined.roleName)}</p>
        <Link href={`/o/${joined.orgId}`}>
          <Button>{inviteScreenTh.enterOrg}</Button>
        </Link>
        <p className="m-0 text-body-sm text-text-muted">{inviteScreenTh.mobileHint}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto my-8 flex w-full max-w-[var(--size-dialog-max-w)] flex-col gap-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card">
        {throttle.isActive && <ThrottleBanner remainingSeconds={throttle.remainingSeconds} />}
        <h1 className="m-0 text-heading-md">{error.title}</h1>
        <p className="m-0 text-body-sm text-text-muted">{error.body}</p>
        {/* §11.5 — the "why", always SECOND: what to do comes before the
            reason, styled like the existing `mobileHint` line. */}
        {error.hint && <p className="m-0 text-body-sm text-text-muted">{error.hint}</p>}
        <InviteNextStepButton
          step={error.next}
          onRetry={() => token && load(token)}
          onLeaveForAuth={holdForReturn}
        />
      </main>
    );
  }

  if (!ready || preview.isPending || !previewed) {
    return (
      <main className="mx-auto my-8 flex w-full max-w-[var(--size-dialog-max-w)] flex-col gap-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card" role="status" aria-label="กำลังโหลด">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </main>
    );
  }

  return (
    <main className="mx-auto my-8 flex w-full max-w-[var(--size-dialog-max-w)] flex-col gap-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card">
      <h1 className="m-0 text-heading-md">{inviteScreenTh.title}</h1>
      <p className="m-0 text-heading-sm">{previewed.organizationName}</p>
      <p>{inviteScreenTh.invitedAs(roleLabel(previewed.roleKey, previewed.roleName))}</p>
      {/* Masked, never the address: this page is reachable by anyone holding
          the link, account or not (api-spec §3.14). */}
      <p className="m-0 text-body-sm text-text-muted">{inviteScreenTh.issuedTo(previewed.emailMasked)}</p>
      <p className="m-0 text-body-sm text-text-muted">{formatExpiry(previewed.expiresAt)}</p>

      {isSignedIn(state) ? (
        <Button
          disabled={accept.isPending || token === null}
          loading={accept.isPending}
          loadingLabel={inviteScreenTh.joining}
          onClick={() =>
            token &&
            accept.mutate(token, {
              onSuccess: (result) =>
                setJoined({
                  orgId: result.organization.id,
                  orgName: result.organization.name,
                  roleName: roleLabel(result.membership.roleKey, result.membership.roleName),
                }),
              onError: fail,
            })
          }
        >
          {inviteScreenTh.join}
        </Button>
      ) : (
        <>
          <Link href="/login" onClick={holdForReturn}>
            <Button>{inviteScreenTh.loginToAccept}</Button>
          </Link>
          <Link href="/signup" onClick={holdForReturn}>
            <Button variant="secondary">{inviteScreenTh.signup}</Button>
          </Link>
          <p className="m-0 text-body-sm text-text-muted">{inviteScreenTh.sameEmailOnly}</p>
        </>
      )}
    </main>
  );
}

function InviteNextStepButton({
  step,
  onRetry,
  onLeaveForAuth,
}: {
  step: InviteError["next"];
  onRetry: () => void;
  onLeaveForAuth: () => void;
}) {
  switch (step.kind) {
    case "retry":
      return <Button onClick={onRetry}>{inviteScreenTh.retry}</Button>;
    case "login":
      return (
        <Link href="/login" onClick={onLeaveForAuth}>
          <Button>{inviteScreenTh.login}</Button>
        </Link>
      );
    case "switch-account":
      // §11.2: "คงลิงก์เดิมไว้ให้" — the other account is signing in to THIS
      // invitation, so it comes back here too.
      return (
        <Link href="/login" onClick={onLeaveForAuth}>
          <Button>{inviteScreenTh.switchAccount}</Button>
        </Link>
      );
    case "enter-org":
      // The refusal carries no org id, so the shop picker is the honest
      // destination — it lists exactly the shops this person is in.
      return (
        <Link href="/select-org">
          <Button>{inviteScreenTh.enterOrg}</Button>
        </Link>
      );
    default:
      return (
        <Link href="/">
          <Button variant="secondary">{inviteScreenTh.home}</Button>
        </Link>
      );
  }
}
