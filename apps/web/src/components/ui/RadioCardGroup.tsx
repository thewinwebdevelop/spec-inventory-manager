/**
 * `RadioCardGroup` — ui.md §2.1, one of the seven components F-002 was
 * supposed to contribute to the design system and never built.
 *
 * The screens that need it (S5 tax profile, S7 invite, S9 change role) shipped
 * with bare `<fieldset><label><input type="radio">` and no layout at all: a
 * 13px native dot, the label jammed against it, no tap target, no card, no
 * room for the "why is this disabled" sentence the spec requires.
 *
 * Spec, verbatim: cards stacked with `space.2`; the selected one has a 2px
 * `color.primary` border on `surface`; a disabled one is 60% opacity with a
 * `type.body.sm` `text.muted` helper saying why; and the WHOLE card is the tap
 * target, at least `size.tap-target.min` tall.
 */
import { cn } from "./utils";

export interface RadioCardOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
  /** Shown when disabled — the spec asks for the reason, not just the state. */
  readonly disabledReason?: string;
}

export function RadioCardGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly RadioCardOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("m-0 border-0 p-0", className)}>
      <legend className="mb-2 p-0 text-label-sm text-text-muted">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-card border bg-surface px-4 py-3",
                "min-h-[var(--size-tap-target-min)]",
                selected
                  ? "border-2 border-primary"
                  : "border border-border-default hover:bg-surface-muted",
                option.disabled && "cursor-not-allowed opacity-60 hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 flex-none accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-body-md">{option.label}</span>
                {option.description && (
                  <span className="block text-body-sm text-text-muted">{option.description}</span>
                )}
                {option.disabled && option.disabledReason && (
                  <span className="block text-body-sm text-text-muted">
                    {option.disabledReason}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
