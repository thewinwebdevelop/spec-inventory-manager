"use client";

/**
 * S7 — เชิญสมาชิก (ux-wireframe §8).
 *
 * Two fields, and the role picker is the interesting one: an Admin must not be
 * able to OFFER the Owner role, because granting `full_access` is granting
 * ownership (C-1/D-028). That filtering is `assignableRoles`, tested
 * separately — the server refuses it regardless, so this is about not showing
 * a button that produces a 403.
 *
 * On success the caller receives the raw token exactly once and shows S8. This
 * component never stores it.
 */
import { useState } from "react";
import { useCreateInvitation } from "../api/use-member-mutations";
import { useRoles } from "../api/use-members";
import { assignableRoles } from "../member-actions";
import { useActiveOrg } from "../../../lib/org/org-context";
import { toApiFailure } from "../../../lib/api/error";
import { inviteFormTh, roleLabel } from "../i18n";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

export function InviteDialog({
  ownerRoleIds,
  defaultRoleId,
  onIssued,
  onClose,
}: {
  /** Role ids that carry `full_access`, resolved by the caller from capabilities. */
  ownerRoleIds: ReadonlySet<string>;
  /** D-030's "เชิญเจ้าของร้าน" arrives with the Owner role preselected. */
  defaultRoleId?: string;
  onIssued: (issued: { inviteUrl: string; email: string; expiresAt: string }) => void;
  onClose: () => void;
}) {
  const org = useActiveOrg();
  const roles = useRoles();
  const create = useCreateInvitation();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId ?? "");
  const [fieldError, setFieldError] = useState<{ email?: string; role?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);

  const offerable = assignableRoles(roles.data?.items ?? [], org.capabilities, ownerRoleIds);

  const submit = () => {
    setFieldError({});
    setBanner(null);
    if (!roleId) {
      // AC US-3 makes the role mandatory — there is no "invite them and decide
      // later", because the invitation IS the grant.
      setFieldError({ role: inviteFormTh.error.role });
      return;
    }
    create.mutate(
      { email, roleId },
      {
        onSuccess: (issued) =>
          onIssued({
            inviteUrl: issued.inviteUrl,
            email: issued.invitation.email,
            expiresAt: issued.invitation.expiresAt,
          }),
        onError: (err) => {
          const failure = toApiFailure(err);
          if (failure.kind === "validation") {
            setFieldError({ email: failure.fieldErrors.email ?? inviteFormTh.error.email });
            return;
          }
          if (failure.kind === "conflict") {
            // D-027: `INVITATION_PENDING` must offer a next step, never a wall.
            const message =
              failure.code === "ALREADY_MEMBER"
                ? inviteFormTh.error.alreadyMember
                : failure.code === "INVITATION_PENDING"
                  ? inviteFormTh.error.pending
                  : failure.code === "INVITATION_LIMIT_REACHED"
                    ? inviteFormTh.error.limitReached
                    : inviteFormTh.error.generic;
            setBanner(message);
            return;
          }
          setBanner(inviteFormTh.error.generic);
        },
      },
    );
  };

  return (
    <div role="dialog" aria-label={inviteFormTh.title} className="rounded-card border border-border-default p-4">
      <h3 className="text-heading-sm">{inviteFormTh.title}</h3>
      {banner && <ErrorBanner message={banner} />}

      <TextField
        label={inviteFormTh.emailLabel}
        value={email}
        onChange={setEmail}
        type="email"
        placeholder={inviteFormTh.emailPlaceholder}
        disabled={create.isPending}
        errorText={fieldError.email}
      />

      <fieldset>
        <legend className="text-body-sm">{inviteFormTh.roleLabel}</legend>
        {offerable.map((role) => (
          <label key={role.id} className="block">
            <input
              type="radio"
              name="roleId"
              checked={roleId === role.id}
              onChange={() => setRoleId(role.id)}
              disabled={create.isPending}
            />
            {roleLabel(role.key, role.name)}
          </label>
        ))}
        {fieldError.role && (
          <p role="alert" className="text-body-sm text-danger-text">
            {fieldError.role}
          </p>
        )}
      </fieldset>

      <Button
        onClick={submit}
        disabled={create.isPending}
        loading={create.isPending}
        loadingLabel={inviteFormTh.submitLoading}
      >
        {inviteFormTh.submit}
      </Button>
      <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
        {inviteFormTh.cancel}
      </Button>
    </div>
  );
}
