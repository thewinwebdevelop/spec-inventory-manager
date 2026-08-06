"use client";

/**
 * S3's shop switcher (ux-wireframe §4).
 *
 * Switching is a NAVIGATION, not a state write — `/o/org_1/x` → `/o/org_2/x`.
 * That is what makes two tabs on two shops work with no sync logic, and what
 * guarantees no query keyed for the old shop is ever read again (web.md
 * §3.2). Mobile does the opposite (one `activeOrgId`) because it has one
 * instance and no per-screen URL.
 *
 * The current shop is marked with text, not colour alone — `aria-current` plus
 * a visible label, per §4's "อ่านออกด้วยข้อความ ไม่ใช่สีอย่างเดียว".
 *
 * A failure to load the list degrades INSIDE the dropdown; it must not take
 * the page down, because the page itself is fine (§4 States).
 */
import Link from "next/link";
import { useMyOrganizations, activeOrganizations } from "../api/use-my-organizations";
import { useActiveOrg } from "../../../lib/org/org-context";
import { orgTh, roleLabel } from "../i18n";
import { CREATE_ORG_PATH } from "./SelectOrgScreen";

export function OrgSwitcher() {
  const active = useActiveOrg();
  const query = useMyOrganizations();
  const items = activeOrganizations(query.data);

  return (
    <details className="mb-4">
      <summary className="cursor-pointer rounded-card border border-border-default p-3">
        <span className="font-semibold">{active.name}</span>
        <span className="block text-body-sm">
          {roleLabel(active.roleKey, active.roleName)}
        </span>
      </summary>

      <div className="mt-2 rounded-card border border-border-default p-2">
        <p className="px-2 text-body-sm">{orgTh.shell.switcher.label}</p>

        {query.isError ? (
          <div className="p-2 text-body-sm">
            {orgTh.shell.switcher.error}{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              {orgTh.shell.switcher.retry}
            </button>
          </div>
        ) : (
          <ul className="list-none p-0">
            {items.map((item) => {
              const isCurrent = item.organization.id === active.orgId;
              return (
                <li key={item.organization.id}>
                  <Link
                    href={`/o/${item.organization.id}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className="flex items-center justify-between gap-3 p-2 no-underline"
                  >
                    <span>
                      {item.organization.name}
                      {/* The text half of "not colour alone". */}
                      {isCurrent && (
                        <span className="ml-2 text-body-sm">({orgTh.shell.switcher.current})</span>
                      )}
                    </span>
                    <span className="text-body-sm">
                      {roleLabel(item.membership.roleKey, item.membership.roleName)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link href={CREATE_ORG_PATH} className="block p-2">
          {orgTh.shell.switcher.createShop}
        </Link>
      </div>
    </details>
  );
}
