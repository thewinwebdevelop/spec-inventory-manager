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
import { toInviteError, type InviteError } from "../invite-error";
import { inviteScreenTh } from "../i18n";
import { formatExpiry } from "../../org/expiry";
import { roleLabel } from "../../org/i18n";
import { useSession } from "../../../lib/session/session-context";
import { isSignedIn } from "../../../lib/session/session-state";
import { Button } from "../../../components/ui/Button";
import { SkeletonRow } from "../../../components/ui/Skeleton";
import { ThrottleBanner } from "../../../components/ui/ThrottleBanner";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";
import { ApiRequestError } from "../../../lib/api/error";

export function InviteScreen() {
  const { token, ready } = useInviteToken();
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
      // No token in the link at all. Same message as an unknown one, because
      // from the reader's side it is the same event: the link they were sent
      // does not work.
      setError(
        toInviteError(
          new ApiRequestError(404, { error: { code: "INVITATION_INVALID", message: "" } }),
        ),
      );
      return;
    }
    load(token);
    // Once per token. `preview` is a new object on every render, so including
    // it would spend the preview rate limit on re-renders.
    // eslint-disable-next-line
  }, [ready, token]);

  if (joined) {
    return (
      <main className="mx-auto w-full max-w-[480px] p-6">
        <h1 className="text-heading-md">{inviteScreenTh.joinedTitle(joined.orgName)}</h1>
        <p className="text-body-sm">{inviteScreenTh.joinedRole(joined.roleName)}</p>
        <Link href={`/o/${joined.orgId}`}>
          <Button>{inviteScreenTh.enterOrg}</Button>
        </Link>
        <p className="text-body-sm">{inviteScreenTh.mobileHint}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[480px] p-6">
        {throttle.isActive && <ThrottleBanner remainingSeconds={throttle.remainingSeconds} />}
        <h1 className="text-heading-md">{error.title}</h1>
        <p className="text-body-sm">{error.body}</p>
        <InviteNextStepButton step={error.next} onRetry={() => token && load(token)} />
      </main>
    );
  }

  if (!ready || preview.isPending || !previewed) {
    return (
      <main className="mx-auto w-full max-w-[480px] p-6" role="status" aria-label="กำลังโหลด">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[480px] p-6">
      <h1 className="text-heading-md">{inviteScreenTh.title}</h1>
      <p className="text-heading-sm">{previewed.organizationName}</p>
      <p>{inviteScreenTh.invitedAs(roleLabel(previewed.roleKey, previewed.roleName))}</p>
      {/* Masked, never the address: this page is reachable by anyone holding
          the link, account or not (api-spec §3.14). */}
      <p className="text-body-sm">{inviteScreenTh.issuedTo(previewed.emailMasked)}</p>
      <p className="text-body-sm">{formatExpiry(previewed.expiresAt)}</p>

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
          <Link href="/login">
            <Button>{inviteScreenTh.loginToAccept}</Button>
          </Link>
          <Link href="/signup">
            <Button variant="secondary">{inviteScreenTh.signup}</Button>
          </Link>
          <p className="text-body-sm">{inviteScreenTh.sameEmailOnly}</p>
        </>
      )}
    </main>
  );
}

function InviteNextStepButton({
  step,
  onRetry,
}: {
  step: InviteError["next"];
  onRetry: () => void;
}) {
  switch (step.kind) {
    case "retry":
      return <Button onClick={onRetry}>{inviteScreenTh.retry}</Button>;
    case "login":
      return (
        <Link href="/login">
          <Button>{inviteScreenTh.login}</Button>
        </Link>
      );
    case "switch-account":
      return (
        <Link href="/login">
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
