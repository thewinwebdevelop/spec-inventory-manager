"use client";

/**
 * S4 — ข้อมูลร้าน (ux-wireframe §5). Phase 0's shop home page, since F-030's
 * dashboard does not exist yet.
 *
 * The profile is already loaded by `OrgGuard` (it is what decided the caller
 * may be here), so this screen reads it from `useActiveOrg()` rather than
 * fetching it again.
 */
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useActiveOrg } from "../../../lib/org/org-context";
import { can } from "../../../lib/org/capability";
import { orgKey } from "../../../lib/org/org-keys";
import { onboardingItems, CAPABILITY_MANAGE_ORG_SETTINGS } from "../tax-card";
import { orgProfileTh } from "../i18n";
import { SectionCard } from "../../../components/ui/SectionCard";
import { DataRow } from "../../../components/ui/DataRow";
import { Banner } from "../../../components/ui/Banner";
import { Icon } from "../../../components/ui/Icon";
import { Button } from "../../../components/ui/Button";
import { TaxProfileCard } from "./TaxProfileCard";
import { TaxProfileDialog } from "./TaxProfileDialog";
import { RenameOrgDialog } from "./RenameOrgDialog";
import { LeaveOrgDialog } from "./LeaveOrgDialog";
import { CAPABILITY_MANAGE_MEMBERS } from "./AppShell";

export function OrgProfileScreen() {
  const org = useActiveOrg();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingTax, setEditingTax] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // W-12 closed: S4's "ออกจากร้านนี้" link lands back on this route with
  // `?leave=1`, and the confirm opens here — where Staff can reach it (D-029).
  const [leaving, setLeaving] = useState(useSearchParams().get("leave") === "1");

  // ★ `can`, not `.has`: an Owner's role carries `full_access` alone, so a set
  // lookup told the Owner they could not rename their own shop (capability.ts).
  const canEditSettings = can(org.capabilities, CAPABILITY_MANAGE_ORG_SETTINGS);
  const canManageMembers = can(org.capabilities, CAPABILITY_MANAGE_MEMBERS);
  const onboarding = onboardingItems(org.profile, org.capabilities);
  const refetchProfile = () =>
    void queryClient.invalidateQueries({ queryKey: orgKey(org.orgId, "profile") });

  return (
    <main className="flex flex-col gap-4 p-card-padding">
      <h1 className="m-0 text-heading-md">{orgProfileTh.title}</h1>

      {onboarding && (
        /* The mockup makes this a tone-`info` Banner: it is guidance, not a
           status, and not a section of the shop's data. */
        <Banner
          tone="info"
          icon={<Icon role="info" size="md" />}
          /* ★ §8.4 item 2, measured: the three CTAs were links INSIDE the
             sentences at 17–18px tall. "ทุกอย่างที่กดได้สูง ≥ 44px ไม่มีข้อยกเว้น"
             cannot be met by a link mid-sentence, and the mockup does not ask
             it to — `.banner .acts` is a row of controls BELOW the text. */
          actions={
            <>
              {onboarding.inviteTeam && (
                <Button
                  variant="tertiary"
                  onClick={() => router.push(`/o/${org.orgId}/settings/members`)}
                >
                  {orgProfileTh.onboarding.inviteTeam.cta}
                </Button>
              )}
              {onboarding.declareTax && (
                <Button variant="tertiary" onClick={() => setEditingTax(true)}>
                  {orgProfileTh.onboarding.declareTax.cta}
                </Button>
              )}
              {onboarding.inviteBackupOwner && (
                /* §5: opens S7 with the Owner role preselected. W5 reads
                   `?role=owner`; until then it still lands on the members
                   screen correctly. */
                <Button
                  variant="tertiary"
                  onClick={() =>
                    router.push(`/o/${org.orgId}/settings/members?invite=1&role=owner`)
                  }
                >
                  {orgProfileTh.onboarding.backupOwner.cta}
                </Button>
              )}
            </>
          }
        >
          <p className="m-0 mb-2 text-heading-sm">{orgProfileTh.onboarding.title}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {onboarding.inviteTeam && <li>{orgProfileTh.onboarding.inviteTeam.text}</li>}
            {onboarding.declareTax && <li>{orgProfileTh.onboarding.declareTax.text}</li>}
            {onboarding.inviteBackupOwner && (
              <li>{orgProfileTh.onboarding.backupOwner.text}</li>
            )}
          </ul>
        </Banner>
      )}

      <SectionCard>
        <DataRow
          label={orgProfileTh.fields.name}
          action={
            canEditSettings && (
              <Button variant="secondary" size="sm" onClick={() => setRenaming(true)}>
                {orgProfileTh.fields.edit}
              </Button>
            )
          }
        >
          {org.name}
        </DataRow>

        {/* Fixed THB + Asia/Bangkok in Phase 0 (D-013) — displayed, not editable. */}
        <DataRow label={orgProfileTh.fields.localeLabel}>
          {orgProfileTh.fields.localeValue}
        </DataRow>

        <DataRow label={orgProfileTh.fields.team}>
          {/* `counts` is a total, never a list — a Staff member seeing "4 คน"
              is not a PDPA problem; seeing WHO would be (D-028). */}
          {canManageMembers ? (
            <Link
              className="inline-flex min-h-[var(--size-tap-target-min)] items-center gap-1 font-semibold text-primary no-underline hover:underline"
              href={`/o/${org.orgId}/settings/members`}
            >
              {orgProfileTh.fields.teamValue(
                org.profile.counts.activeMembers,
                org.profile.counts.pendingInvitations,
              )}
              <Icon role="chevron-right" size="sm" />
            </Link>
          ) : (
            orgProfileTh.fields.teamValue(org.profile.counts.activeMembers, 0)
          )}
        </DataRow>
      </SectionCard>

      <TaxProfileCard
        profile={org.profile}
        capabilities={org.capabilities}
        onEdit={() => setEditingTax(true)}
        onProfileStale={refetchProfile}
      />

      {/* §5/D-029: a text link, low in the page, away from other buttons.
          Every ACTIVE MEMBER can leave a shop — including Staff, who cannot
          open the members screen. That is precisely why the affordance lives
          here and not there, so the link must stay on THIS route: pointing it
          at the members screen would send a Staff member to a 403 for an
          action they are entitled to take. The confirm (§10.3) opens right
          here; `?leave=1` still works as a deep link into it. */}
      <div className="mt-2">
        <Button variant="tertiary" onClick={() => setLeaving(true)}>
          {orgProfileTh.leaveOrg}
        </Button>
      </div>

      {leaving && <LeaveOrgDialog onClose={() => setLeaving(false)} />}
      {renaming && <RenameOrgDialog currentName={org.name} onClose={() => setRenaming(false)} />}
      {editingTax && (
        <TaxProfileDialog profile={org.profile} onClose={() => setEditingTax(false)} />
      )}
    </main>
  );
}
