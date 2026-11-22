/**
 * `CapabilityReadList` (ui.md §3) — R4: what a role grants, as a LIST, not as
 * disabled checkboxes (ux §A: a disabled checkbox reads as "why can't I press
 * this?").
 *
 *  - granted: `icon.check` + the label (+ "ให้" for a screen reader)
 *  - not granted: "–" + the label in `text.muted` + the TEXT "ไม่ได้ให้" on the
 *    right — colour is never the only signal (ux R4)
 *  - "เร็ว ๆ นี้" Badge kept · a row implied by another grant reads ✓ +
 *    "มาพร้อมสิทธิ์จัดการ"
 *  - keys the catalog does not know → one "และสิทธิ์อื่นอีก n รายการ…" line
 *  - the Owner (`grantsOwnership`, derived by the server from `full_access` —
 *    never from `key`) → ONE card instead of the list (ui.md §3 card spec)
 *
 * Labels/descriptions come from `GET /capabilities` only (D-037). Rows are not
 * interactive, so they size to their content (ui.md §3: no 44px rule).
 */
import { Badge } from "../../../components/ui/Badge";
import { Icon } from "../../../components/ui/Icon";
import { CAPABILITY_FULL_ACCESS } from "../../../lib/org/capability";
import { roleFormTh, roleReadOnlyTh } from "./i18n";
import { buildChecklist, initialSelection } from "./role-form-model";
import type { CapabilityCatalog } from "./api/use-role-details";

export function CapabilityReadList({
  capabilities,
  grantsOwnership,
  catalog,
}: {
  capabilities: readonly string[];
  grantsOwnership: boolean;
  catalog: CapabilityCatalog;
}) {
  const fullAccess = grantsOwnership
    ? catalog.items.find((i) => i.key === CAPABILITY_FULL_ACCESS)
    : undefined;
  if (fullAccess) {
    return (
      <div className="flex items-start gap-3 rounded-card bg-surface-muted p-4">
        <Icon role="check" className="mt-0.5" />
        <div className="min-w-0">
          <p className="m-0 text-body-md">{fullAccess.labelTh}</p>
          <p className="m-0 text-body-sm text-text-muted">{fullAccess.descriptionTh}</p>
        </div>
      </div>
    );
  }

  const { selection, passthrough } = initialSelection(capabilities, catalog);
  // Read-only: nothing is "disabled because you lack it" here — every row is just shown.
  const view = buildChecklist(catalog, selection, () => true);

  return (
    <div className="flex flex-col">
      {view.groups.map((group, i) => (
        <div key={group.key} className={i === 0 ? undefined : "mt-6"}>
          <h3 className="m-0 mb-2 border-b border-border-default pb-2 text-label-sm text-text-muted">
            {group.label}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {group.rows.map((row) => (
              <li key={row.key} className="flex items-start justify-between gap-3 text-body-md">
                <span
                  className={
                    row.checked
                      ? "flex min-w-0 items-start gap-2"
                      : "flex min-w-0 items-start gap-2 text-text-muted"
                  }
                >
                  {row.checked ? (
                    <Icon role="check" className="mt-0.5" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="w-[var(--size-icon-md)] flex-none text-center"
                    >
                      –
                    </span>
                  )}
                  <span className="min-w-0">
                    {row.label}
                    {row.upcoming && (
                      <Badge tone="neutral" className="ml-2">
                        {roleFormTh.checklist.upcomingBadge}
                      </Badge>
                    )}
                    {row.locked && (
                      <span className="block text-body-sm text-text-muted">
                        {roleFormTh.checklist.impliedReason}
                      </span>
                    )}
                  </span>
                </span>
                {row.checked ? (
                  <span className="sr-only">{roleReadOnlyTh.granted}</span>
                ) : (
                  // body.sm (22px line) beside body.md (26px): 2px down shares the baseline.
                  <span className="mt-0.5 flex-none text-body-sm text-text-muted">
                    {roleReadOnlyTh.notGranted}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {passthrough.length > 0 && (
        <p className="m-0 mt-4 text-body-sm text-text-muted">
          {roleFormTh.checklist.unknownExtra(passthrough.length)}
        </p>
      )}
    </div>
  );
}
