"use client";

/**
 * S4's inline rename (ux-wireframe §5, "แก้ไขชื่อร้าน").
 *
 * One field. The logo is deliberately absent: the contract accepts `null` and
 * nothing else until F-040 (M-4), so there is no upload control to design —
 * a shop's initial stands in for an avatar everywhere.
 */
import { useState } from "react";
import { useRenameOrganization } from "../api/use-org-mutations";
import { orgProfileTh } from "../i18n";
import { toApiFailure, failureMessage } from "../../../lib/api/error";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";

export function RenameOrgDialog({
  currentName,
  onClose,
}: {
  currentName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const rename = useRenameOrganization();

  const submit = () => {
    setError(null);
    rename.mutate(name, {
      onSuccess: onClose,
      onError: (err) => {
        const failure = toApiFailure(err);
        setError(
          failure.kind === "validation"
            ? (failure.fieldErrors.name ?? orgProfileTh.rename.invalid)
            : failureMessage(failure),
        );
      },
    });
  };

  return (
    <div role="dialog" aria-label={orgProfileTh.rename.title} className="space-y-3 rounded-card border border-border-default bg-surface p-card-padding shadow-card">
      <h3 className="text-heading-sm">{orgProfileTh.rename.title}</h3>
      <TextField
        label={orgProfileTh.fields.name}
        value={name}
        onChange={setName}
        disabled={rename.isPending}
        errorText={error ?? undefined}
      />
      {/* `.dialog .acts` — one right-aligned row, `space.3` between. */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button
          onClick={submit}
          disabled={rename.isPending}
          loading={rename.isPending}
          loadingLabel={orgProfileTh.rename.save}
        >
          {orgProfileTh.rename.save}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={rename.isPending}>
          {orgProfileTh.rename.cancel}
        </Button>
      </div>
    </div>
  );
}
