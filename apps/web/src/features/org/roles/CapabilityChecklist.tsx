"use client";

/**
 * `CapabilityChecklist` — R3 (ui.md §3, ux-wireframe R3 + §0.4).
 *
 * web: group headings are static (ui.md §5 "กลุ่มไม่พับ") — `type.label.sm`
 * `text.muted` + a `border.default` rule, `space.6` above / `space.2` below
 * (ui.md §3). Rows are `CheckboxRow` (whole row = tap target, ≥ 56px).
 *
 * Row states come from `buildChecklist` (role-form-model.ts): ticked / upcoming
 * badge / imply-lock ("มาพร้อมสิทธิ์จัดการ") / "คุณไม่มีสิทธิ์นี้". Locked and
 * disabled rows stay FOCUSABLE (`aria-disabled`) so a screen reader can read
 * the reason (ux §A). None of this is enforcement — the server decides.
 */
import { forwardRef } from "react";
import { Badge } from "../../../components/ui/Badge";
import { CheckboxRow } from "../../../components/ui/Checkbox";
import type { ChecklistView } from "./role-form-model";
import { roleFormTh } from "./i18n";

const T = roleFormTh.checklist;

export interface CapabilityChecklistProps {
  view: ChecklistView;
  /** Keys present on the role that this catalog cannot show (sent back on save). */
  unknownCount: number;
  /** "เลือกสิทธิ์อย่างน้อย 1 อย่าง" etc. — under the heading. */
  errorText?: string;
  disabled?: boolean;
  onToggle: (key: string, checked: boolean) => void;
}

export const CapabilityChecklist = forwardRef<HTMLElement, CapabilityChecklistProps>(
  function CapabilityChecklist({ view, unknownCount, errorText, disabled = false, onToggle }, ref) {
    return (
      <section ref={ref} aria-labelledby="capability-checklist-title" className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="capability-checklist-title" className="m-0 text-heading-sm">
            {T.title}
          </h2>
          <span aria-live="polite" className="text-body-sm text-text-muted tabular-nums">
            {T.selected(view.selectedCount, view.total)}
          </span>
        </div>
        {view.hasUpcoming && (
          <p className="m-0 mt-1 text-body-sm text-text-muted">{T.upcomingNote}</p>
        )}
        {errorText && (
          <p role="alert" className="m-0 mt-2 text-body-sm text-danger-text">
            {errorText}
          </p>
        )}

        {view.groups.map((group) => (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`cap-group-${group.key}`}
            className="mt-6"
          >
            <h3
              id={`cap-group-${group.key}`}
              className="m-0 mb-2 border-b border-border-default pb-2 text-label-sm text-text-muted"
            >
              {group.label}
            </h3>
            {group.rows.map((row) => {
              const blocked = disabled || row.locked || row.disabled;
              const reason = row.locked
                ? T.impliedReason
                : row.disabled
                  ? T.viewerLacks
                  : undefined;
              return (
                <CheckboxRow
                  key={row.key}
                  id={`cap-${row.key}`}
                  name="capabilities"
                  value={row.key}
                  checked={row.checked}
                  disabled={blocked}
                  label={row.label}
                  description={row.description}
                  badge={row.upcoming ? <Badge tone="neutral">{T.upcomingBadge}</Badge> : undefined}
                  reason={reason}
                  onChange={(checked) => onToggle(row.key, checked)}
                  className="-mx-4"
                />
              );
            })}
          </div>
        ))}

        {unknownCount > 0 && (
          <p className="m-0 mt-4 text-body-sm text-text-muted">{T.unknownExtra(unknownCount)}</p>
        )}
      </section>
    );
  },
);
