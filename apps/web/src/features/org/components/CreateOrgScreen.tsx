"use client";

/**
 * S2 — สร้างร้านใหม่ (ux-wireframe §3).
 *
 * One field, on purpose: the server binds the plan and the timezone/currency
 * defaults, so there is nothing else to ask. The submit button disables while
 * in flight because there is no `Idempotency-Key` yet — a double click is a
 * second shop, and that is the whole reason the wireframe calls it out.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateOrganization } from "../api/use-create-organization";
import { toCreateOrgError, type CreateOrgError } from "../create-org-error";
import { orgTh } from "../i18n";
import { errorsTh } from "../../../i18n/errors";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { ThrottleBanner } from "../../../components/ui/ThrottleBanner";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";

export const SELECT_ORG_PATH = "/select-org";

export function CreateOrgScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<CreateOrgError | null>(null);
  const throttle = useThrottleCountdown();
  const create = useCreateOrganization();

  const submit = () => {
    setError(null);
    create.mutate(name, {
      onSuccess: (created) => {
        // ux Q5: straight into the new shop. The toast belongs to the
        // destination, so it travels as a query param rather than being
        // rendered here on a screen that is about to unmount.
        router.replace(
          `/o/${created.organization.id}?created=${encodeURIComponent(created.organization.name)}`,
        );
      },
      onError: (err) => {
        const mapped = toCreateOrgError(err);
        if (mapped.kind === "throttled") throttle.start(mapped.retryAfterSeconds);
        setError(mapped);
      },
    });
  };

  const blocked = create.isPending || throttle.isActive;

  return (
    <main className="mx-auto w-full max-w-[480px] p-6">
      <Link href={SELECT_ORG_PATH}>{orgTh.createOrg.back}</Link>
      <h1 className="text-heading-md">{orgTh.createOrg.title}</h1>

      {throttle.isActive && <ThrottleBanner remainingSeconds={throttle.remainingSeconds} />}

      {error?.kind === "banner" && (
        <ErrorBanner
          message={error.message}
          onRetry={error.retry ? submit : undefined}
          retryLabel={errorsTh.retry}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) submit();
        }}
      >
        <TextField
          label={orgTh.createOrg.name.label}
          value={name}
          onChange={setName}
          placeholder={orgTh.createOrg.name.placeholder}
          disabled={blocked}
          errorText={error?.kind === "field" ? error.message : undefined}
        />
        <p className="mb-4 text-body-sm">{orgTh.createOrg.name.helper}</p>

        <p className="mb-6 rounded-card border border-border-default bg-surface-muted p-4 text-body-sm">
          {orgTh.createOrg.explainer}
        </p>

        <Button
          type="submit"
          fullWidth
          disabled={blocked}
          loading={create.isPending}
          loadingLabel={orgTh.createOrg.submitLoading}
        >
          {orgTh.createOrg.submit}
        </Button>
      </form>
    </main>
  );
}
