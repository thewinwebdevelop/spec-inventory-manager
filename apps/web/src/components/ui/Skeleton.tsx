/**
 * Skeleton shimmer — the mandated loading standard (design-system.md §2:
 * "Skeleton shimmer ... ไม่ใช่ spinner") for list-shaped data (session list,
 * ui.md §2.2).
 */
export function SkeletonRow() {
  return (
    <div
      data-testid="skeleton-row"
      className="mb-3 h-16 animate-shimmer rounded-card bg-surface-muted"
    />
  );
}

export function SessionListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-label="กำลังโหลด" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
