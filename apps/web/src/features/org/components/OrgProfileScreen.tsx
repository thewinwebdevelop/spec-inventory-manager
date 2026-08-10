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
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useActiveOrg } from "../../../lib/org/org-context";
import { orgKey } from "../../../lib/org/org-keys";
import { onboardingItems, CAPABILITY_MANAGE_ORG_SETTINGS } from "../tax-card";
import { orgProfileTh } from "../i18n";
import { TaxProfileCard } from "./TaxProfileCard";
import { TaxProfileDialog } from "./TaxProfileDialog";
import { RenameOrgDialog } from "./RenameOrgDialog";
import { LeaveOrgDialog } from "./LeaveOrgDialog";
import { CAPABILITY_MANAGE_MEMBERS } from "./AppShell";

export function OrgProfileScreen() {
  const org = useActiveOrg();
  const queryClient = useQueryClient();
  const [editingTax, setEditingTax] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // W-12 closed: S4's "ออกจากร้านนี้" link lands back on this route with
  // `?leave=1`, and the confirm opens here — where Staff can reach it (D-029).
  const [leaving, setLeaving] = useState(useSearchParams().get("leave") === "1");

  const canEditSettings = org.capabilities.has(CAPABILITY_MANAGE_ORG_SETTINGS);
  const canManageMembers = org.capabilities.has(CAPABILITY_MANAGE_MEMBERS);
  const onboarding = onboardingItems(org.profile, org.capabilities);
  const refetchProfile = () =>
    void queryClient.invalidateQueries({ queryKey: orgKey(org.orgId, "profile") });

  return (
    <main className="p-6">
      <h1 className="text-heading-md">{orgProfileTh.title}</h1>

      {onboarding && (
        <section className="mb-4 rounded-card border border-border-default p-4">
          <h2 className="text-heading-sm">{orgProfileTh.onboarding.title}</h2>
          <ul className="list-none p-0">
            {onboarding.inviteTeam && (
              <li>
                {orgProfileTh.onboarding.inviteTeam.text}{" "}
                <Link href={`/o/${org.orgId}/settings/members`}>
                  {orgProfileTh.onboarding.inviteTeam.cta}
                </Link>
              </li>
            )}
            {onboarding.declareTax && (
              <li>
                {orgProfileTh.onboarding.declareTax.text}{" "}
                <button type="button" className="underline" onClick={() => setEditingTax(true)}>
                  {orgProfileTh.onboarding.declareTax.cta}
                </button>
              </li>
            )}
            {onboarding.inviteBackupOwner && (
              <li>
                {orgProfileTh.onboarding.backupOwner.text}{" "}
                {/* §5: opens S7 with the Owner role preselected. W5 reads
                    `?role=owner`; until then the link still lands correctly on
                    the members screen. */}
                <Link href={`/o/${org.orgId}/settings/members?invite=1&role=owner`}>
                  {orgProfileTh.onboarding.backupOwner.cta}
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="mb-4 rounded-card border border-border-default p-4">
        <dl>
          <dt className="text-body-sm">{orgProfileTh.fields.name}</dt>
          <dd>
            {org.name}{" "}
            {canEditSettings && (
              <button type="button" className="underline" onClick={() => setRenaming(true)}>
                {orgProfileTh.fields.edit}
              </button>
            )}
          </dd>

          <dt className="text-body-sm">{orgProfileTh.fields.localeLabel}</dt>
          {/* Fixed THB + Asia/Bangkok in Phase 0 (D-013) — displayed, not editable. */}
          <dd>{orgProfileTh.fields.localeValue}</dd>

          <dt className="text-body-sm">{orgProfileTh.fields.team}</dt>
          <dd>
            {/* `counts` is a total, never a list — a Staff member seeing "4
                คน" is not a PDPA problem; seeing WHO would be (D-028). */}
            {canManageMembers ? (
              <Link href={`/o/${org.orgId}/settings/members`}>
                {orgProfileTh.fields.teamValue(
                  org.profile.counts.activeMembers,
                  org.profile.counts.pendingInvitations,
                )}
              </Link>
            ) : (
              orgProfileTh.fields.teamValue(org.profile.counts.activeMembers, 0)
            )}
          </dd>
        </dl>
      </section>

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
      <button type="button" className="text-body-sm underline" onClick={() => setLeaving(true)}>
        {orgProfileTh.leaveOrg}
      </button>

      {leaving && <LeaveOrgDialog onClose={() => setLeaving(false)} />}
      {renaming && <RenameOrgDialog currentName={org.name} onClose={() => setRenaming(false)} />}
      {editingTax && (
        <TaxProfileDialog profile={org.profile} onClose={() => setEditingTax(false)} />
      )}
    </main>
  );
}
