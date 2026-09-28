/**
 * `Checkbox` + `CheckboxRow` — ui.md §2.1 (F-003), promoted to the design
 * system because every "select many" screen (bulk product select F-092,
 * channel settings, filters) needs it and a one-off per feature is how this
 * drifts.
 *
 * `Checkbox` is the BOX ONLY — spec is explicit it is never used alone, only
 * inside `CheckboxRow` (or an equivalent labelled wrapper), so it takes no
 * label prop and renders no text.
 *
 * Four states, no `opacity` anywhere (ui.md §2.1 table + ⛔ note):
 *   - empty            — `Checkbox checked={false}`
 *   - checked          — `Checkbox checked={true}`
 *   - disabled+checked — `Checkbox checked disabled` (also covers "imply-lock")
 *   - disabled+empty   — `Checkbox disabled`
 *
 * `disabled` here is deliberately NOT the native `disabled` attribute — the
 * spec requires the row to stay focusable so a screen reader can still read
 * the reason line next to it ("ยังโฟกัสได้ (ให้ screen reader อ่านเหตุผล)").
 * The native attribute would remove the control from the tab order entirely,
 * so this uses `aria-disabled` + a guard in the change/click/keydown handlers
 * instead — the same technique `RadioCardGroup`'s sibling `disabledReason`
 * pattern assumes but a checkbox needs to implement itself.
 */
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { cn } from "./utils";

export interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  value?: string;
  onChange?: (checked: boolean) => void;
  /** Wires the row's label/description/reason text via `aria-describedby`. */
  "aria-describedby"?: string;
  className?: string;
}

export function Checkbox({
  checked,
  disabled = false,
  id,
  name,
  value,
  onChange,
  "aria-describedby": ariaDescribedBy,
  className,
}: CheckboxProps) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-none",
        "h-[var(--size-checkbox)] w-[var(--size-checkbox)]",
        className,
      )}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        aria-disabled={disabled || undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          if (disabled) return;
          onChange?.(event.target.checked);
        }}
        onClick={(event) => {
          // aria-disabled (not the native attribute) blocks interaction by
          // hand — see the file header for why it must stay focusable.
          if (disabled) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (disabled && (event.key === " " || event.key === "Enter")) {
            event.preventDefault();
          }
        }}
        className={cn(
          "peer absolute inset-0 m-0 h-full w-full appearance-none opacity-0",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      />
      <Box checked={checked} disabled={disabled} />
    </span>
  );
}

function Box({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  let mark: ReactNode = null;
  if (checked) {
    mark = <Icon role="check" size="sm" className="h-3.5 w-3.5" />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex h-full w-full items-center justify-center",
        "rounded-checkbox border-[length:var(--checkbox-border-w)] transition-colors",
        // ⚠️ `border-primary`, NOT `border-btn-bg` — design-system.md §1.3/§9.1
        // and the ⛔ note at §1.1c-3 are explicit that `color.primary` and
        // `btn.bg` are the SAME value in light but MUST diverge in dark
        // (`#2FBBA6` vs `#0A5A45`); the box needs a border that is visible
        // against its own fill in both themes, which is exactly what that
        // divergence is for.
        checked && !disabled && "border-primary bg-btn-bg text-btn-fg",
        checked && disabled && "border-border-default bg-surface-muted text-text-muted",
        !checked && disabled && "border-border-default bg-surface-muted",
        !checked &&
          !disabled &&
          cn(
            "bg-surface",
            // ui.md §2.1 "ว่าง" row — the outline-button border formula
            // (design-system.md §1.1c), composed from existing color tokens
            // only. No new hex.
            "border-[color-mix(in_srgb,var(--color-text-muted)_60%,var(--color-border-default))]",
            "peer-hover:border-primary",
          ),
      )}
    >
      {mark}
    </span>
  );
}

export interface CheckboxRowProps {
  checked: boolean;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
  /** e.g. `<Badge tone="neutral">เร็ว ๆ นี้</Badge>` */
  badge?: ReactNode;
  /** Lock/disabled reason line — rendered with `icon.lock`. */
  reason?: ReactNode;
  id?: string;
  name?: string;
  value?: string;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export function CheckboxRow({
  checked,
  disabled = false,
  label,
  description,
  badge,
  reason,
  id,
  name,
  value,
  onChange,
  className,
}: CheckboxRowProps) {
  const descriptionId = description && id ? `${id}-description` : undefined;
  const reasonId = reason && id ? `${id}-reason` : undefined;
  const describedBy = [descriptionId, reasonId].filter(Boolean).join(" ") || undefined;

  return (
    <label
      className={cn(
        "flex min-h-[var(--size-list-row-min-h)] cursor-pointer items-start gap-3 px-4 py-3",
        "has-[:focus-visible]:ring-[length:var(--focus-ring-w)] has-[:focus-visible]:ring-primary",
        "has-[:focus-visible]:ring-offset-[length:var(--focus-ring-offset)]",
        disabled ? "cursor-default" : "hover:bg-surface-muted",
        className,
      )}
    >
      <span className="mt-0.5">
        <Checkbox
          checked={checked}
          disabled={disabled}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          aria-describedby={describedBy}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-body-md text-text">
          {label}
          {badge}
        </span>
        {description && (
          <span id={descriptionId} className="block text-body-sm text-text-muted">
            {description}
          </span>
        )}
        {reason && (
          <span id={reasonId} className="mt-1 flex items-center gap-1 text-body-sm text-text-muted">
            <Icon role="lock" size="sm" aria-hidden="true" />
            {reason}
          </span>
        )}
      </span>
    </label>
  );
}
