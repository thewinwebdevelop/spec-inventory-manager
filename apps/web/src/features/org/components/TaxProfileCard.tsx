"use client";

/**
 * S4's tax card, including the ★ reveal button (ux-wireframe §5).
 *
 * The number lives in `RevealState` and nowhere else — not in a query cache,
 * not in a ref, not in a `visible` flag beside a retained string. See
 * tax-reveal.ts for why the state shape is the safeguard.
 *
 * A 429 throttles THIS CARD only, never the page: §5 is explicit that the
 * user must still be able to edit everything else while waiting.
 */
import { useState } from "react";
import { useRevealTaxId } from "../api/use-reveal-tax-id";
import { taxCardView, type OrgProfile } from "../tax-card";
import {
  pressRequestsReveal,
  revealShown,
  toggleReveal,
  visibleTaxId,
  REVEAL_ERROR,
  REVEAL_HIDDEN,
  type RevealState,
} from "../tax-reveal";
import { orgProfileTh } from "../i18n";
import { toApiFailure } from "../../../lib/api/error";
import { Button } from "../../../components/ui/Button";
import { SectionCard } from "../../../components/ui/SectionCard";
import { DataRow } from "../../../components/ui/DataRow";
import { ThrottleBanner } from "../../../components/ui/ThrottleBanner";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";

export function TaxProfileCard({
  profile,
  capabilities,
  onEdit,
  onProfileStale,
}: {
  profile: OrgProfile;
  capabilities: ReadonlySet<string>;
  onEdit: () => void;
  /** The card's data is out of date (a 404 on reveal) — refetch the profile. */
  onProfileStale: () => void;
}) {
  const view = taxCardView(profile, capabilities);
  const [reveal, setReveal] = useState<RevealState>(REVEAL_HIDDEN);
  const [revealError, setRevealError] = useState<string | null>(null);
  const throttle = useThrottleCountdown();
  const revealMutation = useRevealTaxId();

  const press = () => {
    setRevealError(null);
    const next = toggleReveal(reveal);
    if (!pressRequestsReveal(reveal)) {
      // Hiding, or already asking. Hiding drops the number by construction.
      setReveal(next);
      return;
    }
    setReveal(next);
    revealMutation.mutate(undefined, {
      onSuccess: (data) => setReveal(revealShown(data.taxId, data.revealedAt)),
      onError: (err) => {
        const failure = toApiFailure(err);
        setReveal(REVEAL_ERROR);
        if (failure.kind === "throttled") {
          throttle.start(failure.retryAfterSeconds ?? 60);
          return;
        }
        if (failure.kind === "not-found") {
          // §5: the declaration is gone — close the value and refetch.
          setReveal(REVEAL_HIDDEN);
          onProfileStale();
          setRevealError(orgProfileTh.tax.revealError.notFoundToast);
          return;
        }
        if (failure.kind === "forbidden" || failure.kind === "org-access-denied") {
          // Our capability picture is stale; the shell re-derives it.
          onProfileStale();
          return;
        }
        setRevealError(orgProfileTh.tax.revealError.generic);
      },
    });
  };

  const shown = visibleTaxId(reveal);

  return (
    /* `SectionCard` owns the header row, so "แก้ไข" sits at the top RIGHT the
       way it does on the shop card above — it had been a block button dropped
       under the heading, on its own line, left-aligned. */
    <SectionCard
      title={orgProfileTh.tax.title}
      action={
        /* Reaching the `details` tier IS the edit right — `taxCardView`
           only returns it to a caller with `manage_org_settings`. */
        view.kind === "details" ? (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            {orgProfileTh.fields.edit}
          </Button>
        ) : undefined
      }
    >
      {view.kind === "undeclared" && (
        <div className="space-y-3">
          <p className="m-0 text-body-sm text-text-muted">
            {view.canEdit
              ? orgProfileTh.tax.undeclaredCanEdit
              : orgProfileTh.tax.undeclaredReadOnly}
          </p>
          {view.canEdit && (
            <Button variant="secondary" onClick={onEdit}>
              {orgProfileTh.tax.undeclaredCta}
            </Button>
          )}
        </div>
      )}

      {view.kind === "summary" && (
        <div className="space-y-2">
          {/* No digits reach this branch — see tax-card.ts. */}
          <p className="m-0 text-body-sm">{orgProfileTh.tax.declaredReadOnly(view.vatRegistered)}</p>
          <p className="m-0 text-body-sm text-text-muted">{orgProfileTh.tax.declaredReadOnlyHint}</p>
        </div>
      )}

      {view.kind === "details" && (
        <div>
          {/* Label left, value right, a rule between — the same `DataRow` the
              shop card uses. This was a bare `<dl>`: label and value on
              alternating full-width lines with no column and no divider, so
              four facts read as eight unrelated ones. */}
          <DataRow label={orgProfileTh.tax.entityTypeLabel}>
            {view.entityType ? orgProfileTh.tax.entity[view.entityType] : "—"}
          </DataRow>

          <DataRow label={orgProfileTh.tax.taxIdLabel}>
            <span className="tabular-nums">{shown ?? view.taxIdMasked ?? "—"}</span>
          </DataRow>

          <DataRow label={orgProfileTh.tax.vatLabel}>
            {view.vatRegistered === null
              ? "—"
              : view.vatRegistered
                ? orgProfileTh.tax.vatYes
                : orgProfileTh.tax.vatNo}
          </DataRow>

          <DataRow label={orgProfileTh.tax.branchLabel}>
            <span className="tabular-nums">
              {view.branchCode === "00000"
                ? orgProfileTh.tax.branchHeadOffice
                : (view.branchCode ?? "—")}
            </span>
          </DataRow>

          <div className="mt-4 space-y-2">
            {throttle.isActive ? (
              <>
                <ThrottleBanner remainingSeconds={throttle.remainingSeconds} />
                {/* §5: say what the user CAN still do — never a dead end. */}
                <p className="m-0 text-body-sm text-text-muted">
                  {orgProfileTh.tax.revealError.throttledHint}
                </p>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={press}
                  disabled={reveal.status === "loading"}
                  loading={reveal.status === "loading"}
                  loadingLabel={orgProfileTh.tax.revealLoading}
                >
                  {shown ? orgProfileTh.tax.hide : orgProfileTh.tax.reveal}
                </Button>
                {/* Before the press, not after — §5: "บอกก่อนกด ไม่ใช่แอบเก็บ". */}
                <p className="m-0 text-body-sm text-text-muted">
                  {orgProfileTh.tax.revealNotice}
                </p>
              </>
            )}

            {revealError && (
              <p role="alert" className="m-0 text-body-sm text-danger-text">
                {revealError}
              </p>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
