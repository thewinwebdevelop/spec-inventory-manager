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
    /**
     * ★ `relative` + an ABSOLUTE panel — the mockup's `.orgwrap`/`.dd`.
     *
     * The panel was in normal flow, so opening the switcher pushed the whole
     * nav down the page instead of floating over it. The mockup is explicit:
     * `position:absolute; top:calc(100% + 6px); width:290px;
     *  box-shadow:var(--shadow-dialog); z-index:40`.
     */
    <details className="group relative">
      {/* The mockup's switcher is a CONTROL — bordered, with the shop's initial
          and a chevron that turns — not a paragraph you discover is clickable.
          `list-none` removes the native disclosure triangle, which was the
          only affordance it had. */}
      <summary className="flex min-h-[var(--size-tap-target-min)] cursor-pointer list-none items-center gap-2.5 rounded-button border border-border-default bg-surface px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-badge bg-surface-muted text-label-sm font-semibold text-text-muted"
        >
          {active.name.trim().charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{active.name}</span>
        <span className="block text-body-sm text-text-muted">
          {roleLabel(active.roleKey, active.roleName)}
        </span>
        </span>
        <span aria-hidden="true" className="flex-none text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[290px] rounded-card border border-border-default bg-surface p-1.5 shadow-dialog">
        <p className="m-0 px-2 py-1 text-body-sm text-text-muted">{orgTh.shell.switcher.label}</p>

        {query.isError ? (
          <div className="p-2 text-body-sm">
            {orgTh.shell.switcher.error}{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              {orgTh.shell.switcher.retry}
            </button>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((item) => {
              const isCurrent = item.organization.id === active.orgId;
              return (
                <li key={item.organization.id}>
                  <Link
                    href={`/o/${item.organization.id}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className="flex min-h-[var(--size-list-row-min-h)] items-center gap-2.5 rounded-button px-2.5 py-2 text-text no-underline hover:bg-surface-muted"
                  >
                    {/* `.ck` — a 20px slot that is always there, so the names
                        line up whether or not a row is the current one. */}
                    <span aria-hidden="true" className="flex w-5 flex-none items-center text-primary">
                      {isCurrent ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {item.organization.name}
                      {/* The text half of "not colour alone". */}
                      {isCurrent && (
                        <span className="ml-2 text-body-sm text-text-muted">
                          ({orgTh.shell.switcher.current})
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-body-sm text-text-muted">
                      {roleLabel(item.membership.roleKey, item.membership.roleName)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* `.sep` then the create row — the mockup separates "which shop" from
            "make a new one", because they are different kinds of action. */}
        <div className="mx-1 my-1.5 h-px bg-border-default" />
        <Link
          href={CREATE_ORG_PATH}
          className="flex min-h-[var(--size-list-row-min-h)] items-center gap-2.5 rounded-button px-2.5 py-2 text-text no-underline hover:bg-surface-muted"
        >
          <span aria-hidden="true" className="flex w-5 flex-none items-center text-primary">
            +
          </span>
          <span className="flex-1">{orgTh.shell.switcher.createShop}</span>
        </Link>
      </div>
    </details>
  );
}
