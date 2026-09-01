"use client";

/**
 * S5 — ข้อมูลผู้เสียภาษี (ux-wireframe §6).
 *
 * `PUT` is THE WHOLE SET OR NOTHING (data-model §3.3), so the form always
 * sends every field. Which creates the problem §6 solves explicitly: to edit
 * an existing declaration the form needs the CURRENT tax id, and the only
 * place that number exists is `POST …/tax-profile/reveal` — it is not on
 * `GET /orgs/{orgId}` and never will be.
 *
 * So opening in edit mode spends one reveal (counting against the same
 * 20/hour budget as S4's button). And when that request fails — throttled,
 * offline — the form must NOT become unusable: §6 says leave the field empty
 * and tell the user plainly that they will have to retype the number, rather
 * than letting them fill everything in and discover it at save time.
 *
 * The typed number lives in component state and dies with the dialog. It is
 * never written to a query cache: the save response carries `taxIdMasked`
 * only, which is what makes writing THAT response safe.
 */
import { useEffect, useState } from "react";
import { useRevealTaxId } from "../api/use-reveal-tax-id";
import { useSaveTaxProfile, type TaxProfileRequest } from "../api/use-org-mutations";
import type { OrgProfile } from "../tax-card";
import { taxFormTh } from "../i18n";
import { toApiFailure } from "../../../lib/api/error";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

type EntityType = "personal" | "company";

export function TaxProfileDialog({
  profile,
  onClose,
}: {
  profile: OrgProfile;
  onClose: () => void;
}) {
  const editing = profile.taxProfileComplete;
  const [entityType, setEntityType] = useState<EntityType>(
    profile.taxProfile?.entityType ?? "company",
  );
  const [taxId, setTaxId] = useState("");
  const [vatRegistered, setVatRegistered] = useState(profile.taxProfile?.vatRegistered ?? false);
  const [branchCode, setBranchCode] = useState(profile.taxProfile?.branchCode ?? "");
  const [fieldError, setFieldError] = useState<{ taxId?: string; branchCode?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [revealUnavailable, setRevealUnavailable] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reveal = useRevealTaxId();
  const save = useSaveTaxProfile();

  useEffect(() => {
    if (!editing) return;
    reveal.mutate(undefined, {
      onSuccess: (data) => setTaxId(data.taxId),
      // Not a dead end: the field stays empty and says why (§6).
      onError: () => setRevealUnavailable(true),
    });
    // Deps are `[editing]` only, on purpose: `reveal` is a new object every
    // render, and including it would spend one of the user's 20 hourly
    // reveals — and emit one audit event — per re-render.
  }, [editing]);

  const doSave = () => {
    setFieldError({});
    setBanner(null);
    const body: TaxProfileRequest = {
      entityType,
      taxId,
      vatRegistered,
      // A personal taxpayer has no branch — §6 hides the field entirely, so
      // it must not be sent either.
      ...(entityType === "company" && branchCode ? { branchCode } : {}),
    };
    save.mutate(body, {
      onSuccess: onClose,
      onError: (err) => {
        const failure = toApiFailure(err);
        if (failure.kind === "validation") {
          setFieldError({
            taxId: failure.fieldErrors.taxId ?? (failure.code === "TAX_ID_INVALID" ? taxFormTh.error.taxId : undefined),
            branchCode: failure.fieldErrors.branchCode,
          });
          return;
        }
        if (failure.kind === "forbidden") {
          setBanner(taxFormTh.error.forbidden);
          return;
        }
        setBanner(taxFormTh.error.generic);
      },
    });
  };

  const submit = () => {
    // §6: overwriting an existing declaration is confirmed first — a shop has
    // exactly one, so this replaces rather than adds.
    if (editing && !confirming) {
      setConfirming(true);
      return;
    }
    doSave();
  };

  return (
    <div role="dialog" aria-label={taxFormTh.title} className="space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card">
      <h3 className="text-heading-sm">{taxFormTh.title}</h3>

      {banner && <ErrorBanner message={banner} />}

      <fieldset>
        <legend className="text-body-sm">{taxFormTh.entityLabel}</legend>
        <label>
          <input
            type="radio"
            name="entityType"
            checked={entityType === "personal"}
            onChange={() => setEntityType("personal")}
          />
          {taxFormTh.personal}
        </label>
        <label>
          <input
            type="radio"
            name="entityType"
            checked={entityType === "company"}
            onChange={() => setEntityType("company")}
          />
          {taxFormTh.company}
        </label>
      </fieldset>

      {/* Visible WHILE the number is being typed, not after — for a personal
          taxpayer these 13 digits are a national ID. */}
      {entityType === "personal" && <p className="text-body-sm">{taxFormTh.personalHelper}</p>}

      <TextField
        label={taxFormTh.taxIdLabel}
        value={taxId}
        onChange={setTaxId}
        disabled={reveal.isPending || save.isPending}
        errorText={fieldError.taxId}
        // Never offer to remember a tax id / national ID (§6 a11y note).
        autoComplete="off"
      />
      {revealUnavailable && <p className="text-body-sm">{taxFormTh.revealUnavailable}</p>}

      <fieldset>
        <legend className="text-body-sm">{taxFormTh.vatLabel}</legend>
        <label>
          <input type="radio" name="vat" checked={vatRegistered} onChange={() => setVatRegistered(true)} />
          {taxFormTh.vatYes}
        </label>
        <label>
          <input type="radio" name="vat" checked={!vatRegistered} onChange={() => setVatRegistered(false)} />
          {taxFormTh.vatNo}
        </label>
      </fieldset>

      {/* §6: a personal taxpayer has no branch code — hide it, do not disable. */}
      {entityType === "company" && (
        <>
          <TextField
            label={taxFormTh.branchLabel}
            value={branchCode}
            onChange={setBranchCode}
            disabled={save.isPending}
            errorText={fieldError.branchCode}
            autoComplete="off"
          />
          <p className="text-body-sm">{taxFormTh.branchHelper}</p>
        </>
      )}

      <p className="text-body-sm">{taxFormTh.privacyNote}</p>

      {confirming && (
        <div role="alertdialog" aria-label={taxFormTh.overwriteConfirm.title}>
          <p>{taxFormTh.overwriteConfirm.title}</p>
          <p className="text-body-sm">{taxFormTh.overwriteConfirm.body}</p>
        </div>
      )}

      <Button
        onClick={submit}
        disabled={save.isPending}
        loading={save.isPending}
        loadingLabel={taxFormTh.saveLoading}
      >
        {confirming ? taxFormTh.overwriteConfirm.confirm : taxFormTh.save}
      </Button>
      <Button
        variant="secondary"
        onClick={confirming ? () => setConfirming(false) : onClose}
        disabled={save.isPending}
      >
        {taxFormTh.cancel}
      </Button>
    </div>
  );
}
