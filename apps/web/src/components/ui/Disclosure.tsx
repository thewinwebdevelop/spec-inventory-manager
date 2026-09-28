/**
 * `Disclosure` — ui.md §2.2 (F-003). A collapsible section heading, promoted
 * to the design system because it repeats: the checklist on mobile (F-003),
 * channel settings (F-020), order detail (F-024).
 *
 * The whole row is one `button`, at least `size.list-row.min-h` (56px) tall —
 * not a chevron-only hit target. Open/closed state is controlled by the
 * caller (each screen decides its own default, per spec).
 */
import { Icon } from "./Icon";
import { cn } from "./utils";

export interface DisclosureProps {
  id: string;
  /** Group heading, e.g. "ทีมงาน". */
  title: string;
  selectedCount: number;
  totalCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Disclosure({
  id,
  title,
  selectedCount,
  totalCount,
  open,
  onOpenChange,
  children,
  className,
}: DisclosureProps) {
  const panelId = `${id}-panel`;

  return (
    <div className={className}>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${title}, เลือก ${selectedCount} จาก ${totalCount}`}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex min-h-[var(--size-list-row-min-h)] w-full items-center justify-between gap-3",
          "border-b border-border-default px-4 py-3 text-left hover:bg-surface-muted",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            role="chevron-down"
            aria-hidden="true"
            className={cn(
              "flex-none transition-transform duration-150 ease-out motion-reduce:transition-none",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="truncate text-button-md text-text">{title}</span>
        </span>
        <span className="flex-none text-body-sm text-text-muted">
          เลือก {selectedCount} จาก {totalCount}
        </span>
      </button>
      <div id={panelId} role="region" aria-labelledby={id} hidden={!open} className="px-4">
        {children}
      </div>
    </div>
  );
}
